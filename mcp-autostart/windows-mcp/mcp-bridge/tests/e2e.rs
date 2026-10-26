use std::io::{Read, Write};
use std::net::TcpStream;
use std::sync::Arc;
use std::time::Duration;

// In-process integration test: spawns real TCP servers on ephemeral ports
// and drives them with raw HTTP, exactly like a cloud chat would.
// Run: cargo test --bin mcp-bridge -- --ignored e2e --nocapture

use mcp_bridge_lib::*;

fn http(port: u16, method: &str, path: &str, body: Option<&str>, headers: &[(&str, &str)]) -> (u16, String) {
    let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
    s.set_read_timeout(Some(Duration::from_millis(500))).unwrap();
    let body = body.unwrap_or("");
    let mut req = format!(
        "{} {} HTTP/1.1\r\nHost: t\r\nContent-Length: {}\r\nConnection: close\r\n",
        method, path, body.len()
    );
    for (k, v) in headers {
        req.push_str(&format!("{k}: {v}\r\n"));
    }
    req.push_str("\r\n");
    req.push_str(body);
    s.write_all(req.as_bytes()).unwrap();
    let mut buf = String::new();
    let mut chunk = [0u8; 8192];
    loop {
        match s.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => buf.push_str(&String::from_utf8_lossy(&chunk[..n])),
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(20));
                continue;
            }
            Err(e) if e.kind() == std::io::ErrorKind::Interrupted => continue,
            Err(_) => break,
        }
    }
    let status: u16 = buf
        .split_whitespace()
        .nth(1)
        .and_then(|c| c.parse().ok())
        .unwrap_or(0);
    let body = buf.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
    (status, body)
}

