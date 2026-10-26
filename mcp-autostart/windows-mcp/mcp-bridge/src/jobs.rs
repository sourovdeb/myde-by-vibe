
use serde_json::{json, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;

static JOB_SEQ: AtomicU64 = AtomicU64::new(1);
pub const MAX_RUNNING: usize = 4;

#[derive(Debug, Clone)]
pub struct Job {
    pub id: String,
    pub agent: String,
    pub status: String,
    pub output: String,
    pub delivered: usize,
}

#[derive(Default)]
pub struct JobRegistry {
    jobs: Mutex<HashMap<String, Job>>,
}

impl JobRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    fn running(&self) -> usize {
        self.jobs
            .lock()
            .unwrap()
            .values()
            .filter(|j| j.status == "running")
            .count()
    }

    pub fn spawn(&self, exe: &str, argv: &[String], prompt: &str) -> Result<Job, String> {
        if self.running() >= MAX_RUNNING {
            return Err("too many running jobs (max 4)".into());
        }
        let id = format!("job-{}", JOB_SEQ.fetch_add(1, Ordering::SeqCst));
        let job = Job {
            id: id.clone(),
            agent: exe.to_string(),
            status: "running".into(),
            output: String::new(),
            delivered: 0,
        };
        self.jobs.lock().unwrap().insert(id.clone(), job.clone());

        let exe = exe.to_string();
        let argv: Vec<String> = argv.to_vec();
        let prompt = prompt.to_string();
        let jobs: &'static Mutex<HashMap<String, Job>> = unsafe { std::mem::transmute(&self.jobs) };
        std::thread::spawn(move || {
            let out = crate::runner::run_sync(&exe, &argv, &prompt, crate::bridge::RUN_TIMEOUT_SECS);
            let mut map = jobs.lock().unwrap();
            if let Some(j) = map.get_mut(&id) {
                match out {
                    Ok(o) => {
                        j.status = if o.exit_code == 0 {
                            "succeeded".into()
                        } else {
                            "failed".into()
                        };
                        j.output = o.stdout;
                    }
                    Err(e) => {
                        j.status = "failed".into();
                        j.output = e;
                    }
                }
            }
        });
        Ok(job)
    }

    /// return status plus only the not-yet-delivered slice of output
    pub fn poll(&self, args: &Value) -> Result<Value, String> {
        let id = args
            .get("job_id")
            .and_then(|v| v.as_str())
            .ok_or("missing job_id")?;
        let mut map = self.jobs.lock().unwrap();
        let j = map.get_mut(id).ok_or_else(|| format!("no such job: {id}"))?;
        let new_out = j.output[j.delivered.min(j.output.len())..].to_string();
        j.delivered = j.output.len();
        Ok(json!({
            "job_id": j.id,
            "agent": j.agent,
            "status": j.status,
            "new_output": new_out,
        }))
    }

    pub fn cancel(&self, args: &Value) -> Result<Value, String> {
        let id = args
            .get("job_id")
            .and_then(|v| v.as_str())
            .ok_or("missing job_id")?;
        let mut map = self.jobs.lock().unwrap();
        let j = map.get_mut(id).ok_or_else(|| format!("no such job: {id}"))?;
        if j.status == "running" {
            j.status = "cancelled".into();
        }
        Ok(json!({"job_id": j.id, "status": j.status}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn poll_unknown_job() {
        let r = JobRegistry::new();
        let e = r.poll(&json!({"job_id":"nope"})).unwrap_err();
        assert!(e.contains("no such job"));
    }

    #[test]
    fn cancel_marks_cancelled() {
        let r = JobRegistry::new();
        let j = r.spawn("sleep", &["5".into()], "x").unwrap();
        let c = r.cancel(&json!({"job_id": j.id})).unwrap();
        assert_eq!(c["status"], "cancelled");
    }
}
