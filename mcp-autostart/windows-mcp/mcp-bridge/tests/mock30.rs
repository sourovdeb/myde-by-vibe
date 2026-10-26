//! 30-scenario mock test suite: drives the bridge over real TCP in --mock
//! semantics (mock_mode=true), covering the full usable path from a cloud
//! chat's perspective: workflow one-click, agent tools, jobs, OAuth,
//! admin settings, protocol eras, and error handling.
//! Run: cargo test --test mock30 -- --nocapture

use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::Arc;
use std::time::Duration;

use mcp_bridge_lib::*;

fn boot() -> (u16, u16, Arc<bridge::Bridge>) {
    let mut cfg = config::Config::default();
    // allow the default workflow workdirs (E:/ONE-STOP-SHOP/... on the
    // real machine; canonicalize-miss falls back to literal path compare,
    // so a nonexistent dir still matches its literal config entry)
    let mut dirs = vec!["/tmp".to_string()];
    dirs.extend(config::default_workflows().iter().map(|w| w.workdir.clone()));
    cfg.allowed_dirs = dirs;
    let b = Arc::new(bridge::Bridge::new(cfg, true));
    let mcp_l = TcpListener::bind("127.0.0.1:0").unwrap();
    let admin_l = TcpListener::bind("127.0.0.1:0").unwrap();
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
    std::thread::sleep(Duration::from_millis(80));
    (mcp_port, admin_port, b)
}

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
    let mut chunk = [0u8; 16384];
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
    let status: u16 = buf.split_whitespace().nth(1).and_then(|c| c.parse().ok()).unwrap_or(0);
    let body = buf.split("\r\n\r\n").nth(1).unwrap_or("").to_string();
    (status, body)
}

fn call_tool(port: u16, id: i32, tool: &str, args: serde_json::Value) -> (u16, serde_json::Value) {
    let body = serde_json::json!({
        "jsonrpc": "2.0", "id": id, "method": "tools/call",
        "params": {"name": tool, "arguments": args}
    })
    .to_string();
    let (st, resp) = http(port, "POST", "/mcp", Some(&body), &[]);
    let v: serde_json::Value = serde_json::from_str(&resp).unwrap_or(serde_json::Value::Null);
    (st, v)
}

fn tool_text(v: &serde_json::Value) -> String {
    v["result"]["content"][0]["text"]
        .as_str()
        .unwrap_or("")
        .to_string()
}

fn parse(t: &str) -> serde_json::Value {
    serde_json::from_str(t).unwrap_or(serde_json::Value::Null)
}

