# Latch MCP Bridges — DaVinci Resolve & OBS Studio Control

Control DaVinci Resolve and OBS Studio from Mistral AI via the Latch MCP server.

**Date:** 2026-10-26
**Status:** Tested end-to-end (Mistral AI → Latch → Resolve/OBS bridges)

---

## Architecture

```
Mistral AI (chat.mistral.ai)          Pi Agent (E:\apps\pi\agent\bin\pi)
    │                                        │
    ▼                                        ▼
Latch MCP Connector                  Pi MCP Config (~/.pi/agent/mcp.json)
(latch_mcp_local_pc_tools_00da)      or project-level (.pi/agent/mcp.json)
    │                                        │
    └────────────┬───────────────────────────┘
                 │  HTTPS via Cloudflare Tunnel
                 ▼
    Cloudflare Tunnel (https://jason-salvador-known-stood.trycloudflare.com)
                 │
                 ▼
    Latch Server (port 3939, E:\tools\latch\latch.exe)
                 │  run_task (allow-listed commands)
                 ▼
    Bridge Scripts (E:\tools\latch-bridges\)
        ├── resolve_cmd.py → ResolvePython.exe → resolve_bridge.py → DaVinci Resolve API
        └── obs_cmd.py → venv python → obs_bridge.py → OBS WebSocket (port 4455)
```

---

## Files

| File | Purpose |
|------|---------|
| `resolve_bridge.py` | Resolve control via DaVinciResolveScript API. Run with Resolve's bundled Python. |
| `obs_bridge.py` | OBS control via WebSocket (obs-websocket protocol v5). Run with venv Python. |
| `resolve_cmd.py` | Wrapper: invokes ResolvePython.exe with resolve_bridge.py |
| `obs_cmd.py` | Wrapper: invokes venv python with obs_bridge.py |
| `latch-config-example.json` | Example Latch config with scripts enabled and allow-listed commands |

---

## Resolve Bridge Commands

| Command | Description |
|---------|-------------|
| `status` | Check if Resolve is running and scripting is available |
| `list_projects` | List all projects in the project manager |
| `get_current` | Get info about the currently open project |
| `list_timelines` | List all timelines in the current project |
| `get_timeline_info` | Get detailed info about a timeline |
| `list_media_pool` | List top-level items in the Media Pool |
| `get_resolve_version` | Get Resolve version info |

**Prerequisites:**
- DaVinci Resolve Studio (external scripting requires Studio license)
- Resolve must be running
- External scripting enabled: Preferences > System > General > External scripting using: Local

---

## OBS Bridge Commands

| Command | Description |
|---------|-------------|
| `status` | Check OBS WebSocket connection status |
| `get_version` | Get OBS version info |
| `list_scenes` | List all scenes |
| `get_current_scene` | Get the currently active scene |
| `switch_scene <name>` | Switch to a scene by name |
| `list_sources` | List all sources |
| `get_stream_status` | Get streaming status |
| `get_record_status` | Get recording status |
| `list_profiles` | List streaming/recording profiles |

**Prerequisites:**
- OBS Studio running
- WebSocket server enabled: Tools > WebSocket Server Settings > Enable WebSocket server (port 4455)
- Python venv with `websocket-client` package

---

## Latch Configuration

### 1. Enable scripts capability

Edit `C:\Users\souro\.mcp-autostart\latch.json`:

```json
{
  "caps": {
    "read": true,
    "edit": false,
    "scripts": true,
    "desktop": false
  },
  "providers": {
    "mistral": {
      "read": true,
      "edit": false,
      "scripts": true,
      "desktop": false
    }
  }
}
```

### 2. Add allow-listed commands

Latch uses **exact match** for command allow-listing. Each command must be a single string with no spaces in the program path (Latch splits on whitespace for execution).

```json
{
  "commands": [
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py status",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py list_projects",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py get_current",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py list_timelines",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py get_timeline_info",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py list_media_pool",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py get_resolve_version",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py status",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py get_version",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py list_scenes",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py get_current_scene",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py list_sources",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py get_stream_status",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py get_record_status",
    "C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py list_profiles"
  ]
}
```

> **Note:** Latch re-reads the config on every request, so changes take effect immediately without restart.

> **Note:** `switch_scene` takes a dynamic scene name argument and is NOT in the allow-list (exact match required). To use it, you would need to add specific scene names or modify the bridge to accept a fixed set of scenes.

