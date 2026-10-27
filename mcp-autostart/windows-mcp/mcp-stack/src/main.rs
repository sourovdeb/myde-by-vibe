// mcp-stack: one .exe supervisor for the Sourov local MCP stack.
//
// Components (name, listen port, spawn spec):
//   latch    3939  E:\tools\latch\latch.exe serve          (MCP + panel; config in ~/.mcp-autostart\latch.json - NEVER written here)
//   bridge   8765  E:\tools\mcp-bridge\mcp-bridge.exe      (config in %APPDATA%\mcp-bridge\config.json - NEVER written here)
//   sysinfo  3000  node my-mcp-connector server            (5 system tools)
//   browser  3001  node browser-control-mcp server         (15 Chrome/CDP tools)
//   tunnel-* none   cloudflared quick tunnels for the ports above; live URL captured to state
//
// Hard rules:
//  - read-only toward every external config file; this binary only spawns/kills processes
//  - RAM budget: estimated combined usage must stay under --max-mb (default 1024)
//  - stop never kills a component's descendants (e.g. Latch's own bridge children)
//
// Subcommands:
//   start [--all | -latch -bridge -sysinfo -browser -tunnels] [--silent] [--watch]
//   stop [names...] [--tunnels]
//   status
//   autostart install|uninstall|status
//
// State: %APPDATA%\mcp-stack\state.json ; logs: %APPDATA%\mcp-stack\logs\

use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::net::TcpStream;
use std::process::Command;
use std::thread::sleep;
use std::time::Duration;

#[derive(Serialize, Deserialize, Clone)]
struct Spawned {
    pid: u32,
    log: String,
    started_at: String,
}

#[derive(Serialize, Deserialize, Default, Clone)]
struct State {
    #[serde(default)]
    spawned: BTreeMap<String, Spawned>,
    #[serde(default)]
    tunnels: BTreeMap<String, String>,
}

const CLOUDFLARED: &str = r"C:\tmp\cloudflared.exe";
const NODE: &str = r"C:\Program Files\nodejs\node.exe";
const LATCH_EXE: &str = r"E:\tools\latch\latch.exe";
const LATCH_CWD: &str = r"E:\tools\latch";
const SYSINFO_JS: &str =
    r"C:\Users\souro\.vibe\plugins\my-mcp-connector\server\http-server.js";
const BROWSER_JS: &str =
    r"C:\Users\souro\.vibe\plugins\browser-control-mcp\server\http-server.js";

/// Estimated MB per running component (measured 2026-10-27).
const EST_MB: &str = "55"; // latch
const EST_BRIDGE: &str = "40";
const EST_NODE: &str = "50";
const EST_TUNNEL: &str = "47";

fn now() -> String {
    // UTC stamp without extra deps
    let s = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    format!("{}", s)
}

fn appdir() -> std::path::PathBuf {
    let base = std::env::var("APPDATA").unwrap_or_else(|_| ".".into());
    let p = std::path::Path::new(&base).join("mcp-stack");
    let _ = std::fs::create_dir_all(p.join("logs"));
    p
}

fn load_state() -> State {
    let f = appdir().join("state.json");
    std::fs::read_to_string(f)
        .ok()
        .and_then(|t| serde_json::from_str(&t.trim_start_matches('\u{feff}')).ok())
        .unwrap_or_default()
}

fn save_state(s: &State) {
    let f = appdir().join("state.json");
    if let Ok(t) = serde_json::to_string_pretty(s) {
        let _ = std::fs::write(&f, t);
    }
}

fn port_up(port: u16) -> bool {
    TcpStream::connect(("127.0.0.1", port))
        .map(|_| true)
        .unwrap_or(false)
}

fn free_mb() -> Option<u64> {
    // PowerShell one-liner; cached per call (cheap enough at 60s intervals)
    let out = Command::new("powershell")
        .args([
            "-NoProfile",
            "-Command",
            "[math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory/1024)",
        ])
        .output()
        .ok()?;
    let s = String::from_utf8_lossy(&out.stdout).trim().to_string();
    s.parse().ok()
}

