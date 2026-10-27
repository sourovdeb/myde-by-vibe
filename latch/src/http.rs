use crate::bridge::{dispatch, Bridge, Runner};
use crate::panel::{self, apply_form};
use crate::settings::Caller;
use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

pub struct Shared<R: Runner> {
    pub bridge: Mutex<Bridge<R>>,
}

pub fn serve<R: Runner + 'static>(
    listener: TcpListener,
    shared: Arc<Shared<R>>,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    listener
        .set_nonblocking(true)
        .map_err(|e| e.to_string())?;
    while !stop.load(Ordering::Relaxed) {
        match listener.accept() {
            Ok((stream, _)) => {
                let shared = Arc::clone(&shared);
                thread::spawn(move || {
                    let _ = handle_client(stream, &shared);
                });
            }
            Err(e) if e.kind() == std::io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(15));
            }
            Err(e) => return Err(e.to_string()),
        }
    }
    Ok(())
}

fn handle_client<R: Runner>(mut stream: TcpStream, shared: &Shared<R>) -> Result<(), String> {
    let _ = stream.set_read_timeout(Some(Duration::from_secs(5)));
    let mut buf = Vec::new();
    let mut tmp = [0u8; 2048];
    let header_end;
    loop {
        let n = stream.read(&mut tmp).map_err(|e| e.to_string())?;
        if n == 0 {
            return Ok(());
        }
        buf.extend_from_slice(&tmp[..n]);
        if let Some(pos) = find_header_end(&buf) {
            header_end = pos;
            break;
        }
        if buf.len() > 64 * 1024 {
            return Ok(());
        }
    }
    let head = String::from_utf8_lossy(&buf[..header_end]).to_string();
    let mut rest = buf[header_end + 4..].to_vec();
    let first = head.lines().next().unwrap_or("");
    let mut parts = first.split_whitespace();
    let method = parts.next().unwrap_or("");
    let target = parts.next().unwrap_or("/");
    let path_only = target.split('?').next().unwrap_or(target);
    if method == "OPTIONS" {
        write_raw(&mut stream, 204, "text/plain", b"", None)?;
        return Ok(());
    }
    let len = content_length(&head).unwrap_or(0);
    while rest.len() < len {
        let n = stream.read(&mut tmp).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        rest.extend_from_slice(&tmp[..n]);
        if rest.len() > 80_000 {
            break;
        }
    }
    let body = &rest[..len.min(rest.len())];
    if method == "GET" && (path_only == "/" || path_only == "/panel") {
        return panel_get(&mut stream, shared, target);
    }
    if method == "POST" && path_only == "/panel" {
        let form = String::from_utf8_lossy(body).into_owned();
        return panel_post(&mut stream, shared, &form);
    }
    if method != "POST" {
        write_raw(
            &mut stream,
            405,
            "application/json",
            b"{\"error\":\"POST only\"}",
            None,
        )?;
        return Ok(());
    }
    let Some(caller) = Caller::from_path(path_only) else {
        write_raw(
            &mut stream,
            404,
            "application/json",
            b"{\"error\":\"unknown path\"}",
            None,
        )?;
        return Ok(());
    };
    let parsed: Result<Value, _> = serde_json::from_slice(body);
    let Ok(value) = parsed else {
        write_raw(
            &mut stream,
            400,
            "application/json",
            br#"{"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":"parse error"}}"#,
            None,
        )?;
        return Ok(());
    };
    let mut bridge = shared.bridge.lock().map_err(|e| e.to_string())?;
    match dispatch(&mut bridge, &value, caller) {
        None => write_raw(&mut stream, 202, "application/json", b"", Some("latch"))?,
        Some(msg) => {
            let bytes = serde_json::to_vec(&msg).map_err(|e| e.to_string())?;
            write_raw(&mut stream, 200, "application/json", &bytes, Some("latch"))?;
        }
    }
    Ok(())
}

fn panel_get<R: Runner>(
    mut stream: &mut TcpStream,
    shared: &Shared<R>,
    target: &str,
) -> Result<(), String> {
    let mut bridge = shared.bridge.lock().map_err(|e| e.to_string())?;
    bridge.reload();
    if !token_ok(&bridge.settings.token, query_token(target)) {
        write_raw(&mut stream, 404, "text/plain", b"not found", None)?;
        return Ok(());
    }
    let html = panel::render(&bridge.settings, false);
    write_raw(&mut stream, 200, "text/html; charset=utf-8", html.as_bytes(), None)
}

