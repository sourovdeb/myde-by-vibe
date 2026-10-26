mod auth;
mod bridge;
mod config;
mod http;
mod http_admin;
mod jobs;
mod mcp;
mod runner;

use std::net::TcpListener;
use std::sync::Arc;

use crate::bridge::Bridge;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let mock = args.iter().any(|a| a == "--mock");
    let check = args.iter().any(|a| a == "--check");

    if check {
        // prints what claude.ai / grok.com need: the connector URL form
        let cfg = config::load_config();
        println!("mcp-bridge v{}", env!("CARGO_PKG_VERSION"));
        println!("local:   http://127.0.0.1:{}/mcp", cfg.port);
        if !cfg.public_url.is_empty() {
            println!("public:  {}", cfg.public_url);
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
    http::serve(mcp_listener, b, false);
}