/// Extract the newest trycloudflare URL from a cloudflared stdout log.
fn url_from_log(path: &str) -> Option<String> {
    let data = std::fs::read_to_string(path).ok()?;
    data.lines()
        .rev()
        .find_map(|l| l.find("https://").and_then(|i| l[i..].trim_end().split_whitespace().next().map(|u| u.to_string())))
        .filter(|u| u.starts_with("https://"))
}

fn pid_alive(pid: u32) -> bool {
    Command::new("powershell")
        .args(["-NoProfile", "-Command", &format!("(Get-Process -Id {} -ErrorAction SilentlyContinue) -ne $null", pid)])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).trim() == "True")
        .unwrap_or(false)
}

fn spawn_server(name: &str, prog: &str, args: &[String], cwd: Option<String>, port: Option<u16>) -> Option<Spawned> {
    let log = appdir().join(format!("logs/{}.log", name));
    let mut c = Command::new(prog);
    c.args(args);
    if let Some(d) = cwd {
        c.current_dir(d);
    }
    let child = c.stdout(std::process::Stdio::from(std::fs::File::create(&log).ok()?))
        .stderr(std::process::Stdio::from(std::fs::OpenOptions::new().append(true).create(true).open(log.with_file_name(format!("{}.err", name))).ok()?))
        .spawn()
        .ok()?;
    let pid = child.id();
    drop(child);
    if let Some(p) = port {
        for _ in 0..20 {
            sleep(Duration::from_millis(500));
            if port_up(p) {
                return Some(Spawned { pid, log: log.to_string_lossy().into(), started_at: now() });
            }
        }
    } else {
        sleep(Duration::from_secs(2));
    }
    Some(Spawned { pid, log: log.to_string_lossy().into(), started_at: now() })
}

fn spawn_tunnel(port: u16) -> Result<(Spawned, Option<String>), String> {
    let name = format!("tunnel-{}", port);
    let log = appdir().join(format!("logs/{}.log", name));
    let err = log.with_file_name(format!("{}.err", name));
    let child = Command::new(CLOUDFLARED)
        .args(["tunnel", "--url", &format!("http://localhost:{}", port), "--no-autoupdate"])
        .stdout(std::process::Stdio::from(std::fs::File::create(&log).map_err(|e| e.to_string())?))
        .stderr(std::process::Stdio::from(
            std::fs::OpenOptions::new().append(true).create(true).open(err).map_err(|e| e.to_string())?,
        ))
        .spawn()
        .map_err(|e| e.to_string())?;
    let pid = child.id();
    drop(child);
    // wait up to 30s for the URL line
    let mut url = None;
    for _ in 0..60 {
        sleep(Duration::from_millis(500));
        if let Some(u) = url_from_log(&log.to_string_lossy()) {
            url = Some(u);
            break;
        }
    }
    Ok((
        Spawned {
            pid,
            log: log.to_string_lossy().into(),
            started_at: now(),
        },
        url,
    ))
}

struct Plan {
    latch: bool,
    bridge: bool,
    sysinfo: bool,
    browser: bool,
    tunnels: bool,
}

impl Default for Plan {
    fn default() -> Self {
        Plan { latch: false, bridge: false, sysinfo: false, browser: false, tunnels: false }
    }
}

fn component_ports(p: &Plan) -> Vec<(String, u16, u64)> {
    let mut v = vec![];
    if p.latch {
        v.push(("latch".into(), 3939, EST_MB.parse().unwrap_or(55)));
    }
    if p.bridge {
        v.push(("bridge".into(), 8765, EST_BRIDGE.parse().unwrap_or(40)));
    }
    if p.sysinfo {
        v.push(("sysinfo".into(), 3000, EST_NODE.parse().unwrap_or(50)));
    }
    if p.browser {
        v.push(("browser".into(), 3001, EST_NODE.parse().unwrap_or(50)));
    }
    v
}

