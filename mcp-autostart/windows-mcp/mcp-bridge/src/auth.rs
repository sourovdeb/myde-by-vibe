/// Auth wiring: /mcp requires an OAuth bearer token issued by this bridge's
/// authorization server (src/oauth.rs). Dev mode (passphrase "change-me")
/// keeps no-auth for local testing.
use crate::bridge::Bridge;

pub const DEV_PASSPHRASE: &str = "change-me";

impl Bridge {
    /// None = authorized; Some(err) = 401 with reason.
    pub fn check_auth(&self, headers: &[(String, String)]) -> Option<String> {
        let dev_mode = self.cfg.read().unwrap().passphrase == DEV_PASSPHRASE;
        let got = headers
            .iter()
            .find(|(k, _)| k == "authorization")
            .map(|(_, v)| v.clone())
            .unwrap_or_default();
        let got = got.strip_prefix("Bearer ").unwrap_or(&got).trim().to_string();
        if dev_mode && got.is_empty() {
            return None; // dev mode: no auth until a passphrase is set
        }
        if self.oauth.token_valid(&got) {
            None
        } else {
            Some("invalid_token".into())
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::Config;

    fn authed_bridge() -> Bridge {
        let mut cfg = Config::default();
        cfg.passphrase = "hunter2".into();
        Bridge::new(cfg, true)
    }

    #[test]
    fn dev_mode_no_auth_required() {
        let b = Bridge::new(Config::default(), true);
        assert!(b.check_auth(&[]).is_none());
    }

    #[test]
    fn set_passphrase_requires_valid_token() {
        let b = authed_bridge();
        assert!(b.check_auth(&[]).is_some());
        let token = crate::oauth::random_token("tok");
        b.oauth.tokens.lock().unwrap().insert(token.clone());
        let ok = vec![("authorization".into(), format!("Bearer {token}"))];
        assert!(b.check_auth(&ok).is_none());
        let bad = vec![("authorization".into(), "Bearer wrong".into())];
        assert!(b.check_auth(&bad).is_some());
    }

    #[test]
    fn dev_mode_still_accepts_valid_token() {
        let b = Bridge::new(Config::default(), true);
        let token = crate::oauth::random_token("tok");
        b.oauth.tokens.lock().unwrap().insert(token.clone());
        let ok = vec![("authorization".into(), format!("Bearer {token}"))];
        assert!(b.check_auth(&ok).is_none());
    }
}
