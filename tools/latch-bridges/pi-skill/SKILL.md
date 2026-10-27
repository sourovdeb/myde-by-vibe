---
name: latch-resolve-obs-bridges
description: "Control DaVinci Resolve and OBS Studio via the Latch MCP server. Use the mcp__latch__run_task tool to run bridge commands for Resolve (project/timeline/media pool queries) and OBS (scene/source/stream/record queries). Use for: Resolve status, project listing, timeline info, media pool, OBS scenes, sources, streaming/recording status, DaVinci Resolve control, OBS Studio control, video editing automation, streaming automation"
metadata:
  version: "1.0.0"
  mcp_server: "latch"
  mcp_endpoint: "https://jason-salvador-known-stood.trycloudflare.com/mcp/pi"
  bridge_dir: "E:\\tools\\latch-bridges"
---

# Latch Resolve & OBS Bridges

Control DaVinci Resolve and OBS Studio through the Latch MCP server using the `mcp__latch__run_task` tool.

## Prerequisites

### DaVinci Resolve
- Resolve Studio must be running (external scripting requires Studio license)
- External scripting enabled: Preferences > System > General > External scripting using: Local

### OBS Studio
- OBS must be running
- WebSocket server enabled: Tools > WebSocket Server Settings > Enable WebSocket server (port 4455)

## Available Commands

All commands use the `mcp__latch__run_task` tool with a `command` parameter. The command must be an **exact match** from the allow-list.

### Resolve Commands (7)

| Command | Description |
|---------|-------------|
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py status` | Check if Resolve is running |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py list_projects` | List all projects |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py get_current` | Get current project info |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py list_timelines` | List all timelines |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py get_timeline_info` | Get timeline details |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py list_media_pool` | List Media Pool items |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py get_resolve_version` | Get Resolve version |

### OBS Commands (8)

| Command | Description |
|---------|-------------|
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py status` | Check OBS WebSocket connection |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py get_version` | Get OBS version info |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py list_scenes` | List all scenes |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py get_current_scene` | Get active scene |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py list_sources` | List all sources |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py get_stream_status` | Get streaming status |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py get_record_status` | Get recording status |
| `C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py list_profiles` | List streaming/recording profiles |

## Usage Examples

### Check Resolve status
```
Use mcp__latch__run_task with command:
C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\resolve_cmd.py status
```

### List OBS scenes
```
Use mcp__latch__run_task with command:
C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py list_scenes
```

### Check streaming status
```
Use mcp__latch__run_task with command:
C:\Users\souro\.local\bin\python3.12.exe E:\tools\latch-bridges\obs_cmd.py get_stream_status
```

## Output Format

All commands return JSON. Example outputs:

**Resolve connected:**
```json
{"status": "connected", "version": "21.1.0.17", "product": "DaVinci Resolve", "scripting": "enabled"}
```

**Resolve disconnected:**
```json
{"status": "disconnected", "message": "Resolve is not running or external scripting is disabled"}
```

**OBS connected:**
```json
{"status": "connected", "obs_version": "5.0.0", "obs_studio_version": "31.0.0", "platform": "windows"}
```

**OBS disconnected:**
```json
{"error": "Cannot connect to OBS WebSocket at ws://localhost:4455. Is OBS running with WebSocket enabled?"}
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Resolve is not running" | Start DaVinci Resolve Studio. Enable external scripting in Preferences. |
| "Cannot connect to OBS WebSocket" | Start OBS. Enable WebSocket: Tools > WebSocket Server Settings. Default port 4455. |
| "command is not on the allow list" | Copy the command exactly from the table above — Latch uses exact match. |
| Tool not available | Check that the `latch` MCP server is connected: run `/mcp` in Pi. |

## Architecture

```
Pi Agent → mcp__latch__run_task → Latch MCP (port 3939 via Cloudflare tunnel)
                                    → Bridge Scripts (E:\tools\latch-bridges\)
                                        ├── resolve_cmd.py → ResolvePython.exe → DaVinci Resolve API
                                        └── obs_cmd.py → venv python → OBS WebSocket (port 4455)
```

## Notes

- Commands are **read-only** — they query status and list resources, they don't modify projects or scenes
- `switch_scene` is NOT available (requires dynamic scene name argument, not supported by Latch's exact-match allow-list)
- Bridge scripts are at `E:\tools\latch-bridges\`
- Latch config is at `C:\Users\souro\.mcp-autostart\latch.json`
- Full documentation: `tools/latch-bridges/README.md` in the myde-by-vibe repo