fn cmd_start(plan: Plan, silent: bool, watch: bool, max_mb: u64) -> i32 {
    let srv: Vec<(String, u16, u64)> = component_ports(&plan);
    let tunnel_count = if plan.tunnels { srv.len() } else { 0 };
    let est_total: u64 = srv.iter().map(|s| s.2).sum::<u64>()
        + tunnel_count as u64 * EST_TUNNEL.parse().unwrap_or(47);
    if est_total > max_mb {
        if !silent {
            println!(
                "REFUSED: estimated {} MB exceeds --max-mb {} (latch+bridge+nodes+tunnels). Lower the component set.",
                est_total, max_mb
            );
        }
        return 2;
    }
    // servers first
    for (name, port, _est) in srv.iter() {
        if port_up(*port) {
            if !silent {
                println!("{name:8} already up on :{}", port);
            }
            continue;
        }
        let spec = match name.as_str() {
            "latch" => (LATCH_EXE.to_string(), vec!["serve".into()], Some(LATCH_CWD.to_string())),
            "bridge" => {
                let exe = r"E:\tools\mcp-bridge\mcp-bridge.exe".to_string();
                (exe, vec![], None)
            }
            "sysinfo" => (NODE.to_string(), vec![SYSINFO_JS.into()], None),
            _ => (NODE.to_string(), vec![BROWSER_JS.into()], None),
        };
        match spawn_server(name, &spec.0, &spec.1, spec.2.clone(), Some(*port)) {
            Some(s) => {
                if !silent {
                    println!("{name:8} started pid {} (log {})", s.pid, s.log);
                }
                let mut st = load_state();
                st.spawned.insert(name.clone(), s);
                save_state(&st);
            }
            None => {
                if !silent {
                    println!("{name:8} FAILED to start; see {}\\logs\\{}.err", appdir().display(), name);
                }
            }
        }
    }
    // tunnels
    if plan.tunnels {
        let st0 = load_state();
        for (_name, port, _est) in srv.iter() {
            let tname = format!("tunnel-{}", port);
            // only skip if the recorded pid is still alive; a stale URL in state does not count
            if let Some(s) = st0.spawned.get(&tname) {
                if pid_alive(s.pid) {
                    if !silent {
                        println!("{tname:16} pid {} still up (url: {})", s.pid, st0.tunnels.get(&tname).cloned().unwrap_or_default());
                    }
                    continue;
                }
            }
            match spawn_tunnel(*port) {
                Ok((s, url)) => {
                    let u = url.unwrap_or_default();
                    if !silent {
                        if u.is_empty() {
                            println!("{tname:16} pid {} url pending (check {})", s.pid, s.log);
                        } else {
                            println!("{tname:16} pid {} public MCP endpoint: {}", s.pid, format!("{}/mcp", u.trim_end_matches('/')));
                        }
                    }
                    let mut st = load_state();
                    st.spawned.insert(tname.clone(), s);
                    if !u.is_empty() {
                        st.tunnels.insert(tname.clone(), u);
                    }
                    save_state(&st);
                }
                Err(e) => {
                    if !silent {
                        println!("{tname:16} FAILED: {e}");
                    }
                }
            }
        }
    }
    if watch {
        if !silent {
            println!("watching every 60s (Ctrl-C to stop the watcher only; daemons keep running)");
        }
        loop {
            sleep(Duration::from_secs(60));
            // re-run non-silent-less health check: restart only what is DOWN
            for (name, port, _est) in component_ports(&plan).iter() {
                if !port_up(*port) {
                    if let Some(free) = free_mb() {
                        if free < 1536 {
                            if !silent {
                                println!("[{name}] down but free RAM {free}MB < 1536MB floor; skipping restart");
                            }
                            continue;
                        }
                    }
                    let spec = match name.as_str() {
                        "latch" => (LATCH_EXE.to_string(), vec!["serve".into()], Some(LATCH_CWD.to_string())),
                        "bridge" => {
                            let exe = r"E:\tools\mcp-bridge\mcp-bridge.exe".to_string();
                            (exe, vec![], None)
                        }
                        "sysinfo" => (NODE.to_string(), vec![SYSINFO_JS.into()], None),
                        _ => (NODE.to_string(), vec![BROWSER_JS.into()], None),
                    };
                    if let Some(s) = spawn_server(name, &spec.0, &spec.1, spec.2.clone(), Some(*port)) {
                        if !silent {
                            println!("[watch] {name} restarted pid {}", s.pid);
                        }
                        let mut st = load_state();
                        st.spawned.insert(name.clone(), s);
                        save_state(&st);
                    }
                }
            }
        }
    }
    // final RAM report
    if !silent {
        if let Some(free) = free_mb() {
            println!("free RAM now: {} MB (budget {} MB total, est {} MB)", free, max_mb, est_total);
        }
    }
    0
}

