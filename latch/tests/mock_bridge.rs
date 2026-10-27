use latch::http::{post_json, serve, stdio_line, Shared};
use latch::settings::{chat_envelope, diagnose_url, ChatCloud, Settings, Verdict};
use latch::{advertised_tools, dispatch, Bridge, MockRunner};
use serde_json::json;
use std::fs;
use std::net::TcpListener;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn bridge(settings: Settings) -> Bridge<MockRunner> {
    Bridge::new(settings, MockRunner::default())
}

#[test]
fn localhost_url_is_rejected_and_public_https_is_accepted() {
    assert!(matches!(
        diagnose_url("http://127.0.0.1:3939"),
        Verdict::Bad(_)
    ));
    assert!(matches!(diagnose_url("https://192.168.1.8/mcp"), Verdict::Bad(_)));
    assert!(matches!(diagnose_url(""), Verdict::Empty));
    assert!(matches!(
        diagnose_url("https://latch.example/mcp"),
        Verdict::Ok(_)
    ));
}

#[test]
fn tools_follow_the_switches() {
    let mut settings = Settings::default();
    settings.clients.pi = false;
    settings.tools.handoff = true;
    settings.tools.shell = false;
    let names: Vec<_> = advertised_tools(&settings).into_iter().map(|t| t.name).collect();
    assert!(names.contains(&"handoff_grok_cli".into()));
    assert!(names.contains(&"handoff_vibe".into()));
    assert!(!names.iter().any(|n| n == "handoff_pi"));
    assert!(!names.iter().any(|n| n == "run_allowlisted"));
}

#[test]
fn server_off_refuses_tools_but_still_initializes() {
    let mut b = bridge(Settings::default());
    assert!(!b.settings.server_on);
    let init = dispatch(
        &mut b,
        &json!({"jsonrpc":"2.0","id":1,"method":"initialize"}),
    )
    .unwrap();
    assert_eq!(init["result"]["serverInfo"]["name"], "Latch");
    let listed = dispatch(
        &mut b,
        &json!({"jsonrpc":"2.0","id":2,"method":"tools/list"}),
    )
    .unwrap();
    assert_eq!(listed["error"]["code"], -32000);
}

#[test]
fn handoff_is_queued_on_the_mock_and_does_not_invent_a_cloud_reply() {
    let mut settings = Settings::default();
    settings.server_on = true;
    let mut b = bridge(settings);
    let reply = dispatch(
        &mut b,
        &json!({
            "jsonrpc":"2.0",
            "id":7,
            "method":"tools/call",
            "params":{"name":"handoff_vibe","arguments":{"text":"list the files"}}
        }),
    )
    .unwrap();
    assert_eq!(reply["result"]["isError"], false);
    assert_eq!(b.runner.handoffs.len(), 1);
    assert_eq!(b.runner.handoffs[0].0, "vibe");
    assert_eq!(b.runner.handoffs[0].1, "list the files");
    let text = reply["result"]["content"][0]["text"].as_str().unwrap();
    assert!(text.contains("queued"));
    assert!(!text.to_lowercase().contains("mistral said"));
}

#[test]
fn shell_refuses_anything_not_on_the_allow_list() {
    let mut settings = Settings::default();
    settings.server_on = true;
    settings.tools.shell = true;
    settings.commands = vec!["git status".into()];
    let mut b = bridge(settings);
    let denied = dispatch(
        &mut b,
        &json!({
            "jsonrpc":"2.0","id":1,"method":"tools/call",
            "params":{"name":"run_allowlisted","arguments":{"text":"rm -rf /"}}
        }),
    )
    .unwrap();
    assert_eq!(denied["result"]["isError"], true);
    assert!(b.runner.commands.is_empty());

    let allowed = dispatch(
        &mut b,
        &json!({
            "jsonrpc":"2.0","id":2,"method":"tools/call",
            "params":{"name":"run_allowlisted","arguments":{"text":"git status"}}
        }),
    )
    .unwrap();
    assert_eq!(allowed["result"]["isError"], false);
    assert_eq!(b.runner.commands, vec!["git status".to_string()]);
}

