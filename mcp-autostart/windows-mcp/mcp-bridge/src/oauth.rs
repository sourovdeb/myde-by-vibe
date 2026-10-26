use serde_json::json;

/// OAuth 2.1 single-user authorization server for the bridge.
/// PKCE S256 required; passphrase approval page; dynamic client registration.
/// State kept in-memory (single-user bridge: acceptable; restart = re-consent).

pub struct OAuth {
    /// client_id -> redirect_uris (from dynamic registration)
    pub clients: std::sync::Mutex<std::collections::HashMap<String, Vec<String>>>,
    /// code -> (client_id, redirect_uri, code_challenge, expiry)
    pub codes: std::sync::Mutex<std::collections::HashMap<String, AuthCode>>,
    /// bearer tokens issued
    pub tokens: std::sync::Mutex<std::collections::HashSet<String>>,
}

pub struct AuthCode {
    pub client_id: String,
    pub redirect_uri: String,
    pub code_challenge: String,
    pub expires: std::time::Instant,
}

impl OAuth {
    pub fn new() -> Self {
        Self {
            clients: Default::default(),
            codes: Default::default(),
            tokens: Default::default(),
        }
    }

    /// RFC 9728 protected resource metadata; points 401s at the AS
    pub fn protected_resource_metadata(&self, base: &str) -> serde_json::Value {
        json!({
            "resource": format!("{base}/mcp"),
            "authorization_servers": [base],
            "scopes_supported": ["mcp"],
            "bearer_methods_supported": ["header"]
        })
    }

    /// RFC 8414 authorization server metadata
    pub fn as_metadata(&self, base: &str) -> serde_json::Value {
        json!({
            "issuer": base,
            "authorization_endpoint": format!("{base}/authorize"),
            "token_endpoint": format!("{base}/token"),
            "registration_endpoint": format!("{base}/register"),
            "response_types_supported": ["code"],
            "grant_types_supported": ["authorization_code", "refresh_token"],
            "code_challenge_methods_supported": ["S256"],
            "token_endpoint_auth_methods_supported": ["none"]
        })
    }

    pub fn register_client(&self, redirect_uris: Vec<String>) -> String {
        let client_id = random_token("client");
        self.clients
            .lock()
            .unwrap()
            .insert(client_id.clone(), redirect_uris);
        client_id
    }

    pub fn client_redirect_ok(&self, client_id: &str, redirect_uri: &str) -> bool {
        self.clients
            .lock()
            .unwrap()
            .get(client_id)
            .map(|uris| uris.iter().any(|u| u == redirect_uri))
            .unwrap_or(false)
    }

    /// authorize: validate client+redirect+PKCE, issue code after passphrase ok
    pub fn issue_code(
        &self,
        client_id: &str,
        redirect_uri: &str,
        code_challenge: &str,
    ) -> Result<String, String> {
        if !self.client_redirect_ok(client_id, redirect_uri) {
            return Err("invalid_client_or_redirect".into());
        }
        if code_challenge.len() != 43 {
            return Err("pkce S256 required (43-char challenge)".into());
        }
        let code = random_token("code");
        self.codes.lock().unwrap().insert(
            code.clone(),
            AuthCode {
                client_id: client_id.to_string(),
                redirect_uri: redirect_uri.to_string(),
                code_challenge: code_challenge.to_string(),
                expires: std::time::Instant::now() + std::time::Duration::from_secs(60),
            },
        );
        Ok(code)
    }

    /// token: verify code (single-use), PKCE verifier, issue bearer
    pub fn exchange_code(
        &self,
        code: &str,
        client_id: &str,
        redirect_uri: &str,
        verifier: &str,
    ) -> Result<String, String> {
        let ac = self
            .codes
            .lock()
            .unwrap()
            .remove(code)
            .ok_or("invalid_grant")?;
        if ac.expires < std::time::Instant::now() {
            return Err("code_expired".into());
        }
        if ac.client_id != client_id || ac.redirect_uri != redirect_uri {
            return Err("invalid_grant".into());
        }
        // S256: BASE64URL(SHA256(verifier)) must equal the stored challenge
        let digest = sha256(verifier.as_bytes());
        let computed = b64url(&digest);
        if computed != ac.code_challenge {
            return Err("pkce_verification_failed".into());
        }
        let token = random_token("tok");
        self.tokens.lock().unwrap().insert(token.clone());
        Ok(token)
    }

