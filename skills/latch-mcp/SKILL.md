---
name: latch-mcp
description: Control the Latch MCP server (port 3939) — start, stop, status, configure. Latch provides 6 tools: list_files, read_file, search_files, write_file, run_task (DaVinci Resolve + OBS Studio bridges), control_desktop. Use when the user asks about Latch, file operations via MCP, Resolve/OBS control, or the latch server on port 3939.
user-invocable: true
metadata:
  display-name: Latch MCP
  short-description: Start/stop/configure Latch MCP server (port 3939, 6 tools)
---

# Latch MCP

Latch is a Rust-based local MCP server that exposes file operations and DaVinci Resolve / OBS Studio bridges to AI agents.

## Quick Reference

| Property | Value |
|----------|-------|
| **Port** | 3939 |
| **Binary** | `E:\tools\latch\latch.exe` (507 KB, PE32+ x86-64, Rust) |
| **Source** | `E:\tools\latch\src\*.rs` (839 lines, 5 files) |
| **Config** | `C:\Users\souro\.mcp-autostart\latch.json` |
| **MCP endpoint** | `POST http://localhost:3939/mcp/mistral` |
| **Health** | `POST http://localhost:3939/health` (GET returns error — POST only) |
| **Live PID** | 12756 |

## Tools (6)

| Tool | Description | Key Params |
|------|-------------|------------|
| `list_files` | List files in one allowed folder | `path` |
| `read_file` | Read one file | `path` (required) |
| `search_files` | Find a phrase in files | `query` (required), `path` |
| `write_file` | Create or replace one file | `path`, `text` (both required) |
| `run_task` | Run an allow-listed bridge command (Resolve/OBS) | `command` (required) |
| `control_desktop` | Desktop control actions | — |

## Start

```cmd
E:\tools\latch\Latch-AutoStart.cmd
```

This script is idempotent — it skips if Latch is already listening on 3939. It also:
1. Sets firewall rule (private mode by default; set `LATCH_PUBLIC=1` for external access)
2. Starts `latch.exe serve` if port 3939 is not listening
3. Starts a Cloudflare quick tunnel (if cloudflared is not already running)
4. Refreshes `E:\tools\latch\status.json` with live PIDs and tunnel URL

**Manual start (no tunnel):**
```cmd
E:\tools\latch\latch.exe serve
```

**Stdio mode (for Pi agent):**
```cmd
E:\tools\latch\latch.exe stdio
```

## Stop

```powershell
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3939 -ErrorAction SilentlyContinue | Stop-Process -Id $_.OwningProcess -Force"
```

Also stop the cloudflared tunnel if running:
```powershell
powershell.exe -NoProfile -Command "Get-Process cloudflared -ErrorAction SilentlyContinue | Stop-Process -Force"
```

## Status

```powershell
# Refresh status.json (live PIDs + tunnel URL)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File E:\tools\latch\Latch-Status.ps1

# Read status.json
Get-Content E:\tools\latch\status.json

# Quick port check
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3939 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess"

# Health check (POST required)
curl -s -X POST http://localhost:3939/health
```

## Configure

### Config file: `C:\Users\souro\.mcp-autostart\latch.json`

Key fields:
- `server_on` (bool) — master toggle
- `port` (number) — default 3939
- `token` (string) — auth token for the server
- `caps` (object) — capability toggles: `read`, `edit`, `scripts`, `desktop`
- `providers` (object) — per-provider caps: `grok`, `mistral`, `chatgpt`, `pi`
- `folders` (array) — allowed folder paths for file operations (E:\, D:\, G:\, H:\, C:\Users\souro\.vibe, Downloads)
- `commands` (array) — allow-listed bridge commands (Resolve + OBS Python scripts)
- `apps` (array) — allowed desktop apps
- `mistral_model` (string) — model name for Mistral provider

### Edit config
```powershell
notepad C:\Users\souro\.mcp-autostart\latch.json
```

After editing, restart Latch for changes to take effect.

### Firewall toggle
```cmd
:: Private mode (default — localhost only)
netsh advfirewall firewall set rule name="latch" new enable=no

:: Public mode (allows external network access)
set LATCH_PUBLIC=1
netsh advfirewall firewall set rule name="latch" new enable=yes
```

## Logs

| Log | Path |
|-----|------|
| Server log | `E:\tools\latch\latch-serve.log` |
| Tunnel log | `E:\tools\latch\cf-tunnel.log` |
| Status JSON | `E:\tools\latch\status.json` |

## Pi Agent Config

In `E:\ONE-STOP-SHOP\.pi\agent\mcp.json`:
```json
"latch": {
    "type": "stdio",
    "command": "E:\\tools\\latch\\latch.exe",
    "args": ["stdio"],
    "timeout": 30
}
```

In `~/.pi/agent/mcp.json` (tunnel-based):
```json
"latch": {
    "url": "https://<subdomain>.trycloudflare.com/mcp/pi"
}
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 3939 not listening | Run `E:\tools\latch\Latch-AutoStart.cmd` |
| GET /health returns `{"error":"POST only"}` | Use POST: `curl -X POST http://localhost:3939/health` |
| Tunnel URL stale/NXDOMAIN | Restart cloudflared, get new URL from `cf-tunnel.log`, update connectors |
| File ops rejected | Check `folders` array in `latch.json` — path must be in allowed list |
| `run_task` rejected | Check `commands` array in `latch.json` — command must match exactly |
| Provider caps blocking | Check `providers.<name>` in `latch.json` — e.g., `chatgpt` has all caps off |
| Firewall blocking | Set `LATCH_PUBLIC=1` or check firewall rule `netsh advfirewall firewall show rule name="latch"` |

## Gotchas

- **Health endpoint requires POST.** GET returns `{"error":"POST only"}`.
- **Config changes require restart.** Edit `latch.json`, then stop and start Latch.
- **Allowed folders are strict.** File operations outside the `folders` list are rejected.
- **Bridge commands are exact-match.** `run_task` only runs commands listed verbatim in the `commands` array.
- **Tunnel URL is ephemeral.** After cloudflared restart, the URL changes. Check `E:\tools\latch\cf-tunnel.log` for the new URL.
- **Never print the `token` value** from `latch.json`.
