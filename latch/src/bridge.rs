use crate::desktop;
use crate::settings::{Caller, Cap, Settings};
use serde_json::{json, Value};
use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

pub trait Runner: Send {
    fn list_files(&mut self, folders: &[String], path: &str) -> Result<String, String>;
    fn read_file(&mut self, folders: &[String], path: &str) -> Result<String, String>;
    fn search_files(&mut self, folders: &[String], root: &str, query: &str) -> Result<String, String>;
    fn write_file(&mut self, folders: &[String], path: &str, text: &str) -> Result<String, String>;
    fn run_task(&mut self, command: &str) -> Result<String, String>;
    fn control_desktop(
        &mut self,
        action: &str,
        target: &str,
        text: &str,
        apps: &[String],
    ) -> Result<String, String>;
}

/// Records calls. Never starts a process and never opens the network.
#[derive(Debug, Default)]
pub struct MockRunner {
    pub commands: Vec<String>,
    pub files: BTreeMap<String, String>,
    pub desktop: Vec<(String, String, String)>,
}

impl Runner for MockRunner {
    fn list_files(&mut self, _folders: &[String], path: &str) -> Result<String, String> {
        let prefix = child_prefix(path);
        let mut names = Vec::new();
        for key in self.files.keys() {
            if let Some(rest) = key.strip_prefix(&prefix) {
                if !rest.is_empty() && !rest.contains('/') && !rest.contains('\\') {
                    names.push(rest.to_string());
                }
            }
        }
        names.sort();
        Ok(names.join("\n"))
    }

    fn read_file(&mut self, _folders: &[String], path: &str) -> Result<String, String> {
        self.files
            .get(path)
            .cloned()
            .ok_or_else(|| format!("mock file missing: {path}"))
    }

    fn search_files(
        &mut self,
        folders: &[String],
        root: &str,
        query: &str,
    ) -> Result<String, String> {
        let mut hits = Vec::new();
        for (path, text) in &self.files {
            let in_root = if root.is_empty() {
                folders.iter().any(|folder| desktop::inside(folder, path))
            } else {
                desktop::inside(root, path)
            };
            if in_root && text.contains(query) {
                hits.push(format!("{path}: {text}"));
            }
        }
        Ok(hits.join("\n"))
    }

    fn write_file(&mut self, _folders: &[String], path: &str, text: &str) -> Result<String, String> {
        self.files.insert(path.to_string(), text.to_string());
        Ok(format!("wrote {} bytes", text.len()))
    }

    fn run_task(&mut self, command: &str) -> Result<String, String> {
        self.commands.push(command.to_string());
        Ok(format!("mock:{command}"))
    }

    fn control_desktop(
        &mut self,
        action: &str,
        target: &str,
        text: &str,
        _apps: &[String],
    ) -> Result<String, String> {
        self.desktop
            .push((action.to_string(), target.to_string(), text.to_string()));
        Ok(format!("mock:{action}"))
    }
}

fn child_prefix(path: &str) -> String {
    if path.ends_with('/') || path.ends_with('\\') {
        path.to_string()
    } else if path.contains('\\') {
        format!("{path}\\")
    } else {
        format!("{path}/")
    }
}

/// Real disk and process runner. Commands run as a direct argv, never through a shell.
pub struct FsRunner;

impl Runner for FsRunner {
    fn list_files(&mut self, folders: &[String], path: &str) -> Result<String, String> {
        let canon = desktop::canonical_inside(folders, Path::new(path))?;
        let mut names = Vec::new();
        for entry in fs::read_dir(&canon).map_err(|e| e.to_string())? {
            let entry = entry.map_err(|e| e.to_string())?;
            let name = entry.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            names.push(name);
            if names.len() == 200 {
                break;
            }
        }
        names.sort();
        Ok(names.join("\n"))
    }

    fn read_file(&mut self, folders: &[String], path: &str) -> Result<String, String> {
        let canon = desktop::canonical_inside(folders, Path::new(path))?;
        let text = fs::read_to_string(&canon).map_err(|e| e.to_string())?;
        if text.len() > 32_000 {
            Ok(text.chars().take(32_000).collect())
        } else {
            Ok(text)
        }
    }