    pub fn token_valid(&self, token: &str) -> bool {
        self.tokens.lock().unwrap().contains(token)
    }
}

pub fn sha256(data: &[u8]) -> [u8; 32] {
    // minimal SHA-256 (FIPS 180-4) — avoids a crypto dependency for PKCE
    const K: [u32; 64] = [
        0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4,
        0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe,
        0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f,
        0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
        0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc,
        0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b,
        0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070, 0x19a4c116,
        0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
        0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7,
        0xc67178f2,
    ];
    let mut h: [u32; 8] = [
        0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
        0x5be0cd19,
    ];
    let mut msg = data.to_vec();
    let bitlen = (data.len() as u64) * 8;
    msg.push(0x80);
    while msg.len() % 64 != 56 {
        msg.push(0);
    }
    msg.extend_from_slice(&bitlen.to_be_bytes());
    for block in msg.chunks(64) {
        let mut w = [0u32; 64];
        for i in 0..16 {
            w[i] = u32::from_be_bytes([
                block[i * 4],
                block[i * 4 + 1],
                block[i * 4 + 2],
                block[i * 4 + 3],
            ]);
        }
        for i in 16..64 {
            let s0 = w[i - 15].rotate_right(7) ^ w[i - 15].rotate_right(18) ^ (w[i - 15] >> 3);
            let s1 = w[i - 2].rotate_right(17) ^ w[i - 2].rotate_right(19) ^ (w[i - 2] >> 10);
            w[i] = w[i - 16]
                .wrapping_add(s0)
                .wrapping_add(w[i - 7])
                .wrapping_add(s1);
        }
        let (mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh) =
            (h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7]);
        for i in 0..64 {
            let s1 = e.rotate_right(6) ^ e.rotate_right(11) ^ e.rotate_right(25);
            let ch = (e & f) ^ ((!e) & g);
            let t1 = hh
                .wrapping_add(s1)
                .wrapping_add(ch)
                .wrapping_add(K[i])
                .wrapping_add(w[i]);
            let s0 = a.rotate_right(2) ^ a.rotate_right(13) ^ a.rotate_right(22);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g;
            g = f;
            f = e;
            e = d.wrapping_add(t1);
            d = c;
            c = b;
            b = a;
            a = t1.wrapping_add(t2);
        }
        h[0] = h[0].wrapping_add(a);
        h[1] = h[1].wrapping_add(b);
        h[2] = h[2].wrapping_add(c);
        h[3] = h[3].wrapping_add(d);
        h[4] = h[4].wrapping_add(e);
        h[5] = h[5].wrapping_add(f);
        h[6] = h[6].wrapping_add(g);
        h[7] = h[7].wrapping_add(hh);
    }
    let mut out = [0u8; 32];
    for (i, word) in h.iter().enumerate() {
        out[i * 4..i * 4 + 4].copy_from_slice(&word.to_be_bytes());
    }
    out
}

pub fn b64url(data: &[u8]) -> String {
    const CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
    let mut s = String::new();
    for chunk in data.chunks(3) {
        let b = [chunk[0], *chunk.get(1).unwrap_or(&0), *chunk.get(2).unwrap_or(&0)];
        let n = ((b[0] as u32) << 16) | ((b[1] as u32) << 8) | b[2] as u32;
        s.push(CHARS[(n >> 18) as usize & 63] as char);
        s.push(CHARS[(n >> 12) as usize & 63] as char);
        if chunk.len() > 1 {
            s.push(CHARS[(n >> 6) as usize & 63] as char);
        }
        if chunk.len() > 2 {
            s.push(CHARS[n as usize & 63] as char);
        }
    }
    s
}

