use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Clients {
    pub grok_cli: bool,
    pub pi: bool,
    pub vibe: bool,
    pub copilot: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Tools {
    pub files: bool,
    pub shell: bool,
    pub handoff: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Settings {
    pub server_on: bool,
    pub name: String,
    pub public_url: String,
    pub port: u16,
    pub clients: Clients,
    pub tools: Tools,
    pub folders: Vec<String>,
    pub commands: Vec<String>,
    pub grok_model: String,
    pub mistral_model: String,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            server_on: false,
            name: "Latch".into(),
            public_url: String::new(),
            port: 3939,
            clients: Clients {
                grok_cli: true,
                pi: true,
                vibe: true,
                copilot: true,
            },
            tools: Tools {
                files: true,
                shell: false,
                handoff: true,
            },
            folders: Vec::new(),
            commands: Vec::new(),
            grok_model: "grok-4.6".into(),
            mistral_model: "mistral-large-latest".into(),
        }
    }
}

impl Settings {
    pub fn load(path: &Path) -> Result<Self, String> {
        let text = fs::read_to_string(path).map_err(|e| format!("read {}: {e}", path.display()))?;
        serde_json::from_str(&text).map_err(|e| format!("settings json: {e}"))
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let text = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, text + "\n").map_err(|e| e.to_string())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Verdict {
    Empty,
    Bad(Vec<&'static str>),
    Ok(Vec<&'static str>),
}

/// Grok's custom connector opens this URL from its own servers.
/// A program on this PC is invisible unless the URL is public https.
pub fn diagnose_url(raw: &str) -> Verdict {
    let value = raw.trim();
    if value.is_empty() {
        return Verdict::Empty;
    }
    let Some((scheme, rest)) = value.split_once("://") else {
        return Verdict::Bad(vec!["Start with https:// and include the host."]);
    };
    if scheme != "https" {
        return Verdict::Bad(vec!["Grok only accepts https."]);
    }
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    if authority.contains('@') {
        return Verdict::Bad(vec!["Do not put a password in the URL."]);
    }
    let host = host_of(authority);
    if host.is_empty() {
        return Verdict::Bad(vec!["That URL has no host."]);
    }
    if matches!(host.as_str(), "localhost" | "127.0.0.1" | "::1" | "0.0.0.0")
        || host.ends_with(".local")
        || host.ends_with(".localhost")
    {
        return Verdict::Bad(vec![
            "This host is your own computer. Grok's servers cannot open it.",
        ]);
    }
    if is_private_ip(&host) {
        return Verdict::Bad(vec![
            "This is a private network address. Grok rejects it.",
        ]);
    }
    let mut notes = vec!["Public https. This is the shape the custom connector accepts."];
    if host.ends_with("trycloudflare.com") {
        notes.push("A Cloudflare quick tunnel address changes when the tunnel restarts.");
    }
    Verdict::Ok(notes)
}

fn host_of(authority: &str) -> String {
    if let Some(rest) = authority.strip_prefix('[') {
        return rest.split(']').next().unwrap_or("").to_ascii_lowercase();
    }
    authority
        .split(':')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
}

fn is_private_ip(host: &str) -> bool {
    let parts: Vec<&str> = host.split('.').collect();
    if parts.len() != 4 {
        return false;
    }
    let nums: Option<Vec<u32>> = parts.iter().map(|p| p.parse().ok()).collect();
    let Some(n) = nums else {
        return false;
    };
    if n.iter().any(|x| *x > 255) {
        return false;
    }
    let (a, b) = (n[0], n[1]);
    a == 10
        || a == 0
        || a == 127
        || (a == 192 && b == 168)
        || (a == 172 && (16..=31).contains(&b))
        || (a == 169 && b == 254)
        || (a == 100 && (64..=127).contains(&b))
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ChatCloud {
    Grok,
    Mistral,
}

impl ChatCloud {
    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "grok" => Some(Self::Grok),
            "mistral" => Some(Self::Mistral),
            _ => None,
        }
    }
}

/// The chat message a copilot would send. This is not an MCP tool call,
/// and it is not the same transcript as the CLI.
pub fn chat_envelope(cloud: ChatCloud, settings: &Settings, user_line: &str) -> serde_json::Value {
    let (model, system) = match cloud {
        ChatCloud::Mistral => (
            settings.mistral_model.as_str(),
            "You are the copilot on this PC. Standing rules live here. Use Latch tools only when that server is on. Be brief.",
        ),
        ChatCloud::Grok => (
            settings.grok_model.as_str(),
            "You are the copilot on this PC. Use Latch tools only when that server is on. Be brief.",
        ),
    };
    serde_json::json!({
        "model": model,
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_line }
        ]
    })
}