    fn search_files(
        &mut self,
        folders: &[String],
        root: &str,
        query: &str,
    ) -> Result<String, String> {
        let starts: Vec<String> = if root.is_empty() {
            folders.to_vec()
        } else if folders.iter().any(|folder| desktop::inside(folder, root)) {
            vec![root.to_string()]
        } else {
            return Err("path is outside the allowed folders".into());
        };
        let mut hits = Vec::new();
        for folder in starts {
            let canon = match Path::new(&folder).canonicalize() {
                Ok(path) => path,
                Err(_) => continue,
            };
            walk_search(&canon, query, &mut hits, 0)?;
            if hits.len() >= 20 {
                break;
            }
        }
        Ok(hits.join("\n"))
    }

    fn write_file(&mut self, folders: &[String], path: &str, text: &str) -> Result<String, String> {
        let path = PathBuf::from(path);
        let parent = path.parent().ok_or("missing folder")?;
        let parent = desktop::canonical_inside(folders, parent)?;
        let name = path
            .file_name()
            .ok_or("missing file name")?
            .to_string_lossy()
            .into_owned();
        if name.is_empty() || name == "." || name == ".." || name.contains('/') || name.contains('\\')
        {
            return Err("bad file name".into());
        }
        let dest = parent.join(&name);
        if let Ok(meta) = fs::symlink_metadata(&dest) {
            if meta.file_type().is_symlink() {
                return Err("refusing to follow a symlink".into());
            }
        }
        if !folders.iter().any(|folder| {
            Path::new(folder)
                .canonicalize()
                .map(|root| dest.starts_with(&root))
                .unwrap_or(false)
        }) {
            return Err("path is outside the allowed folders".into());
        }
        fs::write(&dest, text).map_err(|e| e.to_string())?;
        Ok(format!("wrote {} bytes", text.len()))
    }

    fn run_task(&mut self, command: &str) -> Result<String, String> {
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
        let err = String::from_utf8_lossy(&out.stderr);
        text.push_str(&err);
        if text.len() > 8_000 {
            text.truncate(8_000);
        }
        if !out.status.success() {
            return Err(format!("exit {}: {text}", out.status));
        }
        Ok(text)
    }

    fn control_desktop(
        &mut self,
        action: &str,
        target: &str,
        text: &str,
        apps: &[String],
    ) -> Result<String, String> {
        desktop::run(action, target, text, apps)
    }
}

fn walk_search(dir: &Path, query: &str, hits: &mut Vec<String>, depth: usize) -> Result<(), String> {
    if depth > 4 || hits.len() >= 20 {
        return Ok(());
    }
    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(_) => return Ok(()),
    };
    for entry in entries {
        if hits.len() >= 20 {
            break;
        }
        let Ok(entry) = entry else { continue };
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with('.') || name == "node_modules" || name == "target" {
            continue;
        }
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else { continue };
        if file_type.is_symlink() {
            continue;
        }
        if file_type.is_dir() {
            walk_search(&path, query, hits, depth + 1)?;
            continue;
        }
        if !file_type.is_file() {
            continue;
        }
        let Ok(bytes) = fs::read(&path) else { continue };
        if bytes.len() > 200_000 || bytes.contains(&0) {
            continue;
        }
        let text = String::from_utf8_lossy(&bytes);
        if let Some(line) = text.lines().find(|line| line.contains(query)) {
            let shown: String = line.chars().take(160).collect();
            hits.push(format!("{}: {shown}", path.display()));
        }
    }
    Ok(())
}

fn split_args(command: &str) -> Vec<String> {
    command.split_whitespace().map(|part| part.to_string()).collect()
}

pub struct Bridge<R: Runner> {
    pub settings: Settings,
    pub runner: R,
    pub config_path: Option<PathBuf>,
}

impl<R: Runner> Bridge<R> {
    pub fn new(settings: Settings, runner: R) -> Self {
        Self {
            settings,
            runner,
            config_path: None,
        }
    }

    pub fn reload(&mut self) {
        let Some(path) = &self.config_path else {
            return;
        };
        if let Ok(settings) = Settings::load(path) {
            self.settings = settings;
        }
    }
}

#[derive(Debug, Clone)]
pub struct ToolCard {
    pub name: String,
    pub description: String,
    pub schema: Value,
}

