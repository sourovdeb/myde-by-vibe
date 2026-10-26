use serde_json::{json, Value};

use crate::bridge::Bridge;

pub const PROTOCOL_VERSION: &str = "2025-06-18";
pub const NEW_PROTOCOL_VERSION: &str = "2026-07-28";

pub struct Request<'a> {
    pub method: &'a str,
    pub id: Option<&'a Value>,
    pub params: &'a Value,
}

impl Bridge {
    /// Handle one JSON-RPC request. Supports both eras:
    /// - old: initialize + notifications/initialized + session-free calls
    /// - 2026-07-28: standalone POSTs, version in _meta, Mcp-Method header
    pub fn handle(&self, body: &Value, header_method: Option<&str>) -> Value {
        let method = body
            .get("method")
            .and_then(|m| m.as_str())
            .or(header_method)
            .unwrap_or("");
        let id = body.get("id");
        let empty = json!({});
        let params = body.get("params").unwrap_or(&empty);
        let req = Request { method, id, params };

        let result: Option<Value> = match method {
            "initialize" => Some(self.initialize(&req)),
            "notifications/initialized" => None, // notification: 202
            "ping" => Some(json!({})),
            "server/discover" => Some(self.discover(&req)),
            "tools/list" => Some(self.tools_list(&req)),
            "tools/call" => Some(self.tools_call(&req)),
            "" => {
                return error_response(id, -32600, "missing method");
            }
            _ => {
                return error_response(id, -32601, &format!("method not found: {method}"));
            }
        };

        match result {
            Some(v) => {
                let mut r = json!({"jsonrpc": "2.0", "result": v});
                if let Some(id) = id {
                    r["id"] = id.clone();
                } else {
                    r["id"] = Value::Null;
                }
                r
            }
            None => json!({"jsonrpc": "2.0", "id": Value::Null, "result": {}}),
        }
    }

    fn initialize(&self, _req: &Request) -> Value {
        json!({
            "protocolVersion": PROTOCOL_VERSION,
            "capabilities": {"tools": {"listChanged": false}},
            "serverInfo": {"name": "mcp-bridge", "version": env!("CARGO_PKG_VERSION")}
        })
    }

    fn discover(&self, _req: &Request) -> Value {
        json!({
            "protocolVersion": NEW_PROTOCOL_VERSION,
            "capabilities": {"tools": {}},
            "serverInfo": {"name": "mcp-bridge", "version": env!("CARGO_PKG_VERSION")}
        })
    }

    fn tools_list(&self, _req: &Request) -> Value {
        // 2026-07-28-era responses carry ttlMs/cacheScope in result _meta
        json!({
            "tools": crate::bridge::Bridge::tool_defs(),
            "_meta": {"ttlMs": 60000, "cacheScope": "server"}
        })
    }

    fn tools_call(&self, req: &Request) -> Value {
        let name = req.params.get("name").and_then(|v| v.as_str()).unwrap_or("");
        let args = req.params.get("arguments").cloned().unwrap_or(json!({}));
        match self.dispatch(name, &args) {
            Ok(v) => json!({"content": [{"type": "text", "text": v.to_string()}]}),
            Err(e) => json!({
                "content": [{"type": "text", "text": e}],
                "isError": true
            }),
        }
    }
}

fn error_response(id: Option<&Value>, code: i64, msg: &str) -> Value {
    let mut r = json!({"jsonrpc": "2.0", "error": {"code": code, "message": msg}});
    match id {
        Some(id) => r["id"] = id.clone(),
        None => r["id"] = Value::Null,
    }
    r
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    fn bridge() -> Bridge {
        let mut cfg = Config::default();
        cfg.allowed_dirs = vec!["/tmp".into()];
        Bridge::new(cfg, true)
    }

    #[test]
    fn era1_initialize_handshake() {
        let b = bridge();
        let body = json!({"jsonrpc":"2.0","id":1,"method":"initialize",
            "params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"claude.ai"}}});
        let r = b.handle(&body, None);
        assert_eq!(r["id"], 1);
        assert_eq!(r["result"]["protocolVersion"], "2025-06-18");
        assert_eq!(r["result"]["serverInfo"]["name"], "mcp-bridge");
    }

    #[test]
    fn initialized_notification() {
        let b = bridge();
        let body = json!({"jsonrpc":"2.0","method":"notifications/initialized"});
        let r = b.handle(&body, None);
        assert!(r.get("result").is_some());
    }

    #[test]
    fn ping() {
        let b = bridge();
        let r = b.handle(&json!({"jsonrpc":"2.0","id":7,"method":"ping"}), None);
        assert_eq!(r["id"], 7);
        assert_eq!(r["result"], json!({}));
    }

    #[test]
    fn era2_header_method_no_body_method() {
        // 2026-07-28: method via Mcp-Method header, version via _meta
        let b = bridge();
        let body = json!({"jsonrpc":"2.0","id":"a1","params":{},
            "_meta":{"protocolVersion":"2026-07-28"}});
        let r = b.handle(&body, Some("tools/list"));
        assert_eq!(r["id"], "a1");
        let tools = r["result"]["tools"].as_array().unwrap();
        assert_eq!(tools.len(), 5);
        assert_eq!(r["result"]["_meta"]["ttlMs"], 60000);
    }

    #[test]
    fn tools_call_mock_run() {
        let b = bridge();
        let body = json!({"jsonrpc":"2.0","id":3,"method":"tools/call","params":{
            "name":"bridge_run_agent",
            "arguments":{"agent":"vibe","prompt":"hi","workdir":"/tmp"}}});
        let r = b.handle(&body, None);
        let text = r["result"]["content"][0]["text"].as_str().unwrap();
        assert!(text.contains("MOCK vibe ok"));
    }

    #[test]
    fn tools_call_error_is_json_error() {
        let b = bridge();
        let body = json!({"jsonrpc":"2.0","id":4,"method":"tools/call","params":{
            "name":"bridge_run_agent",
            "arguments":{"agent":"nope","prompt":"hi"}}});
        let r = b.handle(&body, None);
        assert_eq!(r["result"]["isError"], true);
    }

    #[test]
    fn unknown_method_error() {
        let b = bridge();
        let r = b.handle(&json!({"jsonrpc":"2.0","id":9,"method":"bogus/x"}), None);
        assert_eq!(r["error"]["code"], -32601);
    }

    #[test]
    fn missing_method_error() {
        let b = bridge();
        let r = b.handle(&json!({"jsonrpc":"2.0","id":10}), None);
        assert_eq!(r["error"]["code"], -32600);
    }

    #[test]
    fn server_discover() {
        let b = bridge();
        let r = b.handle(&json!({"jsonrpc":"2.0","id":2,"method":"server/discover","params":{}}), None);
        assert_eq!(r["result"]["protocolVersion"], "2026-07-28");
    }
}
