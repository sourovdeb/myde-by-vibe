# Security Audit Report — ONE-STOP-SHOP Full System

**Scope:** Latch MCP server, bridge scripts, Cloudflare tunnel, Chrome extension, Mistral workflows, autostart scripts, Pi agent configs
**Date:** 2026-10-27
**Auditor:** Vibe (security-audit skill)

---

## Summary

| Severity | Count |
|----------|-------|
| CRITICAL | 2 |
| HIGH | 2 |
| MEDIUM | 3 |
| LOW | 2 |
| INFO | 2 |

---

## CRITICAL Findings

### 1. Latch MCP endpoints have zero authentication — publicly exposed via Cloudflare tunnel

- **Location:** Latch server (port 3939), endpoints `/mcp/mistral`, `/mcp/pi`
- **Category:** Missing Authentication / Remote Code Execution
- **CWE:** CWE-306 (Missing Authentication for Critical Function), CWE-749 (Exposed Dangerous Method)
- **Confidence:** High (verified live 2026-10-27)

**Description:** The Latch MCP server's `/mcp/mistral` and `/mcp/pi` endpoints accept JSON-RPC requests without any authentication token. The `/panel` endpoint checks a token, but the MCP endpoints do not. This was verified by sending `tools/list` and `tools/call` requests without any token — both succeeded.

**Risk:** Anyone who knows the Cloudflare tunnel URL (`https://jason-salvador-known-stood.trycloudflare.com`) can:
1. List all available tools (file read, file search, command execution)
2. Execute allow-listed commands via `run_task` — including Python scripts that control DaVinci Resolve and OBS Studio
3. Read files from `E:\tools\latch-share\` (which contains operational logs, CSS snapshots, and WordPress operation records)

**Evidence (verified 2026-10-27):**
```bash
# No token — tools/list succeeds:
curl -s -X POST http://127.0.0.1:3939/mcp/mistral \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Returns: {"result":{"tools":[{"name":"list_files",...},{"name":"run_task",...}]}}

# No token — via public tunnel:
curl -s -X POST https://jason-salvador-known-stood.trycloudflare.com/mcp/mistral \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Returns: same tools list — PUBLICLY ACCESSIBLE

