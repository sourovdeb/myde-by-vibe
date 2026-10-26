#![cfg_attr(all(windows, feature = "tray"), windows_subsystem = "windows")]

mod auth;
mod bridge;
mod config;
mod http;
mod http_admin;
mod jobs;
mod mcp;
mod oauth;
mod runner;
#[cfg(all(windows, feature = "tray"))]
mod tray;
mod tunnel;

use std::net::TcpListener;
use std::sync::Arc;

use crate::bridge::Bridge;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mock = args.iter().any(|a| a == "--mock");
    let check = args.iter().any(|a| a == "--check");

    if check {
        let cfg = config::load_config();
        println!("mcp-bridge v{}", env!("CARGO_PKG_VERSION"));
        println!("local:   http://127.0.0.1:{}/mcp", cfg.port);
        if !cfg.public_url.is_empty() {
            println!("public:  {}", cfg.public_url);
        }
        if !cfg.tunnel_cmd.is_empty() {
            println!("tunnel:  {} {:?}", cfg.tunnel_cmd, cfg.tunnel_args);
        }
        println!("admin:   http://127.0.0.1:{}/", cfg.admin_port);
        return;
    }

    let cfg = config::load_config();
    let port = cfg.port;
    let admin_port = cfg.admin_port;
    let enabled = cfg.enabled;
    let b = Arc::new(Bridge::new(cfg, mock));

    let mcp_listener = TcpListener::bind(("127.0.0.1", port))
        .unwrap_or_else(|e| panic!("bind 127.0.0.1:{port}: {e}"));
    // admin listener never routed through the tunnel
    let admin_listener = TcpListener::bind(("127.0.0.1", admin_port))
        .unwrap_or_else(|e| panic!("bind 127.0.0.1:{admin_port}: {e}"));

    let b_admin = b.clone();
    std::thread::spawn(move || http::serve(admin_listener, b_admin, true));

    eprintln!(
        "mcp-bridge v{} {} on http://127.0.0.1:{}/mcp (admin :{admin_port})",
        env!("CARGO_PKG_VERSION"),
        if enabled { "enabled" } else { "disabled" },
        port
    );

    // start tunnel if configured and enabled
    if enabled {
        let cfg = b.cfg.read().unwrap().clone();
        if !cfg.tunnel_cmd.is_empty() {
            if let Err(e) = b.tunnel.start(&cfg) {
                eprintln!("tunnel start failed: {e}");
            }
        }
    }

    #[cfg(all(windows, feature = "tray"))]
    {
        let cfg = b.cfg.read().unwrap().clone();
        let b2 = b.clone();
        let server_b = b.clone();
        std::thread::spawn(move || http::serve(mcp_listener, server_b, false));
        tray::run_tray(b2, cfg); // main thread owns the Win32 event loop
    }
    #[cfg(not(all(windows, feature = "tray")))]
    {
        http::serve(mcp_listener, b, false);
    }
}
