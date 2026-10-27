# ONE-STOP-SHOP Architecture Plan — Full Pipeline Integration

**Date:** 2026-10-27
**Status:** Implemented and audited

## Goal

Build the entire podcast → Resolve → OBS → WordPress → writing workflow, controllable from the Vibe work platform to the PC via Latch MCP. Any local agent (Pi) can use it too. One-click cloudless solution for both Vibe and Pi.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        CLOUD (Mistral AI)                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐ │
│  │  podcast-   │  │  wordpress- │  │  content-   │  │  academic-  │ │
│  │  producer   │  │  maintainer │  │  scheduler  │  │  paper-     │ │
│  │             │  │             │  │             │  │  pipeline   │ │
│  │ enriched:   │  │ enriched:   │  │ enriched:   │  │ enriched:   │ │
│  │ check_local │  │ check_local │  │ check_local │  │ check_local │ │
│  │ _tools      │  │ _tools      │  │ _tools      │  │ _tools      │ │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘ │
│         │                │                │                │         │
│  ┌─────────────┐  ┌──────────────────────────────────────────────┐   │
│  │  mishu-critical-thinking-decision-audit (2 workflows)      │   │
│  │  enriched: check_local_tools                                │   │
│  └──────┬──────────────────────────────────────────────────────┘   │
│         │                                                          │
│         └──────────────────┬───────────────────────────────────────┘
│                            │ shared/latch.py (20 activities)       │
│                            ▼                                        │
│              ┌─────────────────────────┐                           │
│              │  Mistral Cloud          │                           │
│              │  (Temporal worker)      │                           │
│              └─────────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────┘
                             │
                             │ Cloudflare Tunnel (HTTPS)
                             ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        LOCAL PC (Sourov's PC)                        │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Latch MCP Server (port 3939, 0.0.0.0)                       │    │
│  │  Tools: list_files, read_file, search_files, run_task (15 cmds)│   │
│  │  Providers: mistral, pi (read + scripts)                     │    │
│  │  Panel: http://127.0.0.1:3939/panel (token-protected)        │    │
│  └─────────────────────────┬───────────────────────────────────┘    │
│                            │                                         │
│              ┌─────────────┼─────────────┐                          │
│              ▼             ▼             ▼                          │
│  ┌───────────────┐ ┌───────────────┐ ┌─────────────────────────┐   │
│  │ resolve_cmd.py│ │  obs_cmd.py   │ │  File share             │   │
│  │ (7 commands)  │ │  (9 commands) │ │  E:\tools\latch-share\  │   │
│  │               │ │               │ │  (read-only)            │   │
│  │ resolve_      │ │ obs_bridge.py │ │                         │   │
│  │ bridge.py     │ │ (WebSocket)   │ │                         │   │
│  │ (Resolve API) │ │               │ │                         │   │
│  └───────┬───────┘ └───────┬───────┘ └─────────────────────────┘   │
│          │                 │                                        │
│          ▼                 ▼                                        │
│  ┌───────────────┐ ┌───────────────┐                               │
│  │ DaVinci       │ │ OBS Studio    │                               │
│  │ Resolve       │ │ (WebSocket    │                               │
│  │ (Scripting    │ │  port 4455)   │                               │
│  │  API)         │ │               │                               │
│  └───────────────┘ └───────────────┘                               │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Pi Agent (local)                                            │    │
│  │  User-level: HTTP tunnel → /mcp/pi                           │    │
│  │  Project-level: stdio → latch.exe stdio (in ONE-STOP-SHOP)   │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Chrome Extension v2.0.0 (Double Control)                    │    │
│  │  Popup: tabs + MCP 3000/3001 health + Latch 3939 health/tools │    │
│  │  Background: tab tracking + external messaging               │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  One-Click Launcher: start-all.cmd                           │    │
│  │  1. Latch-AutoStart.cmd (latch + tunnel, idempotent)         │    │
│  │  2. Verify Latch MCP connectivity                            │    │
│  │  3. Read tunnel URL from status.json                         │    │
│  │  4. Start workflows worker (if not running)                  │    │
│  │  Desktop shortcut: "ONE-STOP-SHOP Launcher.lnk"              │    │
│  └─────────────────────────────────────────────────────────────┘    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Latch MCP Server (E:\tools\latch\latch.exe)
- Version: 0.2.0
- Port: 3939 (bound to 0.0.0.0)
- Config: C:\Users\souro\.mcp-autostart\latch.json
- Token: 64-char hex (stored in config, used for /panel only)
- Caps: read=true, edit=false, scripts=true, desktop=false
- Allow-list: 15 commands (7 Resolve + 8 OBS, all read-only)
- Shared folder: E:\tools\latch-share\ (read-only file access)

### 2. Cloudflare Tunnel
- Binary: E:\tools\latch\cloudflared.exe (v2026.10.3)
- Type: Quick tunnel (ephemeral URL)
- Current URL: https://jason-salvador-known-stood.trycloudflare.com
- Target: http://localhost:3939
- Status: saved to E:\tools\latch\status.json

### 3. Bridge Scripts (E:\tools\latch-bridges\)
- resolve_bridge.py (253 lines): 7 commands — status, list_projects, get_current, list_timelines, get_timeline_info, list_media_pool, get_resolve_version
- obs_bridge.py (245 lines): 9 commands — status, get_version, list_scenes, get_current_scene, switch_scene, list_sources, get_stream_status, get_record_status, list_profiles
- resolve_cmd.py (13 lines): wrapper using Resolve's bundled Python
- obs_cmd.py (13 lines): wrapper using latch-bridges venv Python

### 4. Mistral Workflows (E:\ONE-STOP-SHOP\mistral-workflows\)
- 5 workflow directories, all enriched with check_local_tools
- shared/latch.py (327 lines): 20 activities for Latch MCP calls
- start_worker.py (56 lines): loads all 6 workflow classes, starts worker
- start-all.cmd: one-click launcher
- Tests: 4 pure-function tests, all PASS

### 5. Chrome Extension v2.0.0 (C:\h\chrome-communication-extension\)
- Manifest v3, version 2.0.0
- Popup: tab list + MCP 3000/3001 health + Latch 3939 health/tools
- Background: tab tracking + external messaging (externally_connectable)
- Content script: page info + execute_js (uses window.eval — security finding)

### 6. Pi Agent Configs
- User-level (~/.pi/agent/mcp.json): HTTP tunnel → /mcp/pi
- Project-level (E:\ONE-STOP-SHOP\.pi\agent\mcp.json): stdio → latch.exe stdio + 8 other MCP servers

### 7. Autostart
- VBS in Startup folder → Latch-AutoStart.cmd (idempotent)
- Starts: latch serve + cloudflared tunnel + status.json refresh

## Security Posture (audited 2026-10-27)

| Severity | Count | Key Findings |
|----------|-------|-------------|
| CRITICAL | 2 | Unauthenticated MCP endpoints (public via tunnel); window.eval() in content.js |
| HIGH | 2 | Latch on 0.0.0.0 with firewall allow; OBS WebSocket no password |
| MEDIUM | 3 | Plaintext token; no .gitignore; window.DoubleControl exposed |
| LOW | 2 | Operational logs in latch-share; innerHTML pattern |
| INFO | 2 | davinci-resolve-mcp v4.13.7 installed; tunnel URL ephemeral |

## Code Quality (audited 2026-10-27)

- Health score: 82/100 (Good)
- 2,261 LOC across 14 files
- 0 syntax errors, 0 TODO/FIXME, 0 bare except
- 4 tests, all PASS
- Main gap: ~150 lines of duplicated local-tools check across 5 workflows

## Verified Facts (2026-10-27)

1. Latch MCP responds on localhost:3939 and via tunnel — tools/list returns 15 commands
2. run_task executes allow-listed commands without authentication (verified via curl)
3. All 5 workflows pass py_compile and import successfully
4. All 6 workflow classes register with the Mistral workflows SDK
5. Bridge scripts pass py_compile
6. 4 pure-function tests pass
7. RAM: 5.69 GB free / 15.68 GB total (63.7% used)
8. Latch PID: 11524, cloudflared PID: 8516
9. Chrome extension manifest v2.0.0 is valid JSON
10. Desktop shortcut created for one-click launcher

## Open Items

1. Security patches (bind to 127.0.0.1, remove eval, add .gitignore) — not yet applied
2. GitHub push — not yet done
3. Named Cloudflare tunnel vs quick tunnel — user decision pending
4. Automated connector URL update on tunnel restart — not implemented
