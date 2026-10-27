---
name: mcp-control
description: Start, stop, check status, and configure all local MCP servers on this PC (Latch 3939, Gateway 3002, Connector 3000, Browser MCP 3001). Use when the user asks to start/stop/restart/status/configure any MCP server, check if MCPs are running, troubleshoot MCP connectivity, fix Cloudflare tunnels, or repair Mistral AI connectors.
user-invocable: true
metadata:
  display-name: MCP Control Center
  short-description: Start/stop/status/configure all 4 local MCP servers + tunnel/connector auto-recovery
---

# MCP Control Center

Manage all 4 local MCP servers on Sourov's PC from one place, plus Cloudflare tunnel and Mistral connector auto-recovery.

## Servers Overview

| # | Server | Port | Tools | Health Endpoint |
|---|--------|------|-------|-----------------|
| 1 | **Latch MCP** | 3939 | 6 (file ops + Resolve/OBS bridges + desktop) | `POST http://localhost:3939/mcp/mistral` (tools/list) |
| 2 | **Unified MCP Gateway** | 3002 | 39 (13 native + 26 proxied) | `GET http://localhost:3002/health` |
| 3 | **my-mcp-connector** | 3000 | 5 (system info, health, skills) | `GET http://localhost:3000/health` |
| 4 | **browser-control-mcp** | 3001 | 15 (Chrome CDP automation) | `GET http://localhost:3001/health` |

## One-Click Recovery (USE THIS WHEN CONNECTORS BREAK)

When Mistral AI connectors show "Needs attention" (dead tunnel URLs):

```cmd
C:\Users\souro\.mcp-autostart\fix-all.cmd
```

This runs:
1. `tunnel-manager.ps1 -Auto` — checks and restarts Cloudflare tunnels
2. `connector-autofix.py --fix` — deletes broken connectors, creates fresh ones with new URLs

After running, go to https://chat.mistral.ai/connections and click "Connect" on any new connectors.

## Auto-Recovery Tooling (2026-10-27)

| Script | Path | Purpose |
|--------|------|---------|
| **fix-all.cmd** | `C:\Users\souro\.mcp-autostart\fix-all.cmd` | One-click: fixes tunnels + connectors |
| **tunnel-manager.ps1** | `C:\Users\souro\.mcp-autostart\tunnel-manager.ps1` | Check/restart/auto-recover Cloudflare tunnels |
| **connector-autofix.py** | `C:\Users\souro\.mcp-autostart\connector-autofix.py` | Delete broken Mistral connectors, create fresh ones |
| **watchdog.cmd** | `C:\Users\souro\.mcp-autostart\watchdog.cmd` | Loop: checks tunnels every 5 min, auto-restarts |
| **watchdog-launcher.vbs** | Startup folder | Launches watchdog at login (hidden) |

### Tunnel Manager Commands
```powershell
# Check status only
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\tunnel-manager.ps1 -Check

# Auto-recover (check + restart if needed)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\tunnel-manager.ps1 -Auto

# Force restart all tunnels
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\tunnel-manager.ps1 -Restart
```

### Connector Autofix Commands
```bash
# Check what's broken (no changes)
C:\tmp\mistral-sdk-venv\Scripts\python.exe C:\Users\souro\.mcp-autostart\connector-autofix.py --check

# Fix: delete broken, create fresh
C:\tmp\mistral-sdk-venv\Scripts\python.exe C:\Users\souro\.mcp-autostart\connector-autofix.py --fix
```

## Quick Commands

### Check ALL statuses at once
```powershell
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,3001,3002,3939 -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue; \"Port $($_.LocalPort) -> PID $($_.OwningProcess) ($($p.ProcessName))\" }"
```

### Health check all 4 (curl)
```bash
curl -s http://localhost:3000/health && echo ""
curl -s http://localhost:3001/health && echo ""
curl -s http://localhost:3002/health && echo ""
curl -s -X POST http://localhost:3939/mcp/mistral -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' -o /dev/null -w "Latch MCP: %{http_code}\n"
```

