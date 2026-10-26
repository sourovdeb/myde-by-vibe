use serde::{Deserialize, Serialize};
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct Agent {
    pub name: String,
    pub exe: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// "readonly" (default) or "full"
    #[serde(default = "default_mode")]
    pub mode: String,
    /// argv template after the exe; {prompt} goes via stdin, never argv
    #[serde(default)]
    pub args: Vec<String>,
}

fn default_true() -> bool {
    true
}
fn default_mode() -> String {
    "readonly".into()
}

impl Agent {
    /// argv for a headless run: exe + fixed args + mode-specific tool flags.
    /// Verified against each CLI's current docs before release; the table is
    /// data, not code, so it can be corrected in config if a flag drifts.
    pub fn argv(&self, workdir: &str) -> Vec<String> {
        let mut argv: Vec<String> = self.args.clone();
        // built-in defaults per agent name if user did not override args
        if argv.is_empty() {
            argv = match self.name.as_str() {
                "claude" => vec!["-p".into(), "--output-format".into(), "json".into()],
                "grok" => vec![
                    "-p".into(),
                    "--output-format".into(),
                    "json".into(),
                    "--no-auto-update".into(),
                ],
                "vibe" => vec!["-p".into(), "--output".into(), "json".into()],
                "pi" => vec!["-p".into(), "--mode".into(), "json".into()],
                _ => vec![],
            };
        }
        if self.mode == "readonly" {
            argv.extend(match self.name.as_str() {
                "claude" => vec!["--permission-mode".into(), "plan".into()],
                "grok" => vec!["--tools".into(), "read_file,grep,list_dir".into()],
                "vibe" => vec![
                    "--enabled-tools".into(),
                    "read_file".into(),
                    "--enabled-tools".into(),
                    "grep".into(),
                ],
                "pi" => vec!["--tools".into(), "read,grep,find,ls".into()],
                _ => vec![],
            });
        }
        if !workdir.is_empty() {
            argv.push("--workdir".into());
            argv.push(workdir.to_string());
        }
        argv
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub name: String,
    /// agent that runs it (claude/grok/vibe/pi or any configured agent)
    pub agent: String,
    /// prompt template; {input} is replaced by the caller's input
    pub prompt: String,
    #[serde(default)]
    pub workdir: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Config {
    pub enabled: bool,
    pub port: u16,
    pub admin_port: u16,
    #[serde(default)]
    pub agents: Vec<Agent>,
    /// workdirs must be inside one of these (canonicalized comparison)
    #[serde(default)]
    pub allowed_dirs: Vec<String>,
    #[serde(default)]
    pub public_url: String,
    #[serde(default = "default_passphrase")]
    pub passphrase: String,
    #[serde(default)]
    pub tunnel_cmd: String,
    #[serde(default)]
    pub tunnel_args: Vec<String>,
    /// named one-click workflows (podcast, wordpress, writing, ...)
    #[serde(default)]
    pub workflows: Vec<Workflow>,
}

fn default_passphrase() -> String {
    "change-me".into()
}

impl Default for Config {
    fn default() -> Self {
        Self {
            enabled: true,
            port: 8765,
            admin_port: 8766,
            agents: vec![
                Agent {
                    name: "claude".into(),
                    exe: "claude".into(),
                    enabled: true,
                    mode: "readonly".into(),
                    args: vec![],
                },
                Agent {
                    name: "grok".into(),
                    exe: "grok".into(),
                    enabled: true,
                    mode: "readonly".into(),
                    args: vec![],
                },
                Agent {
                    name: "vibe".into(),
                    exe: "vibe".into(),
                    enabled: true,
                    mode: "readonly".into(),
                    args: vec![],
                },
                Agent {
                    name: "pi".into(),
                    exe: "pi".into(),
                    enabled: true,
                    mode: "readonly".into(),
                    args: vec![],
                },
            ],
            allowed_dirs: vec![],
            public_url: String::new(),
            passphrase: default_passphrase(),
            tunnel_cmd: String::new(),
            tunnel_args: vec![],
            workflows: default_workflows(),
        }
    }
}

pub fn config_path() -> PathBuf {
    if let Ok(appdata) = std::env::var("APPDATA") {
        return PathBuf::from(appdata).join("mcp-bridge").join("config.json");
    }
    // non-Windows / test fallback
    dirs_home().join(".mcp-bridge").join("config.json")
}

fn dirs_home() -> PathBuf {
    std::env::var("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

pub fn load_config() -> Config {
    let path = config_path();
    match std::fs::read_to_string(&path) {
        Ok(s) => serde_json::from_str(&s).unwrap_or_default(),
        Err(_) => Config::default(),
    }
}

pub fn save_config(cfg: &Config) -> std::io::Result<()> {
    let path = config_path();
    if let Some(dir) = path.parent() {
        std::fs::create_dir_all(dir)?;
    }
    std::fs::write(path, serde_json::to_string_pretty(cfg).unwrap())
}

/// workdir must resolve inside an allowed dir. Empty allowlist = deny all
/// for remote runs (mock/test runs are exempted by the caller).
pub fn workdir_allowed(cfg: &Config, workdir: &str) -> bool {
    if workdir.is_empty() {
        return true;
    }
    let wd = std::fs::canonicalize(workdir).unwrap_or_else(|_| PathBuf::from(workdir));
    cfg.allowed_dirs.iter().any(|allowed| {
        let a = std::fs::canonicalize(allowed).unwrap_or_else(|_| PathBuf::from(allowed));
        wd.starts_with(&a)
    })
}

pub fn default_workflows() -> Vec<Workflow> {
    vec![
        Workflow {
            name: "podcast-producer".into(),
            agent: "vibe".into(),
            prompt: "Run the podcast production pipeline end to end: {input}. Execute each stage, report outputs per stage.".into(),
            workdir: "E:/ONE-STOP-SHOP/mistral-workflows".into(),
            enabled: true,
        },
        Workflow {
            name: "wordpress-maintainer".into(),
            agent: "claude".into(),
            prompt: "Run the wordpress-maintainer workflow: {input}. Perform maintenance checks and fixes, report each step.".into(),
            workdir: "E:/ONE-STOP-SHOP/mistral-workflows".into(),
            enabled: true,
        },
        Workflow {
            name: "academic-paper-pipeline".into(),
            agent: "claude".into(),
            prompt: "Run the academic paper pipeline: {input}. Draft, cite, and report progress per stage.".into(),
            workdir: "E:/ONE-STOP-SHOP/mistral-workflows".into(),
            enabled: true,
        },
        Workflow {
            name: "content-scheduler".into(),
            agent: "vibe".into(),
            prompt: "Run the content scheduler workflow: {input}. Produce the multi-platform schedule and drafts.".into(),
            workdir: "E:/ONE-STOP-SHOP/mistral-workflows".into(),
            enabled: true,
        },
        Workflow {
            name: "mishu-critical-thinking-decision-audit".into(),
            agent: "pi".into(),
            prompt: "Run the mishu critical-thinking decision audit on: {input}. Produce the structured audit report.".into(),
            workdir: "E:/ONE-STOP-SHOP/mistral-workflows".into(),
            enabled: true,
        },
    ]
}

impl Workflow {
    pub fn render_prompt(&self, input: &str) -> String {
        self.prompt.replace("{input}", input)
    }
}