pub fn advertised_tools(settings: &Settings, caller: Caller) -> Vec<ToolCard> {
    let mut tools = Vec::new();
    if settings.allows(caller, Cap::Read) {
        let where_ = if settings.folders.is_empty() {
            "Refuses every call until you list at least one folder.".into()
        } else {
            format!("Inside: {}.", settings.folders.join(", "))
        };
        tools.push(card(
            "list_files",
            &format!("List one allowed folder. {where_}"),
            json!({
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "additionalProperties": false
            }),
        ));
        tools.push(card(
            "read_file",
            &format!("Read one file. {where_}"),
            json!({
                "type": "object",
                "properties": { "path": { "type": "string" } },
                "required": ["path"],
                "additionalProperties": false
            }),
        ));
        tools.push(card(
            "search_files",
            &format!("Find a short plain-text phrase. {where_}"),
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "path": { "type": "string" }
                },
                "required": ["query"],
                "additionalProperties": false
            }),
        ));
    }
    if settings.allows(caller, Cap::Edit) {
        tools.push(card(
            "write_file",
            "Create or replace one file inside an allowed folder.",
            json!({
                "type": "object",
                "properties": {
                    "path": { "type": "string" },
                    "text": { "type": "string" }
                },
                "required": ["path", "text"],
                "additionalProperties": false
            }),
        ));
    }
    if settings.allows(caller, Cap::Scripts) {
        let description = if settings.commands.is_empty() {
            "Refuses every command. The allow list is empty.".into()
        } else {
            format!("Run only an exact line from: {}.", settings.commands.join(" · "))
        };
        tools.push(card(
            "run_task",
            &description,
            json!({
                "type": "object",
                "properties": { "command": { "type": "string" } },
                "required": ["command"],
                "additionalProperties": false
            }),
        ));
    }
    if settings.allows(caller, Cap::Desktop) {
        tools.push(card(
            "control_desktop",
            "List, focus, or type into a window whose app name is allow-listed. No hotkeys and no mouse.",
            json!({
                "type": "object",
                "properties": {
                    "action": { "type": "string", "enum": ["list", "focus", "type"] },
                    "target": { "type": "string" },
                    "text": { "type": "string" }
                },
                "required": ["action"],
                "additionalProperties": false
            }),
        ));
    }
    if tools.is_empty() {
        tools.push(card(
            "ping",
            "The process can answer, but every tool is switched off.",
            json!({ "type": "object", "properties": {}, "additionalProperties": false }),
        ));
    }
    tools
}

fn card(name: &str, description: &str, schema: Value) -> ToolCard {
    ToolCard {
        name: name.into(),
        description: description.into(),
        schema,
    }
}

