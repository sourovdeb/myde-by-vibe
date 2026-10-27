use crate::settings::Settings;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub trait Runner: Send {
    fn handoff(&mut self, client: &str, text: &str) -> Result<String, String>;
    fn note(&mut self, text: &str) -> Result<String, String>;
    fn run_allowed(&mut self, command: &str) -> Result<String, String>;
    fn read_file(&mut self, path: &str) -> Result<String, String>;
}

/// Records calls. Never starts a CLI and never opens the network.
#[derive(Debug, Default)]
pub struct MockRunner {
    pub handoffs: Vec<(String, String)>,
    pub notes: Vec<String>,
    pub commands: Vec<String>,
    pub files: HashMap<String, String>,
}

impl Runner for MockRunner {
    fn handoff(&mut self, client: &str, text: &str) -> Result<String, String> {
        self.handoffs.push((client.to_string(), text.to_string()));
        Ok(format!("queued for {client}"))
    }

    fn note(&mut self, text: &str) -> Result<String, String> {
        self.notes.push(text.to_string());
        Ok("noted".into())
    }

    fn run_allowed(&mut self, command: &str) -> Result<String, String> {
        self.commands.push(command.to_string());
        Ok(format!("mock:{command}"))
    }

    fn read_file(&mut self, path: &str) -> Result<String, String> {
        self.files
            .get(path)
            .cloned()
            .ok_or_else(|| format!("mock file missing: {path}"))
    }
}

/// Real disk and process runner. Shell entries run only as a direct argv,
/// never through a shell, and only after the allow list matched exactly.
pub struct FsRunner;

impl Runner for FsRunner {
    fn handoff(&mut self, client: &str, text: &str) -> Result<String, String> {
        let dir = default_state_dir();
        fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
        let path = dir.join("handoffs.jsonl");
        let line = serde_json::json!({ "client": client, "text": text });
        let mut file = fs::OpenOptions::new()
            .create(true)
            .append(true)
            .open(&path)
            .map_err(|e| e.to_string())?;
        use std::io::Write;
        writeln!(file, "{line}").map_err(|e| e.to_string())?;
        Ok(format!("queued in {}", path.display()))
    }

    fn note(&mut self, text: &str) -> Result<String, String> {
        self.handoff("copilot", text)
    }

    fn run_allowed(&mut self, command: &str) -> Result<String, String> {
        let mut parts = split_args(command);
        if parts.is_empty() {
            return Err("empty command".into());
        }
        let prog = parts.remove(0);
        let out = Command::new(&prog)
            .args(&parts)
            .output()
            .map_err(|e| format!("could not start {prog}: {e}"))?;
        let mut text = String::from_utf8_lossy(&out.stdout).into_owned();
        if !out.status.success() {
            let err = String::from_utf8_lossy(&out.stderr);
            text.push_str(&err);
            if text.len() > 8_000 {
                text.truncate(8_000);
            }
            return Err(format!("exit {}: {text}", out.status));
        }
        if text.len() > 8_000 {
            text.truncate(8_000);
        }
        Ok(text)
    }

    fn read_file(&mut self, path: &str) -> Result<String, String> {
        let text = fs::read_to_string(path).map_err(|e| e.to_string())?;
        if text.len() > 32_000 {
            Ok(text.chars().take(32_000).collect())
        } else {
            Ok(text)
        }
    }
}

fn default_state_dir() -> PathBuf {
    if let Ok(home) = std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        return PathBuf::from(home).join(".mcp-autostart");
    }
    PathBuf::from(".mcp-autostart")
}

pub struct Bridge<R: Runner> {
    pub settings: Settings,
    pub runner: R,
}

impl<R: Runner> Bridge<R> {
    pub fn new(settings: Settings, runner: R) -> Self {
        Self { settings, runner }
    }
}

#[derive(Debug, Clone)]
pub struct ToolCard {
    pub name: String,
    pub description: String,
}

pub fn advertised_tools(s: &Settings) -> Vec<ToolCard> {
    let mut tools = Vec::new();
    if s.tools.files {
        let description = if s.folders.is_empty() {
            "Refuses every read until you list at least one folder.".into()
        } else {
            format!("Read a file inside: {}.", s.folders.join(", "))
        };
        tools.push(ToolCard {
            name: "read_allowed_file".into(),
            description,
        });
    }
    if s.tools.shell {
        let description = if s.commands.is_empty() {
            "Refuses every command. The allow list is empty.".into()
        } else {
            format!("Run only: {}.", s.commands.join(" · "))
        };
        tools.push(ToolCard {
            name: "run_allowlisted".into(),
            description,
        });
    }
    if s.tools.handoff && s.clients.grok_cli {
        tools.push(ToolCard {
            name: "handoff_grok_cli".into(),
            description: "Queue one task for the local Grok CLI. This does not open the grok.com thread.".into(),
        });
    }
    if s.tools.handoff && s.clients.pi {
        tools.push(ToolCard {
            name: "handoff_pi".into(),
            description: "Queue one task for Pi on this PC. Pi still uses its own model login.".into(),
        });
    }
    if s.tools.handoff && s.clients.vibe {
        tools.push(ToolCard {
            name: "handoff_vibe".into(),
            description: "Queue one task for the Vibe CLI. Vibe still talks to Mistral on its own.".into(),
        });
    }
    if s.clients.copilot {
        tools.push(ToolCard {
            name: "copilot_note".into(),
            description: "Leave a short note for the local copilot window.".into(),
        });
    }
    if tools.is_empty() {
        tools.push(ToolCard {
            name: "ping".into(),
            description: "The process can answer, but every tool is switched off.".into(),
        });
    }
    tools
}