### Start ALL servers (idempotent — skips what's already up)
```powershell
# Connector (3000) + Browser MCP (3001)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1

# Latch (3939)
E:\tools\latch\Latch-AutoStart.cmd

# Gateway (3002)
E:\tools\unified-mcp-gateway\start.cmd
```

### Stop ALL servers
```powershell
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000,3001,3002,3939 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue; Write-Host \"Killed PID $($_.OwningProcess) on port $($_.LocalPort)\" }"
```

### Restart ALL servers
Stop all, wait 2 seconds, then start all (see above).

## Individual Server Control

### Latch MCP (port 3939)
- **Start:** `E:\tools\latch\Latch-AutoStart.cmd` (also starts cloudflared tunnel)
- **Stop:** Kill process on port 3939: `Get-NetTCPConnection -LocalPort 3939 | Stop-Process -Id $_.OwningProcess -Force`
- **Status:** `E:\tools\latch\latch.exe status` (shows config, public URL, per-cloud caps)
- **Panel URL:** `E:\tools\latch\latch.exe panel` (prints `http://127.0.0.1:3939/panel?token=...`)
- **Panel:** `GET http://127.0.0.1:3939/panel?token=<token>` (HTML settings UI, 200 with valid token, 404 without)
- **Config:** `C:\Users\souro\.mcp-autostart\latch.json` (folders, commands, provider caps)
- **MCP endpoint:** `POST http://127.0.0.1:3939/mcp/mistral`
- **Tools:** `list_files`, `read_file`, `search_files`, `write_file`, `run_task`, `control_desktop`
- **Binary:** `E:\tools\latch\latch.exe` (507 KB, Rust, rebuilt 2026-10-27 from src-0.2.0 with panel)
- **Source:** `E:\tools\latch\src\*.rs` (7 files, 2918 lines total, includes panel.rs + desktop.rs)
- **Backup:** `E:\tools\latch\src-backup-20261027-101546/` (old simplified version without panel)
- **Logs:** `E:\tools\latch\latch-serve.log`, `E:\tools\latch\cf-tunnel.log`

### Unified MCP Gateway (port 3002)
- **Start:** `E:\tools\unified-mcp-gateway\start.cmd` (runs `node server.js`)
- **Stop:** Kill node process on port 3002
- **Status:** `GET http://localhost:3002/health` (shows upstream server health too)
- **Config:** `E:\tools\unified-mcp-gateway\.env` (GATEWAY_AUTH_TOKEN, GATEWAY_AUTH_ENABLED)
- **Auth:** Bearer token from HKCU env var `GATEWAY_AUTH_TOKEN` (64-char hex, never print)
- **MCP endpoint:** `POST http://localhost:3002/mcp`
- **Tools (39 total):**
  - **Proxied from Latch (6):** `list_files`, `read_file`, `search_files`, `write_file`, `run_task`, `control_desktop`
  - **Proxied from Connector (5):** `health_check`, `system_info`, `one_stop_shop_status`, `credential_env_present`, `vibe_skill_list`
  - **Proxied from Browser (15):** `browser_list_tabs`, `browser_new_tab`, `browser_switch_tab`, `browser_close_tab`, `browser_navigate`, `browser_get_page_info`, `browser_screenshot`, `browser_execute_js`, `browser_click`, `browser_type`, `browser_get_dom`, `browser_scroll`, `browser_wait_for_element`, `browser_get_element_text`, `browser_handle_dialog`
  - **Native (13):** `run_command`, `manage_process`, `screenshot`, `clipboard`, `manage_file`, `manage_service`, `network_info`, `install_package`, `notify`, `window_management`, `registry_read`, `get_env`, `system_info_extended`
- **Source:** `E:\tools\unified-mcp-gateway\server.js` (1296 lines)
- **Logs:** `E:\tools\unified-mcp-gateway\gateway.log`