---

## Setup Instructions

### 1. Install bridge scripts

```bash
# Create directory
mkdir -p E:\tools\latch-bridges

# Copy bridge scripts (resolve_bridge.py, obs_bridge.py, resolve_cmd.py, obs_cmd.py)
# to E:\tools\latch-bridges\
```

### 2. Create Python venv for OBS bridge

```bash
C:\Users\souro\.local\bin\python3.12.exe -m venv E:\tools\latch-bridges\venv
E:\tools\latch-bridges\venv\Scripts\python.exe -m pip install websocket-client
```

### 3. Configure Latch

Edit `C:\Users\souro\.mcp-autostart\latch.json` as shown above.

### 4. Refresh Mistral connector tools

The Mistral connector caches the tool list. After adding new commands to Latch, refresh via the tRPC API:

```js
// From browser console on chat.mistral.ai (logged in)
fetch('/api/trpc/integrations.refreshTools?batch=1', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ '0': { json: { integrationId: 'YOUR_CONNECTOR_ID' } } })
})
```

Or navigate to the connector page and click "Connect" again.

---

## Usage Examples

### Via Mistral AI (chat.mistral.ai)

```
Use the Latch MCP connector to check DaVinci Resolve status:
run_task with command: C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py status
```

```
Use the Latch MCP connector to list OBS scenes:
run_task with command: C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py list_scenes
```

### Direct (local testing)

```bash
# Resolve status
"C:\Users\souro\.local\bin\python3.12.exe" "E:\tools\latch-bridges\resolve_cmd.py" status

# OBS status
"C:\Users\souro\.local\bin\python3.12.exe" "E:\tools\latch-bridges\obs_cmd.py" status
```

### Via Latch HTTP API

```bash
curl -X POST "http://127.0.0.1:3939/mcp/mistral" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"run_task","arguments":{"command":"C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\resolve_cmd.py status"}}}'
```

---

## Key Design Decisions

1. **Wrapper scripts** (`resolve_cmd.py`, `obs_cmd.py`): Latch's `run_task` splits commands on whitespace (`split_whitespace()` in bridge.rs). Paths with spaces (e.g., "Program Files") cannot be used directly. Wrapper scripts in a space-free path (`E:\tools\latch-bridges\`) solve this.

2. **System Python** (`C:\Users\souro\.local\bin\python3.12.exe`): Space-free path, used as the entry point for both wrappers.

3. **Exit code 0 on errors**: Bridge scripts exit 0 even on connection failures, so Latch doesn't mark the result as `isError: true`. The error message is still in the JSON output.

4. **Exact match allow-list**: Latch uses exact string matching (`item == &command` in bridge.rs). The AI must send the exact command string. Dynamic arguments (like scene names) are not supported.

5. **Custom bridges over third-party MCP servers**: Instead of installing `davinci-resolve-mcp` (37 tools, heavy) or `obs-mcp` (royshil), lightweight custom bridges were built to integrate with Latch's allow-list model. This keeps the attack surface minimal and the integration simple.

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Resolve is not running" | Start DaVinci Resolve Studio. Enable external scripting in Preferences. |
| "Cannot connect to OBS WebSocket" | Start OBS Studio. Enable WebSocket: Tools > WebSocket Server Settings > Enable. Default port 4455. |
| "command is not on the allow list" | Check that the command string exactly matches an entry in `latch.json` `commands` array. |
| "websocket-client not installed" | Run: `E:\tools\latch-bridges\venv\Scripts\python.exe -m pip install websocket-client` |
| Mistral doesn't see `run_task` tool | Refresh connector tools via tRPC API (see Setup step 4) or reconnect in the UI. |
| Tunnel returns 503 | Cloudflare tunnel may have restarted. Check tunnel process and update connector URL. |

---

---

## Pi Agent Integration

The Pi agent (`E:\apps\pi\agent\bin\pi`, v1.3.0) can also control Resolve and OBS through Latch.

### Pi MCP Configuration

**User-level** (`C:\Users\souro\.pi\agent\mcp.json`):

```json
{
  "mcpServers": {
    "latch": {
      "type": "http",
      "url": "https://jason-salvador-known-stood.trycloudflare.com/mcp/pi",
      "description": "Latch MCP — file ops + Resolve/OBS bridge commands via run_task"
    }
  }
}
```

