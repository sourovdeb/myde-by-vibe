use serde_json::{json, Value};
use std::io::{BufRead, BufReader, Read, Write};
use std::net::{Shutdown, TcpListener, TcpStream};

use crate::bridge::Bridge;

pub fn serve(listener: TcpListener, bridge: std::sync::Arc<Bridge>, is_admin: bool) {
    for stream in listener.incoming() {
        let Ok(stream) = stream else { continue };
        let bridge = bridge.clone();
        std::thread::spawn(move || {
            let _ = handle_conn(stream, &bridge, is_admin);
        });
    }
}

fn handle_conn(stream: TcpStream, bridge: &Bridge, is_admin: bool) -> std::io::Result<()> {
    // one BufReader for the whole request: headers and body share its buffer
    let mut reader = BufReader::new(stream);
    let (method, path, headers) = read_request(&mut reader)?;
    let body = read_body(&mut reader, &headers);
    let mut stream = reader.into_inner();

    if is_admin {
        crate::http_admin::handle_admin(&mut stream, bridge, method, path, body)
    } else {
        handle_mcp(&mut stream, bridge, method, path, headers, body)
    }
}

type Headers = Vec<(String, String)>;

fn read_request(reader: &mut BufReader<TcpStream>) -> std::io::Result<(String, String, Headers)> {
    let mut line = String::new();
    reader.read_line(&mut line)?;
    let mut parts = line.split_whitespace();
    let method = parts.next().unwrap_or("").to_string();
    let path = parts.next().unwrap_or("/").to_string();
    let mut headers = Vec::new();
    loop {
        let mut h = String::new();
        reader.read_line(&mut h)?;
        let h = h.trim_end();
        if h.is_empty() {
            break;
        }
        if let Some((k, v)) = h.split_once(':') {
            headers.push((k.trim().to_lowercase(), v.trim().to_string()));
        }
    }
    Ok((method, path, headers))
}

fn read_body(reader: &mut BufReader<TcpStream>, headers: &Headers) -> String {
    let len: usize = headers
        .iter()
        .find(|(k, _)| k == "content-length")
        .and_then(|(_, v)| v.parse().ok())
        .unwrap_or(0);
    let mut buf = vec![0u8; len.min(10 * 1024 * 1024)];
    if len > 0 {
        let _ = reader.read_exact(&mut buf);
    }
    String::from_utf8_lossy(&buf).into_owned()
}

pub fn respond(stream: &mut TcpStream, status: u16, reason: &str, body: &str, ctype: &str) -> std::io::Result<()> {
    let resp = format!(
        "HTTP/1.1 {} {}\r\nContent-Type: {}\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
        status, reason, ctype, body.len(), body
    );
    stream.write_all(resp.as_bytes())?;
    stream.flush()?;
    stream.shutdown(Shutdown::Write)
}

fn respond_json(stream: &mut TcpStream, status: u16, body: &str) -> std::io::Result<()> {
    let reason = match status {
        200 => "OK",
        202 => "Accepted",
        400 => "Bad Request",
        401 => "Unauthorized",
        404 => "Not Found",
        405 => "Method Not Allowed",
        503 => "Service Unavailable",
        _ => "Error",
    };
    respond(stream, status, reason, body, "application/json")
}

