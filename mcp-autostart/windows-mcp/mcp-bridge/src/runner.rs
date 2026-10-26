use std::io::Write;
use std::process::{Command, Stdio};

#[derive(Debug)]
pub struct RunOutput {
    pub stdout: String,
    pub exit_code: i32,
}

/// Run exe argv, feed prompt via stdin, kill on timeout.
/// argv arrays only — never a shell string.
pub fn run_sync(exe: &str, argv: &[String], prompt: &str, timeout_secs: u64) -> Result<RunOutput, String> {
    let mut child = Command::new(exe)
        .args(argv)
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("spawn {exe}: {e}"))?;

    if let Some(mut stdin) = child.stdin.take() {
        let prompt = prompt.to_string();
        std::thread::spawn(move || {
            let _ = stdin.write_all(prompt.as_bytes());
            let _ = stdin.flush();
        });
    }

    let deadline = std::time::Instant::now() + std::time::Duration::from_secs(timeout_secs);
    loop {
        match child.try_wait() {
            Ok(Some(status)) => {
                let mut out = String::new();
                use std::io::Read;
                if let Some(mut so) = child.stdout.take() {
                    let mut buf = Vec::new();
                    let _ = so.read_to_end(&mut buf);
                    out.push_str(&String::from_utf8_lossy(&buf[..buf.len().min(crate::bridge::OUTPUT_CAP_BYTES + 64)]));
                }
                return Ok(RunOutput {
                    stdout: crate::bridge::truncate(&out).to_string(),
                    exit_code: status.code().unwrap_or(-1),
                });
            }
            Ok(None) => {
                if std::time::Instant::now() > deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(format!("timeout after {timeout_secs}s"));
                }
                std::thread::sleep(std::time::Duration::from_millis(50));
            }
            Err(e) => return Err(format!("wait: {e}")),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn runs_echo_prompt_via_stdin() {
        let argv: Vec<String> = vec![];
        let out = run_sync("cat", &argv, "hello-stdin", 10).unwrap();
        assert_eq!(out.exit_code, 0);
        assert!(out.stdout.contains("hello-stdin"));
    }

    #[test]
    fn timeout_kills() {
        let argv = vec!["30".to_string()];
        let e = run_sync("sleep", &argv, "", 1).unwrap_err();
        assert!(e.contains("timeout"));
    }

    #[test]
    fn missing_exe_err() {
        let e = run_sync("no-such-exe-xyz", &[], "p", 5).unwrap_err();
        assert!(e.contains("spawn"));
    }

    #[test]
    fn no_shell_injection() {
        // argv element that looks like shell metacharacters must stay inert
        let argv = vec!["-c".to_string(), "echo pwned".to_string()];
        let out = run_sync("cat", &argv, "safe", 10).unwrap();
        assert!(!out.stdout.contains("pwned"));
    }
}
