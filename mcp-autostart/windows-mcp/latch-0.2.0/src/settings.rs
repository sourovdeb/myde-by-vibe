use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Cap {
    Read,
    Edit,
    Scripts,
    Desktop,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Caller {
    Local,
    Grok,
    Mistral,
    Chatgpt,
    Pi,
}

impl Caller {
    pub fn from_path(path: &str) -> Option<Self> {
        match path.split('?').next().unwrap_or(path) {
            "/mcp" | "/mcp/" => Some(Self::Local),
            "/mcp/grok" => Some(Self::Grok),
            "/mcp/mistral" => Some(Self::Mistral),
            "/mcp/chatgpt" => Some(Self::Chatgpt),
            "/mcp/pi" => Some(Self::Pi),
            _ => None,
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            Self::Local => "this PC",
            Self::Grok => "grok",
            Self::Mistral => "mistral",
            Self::Chatgpt => "chatgpt",
            Self::Pi => "pi",
        }
    }

    pub fn parse(name: &str) -> Option<Self> {
        match name {
            "local" | "master" => Some(Self::Local),
            "grok" => Some(Self::Grok),
            "mistral" => Some(Self::Mistral),
            "chatgpt" => Some(Self::Chatgpt),
            "pi" => Some(Self::Pi),
            _ => None,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Caps {
    pub read: bool,
    pub edit: bool,
    pub scripts: bool,
    pub desktop: bool,
}

impl Default for Caps {
    fn default() -> Self {
        Self {
            read: true,
            edit: false,
            scripts: false,
            desktop: false,
        }
    }
}

impl Caps {
    pub fn get(&self, cap: Cap) -> bool {
        match cap {
            Cap::Read => self.read,
            Cap::Edit => self.edit,
            Cap::Scripts => self.scripts,
            Cap::Desktop => self.desktop,
        }
    }

    pub fn set(&mut self, cap: Cap, on: bool) {
        match cap {
            Cap::Read => self.read = on,
            Cap::Edit => self.edit = on,
            Cap::Scripts => self.scripts = on,
            Cap::Desktop => self.desktop = on,
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Providers {
    pub grok: Caps,
    pub mistral: Caps,
    pub chatgpt: Caps,
    pub pi: Caps,
}

impl Default for Providers {
    fn default() -> Self {
        Self {
            grok: Caps::default(),
            mistral: Caps::default(),
            chatgpt: Caps::default(),
            pi: Caps::default(),
        }
    }
}

impl Providers {
    pub fn of(&self, caller: Caller) -> &Caps {
        match caller {
            Caller::Local => &self.grok,
            Caller::Grok => &self.grok,
            Caller::Mistral => &self.mistral,
            Caller::Chatgpt => &self.chatgpt,
            Caller::Pi => &self.pi,
        }
    }

    pub fn of_mut(&mut self, caller: Caller) -> &mut Caps {
        match caller {
            Caller::Local => &mut self.grok,
            Caller::Grok => &mut self.grok,
            Caller::Mistral => &mut self.mistral,
            Caller::Chatgpt => &mut self.chatgpt,
            Caller::Pi => &mut self.pi,
        }
    }
}

/// Read from older latch.json files. Not written back.
#[derive(Debug, Clone, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct LegacyTools {
    #[serde(default)]
    pub files: bool,
    #[serde(default)]
    pub shell: bool,
    #[serde(default)]
    pub handoff: bool,
}

fn legacy_version() -> u32 {
    0
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(default)]
pub struct Settings {
    #[serde(default = "legacy_version")]
    pub version: u32,
    pub server_on: bool,
    pub name: String,
    pub public_url: String,
    pub port: u16,
    /// Local panel secret. Never sent to a cloud tool list.
    pub token: String,
    pub caps: Caps,
    pub providers: Providers,
    pub folders: Vec<String>,
    pub commands: Vec<String>,
    pub apps: Vec<String>,
    pub grok_model: String,
    pub mistral_model: String,
    #[serde(default, skip_serializing)]
    pub tools: LegacyTools,
}

impl Default for Settings {
    fn default() -> Self {
        Self {
            version: 2,
            server_on: false,
            name: "Latch".into(),
            public_url: String::new(),
            port: 3939,
            token: String::new(),
            caps: Caps::default(),
            providers: Providers::default(),
            folders: Vec::new(),
            commands: Vec::new(),
            apps: Vec::new(),
            grok_model: "grok-4.6".into(),
            mistral_model: "mistral-large-latest".into(),
            tools: LegacyTools::default(),
        }
    }
}

impl Settings {
    pub fn load(path: &Path) -> Result<Self, String> {
        let text = fs::read_to_string(path).map_err(|e| format!("read {}: {e}", path.display()))?;
        Self::parse(&text)
    }

    pub fn parse(text: &str) -> Result<Self, String> {
        let mut settings: Self =
            serde_json::from_str(text).map_err(|e| format!("settings json: {e}"))?;
        settings.migrate();
        Ok(settings)
    }

    pub fn save(&self, path: &Path) -> Result<(), String> {
        if let Some(dir) = path.parent() {
            fs::create_dir_all(dir).map_err(|e| e.to_string())?;
        }
        let text = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(path, text + "\n").map_err(|e| e.to_string())
    }

    /// Old files had CLI handoff switches. Version 2 uses capability switches.
    pub fn migrate(&mut self) {
        if self.version >= 2 {
            return;
        }
        self.caps.read = self.tools.files;
        self.caps.edit = false;
        self.caps.scripts = self.tools.shell;
        self.caps.desktop = false;
        let copied = self.caps.clone();
        self.providers.grok = copied.clone();
        self.providers.mistral = copied.clone();
        self.providers.chatgpt = copied.clone();
        self.providers.pi = copied;
        self.providers.chatgpt.edit = false;
        self.providers.chatgpt.scripts = false;
        self.providers.chatgpt.desktop = false;
        self.version = 2;
    }

    /// Master switch first. A provider cannot exceed it.
    /// Local stdio uses the master switches only.
    pub fn allows(&self, caller: Caller, cap: Cap) -> bool {
        if !self.caps.get(cap) {
            return false;
        }
        match caller {
            Caller::Local => true,
            other => self.providers.of(other).get(cap),
        }
    }

    pub fn set_cap(&mut self, caller: Caller, cap: Cap, on: bool) {
        self.version = 2;
        if caller == Caller::Local {
            self.caps.set(cap, on);
        } else {
            self.providers.of_mut(caller).set(cap, on);
        }
    }
}

pub fn cap_parse(name: &str) -> Option<Cap> {
    match name {
        "read" | "files" => Some(Cap::Read),
        "edit" | "write" => Some(Cap::Edit),
        "scripts" | "script" | "shell" => Some(Cap::Scripts),
        "desktop" => Some(Cap::Desktop),
        _ => None,
    }
}

pub fn parse_on(value: &str) -> Option<bool> {
    match value {
        "on" | "true" | "1" | "yes" => Some(true),
        "off" | "false" | "0" | "no" => Some(false),
        _ => None,
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

/// The chat message a copilot would send. This is not an MCP tool call.
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

pub fn new_token() -> String {
    let mut buf = [0u8; 16];
    if fill_random(&mut buf) {
        return buf.iter().map(|b| format!("{b:02x}")).collect();
    }
    let nanos = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos())
        .unwrap_or(0);
    format!("{nanos:032x}{:08x}", std::process::id())
}

fn fill_random(buf: &mut [u8]) -> bool {
    #[cfg(windows)]
    {
        #[link(name = "bcrypt")]
        extern "system" {
            fn BCryptGenRandom(
                algorithm: *mut std::ffi::c_void,
                buffer: *mut u8,
                length: u32,
                flags: u32,
            ) -> i32;
        }
        const USE_SYSTEM_PREFERRED: u32 = 0x0000_0002;
        let status = unsafe {
            BCryptGenRandom(
                std::ptr::null_mut(),
                buf.as_mut_ptr(),
                buf.len() as u32,
                USE_SYSTEM_PREFERRED,
            )
        };
        return status == 0;
    }
    #[cfg(not(windows))]
    {
        use std::io::Read;
        if let Ok(mut file) = std::fs::File::open("/dev/urandom") {
            return file.read_exact(buf).is_ok();
        }
        false
    }
}