/// Handle one JSON-RPC request. Notifications (no id) return None.
pub fn dispatch<R: Runner>(bridge: &mut Bridge<R>, req: &Value) -> Option<Value> {
    if !req.is_object() {
        return Some(err(Value::Null, -32600, "request must be a JSON object"));
    }
    let id = req.get("id").cloned();
    let Some(method) = req.get("method").and_then(|m| m.as_str()) else {
        return Some(err(id.unwrap_or(Value::Null), -32600, "missing method"));
    };
    if id.is_none() {
        return None;
    }
    let id = id.unwrap();
    if method != "initialize" && method != "ping" && !bridge.settings.server_on {
        return Some(err(
            id,
            -32000,
            "Latch server is off. Turn it on before calling tools.",
        ));
    }
    let result = match method {
        "initialize" => json!({
            "protocolVersion": "2025-03-26",
            "capabilities": { "tools": { "listChanged": false } },
            "serverInfo": { "name": bridge.settings.name, "version": "0.1.0" },
            "instructions": "Latch queues tasks for local CLIs. It does not merge cloud transcripts."
        }),
        "ping" => json!({ "serverOn": bridge.settings.server_on }),
        "tools/list" => json!({
            "tools": advertised_tools(&bridge.settings).into_iter().map(|t| json!({
                "name": t.name,
                "description": t.description,
                "inputSchema": {
                    "type": "object",
                    "properties": { "text": { "type": "string" }, "path": { "type": "string" } },
                    "additionalProperties": false
                }
            })).collect::<Vec<_>>()
        }),
        "tools/call" => match call_tool(bridge, req.get("params").unwrap_or(&Value::Null)) {
            Ok(text) => json!({
                "content": [{ "type": "text", "text": text }],
                "isError": false
            }),
            Err(message) => json!({
                "content": [{ "type": "text", "text": message }],
                "isError": true
            }),
        },
        _ => return Some(err(id, -32601, "method not found")),
    };
    Some(json!({ "jsonrpc": "2.0", "id": id, "result": result }))
}

fn call_tool<R: Runner>(bridge: &mut Bridge<R>, params: &Value) -> Result<String, String> {
    let name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("tools/call needs a name")?;
    let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
    let text = args.get("text").and_then(|v| v.as_str()).unwrap_or("");
    let path = args.get("path").and_then(|v| v.as_str()).unwrap_or(text);
    let known = advertised_tools(&bridge.settings);
    if !known.iter().any(|t| t.name == name) {
        return Err(format!("tool {name} is switched off"));
    }
    match name {
        "ping" => Ok("pong".into()),
        "read_allowed_file" => read_jailed(&bridge.settings.folders, path, &mut bridge.runner),
        "run_allowlisted" => {
            if !bridge.settings.commands.iter().any(|c| c == text) {
                return Err("command is not on the allow list".into());
            }
            bridge.runner.run_allowed(text)
        }
        "handoff_grok_cli" => bridge.runner.handoff("grok_cli", text),
        "handoff_pi" => bridge.runner.handoff("pi", text),
        "handoff_vibe" => bridge.runner.handoff("vibe", text),
        "copilot_note" => bridge.runner.note(text),
        _ => Err("unknown tool".into()),
    }
}

fn read_jailed<R: Runner>(folders: &[String], requested: &str, runner: &mut R) -> Result<String, String> {
    if folders.is_empty() {
        return Err("no folders are allowed".into());
    }
    if requested.is_empty() {
        return Err("missing path".into());
    }
    let path = Path::new(requested);
    if path.is_absolute() {
        let ok = folders.iter().any(|folder| path.starts_with(folder));
        if !ok {
            return Err("path is outside the allowed folders".into());
        }
    } else if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("path is outside the allowed folders".into());
    } else {
        let ok = folders.iter().any(|folder| {
            Path::new(folder).join(path).starts_with(folder)
        });
        if !ok {
            return Err("path is outside the allowed folders".into());
        }
    }
    runner.read_file(requested)
}

fn err(id: Value, code: i32, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message }
    })
}

fn split_args(command: &str) -> Vec<String> {
    command.split_whitespace().map(|s| s.to_string()).collect()
}

/// Read a file only when its canonical path stays inside an allowed folder.
pub fn read_canonical(folders: &[String], requested: &str) -> Result<String, String> {
    if folders.is_empty() {
        return Err("no folders are allowed".into());
    }
    let path = PathBuf::from(requested);
    let canon = path.canonicalize().map_err(|e| e.to_string())?;
    let allowed = folders.iter().any(|folder| {
        Path::new(folder)
            .canonicalize()
            .map(|root| canon.starts_with(&root))
            .unwrap_or(false)
    });
    if !allowed {
        return Err("path is outside the allowed folders".into());
    }
    FsRunner.read_file(canon.to_str().ok_or("path is not utf-8")?)
}