#[test]
fn e2e_mock_full_flow() {
    let mut cfg = config::Config::default();
    cfg.port = 0; // ephemeral
    cfg.admin_port = 0;
    cfg.allowed_dirs = vec!["/tmp".into()];
    let b = Arc::new(bridge::Bridge::new(cfg, true));

    let mcp_l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let admin_l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let mcp_port = mcp_l.local_addr().unwrap().port();
    let admin_port = admin_l.local_addr().unwrap().port();

    {
        let b = b.clone();
        std::thread::spawn(move || http::serve(mcp_l, b, false));
    }
    {
        let b = b.clone();
        std::thread::spawn(move || http::serve(admin_l, b, true));
    }
    std::thread::sleep(Duration::from_millis(100));

    let (st, body) = http(mcp_port, "GET", "/healthz", None, &[]);
    assert_eq!(st, 200, "healthz: {body}");
    assert!(body.contains("\"ok\""));

    let (st, body) = http(
        mcp_port,
        "POST",
        "/mcp",
        Some(r#"{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}"#),
        &[],
    );
    assert_eq!(st, 200);
    assert!(body.contains("2025-06-18"), "{body}");
    assert!(body.contains("mcp-bridge"));

    // 3. initialized notification -> 202
    let (st, _) = http(mcp_port, "POST", "/mcp", Some(r#"{"jsonrpc":"2.0","method":"notifications/initialized"}"#), &[]);
    assert_eq!(st, 202);

    // 4. ping
    let (st, body) = http(mcp_port, "POST", "/mcp", Some(r#"{"jsonrpc":"2.0","id":2,"method":"ping"}"#), &[]);
    assert_eq!(st, 200);
    assert!(body.contains(r#""id":2"#));

    let (st, body) = http(
        mcp_port,
        "POST",
        "/mcp",
        Some(r#"{"jsonrpc":"2.0","id":"e2","params":{},"_meta":{"protocolVersion":"2026-07-28"}}"#),
        &[("Mcp-Method", "tools/list")],
    );
    assert_eq!(st, 200);
    assert!(body.contains("bridge_list_agents"), "{body}");
    assert!(body.contains("ttlMs"), "{body}");

    // 6. tools/call mock run
    let (st, body) = http(
        mcp_port,
        "POST",
        "/mcp",
        Some(r#"{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"bridge_run_agent","arguments":{"agent":"claude","prompt":"hi","workdir":"/tmp"}}}"#),
        &[],
    );
    assert_eq!(st, 200);
    assert!(body.contains("MOCK claude ok"), "{body}");

    // 7. workdir allowlist
    let (_, body) = http(
        mcp_port,
        "POST",
        "/mcp",
        Some(r#"{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"bridge_run_agent","arguments":{"agent":"pi","prompt":"x","workdir":"/etc"}}}"#),
        &[],
    );
    assert!(body.contains("allowlist"), "{body}");
    assert!(body.contains(r#""isError":true"#), "{body}");

    let (_, body) = http(
        mcp_port,
        "POST",
        "/mcp",
        Some(r#"{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"bridge_start_agent","arguments":{"agent":"vibe","prompt":"long","workdir":"/tmp"}}}"#),
        &[],
    );
    assert!(body.contains("job-"), "{body}");

    // 9. server/discover
    let (_, body) = http(mcp_port, "POST", "/mcp", Some(r#"{"jsonrpc":"2.0","id":6,"method":"server/discover"}"#), &[]);
    assert!(body.contains("2026-07-28"), "{body}");

    let (st, body) = http(admin_port, "GET", "/", None, &[]);
    assert_eq!(st, 200);
    assert!(body.contains("mcp-bridge settings"), "{body}");
    let (st, body) = http(admin_port, "GET", "/api/config", None, &[]);
    assert_eq!(st, 200);
    assert!(body.contains("\"port\""), "{body}");

    // 11. 404 / 400 errors
    let (st, _) = http(mcp_port, "GET", "/nope", None, &[]);
    assert_eq!(st, 404);
    let (st, body) = http(mcp_port, "POST", "/mcp", Some("not json"), &[]);
    assert_eq!(st, 400);
    assert!(body.contains("-32700"), "{body}");

    b.cfg.write().unwrap().enabled = false;
    let (st, body) = http(mcp_port, "GET", "/healthz", None, &[]);
    assert_eq!(st, 503, "{body}");
}

#[test]
fn e2e_oauth_full_flow() {
    let mut cfg = config::Config::default();
    cfg.allowed_dirs = vec!["/tmp".into()];
    cfg.passphrase = "hunter2".into(); // auth required
    let b = std::sync::Arc::new(bridge::Bridge::new(cfg, true));

    let mcp_l = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
    let port = mcp_l.local_addr().unwrap().port();
    {
        let b = b.clone();
        std::thread::spawn(move || http::serve(mcp_l, b, false));
    }
    std::thread::sleep(Duration::from_millis(100));

    // 1. metadata routes
    let (st, body) = http(port, "GET", "/.well-known/oauth-protected-resource", None, &[]);
    assert_eq!(st, 200);
    assert!(body.contains("/mcp"), "{body}");
    let (st, body) = http(port, "GET", "/.well-known/oauth-authorization-server", None, &[]);
    assert_eq!(st, 200);
    assert!(body.contains("/authorize") && body.contains("S256"), "{body}");

    // 2. dynamic client registration
    let (st, body) = http(
        port,
        "POST",
        "/register",
        Some(r#"{"redirect_uris":["https://claude.ai/api/mcp/auth_callback"]}"#),
        &[],
    );
    assert_eq!(st, 201, "{body}");
    let client_id = body.split('"').nth(3).unwrap().to_string();

    // 3. /mcp without token -> 401
    let (st, _) = http(port, "POST", "/mcp", Some(r#"{"jsonrpc":"2.0","id":1,"method":"ping"}"#), &[]);
    assert_eq!(st, 401);

    // 4. authorize page served without passphrase
    let q = format!(
        "/authorize?client_id={client_id}&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_challenge=pZyNZepIZul0fOpMn60Mgcg9-cPjCUqVsOw2WePKn-k&state=xyz"
    );
    let (st, body) = http(port, "GET", &q, None, &[]);
    assert_eq!(st, 200);
    assert!(body.contains("passphrase"), "{body}");

    // 5. wrong passphrase -> 403 (POST: passphrase never in the URL)
    let (st, _) = http(port, "POST", &q, Some("passphrase=wrong"), &[]);
    assert_eq!(st, 403);

    // 6. correct passphrase -> 302 with code
    let resp = raw_http(port, "POST", &q, Some("passphrase=hunter2"), &[]);
    assert!(resp.starts_with("HTTP/1.1 302"), "{}", &resp[..60.min(resp.len())]);
    let code = resp
        .split("code=")
        .nth(1)
        .unwrap()
        .split('&')
        .next()
        .unwrap()
        .to_string();
    assert!(code.starts_with("code-"), "{code}");

    // 7. token exchange with PKCE verifier (RFC 7636 vector)
    let form = "grant_type=authorization_code&code=".to_string()
        + &code
        + "&client_id="
        + &client_id
        + "&redirect_uri=https%3A%2F%2Fclaude.ai%2Fapi%2Fmcp%2Fauth_callback&code_verifier=dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjpk";
    let (st, body) = http(port, "POST", "/token", Some(&form), &[("Content-Type", "application/x-www-form-urlencoded")]);
    assert_eq!(st, 200, "{body}");
    assert!(body.contains("access_token"), "{body}");
    let token = body
        .split("\"access_token\":\"")
        .nth(1)
        .unwrap()
        .split('"')
        .next()
        .unwrap()
        .to_string();

    // 8. code single-use: replay fails
    let (st, _) = http(port, "POST", "/token", Some(&form), &[("Content-Type", "application/x-www-form-urlencoded")]);
    assert_eq!(st, 400);

    // 9. authenticated /mcp works
    let (st, body) = http(
        port,
        "POST",
        "/mcp",
        Some(r#"{"jsonrpc":"2.0","id":9,"method":"tools/list"}"#),
        &[("Authorization", &format!("Bearer {token}"))],
    );
    assert_eq!(st, 200);
    assert!(body.contains("bridge_list_agents"), "{body}");

    // 10. wrong token still 401
    let (st, _) = http(
        port,
        "POST",
        "/mcp",
        Some(r#"{"jsonrpc":"2.0","id":10,"method":"ping"}"#),
        &[("Authorization", "Bearer bogus")],
    );
    assert_eq!(st, 401);
}

fn raw_http(port: u16, method: &str, path: &str, body: Option<&str>, headers: &[(&str, &str)]) -> String {
    let mut s = TcpStream::connect(("127.0.0.1", port)).unwrap();
    s.set_read_timeout(Some(Duration::from_millis(500))).unwrap();
    let body = body.unwrap_or("");
    let mut req = format!(
        "{} {} HTTP/1.1\r\nHost: t\r\nContent-Length: {}\r\nConnection: close\r\n",
        method, path, body.len()
    );
    for (k, v) in headers {
        req.push_str(&format!("{k}: {v}\r\n"));
    }
    req.push_str("\r\n");
    req.push_str(body);
    s.write_all(req.as_bytes()).unwrap();
    let mut buf = String::new();
    let mut chunk = [0u8; 8192];
    loop {
        match s.read(&mut chunk) {
            Ok(0) => break,
            Ok(n) => buf.push_str(&String::from_utf8_lossy(&chunk[..n])),
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                std::thread::sleep(Duration::from_millis(20));
                continue;
            }
            Err(_) => break,
        }
    }
    buf
}