fn panel_post<R: Runner>(
    mut stream: &mut TcpStream,
    shared: &Shared<R>,
    form: &str,
) -> Result<(), String> {
    let mut bridge = shared.bridge.lock().map_err(|e| e.to_string())?;
    bridge.reload();
    if let Err(message) = apply_form(&mut bridge.settings, form) {
        bridge.reload();
        let body = format!("refused: {message}");
        write_raw(&mut stream, 403, "text/plain", body.as_bytes(), None)?;
        return Ok(());
    }
    if let Some(path) = bridge.config_path.clone() {
        if let Err(message) = bridge.settings.save(&path) {
            let body = format!("save failed: {message}");
            write_raw(&mut stream, 500, "text/plain", body.as_bytes(), None)?;
            return Ok(());
        }
    }
    let html = panel::render(&bridge.settings, true);
    write_raw(&mut stream, 200, "text/html; charset=utf-8", html.as_bytes(), None)
}

fn token_ok(expected: &str, given: &str) -> bool {
    !expected.is_empty() && given == expected
}

fn query_token(target: &str) -> &str {
    let Some(query) = target.split_once('?').map(|(_, query)| query) else {
        return "";
    };
    for pair in query.split('&') {
        if let Some((key, value)) = pair.split_once('=') {
            if key == "token" {
                return value;
            }
        }
    }
    ""
}

pub fn post_json(addr: &str, path: &str, body: &Value) -> Result<String, String> {
    let bytes = serde_json::to_vec(body).map_err(|e| e.to_string())?;
    let (_status, text) = exchange(addr, "POST", path, "application/json", &bytes)?;
    Ok(text)
}

pub fn exchange(
    addr: &str,
    method: &str,
    path: &str,
    content_type: &str,
    body: &[u8],
) -> Result<(u16, String), String> {
    let mut stream = TcpStream::connect(addr).map_err(|e| e.to_string())?;
    let req = format!(
        "{method} {path} HTTP/1.1\r\nHost: {addr}\r\nContent-Type: {content_type}\r\nAccept: application/json, text/event-stream, text/html\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(req.as_bytes()).map_err(|e| e.to_string())?;
    stream.write_all(body).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    stream.read_to_end(&mut out).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out).into_owned();
    let Some((head, rest)) = text.split_once("\r\n\r\n") else {
        return Err("no http header".into());
    };
    let status = head
        .split_whitespace()
        .nth(1)
        .unwrap_or("0")
        .parse()
        .unwrap_or(0);
    Ok((status, rest.to_string()))
}

fn content_length(head: &str) -> Option<usize> {
    for line in head.lines() {
        let Some((key, value)) = line.split_once(':') else {
            continue;
        };
        if key.eq_ignore_ascii_case("content-length") {
            return value.trim().parse().ok();
        }
    }
    None
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|window| window == b"\r\n\r\n")
}

fn write_raw(
    stream: &mut TcpStream,
    status: u16,
    content_type: &str,
    body: &[u8],
    session: Option<&str>,
) -> Result<(), String> {
    let reason = match status {
        200 => "OK",
        202 => "Accepted",
        204 => "No Content",
        400 => "Bad Request",
        403 => "Forbidden",
        404 => "Not Found",
        405 => "Method Not Allowed",
        500 => "Error",
        _ => "OK",
    };
    let session_line = session
        .map(|value| format!("Mcp-Session-Id: {value}\r\n"))
        .unwrap_or_default();
    let head = format!(
        "HTTP/1.1 {status} {reason}\r\nContent-Type: {content_type}\r\nContent-Length: {}\r\n{session_line}Access-Control-Allow-Origin: *\r\nAccess-Control-Allow-Headers: content-type, accept, mcp-session-id\r\nConnection: close\r\n\r\n",
        body.len()
    );
    stream.write_all(head.as_bytes()).map_err(|e| e.to_string())?;
    stream.write_all(body).map_err(|e| e.to_string())?;
    Ok(())
}

pub fn stdio_line<R: Runner>(bridge: &mut Bridge<R>, line: &str) -> Option<String> {
    let value: Value = serde_json::from_str(line).unwrap_or(json!({}));
    dispatch(bridge, &value, Caller::Local).map(|value| value.to_string())
}