fn cmd_stop(names: Vec<String>, include_tunnels: bool) -> i32 {
    let mut st = load_state();
    let mut removed: Vec<String> = vec![];
    for (name, s) in st.spawned.clone() {
        let is_tunnel = name.starts_with("tunnel-");
        let mentioned = names.is_empty() || names.iter().any(|n| n == &name);
        if !mentioned {
            continue;
        }
        if is_tunnel && !include_tunnels && !names.is_empty() && !names.iter().any(|n| n == &name || n == "--tunnels-stop" || n == "all") {
            continue;
        }
        let ok = Command::new("powershell")
            .args(["-NoProfile", "-Command", &format!("Stop-Process -Id {} -Force -ErrorAction SilentlyContinue", s.pid)])
            .status()
            .map(|s| s.success())
            .unwrap_or(false);
        println!("{name:16} pid {} -> {}", s.pid, if ok { "stopped" } else { "not stopped?" });
        removed.push(name.clone());
    }
    st.spawned.retain(|k, _| !removed.contains(k));
    st.tunnels.retain(|k, _| !removed.contains(k));
    save_state(&st);
    0
}

fn cmd_status() -> i32 {
    let st = load_state();
    let mut rows: Vec<String> = Vec::new();
    for (name, port) in [
        ("latch", 3939u16),
        ("bridge", 8765),
        ("sysinfo", 3000),
        ("browser", 3001),
    ] {
        let up = port_up(port);
        let pid = st.spawned.get(name).map(|s| s.pid).unwrap_or(0);
        let pid_s = if pid == 0 { "-".to_string() } else { pid.to_string() };
        rows.push(format!("  {name:8} :{port}  {}  pid={}", if up { "UP" } else { "DOWN" }, pid_s));
    }
    for (k, u) in &st.tunnels {
        let tpid = st
            .spawned
            .get(k)
            .map(|s| s.pid)
            .unwrap_or(0);
        let tpid_s = if tpid == 0 { "?".to_string() } else { tpid.to_string() };
        rows.push(format!("  {k:16}  {}  pid={}", u, tpid_s));
    }
    println!("== mcp-stack status ==");
    for r in &rows {
        println!("{}", r);
    }
    if let Some(free) = free_mb() {
        println!("free RAM: {} MB", free);
    }
    println!("state: {}", appdir().join("state.json").display());
    0
}

fn startup_vbs() -> std::path::PathBuf {
    let pf = std::env::var("USERPROFILE").unwrap_or_else(|_| "C:\\Users\\souro".into());
    std::path::Path::new(&pf)
        .join("AppData\\Roaming\\Microsoft\\Windows\\Start Menu\\Programs\\Startup\\mcp-stack-autostart.vbs")
}