# No token — execute a command:
curl -s -X POST http://127.0.0.1:3939/mcp/mistral \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"run_task","arguments":{"command":"...resolve_cmd.py status"}}}'
# Returns: {"result":{"content":[{"text":"{\"status\":\"disconnected\"...}"}]}}
```

**Fix:** Latch 0.2.0 does not support per-endpoint auth on MCP routes. Mitigations:
1. **Immediate:** Bind Latch to `127.0.0.1` only (not `0.0.0.0`) — the Cloudflare tunnel connects to `localhost:3939`, so this doesn't break the tunnel. Change `latch.exe serve` to `latch.exe serve --host 127.0.0.1` (check if the flag exists; otherwise use a local reverse proxy with auth).
2. **Short-term:** Put a token-checking reverse proxy (e.g., a small Python/Node proxy) between cloudflared and Latch that validates a Bearer token before forwarding to `127.0.0.1:3939`.
3. **Long-term:** Upgrade Latch when per-endpoint auth is available, or replace with a custom MCP server that has auth built in.

---

### 2. Chrome extension content script uses `window.eval()` — arbitrary code execution in page context

- **Location:** `C:\h\chrome-communication-extension\content.js:21`
- **Category:** Code Injection / XSS
- **CWE:** CWE-95 (Eval Injection), CWE-79 (XSS)
- **Confidence:** High

**Description:** The content script executes `window.eval(request.code)` when it receives an `execute_js` message. While the message must come from the extension (not directly from a web page), this is a dangerous pattern:

1. Any compromised or malicious extension with the same messaging channel could execute arbitrary JS in any tab
2. If the background script ever forwards `execute_js` messages from external sources (e.g., via `externally_connectable`), this becomes remotely exploitable
3. The `window.DoubleControl` API is exposed to all web pages, allowing any website to send messages to the background

**Evidence:**
```javascript
// content.js:21
if (request.type === 'execute_js') {
  try {
    const result = window.eval(request.code);  // ARBITRARY CODE EXECUTION
    sendResponse({ success: true, result: result });
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}
```

**Risk:** If an attacker can inject a message into the extension's message channel (e.g., via a compromised externally-connectable page, or a malicious extension with overlapping permissions), they can execute arbitrary JavaScript in any tab's context — including stealing cookies, session tokens, and performing actions as the logged-in user on any website.

**Fix:** Replace `window.eval()` with `chrome.scripting.executeScript({ func: ... })` which runs in an isolated world by default, or use `Function()` constructor with strict CSP. At minimum, validate that `request.code` comes from a trusted source (check `sender.id` against a whitelist).

---

## HIGH Findings

### 3. Latch binds to 0.0.0.0 with explicit firewall allow rule — local network exposure

- **Location:** Latch server config / Windows Firewall
- **Category:** Network Exposure / Missing Access Control
- **CWE:** CWE-668 (Exposure of Resource to Wrong Sphere)
- **Confidence:** High (verified via netstat + firewall rules)

**Description:** Latch listens on `0.0.0.0:3939` (all interfaces), and Windows Firewall has two inbound "Allow" rules named "latch". This means any device on the local network can access the unauthenticated MCP endpoints.

**Evidence:**
```
TCP    0.0.0.0:3939    0.0.0.0:0    LISTENING    11524
Firewall rules: "latch" Inbound Allow (x2)
```

**Risk:** Anyone on the same WiFi/network can execute allow-listed commands, read shared files, and control Resolve/OBS without any authentication.

**Fix:** Bind Latch to `127.0.0.1` only. The Cloudflare tunnel connects via `localhost:3939`, so this doesn't break remote access. Remove or disable the firewall rules for 0.0.0.0 binding.

---

### 4. OBS WebSocket bridge has no authentication

- **Location:** `E:\tools\latch-bridges\obs_bridge.py:37`
- **Category:** Missing Authentication
- **CWE:** CWE-306
- **Confidence:** High

**Description:** The OBS bridge connects to `ws://localhost:4455` with `OBS_PASSWORD = None`. If OBS WebSocket is enabled without a password (the default), anyone who can reach port 4455 can control OBS — switch scenes, start/stop streaming, start/stop recording.

**Evidence:**
```python
OBS_HOST = "localhost"
OBS_PORT = 4455
OBS_PASSWORD = None  # Set if authentication is enabled
```

**Risk:** Combined with the unauthenticated Latch MCP (Finding #1), an attacker can chain: tunnel → Latch `run_task` → `obs_cmd.py switch_scene <name>` → disrupt a live stream or recording.

**Fix:** Enable OBS WebSocket authentication (Tools > WebSocket Server Settings > Authentication) and set `OBS_PASSWORD` in the bridge. Alternatively, ensure OBS WebSocket only listens on `127.0.0.1` (it does by default).

---

## MEDIUM Findings

### 5. Latch auth token stored in plaintext config file

- **Location:** `C:\Users\souro\.mcp-autostart\latch.json`
- **Category:** Sensitive Data Storage
- **CWE:** CWE-312 (Cleartext Storage of Sensitive Information)
- **Confidence:** High

**Description:** The 64-char hex auth token is stored in plaintext in `latch.json`. While this is expected for a config file, the file permissions should be restricted to the user only.

**Risk:** Any process running as the user (or any malware) can read the token and access the `/panel` endpoint.

**Fix:** Verify file ACLs restrict access to `souro` only. Consider using Windows Credential Manager or DPAPI for token storage.

---

### 6. No `.gitignore` in mistral-workflows or chrome-extension projects

- **Location:** `E:\ONE-STOP-SHOP\mistral-workflows\`, `C:\h\chrome-communication-extension\`
- **Category:** Information Exposure / Configuration
- **CWE:** CWE-538 (File and Directory Information Exposure)
- **Confidence:** High

**Description:** Neither project has a `.gitignore` file. If these directories are ever committed to git, `.env` files, `__pycache__`, `.venv`, and other sensitive artifacts could be accidentally included.

**Risk:** Accidental commit of secrets or large binary files to version control.

**Fix:** Create `.gitignore` files:
```
# mistral-workflows/.gitignore
.venv/
__pycache__/
*.pyc
.env
.env.*
output/
.pytest_cache/

# chrome-extension/.gitignore
node_modules/
*.log
.env
```

---

### 7. `window.DoubleControl` API exposed to all web pages

- **Location:** `C:\h\chrome-communication-extension\content.js:38-48`
- **Category:** Information Exposure / Attack Surface
- **CWE:** CWE-749 (Exposed Dangerous Method)
- **Confidence:** Medium

**Description:** The content script exposes `window.DoubleControl` with a `sendMessage()` method to every web page. Any website can call `window.DoubleControl.sendMessage({type: 'open_tab', url: '...'})` to make the extension open tabs, close tabs, or switch tabs.

**Evidence:**
```javascript
window.DoubleControl = {
  sendMessage: function(message) {
    chrome.runtime.sendMessage(message);
  },
  ...
};
```

**Risk:** A malicious website can spam tabs, close tabs (via background handler), or otherwise manipulate the browser. The background script handles `open_tab`, `close_tab`, and `switch_tab` messages without sender validation.

**Fix:** Validate `sender.id` in the background script's message handler. Only accept messages from the extension itself. Remove the `window.DoubleControl` page API or restrict it to specific trusted origins.

---

## LOW Findings

### 8. Latch-share folder contains operational logs readable without auth

- **Location:** `E:\tools\latch-share\` (accessible via Latch `read_file` tool)
- **Category:** Information Exposure
- **CWE:** CWE-200
- **Confidence:** High

**Description:** The shared folder contains `results.jsonl` (WordPress operation logs with timestamps, post IDs, CSS lengths), `brief.md` (operational notes about site changes), and `css-before-2026-10-27.css` (full CSS snapshot). These are readable via the unauthenticated Latch `read_file` tool.

**Risk:** Information disclosure about site operations, post IDs, and site structure.

**Fix:** Move sensitive operational files out of the Latch-share folder. Keep only non-sensitive files there.

---

### 9. Chrome extension popup uses `innerHTML` with static strings

- **Location:** `C:\h\chrome-communication-extension\popup.js:13,17,89`
- **Category:** Code Quality / Potential XSS
- **CWE:** CWE-79
- **Confidence:** Low (currently safe — only static strings used)

**Description:** The popup uses `innerHTML` for clearing and setting static content. Tab titles and URLs are set via `textContent` (safe), but the pattern is fragile — if dynamic content is ever inserted via `innerHTML`, it becomes an XSS vector.

**Fix:** Use `textContent` or `createElement` consistently. Avoid `innerHTML` entirely in extension popups.

---

## INFO Findings

### 10. davinci-resolve-mcp v4.13.7 installed (unofficial Resolve MCP)

- **Location:** `E:\tools\davinci-resolve-mcp\`
- **Category:** Third-Party Dependency
- **Confidence:** High

**Description:** The unofficial `davinci-resolve-mcp` v4.13.7 by Samuel Gursky is installed with 37 MCP tools and 100% API coverage. It's referenced in the Pi project-level `mcp.json` as the `resolve` server. This is a well-maintained project (MIT license, active development) but is not affiliated with Blackmagic Design.

**Note:** DaVinci Resolve 21.1 now ships a native MCP server (Studio license required). The unofficial server may offer more tools but the native one is officially supported. Consider evaluating the native server for production use.

---

### 11. Cloudflare tunnel URL is ephemeral

- **Location:** `E:\tools\latch\status.json`
- **Category:** Operational / Reliability
- **Confidence:** High

**Description:** Quick tunnels (`cloudflared tunnel --url`) generate a new random URL on each restart. The current URL (`https://jason-salvador-known-stood.trycloudflare.com`) will change when cloudflared restarts. All connectors (Mistral AI, Pi agent) must be updated with the new URL.

**Mitigation already in place:** `Latch-Status.ps1` saves the last-known-good URL to `status.json`. The `shared/latch.py` module reads from `status.json` as a fallback.

**Recommendation:** Consider a named Cloudflare tunnel (with a fixed hostname) for production use, or automate connector URL updates on tunnel restart.

---

## Dependency Audit

| Package | Version | Vulnerability | Severity | Fixed In |
|---------|---------|--------------|----------|----------|
| mistralai-workflows | 3.16.0 | None known | — | — |
| mistralai | 2.10.1 | None known | — | — |
| httpx | (in venv) | None known | — | — |
| pydantic | >=2 (in venv) | None known | — | — |
| websocket-client | (in latch-bridges venv) | None known | — | — |
| davinci-resolve-mcp | 4.13.7 | None known (unofficial) | INFO | — |
| cloudflared | 2026.10.3 | None known | — | — |
| latch | 0.2.0 | No auth on MCP endpoints | CRITICAL | Unknown (upstream) |

---

## Secrets Scan

| File | Status | Action |
|------|--------|--------|
| `C:\Users\souro\.mcp-autostart\latch.json` | Token present (len=64) | Restrict file ACLs; consider DPAPI |
| `E:\ONE-STOP-SHOP\mistral-workflows\` (all .py) | No hardcoded secrets | Clean |
| `E:\tools\latch-bridges\` (all .py) | No hardcoded secrets | Clean |
| `C:\h\chrome-communication-extension\` (all .js/.json) | No hardcoded secrets | Clean |
| `~/.vibe/.env` | Loaded by `shared/config.py` | Never committed; session-only |
| `~/.vibe/.env_secrets.md` | Loaded by `shared/config.py` | Never committed; off-limits |
| Git history (`/tmp/myde-by-vibe`) | `tools/mcp-servers/example.env` found | Example file only — verify no real secrets |

---

## Proposed Patches

### Patch 1: Bind Latch to localhost only (CRITICAL — Finding #1, #3)

**Before** (`E:\tools\latch\Latch-AutoStart.cmd`):
```cmd
start "" /b E:\tools\latch\latch.exe serve >> E:\tools\latch\latch-serve.log 2>&1
```

**After:**
```cmd
start "" /b E:\tools\latch\latch.exe serve --host 127.0.0.1 >> E:\tools\latch\latch-serve.log 2>&1
```

If `--host` is not supported, add a local auth proxy between cloudflared and Latch.

Also remove the firewall rules:
```powershell
Remove-NetFirewallRule -DisplayName "latch"
```

### Patch 2: Replace `window.eval()` in content.js (CRITICAL — Finding #2)

**Before** (`content.js:21`):
```javascript
const result = window.eval(request.code);
```

**After:**
```javascript
// Validate sender is the extension itself
if (sender.id !== chrome.runtime.id) {
  sendResponse({ success: false, error: 'Unauthorized sender' });
  return true;
}
// Use Function constructor instead of eval (still dangerous, but contained)
const fn = new Function('return (' + request.code + ')');
const result = fn();
```

Better: remove the `execute_js` handler entirely and use `chrome.scripting.executeScript` from the background with `world: 'ISOLATED'`.

### Patch 3: Add `.gitignore` files (MEDIUM — Finding #6)

Create `E:\ONE-STOP-SHOP\mistral-workflows\.gitignore` and `C:\h\chrome-communication-extension\.gitignore` with the contents shown in Finding #6.

### Patch 4: Enable OBS WebSocket auth (HIGH — Finding #4)

In OBS: Tools > WebSocket Server Settings > Enable Authentication > set password.
Then in `obs_bridge.py`:
```python
OBS_PASSWORD = os.environ.get("OBS_WS_PASSWORD", "your-password-here")
```

---

**Review each patch before applying. Nothing has been changed yet.**