#[test]
fn mock30_suite() {
    let (port, admin_port, b) = boot();
    let mut pass = 0;
    let mut fail: Vec<String> = Vec::new();
    let mut check = |n: u8, name: &str, ok: bool, detail: &str| {
        if ok {
            pass += 1;
            println!("PASS {n:02}: {name}");
        } else {
            fail.push(format!("{n:02} {name}: {detail}"));
            println!("FAIL {n:02}: {name}: {detail}");
        }
    };

    // ---- Workflows (the one-click layer) ----
    let (st, body) = http(port, "POST", "/mcp", Some(r#"{"jsonrpc":"2.0","id":1,"method":"tools/list"}"#), &[]);
    let tools: Vec<String> = parse(&body)["result"]["tools"]
        .as_array()
        .map(|a| a.iter().map(|t| t["name"].as_str().unwrap_or("").to_string()).collect())
        .unwrap_or_default();
    check(1, "tools/list exposes 7 tools", st == 200 && tools.len() == 7, &format!("st={st} n={}", tools.len()));

    let (st, v) = call_tool(port, 2, "bridge_list_workflows", serde_json::json!({}));
    let wfs = parse(&tool_text(&v))["workflows"].as_array().cloned().unwrap_or_default();
    check(2, "list_workflows returns the 5 named workflows", st == 200 && wfs.len() == 5, &format!("n={}", wfs.len()));
    let names: Vec<&str> = wfs.iter().filter_map(|w| w["name"].as_str()).collect();
    check(3, "workflow names include podcast-producer", names.contains(&"podcast-producer"), &names.join(","));
    check(4, "workflow names include wordpress-maintainer", names.contains(&"wordpress-maintainer"), &names.join(","));
    check(5, "all 5 mistral-workflows present", names.contains(&"academic-paper-pipeline") && names.contains(&"content-scheduler") && names.contains(&"mishu-critical-thinking-decision-audit"), &names.join(","));

    let (st, v) = call_tool(port, 6, "bridge_run_workflow", serde_json::json!({"workflow": "podcast-producer", "input": "episode 12 about Reunion culture"}));
    let out = tool_text(&v);
    check(6, "run_workflow podcast one-click returns MOCK ok", st == 200 && out.contains("MOCK vibe ok"), &out);
    check(7, "workflow prompt template rendered with input", out.contains("episode 12 about Reunion culture"), &out);
    check(8, "workflow uses its configured agent", out.contains("MOCK vibe ok"), &out);

    let (st, v) = call_tool(port, 9, "bridge_run_workflow", serde_json::json!({"workflow": "wordpress-maintainer", "input": "weekly maintenance"}));
    check(9, "wordpress-maintainer one-click works", st == 200 && tool_text(&v).contains("MOCK claude ok"), &tool_text(&v));

    let (_, v) = call_tool(port, 10, "bridge_run_workflow", serde_json::json!({"workflow": "mishu-critical-thinking-decision-audit", "input": "should I migrate hosts?"}));
    check(10, "audit workflow renders structured prompt", tool_text(&v).contains("critical-thinking"), &tool_text(&v));

    let (st, v) = call_tool(port, 11, "bridge_run_workflow", serde_json::json!({"workflow": "no-such-workflow", "input": "x"}));
    check(11, "unknown workflow is a clean error", st == 200 && v["result"]["isError"] == serde_json::json!(true), &v.to_string());

    let (_, v) = call_tool(port, 12, "bridge_run_workflow", serde_json::json!({"workflow": "content-scheduler"}));
    check(12, "workflow runs with empty input", tool_text(&v).contains("MOCK vibe ok"), &tool_text(&v));

    // ---- Agents ----
    let (st, v) = call_tool(port, 13, "bridge_list_agents", serde_json::json!({}));
    let agents = parse(&tool_text(&v))["agents"].as_array().cloned().unwrap_or_default();
    check(13, "list_agents shows 4 agents, all found", st == 200 && agents.len() == 4 && agents.iter().all(|a| a["found"] == serde_json::json!(true)), &format!("n={}", agents.len()));

    for (i, agent) in ["claude", "grok", "vibe", "pi"].iter().enumerate() {
        let (_, v) = call_tool(port, 14 + i as i32, "bridge_run_agent", serde_json::json!({"agent": agent, "prompt": "status check", "workdir": "/tmp"}));
        check(14 + i as u8, &format!("run_agent {agent} mock"), tool_text(&v).contains(&format!("MOCK {agent} ok")), &tool_text(&v));
    }

    // ---- Security ----
    let (_, v) = call_tool(port, 18, "bridge_run_agent", serde_json::json!({"agent": "claude", "prompt": "x", "workdir": "/etc"}));
    check(18, "workdir outside allowlist rejected", tool_text(&v).contains("allowlist"), &tool_text(&v));

    let (_, v) = call_tool(port, 19, "bridge_run_agent", serde_json::json!({"agent": "ghost", "prompt": "x"}));
    check(19, "unknown agent rejected", tool_text(&v).contains("not found") || tool_text(&v).contains("disabled"), &tool_text(&v));

    b.cfg.write().unwrap().enabled = false;
    let (st, _) = http(port, "GET", "/healthz", None, &[]);
    let (_, v) = call_tool(port, 20, "bridge_run_workflow", serde_json::json!({"workflow": "podcast-producer", "input": "x"}));
    check(20, "disabled toggle: 503 healthz + workflow refused", st == 503 && tool_text(&v).contains("disabled"), &tool_text(&v));
    b.cfg.write().unwrap().enabled = true;

    // ---- Jobs ----
    let (_, v) = call_tool(port, 21, "bridge_start_agent", serde_json::json!({"agent": "grok", "prompt": "long task", "workdir": "/tmp"}));
    let t = tool_text(&v);
    let job_id = parse(&t)["job_id"].as_str().unwrap_or("").to_string();
    check(21, "start_agent returns a job id", job_id.starts_with("job-"), &t);
    let (_, v) = call_tool(port, 22, "bridge_job_poll", serde_json::json!({"job_id": job_id}));
    let poll = tool_text(&v);
    check(22, "job_poll returns status", parse(&poll)["status"].is_string(), &poll);
    let (_, v) = call_tool(port, 23, "bridge_job_cancel", serde_json::json!({"job_id": job_id}));
    check(23, "job_cancel works", parse(&tool_text(&v))["status"].as_str().map(|s| s == "cancelled" || s == "running").unwrap_or(false), &tool_text(&v));
    let (_, v) = call_tool(port, 24, "bridge_job_poll", serde_json::json!({"job_id": "job-999"}));
    check(24, "polling unknown job errors cleanly", v["result"]["isError"] == serde_json::json!(true), &v.to_string());

    // ---- Admin settings ----
    let (st, body) = http(admin_port, "GET", "/api/config", None, &[]);
    let cfgv: serde_json::Value = serde_json::from_str(&body).unwrap_or(serde_json::Value::Null);
    check(25, "admin config API exposes workflows", st == 200 && cfgv["workflows"].as_array().map(|a| a.len() == 5).unwrap_or(false), &body[..80.min(body.len())]);
    let (st, body) = http(admin_port, "GET", "/", None, &[]);
    check(26, "settings page served on admin port", st == 200 && body.contains("mcp-bridge settings"), &body[..40.min(body.len())]);

    // toggle off via admin API (single entry point), then restore
    let mut newcfg = cfgv.clone();
    newcfg["enabled"] = serde_json::json!(false);
    let (st, _) = http(admin_port, "PUT", "/api/config", Some(&newcfg.to_string()), &[("Content-Type", "application/json")]);
    let now_off = b.cfg.read().unwrap().enabled == false;
    let (st2, _) = http(admin_port, "PUT", "/api/config", Some(&{ let mut c = newcfg.clone(); c["enabled"] = serde_json::json!(true); c.to_string() }), &[("Content-Type", "application/json")]);
    let now_on = b.cfg.read().unwrap().enabled == true;
    check(27, "settings toggle off then on in same settings API", st == 200 && now_off && st2 == 200 && now_on, &format!("st={st} off={now_off} st2={st2} on={now_on}"));

    // ---- Protocol eras ----
    let (st, body) = http(port, "POST", "/mcp", Some(r#"{"jsonrpc":"2.0","id":28,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}"#), &[]);
    check(28, "era-1 initialize handshake", st == 200 && body.contains("2025-06-18"), &body[..60.min(body.len())]);
    let (st, body) = http(port, "POST", "/mcp", Some(r#"{"jsonrpc":"2.0","id":"e","params":{},"_meta":{"protocolVersion":"2026-07-28"}}"#), &[("Mcp-Method", "tools/list")]);
    check(29, "era-2 header-method tools/list", st == 200 && body.contains("bridge_run_workflow"), &body[..60.min(body.len())]);

    // ---- HTTP robustness ----
    let (st, _) = http(port, "POST", "/mcp", Some("broken"), &[]);
    check(30, "invalid JSON -> 400 parse error", st == 400, &format!("st={st}"));

    println!("\nmock30 result: {pass}/30 passed, {} failed", fail.len());
    for f in &fail {
        println!("  FAILED: {f}");
    }
    assert!(fail.is_empty(), "{} of 30 scenarios failed", fail.len());
}
