//! Tunnel control (step 11): the tray toggle starts/stops a configurable
//! external tunnel command (e.g. Tailscale Funnel). The command is config
//! data, argv-array only, never a shell string. Output is logged to
//! %APPDATA%\mcp-bridge\tunnel.log.

use std::process::{Child, Command, Stdio};
use std::sync::Mutex;

use crate::config::Config;

pub struct TunnelCtl {
    child: Mutex<Option<Child>>,
}

impl TunnelCtl {
    pub fn new() -> Self {
        Self { child: Mutex::new(None) }
    }

    /// argv template placeholders: {port} -> mcp port
    pub fn expand_args(cfg: &Config, args: &[String]) -> Vec<String> {
        args.iter()
            .map(|a| a.replace("{port}", &cfg.port.to_string()))
            .collect()
    }

    pub fn start(&self, cfg: &Config) -> Result<(), String> {
        let mut guard = self.child.lock().unwrap();
        if let Some(c) = guard.as_mut() {
            if matches!(c.try_wait(), Ok(None)) {
                return Ok(()); // already running
            }
        }
        if cfg.tunnel_cmd.is_empty() {
            return Err("no tunnel_cmd configured".into());
        }
        let args = Self::expand_args(cfg, &cfg.tunnel_args);
        let log = crate::config::config_path()
            .parent()
            .map(|p| p.join("tunnel.log"))
            .unwrap_or_else(|| std::path::PathBuf::from("tunnel.log"));
        let out = std::fs::OpenOptions::new().create(true).append(true).open(&log);
        let mut cmd = Command::new(&cfg.tunnel_cmd);
        cmd.args(&args);
        if let Ok(f) = out {
            cmd.stdout(Stdio::from(f));
            cmd.stderr(Stdio::from(std::fs::OpenOptions::new().create(true).append(true).open(&log).unwrap()));
        } else {
            cmd.stdout(Stdio::null()).stderr(Stdio::null());
        }
        match cmd.spawn() {
            Ok(c) => {
                *guard = Some(c);
                Ok(())
            }
            Err(e) => Err(format!("spawn {}: {e}", cfg.tunnel_cmd)),
        }
    }

    pub fn stop(&self) {
        if let Some(mut c) = self.child.lock().unwrap().take() {
            let _ = c.kill();
            let _ = c.wait();
        }
    }

    pub fn running(&self) -> bool {
        self.child
            .lock()
            .unwrap()
            .as_mut()
            .map(|c| matches!(c.try_wait(), Ok(None)))
            .unwrap_or(false)
    }
}

impl Default for TunnelCtl {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn expand_port_placeholder() {
        let mut cfg = Config::default();
        cfg.port = 8765;
        cfg.tunnel_cmd = "tailscale".into();
        cfg.tunnel_args = vec!["funnel".into(), "--bg".into(), "--https=443".into(), "--set-path=/mcp".into(), "http://127.0.0.1:{port}/mcp".into()];
        let args = TunnelCtl::expand_args(&cfg, &cfg.tunnel_args);
        assert_eq!(args.last().unwrap(), "http://127.0.0.1:8765/mcp");
        assert!(!args.iter().any(|a| a.contains("{port}")));
    }

    #[test]
    fn start_without_cmd_is_error() {
        let t = TunnelCtl::new();
        let mut cfg = Config::default();
        cfg.tunnel_cmd = String::new();
        assert!(t.start(&cfg).is_err());
        assert!(!t.running());
    }

    #[test]
    fn stop_is_idempotent() {
        let t = TunnelCtl::new();
        t.stop();
        t.stop();
        assert!(!t.running());
    }

    #[test]
    fn start_stop_real_process() {
        let t = TunnelCtl::new();
        let mut cfg = Config::default();
        cfg.tunnel_cmd = "sleep".into();
        cfg.tunnel_args = vec!["30".into()];
        t.start(&cfg).unwrap();
        assert!(t.running());
        t.stop();
        assert!(!t.running());
    }
}