#[test]
fn file_read_stays_inside_the_mock_map() {
    let mut settings = Settings::default();
    settings.server_on = true;
    settings.folders = vec!["/notes".into()];
    let mut b = bridge(settings);
    b.runner.files.insert("/notes/a.txt".into(), "hello".into());
    let ok = dispatch(
        &mut b,
        &json!({
            "jsonrpc":"2.0","id":1,"method":"tools/call",
            "params":{"name":"read_allowed_file","arguments":{"path":"/notes/a.txt"}}
        }),
    )
    .unwrap();
    assert_eq!(ok["result"]["content"][0]["text"], "hello");

    let escaped = dispatch(
        &mut b,
        &json!({
            "jsonrpc":"2.0","id":2,"method":"tools/call",
            "params":{"name":"read_allowed_file","arguments":{"path":"/etc/passwd"}}
        }),
    )
    .unwrap();
    assert_eq!(escaped["result"]["isError"], true);
}

#[test]
fn switched_off_client_cannot_be_called() {
    let mut settings = Settings::default();
    settings.server_on = true;
    settings.clients.grok_cli = false;
    let mut b = bridge(settings);
    let reply = dispatch(
        &mut b,
        &json!({
            "jsonrpc":"2.0","id":1,"method":"tools/call",
            "params":{"name":"handoff_grok_cli","arguments":{"text":"hi"}}
        }),
    )
    .unwrap();
    assert_eq!(reply["result"]["isError"], true);
    assert!(b.runner.handoffs.is_empty());
}

#[test]
fn chat_envelope_keeps_system_and_user_apart() {
    let settings = Settings::default();
    let msg = chat_envelope(ChatCloud::Mistral, &settings, "How far is the moon?");
    assert_eq!(msg["model"], "mistral-large-latest");
    assert_eq!(msg["messages"][0]["role"], "system");
    assert_eq!(msg["messages"][1]["role"], "user");
    assert_eq!(msg["messages"][1]["content"], "How far is the moon?");
}

#[test]
fn settings_roundtrip_and_stdio_line() {
    let dir = std::env::temp_dir().join(format!("latch-test-{}", std::process::id()));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).unwrap();
    let path = dir.join("latch.json");
    let mut settings = Settings::default();
    settings.server_on = true;
    settings.public_url = "https://latch.example/mcp".into();
    settings.save(&path).unwrap();
    let loaded = Settings::load(&path).unwrap();
    assert!(loaded.server_on);
    assert_eq!(loaded.port, 3939);

    let mut b = bridge(loaded);
    let line = r#"{"jsonrpc":"2.0","id":3,"method":"tools/list"}"#;
    let reply = stdio_line(&mut b, line).unwrap();
    let value: serde_json::Value = serde_json::from_str(&reply).unwrap();
    assert!(value["result"]["tools"].as_array().unwrap().len() >= 1);
    let _ = fs::remove_dir_all(&dir);
}

#[test]
fn http_mock_speaks_jsonrpc_without_leaving_the_machine() {
    let listener = TcpListener::bind("127.0.0.1:0").unwrap();
    let addr = listener.local_addr().unwrap();
    let mut settings = Settings::default();
    settings.server_on = true;
    let shared = Arc::new(Shared {
        bridge: Mutex::new(bridge(settings)),
    });
    let stop = Arc::new(AtomicBool::new(false));
    let flag = Arc::clone(&stop);
    thread::spawn(move || {
        let _ = serve(listener, shared, flag);
    });
    thread::sleep(Duration::from_millis(40));
    let body = post_json(
        &addr.to_string(),
        &json!({"jsonrpc":"2.0","id":9,"method":"initialize","params":{}}),
    )
    .unwrap();
    let value: serde_json::Value = serde_json::from_str(&body).unwrap();
    assert_eq!(value["result"]["protocolVersion"], "2025-03-26");
    assert_eq!(value["id"], 9);
    stop.store(true, Ordering::Relaxed);
}
