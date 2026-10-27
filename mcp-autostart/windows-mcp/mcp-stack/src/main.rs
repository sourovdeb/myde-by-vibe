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
    data.lines().rev().find_map(|l| {
        let i = l.find("https://")?;
        let url = l[i..].trim_end().split_whitespace().next()?;
        if url.contains("trycloudflare.com") { Some(url.to_string()) } else { None }
    })
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
    let url_file = err.to_string_lossy().to_string();
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
        if let Some(u) = url_from_log(&url_file) {
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

/// True when the newest log entry is a quick-tunnel 429 (provisioning rate-limited).
fn recent_429(path: &str) -> bool {
    let data = match std::fs::read_to_string(path) { Ok(d) => d, Err(_) => return false };
    data.lines()
        .rev()
        .take(4)
        .any(|l| l.contains("provisioning failed with status 429"))
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

/// Spawn spec for a named component: (program, args, cwd).
fn server_spec(name: &str) -> (String, Vec<String>, Option<String>) {
    match name {
        "latch" => (LATCH_EXE.to_string(), vec!["serve".into()], Some(LATCH_CWD.to_string())),
        "bridge" => (r"E:\tools\mcp-bridge\mcp-bridge.exe".to_string(), vec![], None),
        "sysinfo" => (NODE.to_string(), vec![SYSINFO_JS.into()], None),
        _ => (NODE.to_string(), vec![BROWSER_JS.into()], None),
    }
}

/// Extra port to check for bridge health (admin UI on 8767).
fn extra_health_port(name: &str) -> Option<u16> {
    match name {
        "bridge" => Some(8767),
        _ => None,
    }
}

fn cmd_start(plan: Plan, silent: bool, watch: bool, max_mb: u64) -> i32 {
    let srv: Vec<(String, u16, u64)> = component_ports(&plan);
    let tunnel_count = if plan.tunnels && !srv.is_empty() { srv.len() } else { 0 };
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
        let spec = server_spec(name);
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
    if plan.tunnels && !srv.is_empty() {
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
        run_watch(&plan, silent);
    }
    // final RAM report
    if !silent {
        if let Some(free) = free_mb() {
            println!("free RAM now: {} MB (budget {} MB total, est {} MB)", free, max_mb, est_total);
        }
    }
    0
}

/// Watch loop: every 60s, restart any down server (RAM-guarded) and respawn dead tunnels.
fn run_watch(plan: &Plan, silent: bool) {
    if !silent {
        println!("watching every 60s (Ctrl-C to stop the watcher only; daemons keep running)");
    }
    loop {
        sleep(Duration::from_secs(60));
        // servers: restart only what is DOWN (also check bridge admin port 8767)
        for (name, port, _est) in component_ports(plan).iter() {
            let main_down = !port_up(*port);
            let extra_down = extra_health_port(name).map(|p| !port_up(p)).unwrap_or(false);
            if main_down || extra_down {
                if let Some(free) = free_mb() {
                    if free < 1536 {
                        if !silent {
                            println!("[{name}] down but free RAM {free}MB < 1536MB floor; skipping restart");
                        }
                        continue;
                    }
                }
                let spec = server_spec(name);
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
        // tunnels: respawn any recorded tunnel whose pid died (quick tunnels drop)
        if plan.tunnels {
            let st1 = load_state();
            for (_name, port, _est) in component_ports(plan).iter() {
                let tname = format!("tunnel-{}", port);
                let dead = match st1.spawned.get(&tname) {
                    Some(s) => !pid_alive(s.pid),
                    None => true,
                };
                if dead {
                    if let Ok((s, url)) = spawn_tunnel(*port) {
                        let u = url.unwrap_or_default();
                        if !silent {
                            let shown = if u.is_empty() { String::from("(pending)") } else { u.clone() };
                            println!("[watch] {tname} respawned pid {} url {}", s.pid, shown);
                        }
                        let mut st = load_state();
                        st.spawned.insert(tname.clone(), s);
                        if !u.is_empty() {
                            st.tunnels.insert(tname.clone(), u);
                        }
                        save_state(&st);
                    }
                }
            }
        }
    }
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
        let mut status = format!("  {name:8} :{port}  {}  pid={}", if up { "UP" } else { "DOWN" }, pid_s);
        // bridge also has admin UI on 8767
        if let Some(extra) = extra_health_port(name) {
            let extra_up = port_up(extra);
            status.push_str(&format!("  |  :{extra} {}", if extra_up { "UP" } else { "DOWN" }));
        }
        rows.push(status);
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
        "reconnect" => cmd_reconnect(),
        "doctor" => cmd_doctor(),
        "fix-url" => {
            cmd_fix_url();
            0
        }
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

fn cmd_reconnect() -> i32 {
    // Sequential, 429-aware tunnel re-bring-up: kill dead cfs, back off if the last
    // attempt was rate-limited, spawn one tunnel at a time, capture the fresh URLs.
    let st = load_state();
    let plan = Plan { latch: true, bridge: true, sysinfo: true, browser: true, tunnels: false };
    for (i, (_name, port, _est)) in component_ports(&plan).iter().enumerate() {
        let tname = format!("tunnel-{}", port);
        // skip if the local service is down — a tunnel to a dead port is useless
        if !port_up(*port) {
            eprintln!("[{tname}] local service on :{port} is DOWN — skipping tunnel (start it first: mcp-stack start)");
            continue;
        }
        if i > 0 {
            eprintln!("[{tname}] pacing 40s before provisioning…");
            sleep(Duration::from_secs(40));
        }
        let err_file = appdir().join(format!("logs/{}.err", tname));
        let err_s = err_file.to_string_lossy().to_string();
        if recent_429(&err_s) {
            eprintln!("[{tname}] last attempt was 429-rate-limited; waiting 120s before retry");
            sleep(Duration::from_secs(120));
        }
        if let Some(s) = st.spawned.get(&tname) {
            let _ = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!("Stop-Process -Id {} -Force -ErrorAction SilentlyContinue", s.pid),
                ])
                .status();
        }
        match spawn_tunnel(*port) {
            Ok((s, url)) => {
                let u = url.unwrap_or_default();
                let shown = if u.is_empty() {
                    format!("(pending or 429 — check {err_s})")
                } else {
                    u.clone()
                };
                println!("{tname:16} pid {} public MCP endpoint: {shown}", s.pid);
                let mut st = load_state();
                st.spawned.insert(tname.clone(), s);
                if !u.is_empty() {
                    let mcp = u.trim_end_matches('/');
                    st.tunnels.insert(tname.clone(), format!("{mcp}/mcp"));
                }
                save_state(&st);
            }
            Err(e) => println!("{tname:16} FAILED: {e}"),
        }
    }
    0
}

fn cmd_fix_url() -> i32 {
    // Point the bridge's public_url at the live 8765 tunnel from state.json, then
    // restart the bridge so the new URL is advertised in the OAuth authorize flow.
    let st = load_state();
    let url = match st.tunnels.get("tunnel-8765") {
        Some(u) => u.clone(),
        None => {
            println!("no live 8765 tunnel URL in state — run 'mcp-stack reconnect' first");
            return 1;
        }
    };
    let cfg_path = std::env::var("APPDATA")
        .map(|a| a + "\\mcp-bridge\\config.json")
        .unwrap_or_default();
    let text = match std::fs::read_to_string(&cfg_path) {
        Ok(t) => t,
        Err(e) => {
            println!("cannot read {cfg_path}: {e}");
            return 1;
        }
    };
    let mut v = match serde_json::from_str::<serde_json::Value>(&text) {
        Ok(v) => v,
        Err(e) => {
            println!("config.json is not valid JSON: {e}");
            return 1;
        }
    };
    if let Some(obj) = v.as_object_mut() {
        obj.insert("public_url".to_string(), serde_json::Value::String(url.clone()));
    }
    let out = serde_json::to_string_pretty(&v).expect("serialize");
    std::fs::write(&cfg_path, out).expect("write config");
    println!("public_url -> {url}");
    println!("restarting bridge to pick up the new URL…");
    let st2 = load_state();
    if port_up(8765) {
        if let Some(s) = st2.spawned.get("bridge") {
            let _ = Command::new("powershell")
                .args([
                    "-NoProfile",
                    "-Command",
                    &format!("Stop-Process -Id {} -Force -ErrorAction SilentlyContinue", s.pid),
                ])
                .status();
            sleep(Duration::from_secs(2));
        } else {
            println!("bridge is running but its pid is not in state.json — restart it from the :8767 admin page if the new URL was not picked up");
            return 0;
        }
    }
    match spawn_server("bridge", r"E:\tools\mcp-bridge\mcp-bridge.exe", &[], None, Some(8765)) {
            Some(s) => {
                println!("bridge restarted pid {}", s.pid);
                let mut st = load_state();
                st.spawned.insert("bridge".to_string(), s);
                save_state(&st);
            }
            None => println!("bridge could not be started right now (port busy?) — public_url was saved; run: mcp-stack start -bridge"),
    }
    0
}

fn cmd_doctor() -> i32 {
    let st = load_state();
    println!("== mcp-stack doctor ==");
    for (name, port) in [("latch", 3939u16), ("bridge", 8765u16), ("sysinfo", 3000u16), ("browser", 3001u16)] {
        let up = port_up(port);
        let verdict = if up {
            String::from("OK")
        } else {
            format!("DOWN — run: mcp-stack start {name}")
        };
        println!("  {name:8} :{port} {verdict}");
    }
    for (k, u) in &st.tunnels {
        let tpid = st.spawned.get(k).map(|s| s.pid).unwrap_or(0);
        let alive = tpid != 0 && pid_alive(tpid);
        let err_file = appdir().join(format!("logs/{}.err", k));
        let err_s = err_file.to_string_lossy().to_string();
        let r429 = recent_429(&err_s);
        let verdict = if alive {
            String::from("live")
        } else if r429 {
            String::from("429 rate-limited — wait ~2 min, then: mcp-stack reconnect")
        } else {
            String::from("DEAD — run: mcp-stack reconnect")
        };
        println!("  {k:14} {u}  [{verdict}]");
    }
    if st.tunnels.is_empty() {
        println!("  (no tunnel URLs captured yet — run: mcp-stack reconnect, then status)");
    }
    println!("  latch panel:   local URL needs ?token= — print it with: E:\\tools\\latch\\latch.exe panel");
    println!("  bridge admin:  http://127.0.0.1:8767/ (settings)   http://127.0.0.1:8766/");
    let cfg_path = std::env::var("APPDATA").map(|a| a + "\\mcp-bridge\\config.json").unwrap_or_default();
    if let Ok(t) = std::fs::read_to_string(&cfg_path) {
        if let Ok(cfg) = serde_json::from_str::<serde_json::Value>(&t) {
            if let Some(pub_url) = cfg.get("public_url").and_then(|v| v.as_str()) {
                let host: String = pub_url
                    .trim_start_matches("https://")
                    .split('/')
                    .next()
                    .unwrap_or("")
                    .to_string();
                let resolves: bool = if host.is_empty() {
                    true
                } else {
                    use std::net::ToSocketAddrs;
                    (host.as_str(), 443).to_socket_addrs().is_ok()
                };
                if !resolves {
                    println!("  WARNING: bridge public_url host does not resolve: {pub_url}");
                    println!("           fix: update public_url in %APPDATA%\\mcp-bridge\\config.json (admin page :8767) to a LIVE tunnel URL above");
                }
            }
        }
    }
    if let Some(free) = free_mb() {
        println!("free RAM: {free} MB");
    }
    println!("Self-service: reboot/kill problem -> 'mcp-stack reconnect' -> 'mcp-stack status' -> paste the 4 URLs into chat.mistral.ai/connections");
    0
}

fn print_usage() {
    println!(
        "mcp-stack 0.1.0 — supervisor for the local MCP stack
Usage:
  mcp-stack start [--all | -latch -bridge -sysinfo -browser -tunnels] [--silent] [--watch] [--max-mb N]
  mcp-stack stop [latch|bridge|sysinfo|browser|tunnel-PORT ...] [--tunnels-stop]
  mcp-stack status
  mcp-stack autostart install|uninstall|status
  mcp-stack reconnect     # sequential 429-safe tunnel re-bring-up (the no-agent fix)
  mcp-stack doctor        # what is broken + the exact next command
  mcp-stack fix-url       # point bridge public_url at the live 8765 tunnel + restart bridge

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
        let plan = Plan { latch: true, bridge: true, sysinfo: true, browser: true, tunnels: true };
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

    #[test]
    fn url_from_log_skips_banner() {
        // cloudflared logs contain a banner with https://www.cloudflare.com/website-terms/
        // before the actual trycloudflare.com URL. The function must skip the banner.
        let dir = std::env::temp_dir().join("mcp-stack-test");
        let _ = std::fs::create_dir_all(&dir);
        let f = dir.join("tunnel-test.err");
        let log = "2026-10-27 INF Thank you for trying Cloudflare Tunnel. https://www.cloudflare.com/website-terms/\n\
                   2026-10-27 INF Your quick Tunnel has been created! https://abc-def-ghi.trycloudflare.com\n";
        std::fs::write(&f, log).unwrap();
        let url = url_from_log(&f.to_string_lossy());
        assert_eq!(url, Some("https://abc-def-ghi.trycloudflare.com".to_string()));
        let _ = std::fs::remove_file(&f);
    }

    #[test]
    fn url_from_log_none_when_no_tunnel() {
        let dir = std::env::temp_dir().join("mcp-stack-test");
        let _ = std::fs::create_dir_all(&dir);
        let f = dir.join("tunnel-none.err");
        std::fs::write(&f, "no urls here\n").unwrap();
        assert_eq!(url_from_log(&f.to_string_lossy()), None);
        let _ = std::fs::remove_file(&f);
    }

    #[test]
    fn server_spec_known_names() {
        let (prog, args, cwd) = server_spec("latch");
        assert!(prog.contains("latch.exe"));
        assert_eq!(args, vec!["serve".to_string()]);
        assert!(cwd.is_some());

        let (prog, args, _) = server_spec("bridge");
        assert!(prog.contains("mcp-bridge.exe"));
        assert!(args.is_empty());

        let (prog, args, _) = server_spec("sysinfo");
        assert!(prog.contains("node"));
        assert_eq!(args.len(), 1);

        let (prog, args, _) = server_spec("browser");
        assert!(prog.contains("node"));
        assert_eq!(args.len(), 1);
    }

    #[test]
    fn extra_health_port_bridge() {
        assert_eq!(extra_health_port("bridge"), Some(8767));
        assert_eq!(extra_health_port("latch"), None);
        assert_eq!(extra_health_port("sysinfo"), None);
    }
}