### my-mcp-connector (port 3000)
- **Start:** `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1`
- **Stop:** Kill node process on port 3000
- **Status:** `GET http://localhost:3000/health`
- **MCP endpoint:** `POST http://localhost:3000/mcp`
- **Tools (5):** `health_check`, `system_info`, `one_stop_shop_status`, `credential_env_present`, `vibe_skill_list`
- **Source:** `C:\Users\souro\.vibe\plugins\my-mcp-connector\server\http-server.js`
- **Logs:** `C:\Users\souro\.mcp-autostart\logs\mcp-3000.out.log`, `mcp-3000.err.log`

### browser-control-mcp (port 3001)
- **Start:** `powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1`
- **Stop:** Kill node process on port 3001
- **Status:** `GET http://localhost:3001/health` (shows `chromeConnected: true/false`)
- **MCP endpoint:** `POST http://localhost:3001/mcp`
- **Tools (15):** `browser_list_tabs`, `browser_new_tab`, `browser_switch_tab`, `browser_close_tab`, `browser_navigate`, `browser_get_page_info`, `browser_screenshot`, `browser_execute_js`, `browser_click`, `browser_type`, `browser_get_dom`, `browser_scroll`, `browser_wait_for_element`, `browser_get_element_text`, `browser_handle_dialog`
- **Source:** `C:\Users\souro\.vibe\plugins\browser-control-mcp\server\http-server.js`
- **Requires:** Chrome running with CDP (browser-harness). If Chrome is not running, launch detached via PowerShell `Start-Process`.
- **Logs:** `C:\Users\souro\.mcp-autostart\logs\mcp-3001.out.log`, `mcp-3001.err.log`

## Resilience Scripts

