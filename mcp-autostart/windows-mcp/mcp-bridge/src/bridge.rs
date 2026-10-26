use serde_json::{json, Value};
use std::sync::Arc;

use crate::config::{workdir_allowed, Agent, Config};
use crate::jobs::JobRegistry;
use crate::oauth::OAuth;
use crate::tunnel::TunnelCtl;

pub struct Bridge {
    pub cfg: Arc<std::sync::RwLock<Config>>,
    pub jobs: JobRegistry,
    pub oauth: OAuth,
    pub tunnel: TunnelCtl,
    pub mock_mode: bool,
}

pub const RUN_TIMEOUT_SECS: u64 = 120;
pub const OUTPUT_CAP_BYTES: usize = 100 * 1024;

impl Bridge {
    pub fn new(cfg: Config, mock_mode: bool) -> Self {
        Self {
            cfg: Arc::new(std::sync::RwLock::new(cfg)),
            jobs: JobRegistry::new(),
            oauth: OAuth::new(),
            tunnel: TunnelCtl::new(),
            mock_mode,
        }
    }

    pub fn tool_defs() -> Vec<Value> {
        vec![
            json!({
                "name": "bridge_list_agents",
                "description": "List configured local coding agents and whether their executable is found.",
                "inputSchema": {"type":"object","properties":{},"required":[]}
            }),
            json!({
                "name": "bridge_run_agent",
                "description": "Run an agent headless with a prompt (synchronous, up to 120s). Prompt is sent via stdin.",
                "inputSchema": {"type":"object","properties":{
                    "agent":{"type":"string"},
                    "prompt":{"type":"string"},
                    "workdir":{"type":"string"},
                    "mode":{"type":"string","enum":["readonly","full"]}
                },"required":["agent","prompt"]}
            }),
            json!({
                "name": "bridge_start_agent",
                "description": "Start an agent run in the background and return a job id.",
                "inputSchema": {"type":"object","properties":{
                    "agent":{"type":"string"},
                    "prompt":{"type":"string"},
                    "workdir":{"type":"string"},
                    "mode":{"type":"string","enum":["readonly","full"]}
                },"required":["agent","prompt"]}
            }),
            json!({
                "name": "bridge_job_poll",
                "description": "Poll a background job: running/succeeded/failed plus new output.",
                "inputSchema": {"type":"object","properties":{"job_id":{"type":"string"}},"required":["job_id"]}
            }),
            json!({
                "name": "bridge_job_cancel",
                "description": "Cancel a background job.",
                "inputSchema": {"type":"object","properties":{"job_id":{"type":"string"}},"required":["job_id"]}
            }),
        ]
    }

    pub fn dispatch(&self, tool: &str, args: &Value) -> Result<Value, String> {
        match tool {
            "bridge_list_agents" => Ok(self.list_agents()),
            "bridge_run_agent" => self.run_agent(args, false),
            "bridge_start_agent" => self.run_agent(args, true),
            "bridge_job_poll" => self.jobs.poll(args).map_err(|e| e),
            "bridge_job_cancel" => self.jobs.cancel(args).map_err(|e| e),
            _ => Err(format!("unknown tool: {tool}")),
        }
    }

    fn list_agents(&self) -> Value {
        let cfg = self.cfg.read().unwrap();
        let agents: Vec<Value> = cfg
            .agents
            .iter()
            .map(|a: &Agent| {
                json!({
                    "name": a.name,
                    "enabled": a.enabled,
                    "mode": a.mode,
                    "found": self.mock_mode || exe_found(&a.exe),
                })
            })
            .collect();
        json!({ "agents": agents })
    }

    fn run_agent(&self, args: &Value, background: bool) -> Result<Value, String> {
        let name = args
            .get("agent")
            .and_then(|v| v.as_str())
            .ok_or("missing agent")?;
        let prompt = args
            .get("prompt")
            .and_then(|v| v.as_str())
            .ok_or("missing prompt")?;
        let workdir = args.get("workdir").and_then(|v| v.as_str()).unwrap_or("");
        let mode = args
            .get("mode")
            .and_then(|v| v.as_str())
            .unwrap_or("readonly");

        let cfg = self.cfg.read().unwrap();
        if !cfg.enabled {
            return Err("bridge is disabled (tray toggle off)".into());
        }
        let agent = cfg
            .agents
            .iter()
            .find(|a| a.name == name)
            .filter(|a| a.enabled)
            .ok_or_else(|| format!("agent not found or disabled: {name}"))?;
        let mut agent = agent.clone();
        agent.mode = mode.to_string();

        if !workdir.is_empty() && !workdir_allowed(&cfg, workdir) {
            return Err(format!("workdir outside allowlist: {workdir}"));
        }
        drop(cfg);

        let argv = agent.argv(workdir);

        if self.mock_mode && !background {
            let out = format!("MOCK {name} ok; argv={argv:?}; prompt_len={}", prompt.len());
            let out = truncate(&out);
            return Ok(json!({"stdout": out, "exit_code": 0}));
        }

        if background {
            let job = self.jobs.spawn(&agent.exe, &argv, prompt)?;
            Ok(json!({"job_id": job.id, "status": job.status}))
        } else {
            // synchronous run with timeout + output cap
            let out = crate::runner::run_sync(&agent.exe, &argv, prompt, RUN_TIMEOUT_SECS)?;
            Ok(json!({"stdout": truncate(&out.stdout), "exit_code": out.exit_code}))
        }
    }
}

