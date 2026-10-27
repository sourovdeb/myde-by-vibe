# Latch Bridges — Resolve & OBS Control via Latch MCP

Bridge scripts that let Latch MCP (and any connected agent: Mistral, Pi, Vibe) read DaVinci Resolve and OBS Studio status. Read-only posture: the allow-list excludes `switch_scene` and `start_stream`.

**Created:** 2026-10-26 | **Updated:** 2026-10-27

---

## Files

| File | Size | Purpose |
|---|---|---|
| `resolve_bridge.py` | 7,487 B | Resolve scripting bridge — 7 commands via Resolve's bundled Python |
| `obs_bridge.py` | 7,381 B | OBS WebSocket bridge — 9 commands (8 allow-listed) |
| `resolve_cmd.py` | 533 B | Wrapper: runs resolve_bridge.py with Resolve's Python |
| `obs_cmd.py` | 528 B | Wrapper: runs obs_bridge.py with the venv Python |
| `venv/` | — | Scoped Python venv with `websocket-client` for OBS bridge |

## Resolve commands (7, all allow-listed)

| Command | Description |
|---|---|
| `status` | Check if Resolve is running and scripting is available |
| `list_projects` | List all projects in the project manager |
| `get_current` | Get info about the currently open project |
| `list_timelines` | List all timelines in the current project |
| `get_timeline_info` | Get detailed info about a timeline (name, duration, tracks) |
| `list_media_pool` | List top-level items in the Media Pool |
| `get_resolve_version` | Get Resolve version info |

Run with Resolve's bundled Python:
```
"C:\Program Files\Blackmagic Design\DaVinci Resolve\ResolvePython\ResolvePython.exe" resolve_bridge.py <command>
```
Or via the wrapper (uses system Python 3.12):
```
C:\Users\souro\.local\bin\python3.12.exe resolve_cmd.py <command>
```

## OBS commands (9 defined, 8 allow-listed)

| Command | Allow-listed | Description |
|---|---|---|
| `status` | Yes | Check OBS WebSocket connection status |
| `get_version` | Yes | Get OBS version info |
| `list_scenes` | Yes | List all scenes |
| `get_current_scene` | Yes | Get the currently active scene |
| `switch_scene <name>` | **NO** | Switch to a scene by name — defined but NOT in allow-list |
| `list_sources` | Yes | List all sources |
| `get_stream_status` | Yes | Get streaming status |
| `get_record_status` | Yes | Get recording status |
| `list_profiles` | Yes | List streaming/recording profiles |

Run with the venv Python:
```
E:\tools\latch-bridges\venv\Scripts\python.exe obs_bridge.py <command>
```
Or via the wrapper:
```
C:\Users\souro\.local\bin\python3.12.exe obs_cmd.py <command>
```

**OBS prerequisites:** Tools → WebSocket Server Settings → Enable WebSocket server. Default port 4455.

## Latch allow-list

The 15 allow-listed commands are in `C:\Users\souro\.mcp-autostart\latch.json` under `commands`. Latch `run_task` uses **exact match** — the command string must match exactly, including the Python path and arguments.

## Output format

All bridges output JSON to stdout. Errors return JSON with an `"error"` key and exit code 1.

## Security notes

- **Read-only posture:** `switch_scene` and `start_stream` are NOT in the allow-list. The bridges define them but Latch will refuse to execute them.
- **OBS auth:** `OBS_PASSWORD` is currently `None` in `obs_bridge.py`. Enable WebSocket authentication in OBS and set the password via environment variable `OBS_PASSWORD`.
- **Latch MCP auth:** The Latch MCP endpoints (`/mcp/mistral`, `/mcp/pi`) have zero authentication — see `E:\ONE-STOP-SHOP\SECURITY-AUDIT-2026-10-27.md` (CRITICAL finding #1). Anyone with the tunnel URL can call these bridges.
- **Token:** The Latch token (64 chars) is in `~\.mcp-autostart\latch.json`. Never print it.

## Integration

- **Mistral workflows:** `E:\ONE-STOP-SHOP\mistral-workflows\shared\latch.py` wraps these bridges as 20 MCP activities with graceful degradation.
- **Pi agent:** User-level `~\.pi\agent\mcp.json` points at the HTTP tunnel; project-level `E:\ONE-STOP-SHOP\.pi\agent\mcp.json` uses stdio.
- **Chrome extension:** v2.0.0 popup shows Latch MCP health + tool list.
- **Skill:** `E:\apps\agent-skills\latch-resolve-obs-bridges\SKILL.md` documents the 15 allow-listed commands for agents.

## Testing

```bash
# Resolve (requires Resolve running):
C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py status

# OBS (requires OBS running with WebSocket enabled):
C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py status

# Via Latch MCP (local):
curl -s -X POST http://127.0.0.1:3939/mcp/mistral \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"run_task","arguments":{"command":"C:\\Users\\souro\\.local\\bin\\python3.12.exe E:\\tools\\latch-bridges\\obs_cmd.py status"}}}'
```