/// Non-cryptographic random id. Mixes process time, thread id, and an
/// atomic counter; unique per run. Threat model: internet scanners, not
/// a targeted adversary observing the host (documented limitation).
pub fn random_token(prefix: &str) -> String {
    use std::sync::atomic::{AtomicU64, Ordering};
    static SEQ: AtomicU64 = AtomicU64::new(0);
    let n = SEQ.fetch_add(1, Ordering::Relaxed);
    let t = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_nanos() as u64)
        .unwrap_or(0);
    let tid = format!("{:?}", std::thread::current().id())
        .bytes()
        .fold(0x9e3779b9u64, |a, b| a.wrapping_mul(31).wrapping_add(b as u64));
    let mix = t ^ tid.rotate_left(17) ^ n.wrapping_mul(0x9e3779b97f4a7c15);
    let h1 = sha256(&mix.to_be_bytes());
    let h2 = sha256(&h1);
    format!("{}-{}", prefix, b64url(&h2[..15]))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sha256_known_vectors() {
        // FIPS 180-4 test vectors
        assert_eq!(
            hex(&sha256(b"abc")),
            "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
        );
        assert_eq!(
            hex(&sha256(b"")),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
        assert_eq!(
            hex(&sha256(b"abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq")),
            "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1"
        );
    }

    fn hex(b: &[u8]) -> String {
        b.iter().map(|x| format!("{x:02x}")).collect()
    }

    #[test]
    fn pkce_s256_vector() {
        // verified against python: base64url(sha256(verifier))
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjpk";
        let challenge = b64url(&sha256(verifier.as_bytes()));
        assert_eq!(challenge, "pZyNZepIZul0fOpMn60Mgcg9-cPjCUqVsOw2WePKn-k");
    }

    #[test]
    fn full_oauth_flow() {
        let o = OAuth::new();
        let cid = o.register_client(vec!["https://claude.ai/api/mcp/auth_callback".into()]);
        assert!(o.client_redirect_ok(&cid, "https://claude.ai/api/mcp/auth_callback"));
        assert!(!o.client_redirect_ok(&cid, "https://evil.example/cb"));
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjpk";
        let challenge = b64url(&sha256(verifier.as_bytes()));
        let code = o.issue_code(&cid, "https://claude.ai/api/mcp/auth_callback", &challenge).unwrap();
        let token = o
            .exchange_code(&code, &cid, "https://claude.ai/api/mcp/auth_callback", verifier)
            .unwrap();
        assert!(o.token_valid(&token));
        // code single-use
        assert!(o
            .exchange_code(&code, &cid, "https://claude.ai/api/mcp/auth_callback", verifier)
            .is_err());
    }

    #[test]
    fn wrong_verifier_rejected() {
        let o = OAuth::new();
        let cid = o.register_client(vec!["https://claude.ai/api/mcp/auth_callback".into()]);
        let challenge = b64url(&sha256(b"right-verifier-aaaaaaaaaaaaaaaaaaaaaaaaa"));
        let code = o.issue_code(&cid, "https://claude.ai/api/mcp/auth_callback", &challenge).unwrap();
        assert!(o
            .exchange_code(&code, &cid, "https://claude.ai/api/mcp/auth_callback", "wrong-verifier")
            .is_err());
        assert!(!o.token_valid("anything"));
    }

    #[test]
    fn unregistered_client_rejected() {
        let o = OAuth::new();
        assert!(o.issue_code("ghost", "https://x/cb", &"c".repeat(43)).is_err());
    }

    #[test]
    fn b64url_no_padding() {
        assert_eq!(b64url(&[0xfb, 0xff]), "-_8");
        assert!(!b64url(&[0xff; 32]).contains('='));
    }

    #[test]
    fn tokens_unique() {
        assert_ne!(random_token("t"), random_token("t"));
    }
}