Located at `E:\tools\resilience\`:

| Script | Purpose |
|--------|---------|
| `health-monitor.ps1` | 30s health checks on all 4 services + optional tunnel. Writes `status.json`. |
| `watchdog.ps1` | Auto-restarts down services (max 5/hour). Use `-DryRun` to preview. |
| `tunnel-failover.ps1` | Backup tunnel on primary failure. Requires `-PrimaryUrl` param. |
| `start-all.ps1` | Launches all monitors. Accepts `-TunnelUrl`, `-DryRun`, `-HealthOnly`, `-NoFailover`. |

## Autostart

- **MCP autostart dir:** `C:\Users\souro\.mcp-autostart\`
- **Watchdog config:** `C:\Users\souro\.mcp-autostart\mcp-watchdog.config.json`
- **Watchdog script:** `C:\Users\souro\.mcp-autostart\mcp-watchdog.ps1`
- **Latch config:** `C:\Users\souro\.mcp-autostart\latch.json`
- **Tunnel watchdog:** `watchdog-launcher.vbs` in Startup folder (runs `watchdog.cmd` at login)
- **Tunnel status:** `C:\Users\souro\.mcp-autostart\tunnel-status.json` (written by tunnel-manager.ps1)

## Pi Agent MCP Config

- **Pi config:** `E:\ONE-STOP-SHOP\.pi\agent\mcp.json` (has `unified-gateway`, `latch`, `vibe-bridge`, `resolve`, `browser-harness`, `jev-skill-router`, `skyvern`, `wordpress-easy-mcp`, `hostinger-*`)
- **Alt Pi config:** `~/.pi/agent/mcp.json` (has `unified-gateway` via tunnel, `latch` via tunnel)

## Cloudflare Tunnels

- **Binary:** `C:\tmp\cloudflared.exe` (v2026.10.3)
- **Tunnel URLs doc:** `C:\Users\souro\.vibe\docs\TUNNEL-URLS-latest.md` (auto-generated by tunnel-manager.ps1)
- **Tunnel logs:** `C:\tmp\tunnel-{3000,3001,3002,3939}.log`
- **Tunnel manager:** `C:\Users\souro\.mcp-autostart\tunnel-manager.ps1`
- **Gotcha:** Tunnel URLs are ephemeral. After a cloudflared restart, new URLs must be re-pointed in Mistral connectors.
- **Gotcha:** Multiple cloudflared processes may be running. Check with `Get-Process cloudflared`.
- **Gotcha:** Use `--logfile` flag, NOT PowerShell `RedirectStandardError`. cloudflared writes logs to stderr and dies (exit 127) when PowerShell redirects it.
- **Gotcha:** Cloudflare rate-limits quick tunnel creation (HTTP 429). If you get 429, wait 15-30 minutes before retrying. The watchdog handles this automatically.
- **Gotcha:** Start tunnels with 15-second delays between each to avoid triggering the rate limit.

## Mistral AI Connectors

- **Connector autofix:** `C:\Users\souro\.mcp-autostart\connector-autofix.py`
- **Mistral SDK venv:** `C:\tmp\mistral-sdk-venv\Scripts\python.exe`
- **SDK import:** `from mistralai.client import Mistral` (v3.x)
- **API key:** HKCU `MISTRAL_API_KEY` (len=45)
- **Connectors page:** https://chat.mistral.ai/connections
- **Gotcha:** After creating connectors via API, click "Connect" in the UI for tool detection.
- **Gotcha:** Delete old connectors before creating new ones to avoid duplicates.
- **Gotcha:** Gateway connector needs Bearer auth header (token from HKCU `GATEWAY_AUTH_TOKEN`).

## Troubleshooting

| Symptom | Diagnosis | Fix |
|---------|-----------|-----|
| Port not listening | Process crashed or not started | Run the start command for that server |
| Gateway returns 401 | Missing or wrong Bearer token | Check `GATEWAY_AUTH_TOKEN` env var (HKCU) |
| Browser MCP `chromeConnected: false` | Chrome not running or CDP not available | Launch Chrome detached via PowerShell `Start-Process` |
| Latch panel returns 404 | Old binary without panel, or missing token | Rebuild from src-0.2.0; use `?token=<token>` in URL |
| Tunnel URL NXDOMAIN or 530 | Stale ephemeral URL / dead cloudflared | Run `tunnel-manager.ps1 -Auto` or `fix-all.cmd` |
| Cloudflare 429 rate limit | Too many quick tunnel requests | Wait 15-30 min; watchdog auto-retries |
| Mistral connectors "Needs attention" | Dead tunnel URLs in connectors | Run `fix-all.cmd` or `connector-autofix.py --fix` |
| Gateway upstream shows "error" | Upstream server (latch/connector/browser) is down | Start the upstream server first, then restart gateway |

## Gotchas

- **Never print the gateway auth token.** It is a 64-char hex in HKCU `GATEWAY_AUTH_TOKEN` and `E:\tools\unified-mcp-gateway\.env`.
- **Latch panel requires token.** `GET /panel` without `?token=` returns 404. Get token via `latch.exe panel`.
- **Latch binary rebuilt 2026-10-27** from `src-0.2.0/` (adds panel.rs, desktop.rs, GET/POST /panel routes). Old binary backed up at `src-backup-20261027-101546/`.
- **Gateway `manage_process` stop requires `pid` or `name`, NOT `port`.**
- **Gateway `run_command` has an allow-list.** `start` is allowed (prefix match), `cmd /c` is NOT.
- **Cloudflare tunnel URLs are ephemeral.** Do not hardcode them. Use `TUNNEL-URLS-latest.md`.
- **Cloudflare rate-limits quick tunnels (429).** Wait 15-30 min between restart attempts. Start tunnels with 15s delays.
- **cloudflared + PowerShell `RedirectStandardError` = process dies (exit 127).** Use `--logfile` flag instead.
- **Kill port processes via PowerShell**, not Git Bash `kill` (PID namespace mismatch).
- **Start servers via `tools.process.start()` or PowerShell `Start-Process`**, not Git Bash `nohup &`.
- **Mistral SDK v3 import:** `from mistralai.client import Mistral` (NOT `from mistralai import Mistral`).
- **Mistral connectors API:** `client.beta.connectors.list()` returns `PaginatedConnectors` with `.items` array.
- **Scheduled Task creation needs elevation.** Use the Startup folder VBS launcher instead.