/// Handle one JSON-RPC request. Notifications (no id) return None.
pub fn dispatch<R: Runner>(bridge: &mut Bridge<R>, req: &Value, caller: Caller) -> Option<Value> {
    bridge.reload();
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
            "serverInfo": { "name": bridge.settings.name, "version": "0.2.0" },
            "instructions": format!(
                "Caller: {}. Latch runs approved tasks on this PC. It does not merge cloud transcripts. Only tools switched on for this caller are listed.",
                caller.label()
            )
        }),
        "ping" => json!({ "serverOn": bridge.settings.server_on, "caller": caller.label() }),
        "tools/list" => json!({
            "tools": advertised_tools(&bridge.settings, caller).into_iter().map(|tool| json!({
                "name": tool.name,
                "description": tool.description,
                "inputSchema": tool.schema
            })).collect::<Vec<_>>()
        }),
        "tools/call" => match call_tool(bridge, req.get("params").unwrap_or(&Value::Null), caller) {
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

fn call_tool<R: Runner>(
    bridge: &mut Bridge<R>,
    params: &Value,
    caller: Caller,
) -> Result<String, String> {
    let name = params
        .get("name")
        .and_then(|v| v.as_str())
        .ok_or("tools/call needs a name")?;
    let args = params.get("arguments").cloned().unwrap_or_else(|| json!({}));
    let known = advertised_tools(&bridge.settings, caller);
    if !known.iter().any(|tool| tool.name == name) {
        return Err(format!(
            "tool {name} is switched off for {}",
            caller.label()
        ));
    }
    match name {
        "ping" => Ok("pong".into()),
        "list_files" => {
            let path = arg(&args, &["path"]);
            let resolved = if path.is_empty() {
                bridge
                    .settings
                    .folders
                    .first()
                    .cloned()
                    .ok_or("no folders are allowed")?
            } else {
                resolve_path(&bridge.settings.folders, &path)?
            };
            if !bridge
                .settings
                .folders
                .iter()
                .any(|folder| desktop::inside(folder, &resolved))
            {
                return Err("path is outside the allowed folders".into());
            }
            bridge
                .runner
                .list_files(&bridge.settings.folders, &resolved)
        }
        "read_file" => {
            let path = arg(&args, &["path"]);
            let resolved = resolve_path(&bridge.settings.folders, &path)?;
            if is_folder_root(&bridge.settings.folders, &resolved) {
                return Err("path is a folder".into());
            }
            bridge
                .runner
                .read_file(&bridge.settings.folders, &resolved)
        }
        "search_files" => {
            let query = arg(&args, &["query", "text"]);
            if query.chars().count() < 2 || query.chars().count() > 80 {
                return Err("query must be 2 to 80 characters".into());
            }
            let path = arg(&args, &["path"]);
            let root = if path.is_empty() {
                String::new()
            } else {
                let resolved = resolve_path(&bridge.settings.folders, &path)?;
                if !bridge
                    .settings
                    .folders
                    .iter()
                    .any(|folder| desktop::inside(folder, &resolved))
                {
                    return Err("path is outside the allowed folders".into());
                }
                resolved
            };
            if bridge.settings.folders.is_empty() {
                return Err("no folders are allowed".into());
            }
            bridge
                .runner
                .search_files(&bridge.settings.folders, &root, &query)
        }
        "write_file" => {
            let path = arg(&args, &["path"]);
            let text = arg(&args, &["text"]);
            if text.len() > 65_536 {
                return Err("file is too large".into());
            }
            let resolved = resolve_path(&bridge.settings.folders, &path)?;
            if is_folder_root(&bridge.settings.folders, &resolved) {
                return Err("path is a folder".into());
            }
            if is_settings_file(&resolved, bridge.config_path.as_deref()) {
                return Err("refusing to edit the Latch settings file".into());
            }
            bridge
                .runner
                .write_file(&bridge.settings.folders, &resolved, &text)
        }
        "run_task" => {
            let command = arg(&args, &["command", "text"]);
            if !bridge.settings.commands.iter().any(|item| item == &command) {
                return Err("command is not on the allow list".into());
            }
            bridge.runner.run_task(&command)
        }
        "control_desktop" => {
            let action = arg(&args, &["action"]);
            let target = arg(&args, &["target"]);
            let text = arg(&args, &["text"]);
            desktop::validate(&bridge.settings.apps, &action, &target, &text)?;
            bridge
                .runner
                .control_desktop(&action, &target, &text, &bridge.settings.apps)
        }
        _ => Err("unknown tool".into()),
    }
}

fn arg(args: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(value) = args.get(*key).and_then(|item| item.as_str()) {
            return value.to_string();
        }
    }
    String::new()
}

fn is_folder_root(folders: &[String], path: &str) -> bool {
    folders.iter().any(|folder| {
        folder.trim_end_matches(['/', '\\']).eq_ignore_ascii_case(path.trim_end_matches(['/', '\\']))
    })
}

fn is_settings_file(path: &str, config: Option<&Path>) -> bool {
    if let Some(config) = config {
        if Path::new(path) == config {
            return true;
        }
    }
    path.replace('\\', "/").ends_with("/.mcp-autostart/latch.json")
}

pub fn resolve_path(folders: &[String], requested: &str) -> Result<String, String> {
    if folders.is_empty() {
        return Err("no folders are allowed".into());
    }
    let requested = requested.trim();
    if requested.is_empty() {
        return Err("missing path".into());
    }
    if requested.contains('\0') || desktop::has_parent(requested) {
        return Err("path is outside the allowed folders".into());
    }
    if desktop::is_absolute(requested) {
        if folders.iter().any(|folder| desktop::inside(folder, requested)) {
            return Ok(requested.to_string());
        }
        return Err("path is outside the allowed folders".into());
    }
    Ok(desktop::join_root(&folders[0], requested))
}

fn err(id: Value, code: i32, message: &str) -> Value {
    json!({
        "jsonrpc": "2.0",
        "id": id,
        "error": { "code": code, "message": message }
    })
}