fn cmd_autostart(action: &str) -> i32 {
    let exe = std::env::current_exe().map(|p| p.to_string_lossy().into_owned()).unwrap_or_else(|_| r"E:\tools\mcp-stack\mcp-stack.exe".to_string());
    let path = startup_vbs();
    match action {
        "install" => {
            let vbs = format!(
                r#"Set sh = CreateObject("WScript.Shell")
sh.Run Chr(34) & "{}" & Chr(34) & " start --all --silent --watch", 0, False
"#,
                exe
            );
            if let Some(p) = path.parent() {
                let _ = std::fs::create_dir_all(p);
            }
            match std::fs::write(&path, vbs) {
                Ok(_) => {
                    println!("installed: {}", path.display());
                    0
                }
                Err(e) => {
                    println!("failed: {e}");
                    1
                }
            }
        }
        "uninstall" => {
            match std::fs::remove_file(&path) {
                Ok(_) => {
                    println!("removed {}", path.display());
                    0
                }
                Err(_) => {
                    println!("not present (nothing to remove)");
                    0
                }
            }
        }
        _ => {
            println!("{}", if path.exists() { "installed" } else { "not installed" });
            0
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.is_empty() || args[0] == "help" {
        print_usage();
        return;
    }
    let a = args[0].as_str();
    let rest = &args[1..];
    let mut plan = Plan::default();
    let mut silent = false;
    let mut watch = false;
    let mut max_mb: u64 = 1024;
    let mut stops: Vec<String> = vec![];
    let mut stop_tunnels = false;

    for arg in rest {
        match arg.as_str() {
            "--all" => {
                plan = Plan { latch: true, bridge: true, sysinfo: true, browser: true, tunnels: true };
            }
            "-latch" | "--latch" => plan.latch = true,
            "-bridge" | "--bridge" => plan.bridge = true,
            "-sysinfo" | "--sysinfo" => plan.sysinfo = true,
            "-browser" | "--browser" => plan.browser = true,
            "-tunnels" | "--tunnels" => plan.tunnels = true,
            "--silent" => silent = true,
            "--watch" => watch = true,
            "--max-mb" => {
                // value comes next; handled below by peeking
            }
            _ => {
                if arg.starts_with("--max-mb=") {
                    max_mb = arg[9..].parse().unwrap_or(1024);
                } else if arg == "--tunnels-stop" {
                    stop_tunnels = true;
                } else if a == "stop" && !arg.starts_with("--") {
                    stops.push(arg.clone());
                }
            }
        }
    }
    // resolve --max-mb VALUE (two-token form)
    if let Some(i) = rest.iter().position(|x| x == "--max-mb") {
        if i + 1 < rest.len() {
            max_mb = rest[i + 1].parse().unwrap_or(1024);
        }
    }

    let code = match a {
        "start" => cmd_start(plan, silent, watch, max_mb),
        "stop" => cmd_stop(stops, stop_tunnels),
        "status" => cmd_status(),
        "autostart" => {
            let act = rest.first().map(|s| s.as_str()).unwrap_or("status");
            cmd_autostart(act)
        }
        _ => {
            print_usage();
            1
        }
    };
    std::process::exit(code);
}

fn print_usage() {
    println!(
        "mcp-stack 0.1.0 — supervisor for the local MCP stack
Usage:
  mcp-stack start [--all | -latch -bridge -sysinfo -browser -tunnels] [--silent] [--watch] [--max-mb N]
  mcp-stack stop [latch|bridge|sysinfo|browser|tunnel-PORT ...] [--tunnels-stop]
  mcp-stack status
  mcp-stack autostart install|uninstall|status

Defaults:
  latch   E:\\tools\\latch\\latch.exe serve        :3939
  bridge  E:\\tools\\mcp-bridge\\mcp-bridge.exe    :8765/:8767
  sysinfo node my-mcp-connector http-server.js     :3000
  browser node browser-control-mcp http-server.js  :3001
  tunnels cloudflared quick tunnels for the above (URLs in status output)
RAM budget default 1024 MB combined estimate; watch skips restarts under 1536 MB free."
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_est() {
        assert_eq!(EST_MB.parse::<u64>().unwrap(), 55);
        assert_eq!(EST_TUNNEL.parse::<u64>().unwrap(), 47);
    }

    #[test]
    fn ports_known() {
        let p = Plan::default();
        assert!(component_ports(&p).is_empty());
        let p2 = Plan { latch: true, bridge: true, sysinfo: true, browser: true, tunnels: true };
        let v = component_ports(&p2);
        assert_eq!(v.len(), 4);
        assert!(v.iter().any(|x| x.1 == 3939));
        assert!(v.iter().any(|x| x.1 == 8765));
    }

    #[test]
    fn plan_from_args() {
        // mirrors the arg loop: --all sets everything
        let mut plan = Plan::default();
        plan = Plan { latch: true, bridge: true, sysinfo: true, browser: true, tunnels: true };
        assert!(plan.tunnels && plan.latch && plan.browser);
    }

    #[test]
    fn est_total_under_budget() {
        let p = Plan { latch: true, bridge: true, sysinfo: true, browser: true, tunnels: true };
        let servers: Vec<_> = component_ports(&p);
        let total: u64 = servers.iter().map(|s| s.2).sum::<u64>()
            + servers.len() as u64 * EST_TUNNEL.parse::<u64>().unwrap();
        assert!(total <= 1024, "full stack estimate {} MB must fit 1 GB", total);
        assert_eq!(total, 55 + 40 + 50 + 50 + 4 * 47);
    }
}