fn handle_mcp(
    stream: &mut TcpStream,
    bridge: &Bridge,
    method: String,
    path: String,
    headers: Headers,
    body: String,
) -> std::io::Result<()> {
    if path == "/healthz" {
        let on = bridge.cfg.read().unwrap().enabled;
        return if on {
            respond_json(stream, 200, &json!({"status":"ok"}).to_string())
        } else {
            respond_json(stream, 503, &json!({"status":"disabled"}).to_string())
        };
    }

    if path != "/mcp" {
        return respond_json(stream, 404, &json!({"error":"not found"}).to_string());
    }

    if method != "POST" {
        return respond_json(stream, 405, &json!({"error":"POST required"}).to_string());
    }

    // bearer check; 401 points at the OAuth metadata (step 8 wires full OAuth)
    if let Some(err) = bridge.check_auth(&headers) {
        let hdr = format!(
            "HTTP/1.1 401 Unauthorized\r\nWWW-Authenticate: Bearer error=\"{err}\", resource_metadata=\"/.well-known/oauth-protected-resource\"\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
        );
        stream.write_all(hdr.as_bytes())?;
        return stream.shutdown(Shutdown::Write);
    }

    let parsed: Value = match serde_json::from_str(&body) {
        Ok(v) => v,
        Err(e) => {
            let b = json!({"jsonrpc":"2.0","id":null,"error":{"code":-32700,"message":format!("parse error: {e}")}}).to_string();
            return respond_json(stream, 400, &b);
        }
    };
    let header_method = headers
        .iter()
        .find(|(k, _)| k == "mcp-method")
        .map(|(_, v)| v.clone());
    let resp = bridge.handle(&parsed, header_method.as_deref());

    let is_notification = parsed.get("method").and_then(|m| m.as_str())
        == Some("notifications/initialized")
        || (parsed.get("method").is_none() && header_method.is_none());
    let status = if is_notification {
        202
    } else if resp.get("error").is_some() {
        400
    } else {
        200
    };
    respond_json(stream, status, &resp.to_string())
}

pub const SETTINGS_HTML: &str = r#"<!doctype html><html><head><meta charset="utf-8"><title>mcp-bridge settings</title>
<style>body{font-family:system-ui;max-width:640px;margin:2rem auto;padding:0 1rem}
label{display:block;margin-top:.8rem}input,select{width:100%;padding:.4rem}
button{margin-top:1rem;padding:.5rem 1.5rem}.ok{color:green}</style></head>
<body><h2>mcp-bridge</h2>
<p id="status">loading…</p>
<form id="f">
<label>Enabled <input type="checkbox" id="enabled"></label>
<label>Port <input type="number" id="port"></label>
<label>Public URL <input type="text" id="public_url" placeholder="https://machine.tailnet.ts.net/mcp"></label>
<label>Passphrase <input type="password" id="passphrase"></label>
<label>Allowed dirs (comma separated) <input type="text" id="allowed_dirs"></label>
<div id="agents"></div>
<button type="button" onclick="save()">Save</button> <span id="saved" class="ok"></span>
</form>
<script>
async function load(){const c=await (await fetch('/api/config')).json();
document.getElementById('enabled').checked=c.enabled;
document.getElementById('port').value=c.port;
document.getElementById('public_url').value=c.public_url||'';
document.getElementById('passphrase').value=c.passphrase||'';
document.getElementById('allowed_dirs').value=(c.allowed_dirs||[]).join(', ');
document.getElementById('status').textContent=c.enabled?'ON':'OFF';
let a='';for(const g of (c.agents||[])){a+=`<fieldset><legend>${g.name}</legend>
<label>enabled <input type="checkbox" data-a="${g.name}" data-k="enabled" ${g.enabled?'checked':''}></label>
<label>mode <select data-a="${g.name}" data-k="mode"><option ${g.mode==='readonly'?'selected':''}>readonly</option><option ${g.mode==='full'?'selected':''}>full</option></select></label></fieldset>`;}
document.getElementById('agents').innerHTML=a;}
async function save(){const cur=await (await fetch('/api/config')).json();
cur.enabled=document.getElementById('enabled').checked;
cur.port=+document.getElementById('port').value;
cur.public_url=document.getElementById('public_url').value;
cur.passphrase=document.getElementById('passphrase').value;
cur.allowed_dirs=document.getElementById('allowed_dirs').value.split(',').map(s=>s.trim()).filter(Boolean);
document.querySelectorAll('[data-a]').forEach(el=>{const a=cur.agents.find(x=>x.name===el.dataset.a);a[el.dataset.k]=el.dataset.k==='enabled'?el.checked:el.value;});
await fetch('/api/config',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify(cur)});
document.getElementById('saved').textContent='saved';load();}
load();
</script></body></html>"#;
