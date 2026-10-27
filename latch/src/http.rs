use crate::bridge::{dispatch, Bridge, Runner};
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
    if method == "OPTIONS" {
        write_raw(&mut stream, 204, "text/plain", b"", None)?;
        return Ok(());
    }
    if method != "POST" {
        write_raw(&mut stream, 405, "application/json", b"{\"error\":\"POST only\"}", None)?;
        return Ok(());
    }
    let len = content_length(&head).unwrap_or(0);
    while rest.len() < len {
        let n = stream.read(&mut tmp).map_err(|e| e.to_string())?;
        if n == 0 {
            break;
        }
        rest.extend_from_slice(&tmp[..n]);
    }
    let body = &rest[..len.min(rest.len())];
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
    match dispatch(&mut bridge, &value) {
        None => write_raw(&mut stream, 202, "application/json", b"", Some("latch"))?,
        Some(msg) => {
            let bytes = serde_json::to_vec(&msg).map_err(|e| e.to_string())?;
            write_raw(&mut stream, 200, "application/json", &bytes, Some("latch"))?;
        }
    }
    Ok(())
}

pub fn post_json(addr: &str, body: &Value) -> Result<String, String> {
    let mut stream = TcpStream::connect(addr).map_err(|e| e.to_string())?;
    let bytes = serde_json::to_vec(body).map_err(|e| e.to_string())?;
    let req = format!(
        "POST /mcp HTTP/1.1\r\nHost: {addr}\r\nContent-Type: application/json\r\nAccept: application/json, text/event-stream\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",
        bytes.len()
    );
    stream.write_all(req.as_bytes()).map_err(|e| e.to_string())?;
    stream.write_all(&bytes).map_err(|e| e.to_string())?;
    let mut out = Vec::new();
    stream.read_to_end(&mut out).map_err(|e| e.to_string())?;
    let text = String::from_utf8_lossy(&out).into_owned();
    let Some(pos) = text.find("\r\n\r\n") else {
        return Err("no http header".into());
    };
    Ok(text[pos + 4..].to_string())
}

fn content_length(head: &str) -> Option<usize> {
    for line in head.lines() {
        let Some((k, v)) = line.split_once(':') else {
            continue;
        };
        if k.eq_ignore_ascii_case("content-length") {
            return v.trim().parse().ok();
        }
    }
    None
}

fn find_header_end(buf: &[u8]) -> Option<usize> {
    buf.windows(4).position(|w| w == b"\r\n\r\n")
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
        405 => "Method Not Allowed",
        _ => "OK",
    };
    let session_line = session
        .map(|s| format!("Mcp-Session-Id: {s}\r\n"))
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
    dispatch(bridge, &value).map(|v| v.to_string())
}
