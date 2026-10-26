use serde_json::json;

use crate::bridge::Bridge;

/// Dev-grade bearer auth (step 8 interim). Full OAuth 2.1 (authorize page,
/// PKCE S256, dynamic client registration) replaces this; the interface
/// (check_auth on /mcp, metadata routes) stays the same.
pub const DEV_PASSPHRASE: &str = "change-me";

pub fn token_from_passphrase(p: &str) -> String {
    // FNV-1a 64 twice with salt — NOT cryptographic; interim only.
    let h = |salt: u64, s: &str| -> u64 {
        let mut hash: u64 = salt;
        for b in s.as_bytes() {
            hash ^= *b as u64;
            hash = hash.wrapping_mul(0x100000001b3);
        }
        hash
    };
    format!("{:016x}{:016x}", h(0xcbf29ce484222325, p), h(0xdeadbeefcafebabe, p))
}

impl Bridge {
    /// None = authorized; Some(err) = 401 with reason.
    pub fn check_auth(&self, headers: &[(String, String)]) -> Option<String> {
        let cfg = self.cfg.read().unwrap();
        if cfg.passphrase == DEV_PASSPHRASE {
            return None; // dev mode: no auth until a passphrase is set
        }
        let want = token_from_passphrase(&cfg.passphrase);
        let got = headers
            .iter()
            .find(|(k, _)| k == "authorization")
            .map(|(_, v)| v.clone())
            .unwrap_or_default();
        let got = got.strip_prefix("Bearer ").unwrap_or(&got).trim();
        if got == want {
            None
        } else {
            Some("invalid_token".into())
        }
    }

    pub fn token_grant(&self, passphrase: &str) -> Result<String, String> {
        let cfg = self.cfg.read().unwrap();
        if passphrase == cfg.passphrase {
            Ok(token_from_passphrase(&cfg.passphrase))
        } else {
            Err("invalid passphrase".into())
        }
    }
}

impl Bridge {
    pub fn well_known(&self, host: &str) -> serde_json::Value {
        let base = format!("http://{host}");
        json!({
            "issuer": base,
            "authorization_endpoint": format!("{base}/authorize"),
            "token_endpoint": format!("{base}/token"),
            "registration_endpoint": format!("{base}/register"),
            "response_types": ["code"],
            "grant_types": ["authorization_code", "refresh_token"],
            "code_challenge_methods": ["S256"]
        })
    }

    pub fn protected_resource(&self, host: &str) -> serde_json::Value {
        json!({
            "resource": format!("http://{host}/mcp"),
            "authorization_servers": [format!("http://{host}")],
            "scopes_supported": ["mcp"]
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::bridge::Bridge;
    use crate::config::Config;

    #[test]
    fn dev_mode_no_auth_required() {
        let b = Bridge::new(Config::default(), true);
        assert!(b.check_auth(&[]).is_none());
    }

    #[test]
    fn set_passphrase_requires_bearer() {
        let mut cfg = Config::default();
        cfg.passphrase = "hunter2".into();
        let b = Bridge::new(cfg, true);
        assert!(b.check_auth(&[]).is_some());
        let token = b.token_grant("hunter2").unwrap();
        let ok = vec![("authorization".into(), format!("Bearer {token}"))];
        assert!(b.check_auth(&ok).is_none());
        let bad = vec![("authorization".into(), "Bearer wrong".into())];
        assert!(b.check_auth(&bad).is_some());
    }

    #[test]
    fn wrong_passphrase_no_token() {
        let mut cfg = Config::default();
        cfg.passphrase = "hunter2".into();
        let b = Bridge::new(cfg, true);
        assert!(b.token_grant("nope").is_err());
    }

    #[test]
    fn token_is_deterministic() {
        assert_eq!(token_from_passphrase("abc"), token_from_passphrase("abc"));
        assert_ne!(token_from_passphrase("abc"), token_from_passphrase("abd"));
    }
}
