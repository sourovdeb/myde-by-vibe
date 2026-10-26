use serde_json::json;
use std::io::Write;
use std::net::TcpStream;

use crate::bridge::Bridge;

pub fn handle_admin(
    stream: &mut TcpStream,
    bridge: &Bridge,
    method: String,
    path: String,
    body: String,
) -> std::io::Result<()> {
    match (method.as_str(), path.as_str()) {
        ("GET", "/") => crate::http::respond(stream, 200, "OK", crate::http::SETTINGS_HTML, "text/html"),
        ("GET", "/api/config") => {
            let cfg = bridge.cfg.read().unwrap().clone();
            crate::http::respond(stream, 200, "OK", &serde_json::to_string(&cfg).unwrap(), "application/json")
        }
        ("PUT", "/api/config") => {
            let parsed: serde_json::Value = match serde_json::from_str(&body) {
                Ok(v) => v,
                Err(e) => {
                    let b = json!({"error": format!("parse error: {e}")}).to_string();
                    return crate::http::respond(stream, 400, "Bad Request", &b, "application/json");
                }
            };
            {
                let mut cfg = bridge.cfg.write().unwrap();
                cfg.enabled = parsed.get("enabled").and_then(|v| v.as_bool()).unwrap_or(cfg.enabled);
                cfg.port = parsed.get("port").and_then(|v| v.as_u64()).map(|v| v as u16).unwrap_or(cfg.port);
                cfg.admin_port = parsed.get("admin_port").and_then(|v| v.as_u64()).map(|v| v as u16).unwrap_or(cfg.admin_port);
                cfg.public_url = parsed.get("public_url").and_then(|v| v.as_str()).unwrap_or(&cfg.public_url).to_string();
                cfg.passphrase = parsed.get("passphrase").and_then(|v| v.as_str()).unwrap_or(&cfg.passphrase).to_string();
                if let Some(dirs) = parsed.get("allowed_dirs").and_then(|v| v.as_array()) {
                    cfg.allowed_dirs = dirs.iter().filter_map(|d| d.as_str().map(String::from)).collect();
                }
                if let Some(agents) = parsed.get("agents").and_then(|v| v.as_array()) {
                    if let Ok(new_agents) =
                        serde_json::from_value::<Vec<crate::config::Agent>>(serde_json::json!(agents))
                    {
                        cfg.agents = new_agents;
                    }
                }
                let snapshot = cfg.clone();
                let _ = crate::config::save_config(&snapshot);
            }
            let b = json!({"saved": true}).to_string();
            crate::http::respond(stream, 200, "OK", &b, "application/json")
        }
        _ => {
            stream.write_all(b"HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")?;
            stream.flush()
        }
    }
}