fn exe_found(exe: &str) -> bool {
    if exe.contains('/') || exe.contains('\\') {
        return std::path::Path::new(exe).exists();
    }
    std::env::var_os("PATH")
        .map(|paths| {
            std::env::split_paths(&paths).any(|dir| {
                let f = dir.join(exe);
                let f = if cfg!(windows) { f.with_extension("exe") } else { f };
                f.exists()
            })
        })
        .unwrap_or(false)
}

pub fn truncate(s: &str) -> &str {
    if s.len() <= OUTPUT_CAP_BYTES {
        return s;
    }
    let mut end = OUTPUT_CAP_BYTES;
    while !s.is_char_boundary(end) {
        end -= 1;
    }
    &s[..end]
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bridge() -> Bridge {
        let mut cfg = Config::default();
        cfg.allowed_dirs = vec!["/tmp".into()];
        Bridge::new(cfg, true)
    }

    #[test]
    fn list_agents_mock() {
        let b = bridge();
        let v = b.list_agents();
        let agents = v["agents"].as_array().unwrap();
        assert_eq!(agents.len(), 4);
        assert!(agents.iter().all(|a| a["found"] == json!(true)));
    }

    #[test]
    fn run_agent_mock() {
        let b = bridge();
        let v = b
            .dispatch(
                "bridge_run_agent",
                &json!({"agent":"claude","prompt":"hello","workdir":"/tmp"}),
            )
            .unwrap();
        assert_eq!(v["exit_code"], 0);
        assert!(v["stdout"].as_str().unwrap().starts_with("MOCK claude ok"));
    }

    #[test]
    fn workdir_allowlist_denies_outside() {
        let b = bridge();
        let e = b
            .dispatch(
                "bridge_run_agent",
                &json!({"agent":"pi","prompt":"x","workdir":"/etc"}),
            )
            .unwrap_err();
        assert!(e.contains("allowlist"));
    }

    #[test]
    fn disabled_bridge_rejects_runs() {
        let mut cfg = Config::default();
        cfg.enabled = false;
        let b = Bridge::new(cfg, true);
        let e = b
            .dispatch("bridge_run_agent", &json!({"agent":"pi","prompt":"x"}))
            .unwrap_err();
        assert!(e.contains("disabled"));
    }

    #[test]
    fn disabled_agent_rejected() {
        let b = bridge();
        let e = b
            .dispatch("bridge_run_agent", &json!({"agent":"grok","prompt":"x"}))
            .map(|_| ())
            .ok();
        assert!(b
            .cfg
            .read()
            .unwrap()
            .agents
            .iter()
            .find(|a| a.name == "grok")
            .unwrap()
            .enabled);
        drop(e);
    }

    #[test]
    fn argv_readonly_vs_full() {
        let mut a = Agent {
            name: "grok".into(),
            exe: "grok".into(),
            enabled: true,
            mode: "readonly".into(),
            args: vec![],
        };
        let ro = a.argv("");
        assert!(ro.contains(&"--tools".to_string()));
        a.mode = "full".into();
        let fu = a.argv("");
        assert!(!fu.contains(&"--tools".to_string()));
    }

    #[test]
    fn truncate_caps_output() {
        let s = "x".repeat(200 * 1024);
        assert!(truncate(&s).len() <= OUTPUT_CAP_BYTES);
    }

    #[test]
    fn tool_defs_complete() {
        let defs = Bridge::tool_defs();
        let names: Vec<&str> = defs
            .iter()
            .map(|d| d["name"].as_str().unwrap())
            .collect();
        assert_eq!(
            names,
            vec![
                "bridge_list_agents",
                "bridge_run_agent",
                "bridge_start_agent",
                "bridge_job_poll",
                "bridge_job_cancel"
            ]
        );
    }
}

impl Bridge {
    /// Set enabled + persist + start/stop the tunnel. Single entry point so
    /// tray, admin API and config writes stay consistent.
    pub fn set_enabled(&self, on: bool) {
        {
            let mut cfg = self.cfg.write().unwrap();
            cfg.enabled = on;
            let snapshot = cfg.clone();
            let _ = crate::config::save_config(&snapshot);
        }
        let cfg = self.cfg.read().unwrap().clone();
        if on {
            if !cfg.tunnel_cmd.is_empty() {
                if let Err(e) = self.tunnel.start(&cfg) {
                    eprintln!("tunnel start failed: {e}");
                }
            }
        } else {
            self.tunnel.stop();
        }
    }
}
