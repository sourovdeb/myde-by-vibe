use latch::http::{serve, Shared};
use latch::panel::text_panel;
use latch::settings::{
    cap_parse, diagnose_url, new_token, parse_on, Caller, Settings, Verdict,
};
use latch::{Bridge, FsRunner};
use std::env;
use std::io::{self, BufRead, Write};
use std::net::TcpListener;
use std::path::PathBuf;
use std::sync::atomic::AtomicBool;
use std::sync::Arc;

fn main() {
    let args: Vec<String> = env::args().skip(1).collect();
    let cmd = args.first().map(|s| s.as_str()).unwrap_or("status");
    let (config, rest) = split_args(&args[if args.is_empty() { 0 } else { 1 }..]);
    match cmd {
        "serve" => serve_cmd(&config),
        "stdio" => stdio_cmd(&config),
        "on" => set_on(&config, true),
        "off" => set_on(&config, false),
        "status" => status(&config),
        "panel" => panel(&config),
        "set" => set_cap(&config, &rest),
        "check-url" => {
            let url = rest.first().map(|s| s.as_str()).unwrap_or("");
            match diagnose_url(url) {
                Verdict::Empty => println!("empty"),
                Verdict::Bad(lines) => {
                    for line in lines {
                        println!("reject: {line}");
                    }
                    std::process::exit(2);
                }
                Verdict::Ok(lines) => {
                    for line in lines {
                        println!("ok: {line}");
                    }
                }
            }
        }
        other => {
            eprintln!("unknown command: {other}");
            eprintln!(
                "usage: latch [serve|stdio|on|off|status|panel|set|check-url] [--config path]"
            );
            std::process::exit(2);
        }
    }
}

fn split_args(args: &[String]) -> (PathBuf, Vec<String>) {
    let mut path = default_config();
    let mut rest = Vec::new();
    let mut i = 0;
    while i < args.len() {
        if args[i] == "--config" {
            if let Some(next) = args.get(i + 1) {
                path = PathBuf::from(next);
                i += 2;
                continue;
            }
        }
        rest.push(args[i].clone());
        i += 1;
    }
    (path, rest)
}

fn default_config() -> PathBuf {
    let home = env::var("USERPROFILE")
        .or_else(|_| env::var("HOME"))
        .unwrap_or_else(|_| ".".into());
    PathBuf::from(home).join(".mcp-autostart").join("latch.json")
}

fn load_or_default(path: &PathBuf) -> Settings {
    if path.exists() {
        match Settings::load(path) {
            Ok(settings) => return settings,
            Err(e) => {
                eprintln!("{e}");
                std::process::exit(1);
            }
        }
    }
    let settings = Settings::default();
    if let Err(e) = settings.save(path) {
        eprintln!("{e}");
        std::process::exit(1);
    }
    settings
}

fn ensure_token(path: &PathBuf, settings: &mut Settings) {
    if settings.token.is_empty() {
        settings.token = new_token();
        if let Err(e) = settings.save(path) {
            eprintln!("{e}");
            std::process::exit(1);
        }
    }
}

fn set_on(path: &PathBuf, on: bool) {
    let mut settings = load_or_default(path);
    settings.server_on = on;
    if let Err(e) = settings.save(path) {
        eprintln!("{e}");
        std::process::exit(1);
    }
    println!("{}", if on { "server on" } else { "server off" });
}

fn set_cap(path: &PathBuf, rest: &[String]) {
    let Some(who) = rest.first().and_then(|name| Caller::parse(name)) else {
        eprintln!("usage: latch set <master|grok|mistral|chatgpt|pi> <read|edit|scripts|desktop> <on|off>");
        std::process::exit(2);
    };
    let Some(cap) = rest.get(1).and_then(|name| cap_parse(name)) else {
        eprintln!("usage: latch set <master|grok|mistral|chatgpt|pi> <read|edit|scripts|desktop> <on|off>");
        std::process::exit(2);
    };
    let Some(on) = rest.get(2).and_then(|value| parse_on(value)) else {
        eprintln!("usage: latch set <master|grok|mistral|chatgpt|pi> <read|edit|scripts|desktop> <on|off>");
        std::process::exit(2);
    };
    let mut settings = load_or_default(path);
    settings.set_cap(who, cap, on);
    if let Err(e) = settings.save(path) {
        eprintln!("{e}");
        std::process::exit(1);
    }
    println!("{}", text_panel(&settings));
}

fn status(path: &PathBuf) {
    let settings = load_or_default(path);
    println!("name: {}", settings.name);
    println!("server: {}", if settings.server_on { "on" } else { "off" });
    println!("listen: {}", settings.port);
    println!(
        "public: {}",
        if settings.public_url.is_empty() {
            "(none)"
        } else {
            &settings.public_url
        }
    );
    match diagnose_url(&settings.public_url) {
        Verdict::Empty => println!("url: missing"),
        Verdict::Bad(_) => println!("url: rejected"),
        Verdict::Ok(_) => println!("url: public https"),
    }
    println!(
        "master: read={} edit={} scripts={} desktop={}",
        bit(settings.caps.read),
        bit(settings.caps.edit),
        bit(settings.caps.scripts),
        bit(settings.caps.desktop)
    );
}

fn panel(path: &PathBuf) {
    let mut settings = load_or_default(path);
    ensure_token(path, &mut settings);
    println!("{}", text_panel(&settings));
    println!("Open that panel address while `latch serve` is running.");
}

fn bit(on: bool) -> &'static str {
    if on {
        "on"
    } else {
        "off"
    }
}

fn serve_cmd(path: &PathBuf) {
    let mut settings = load_or_default(path);
    ensure_token(path, &mut settings);
    let port = settings.port;
    let listener = TcpListener::bind(("0.0.0.0", port)).unwrap_or_else(|e| {
        eprintln!("cannot listen on {port}: {e}");
        std::process::exit(1);
    });
    println!(
        "latch listening on {port} ({})",
        if settings.server_on { "on" } else { "off" }
    );
    println!("panel: http://127.0.0.1:{port}/panel?token={}", settings.token);
    let mut bridge = Bridge::new(settings, FsRunner);
    bridge.config_path = Some(path.clone());
    let shared = Arc::new(Shared {
        bridge: std::sync::Mutex::new(bridge),
    });
    let stop = Arc::new(AtomicBool::new(false));
    if let Err(e) = serve(listener, shared, stop) {
        eprintln!("{e}");
        std::process::exit(1);
    }
}

fn stdio_cmd(path: &PathBuf) {
    let settings = load_or_default(path);
    let mut bridge = Bridge::new(settings, FsRunner);
    bridge.config_path = Some(path.clone());
    let stdin = io::stdin();
    let mut out = io::stdout();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        if line.trim().is_empty() {
            continue;
        }
        if let Some(reply) = latch::http::stdio_line(&mut bridge, &line) {
            let _ = writeln!(out, "{reply}");
            let _ = out.flush();
        }
    }
}