**Project-level** (`E:\ONE-STOP-SHOP\.pi\agent\mcp.json`) — same server, already configured.

> **Note:** Project-level `.pi/mcp.json` overrides user-level for the same server name. Both point to the same Latch instance.

### Pi Skill

A Pi skill is installed at `E:\apps\agent-skills\latch-resolve-obs-bridges\SKILL.md` with:
- Full command reference for all 15 Resolve + OBS commands
- Usage examples (check status, list scenes, switch scenes, etc.)
- Troubleshooting guide

### Verification

```bash
pi mcp list
# Output: latch: connected, 4 tools (list_files, read_file, search_files, run_task)
```

---

## Security Audit (2026-10-26)

### CRITICAL — Latch MCP Endpoints Unauthenticated

**Finding:** Latch 0.2.0 MCP endpoints (`/mcp`, `/mcp/mistral`, `/mcp/pi`) have **zero authentication**. In `http.rs`, the `handle_client` function only checks the token for `/panel` endpoints. MCP endpoints go directly to `dispatch()` in `bridge.rs:416` with no token check.

**Evidence:** `curl` to the tunnel URL without any token returns all 4 tools and executes `run_task` successfully.

**Impact:** Anyone who knows the Cloudflare tunnel URL can call all MCP tools — read files, search files, and execute all 15 allow-listed Resolve/OBS commands.

**Mitigation (proposed, not applied):** Add a reverse proxy on a different port that checks `Authorization: Bearer <token>` or `?token=` query param before forwarding to Latch on port 3939. Then repoint the Cloudflare tunnel at the proxy.

**Workaround (current):** The tunnel URL is ephemeral (regenerated on cloudflared restart) and not publicly listed. The allow-list limits execution to 15 specific commands. Risk is moderate but real.

### MEDIUM — Permissive CORS

**Finding:** Latch sets `Access-Control-Allow-Origin: *` (http.rs:262). Any website can make requests to the Latch server if it's reachable from the browser.

### LOW — OBS WebSocket No Authentication

**Finding:** OBS WebSocket uses `ws://` (not `wss://`) and `OBS_PASSWORD = None`. No auth, but localhost-only (port 4455 bound to 127.0.0.1).

### LOW — Traceback in Error Output

**Finding:** `traceback.format_exc()` in error output could leak file paths. Goes to trusted AI only (Mistral/Pi).

### LOW — Token in Plaintext Config

**Finding:** Latch token (64-char hex) stored in plaintext in `latch.json`. By design for local tool.

### SAFE — No Secrets in Bridge Scripts

- No API keys, tokens, or passwords in any bridge script
- Example config uses `"YOUR-TOKEN-HERE"` placeholder
- `subprocess.run` uses list args, no `shell=True` — no command injection
- All Python files pass `py_compile` syntax check

---

## Code Audit (2026-10-26)

| Metric | Value |
|--------|-------|
| Total lines (4 scripts) | 524 |
| Bare `except:` blocks | 0 (fixed — was 5 in resolve_bridge.py) |
| Hardcoded paths | 2 (Resolve install path, OBS port 4455) — acceptable for local tool |
| TODO/FIXME comments | 0 |
| Unused imports | 0 |
| Wrapper scripts | 2 (13 lines each, minimal) |

**Fix applied:** Changed 5 bare `except:` blocks to `except Exception:` in `resolve_bridge.py` (lines 161–182, in `cmd_get_timeline_info`). Bare `except:` catches `KeyboardInterrupt` and `SystemExit` which is incorrect.

---

## Test Results (2026-10-26)

| Test | Result |
|------|--------|
| Resolve bridge (direct) | PASS — returns `{"status": "disconnected"}` when Resolve not running |
| OBS bridge (direct) | PASS — returns connection refused when OBS not running |
| Latch run_task (local HTTP) | PASS — both bridges execute via `run_task` |
| Latch run_task (tunnel) | PASS — both bridges execute via Cloudflare tunnel |
| Mistral AI end-to-end | PASS — Mistral called `run_task` for both Resolve and OBS status, reported results correctly |
| Pi agent MCP connection | PASS — `pi mcp list` shows `latch: connected, 4 tools` |
| Pi agent run_task | PASS — Pi can execute Resolve/OBS commands via Latch |
| Python syntax check | PASS — all 4 scripts pass `py_compile` |
| RAM usage | 3.87 GB free / 15.68 GB total (75.3% used) — healthy |
