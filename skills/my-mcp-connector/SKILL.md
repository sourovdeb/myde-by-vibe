---
name: my-mcp-connector
description: Control the my-mcp-connector MCP server (port 3000) — start, stop, status, configure. Provides 5 system tools: health_check, system_info, one_stop_shop_status, credential_env_present, vibe_skill_list. Use when the user asks about the connector, system info tools, or the MCP server on port 3000.
user-invocable: true
metadata:
  display-name: my-mcp-connector
  short-description: Start/stop/configure Connector (port 3000, 5 system tools)
---

# my-mcp-connector

A lightweight Node.js MCP server that exposes 5 system information and status tools. Used by Mistral AI cloud connectors and the Unified MCP Gateway.

## Quick Reference

| Property | Value |
|----------|-------|
| **Port** | 3000 |
| **Source** | `C:\Users\souro\.vibe\plugins\my-mcp-connector\server\http-server.js` |
| **Start script** | `C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1` |
| **MCP endpoint** | `POST http://localhost:3000/mcp` |
| **Health** | `GET http://localhost:3000/health` |
| **Auth** | None (localhost only) |
| **Live PID** | 5812 (node) |

## Tools (5)

| Tool | Description | Params |
|------|-------------|--------|
| `health_check` | Check server health and status | — |
| `system_info` | Get detailed system information and resources | — |
| `one_stop_shop_status` | Check ONE-STOP-SHOP pipeline folders and status | — |
| `credential_env_present` | List environment variables and check for credentials (names + lengths only, never values) | — |
| `vibe_skill_list` | List installed Vibe skills | — |

## Start

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1
```

This script is idempotent — it starts both Connector (3000) and Browser MCP (3001), skipping any that are already listening.

**Manual start:**
```cmd
cd "C:\Users\souro\.vibe\plugins\my-mcp-connector\server" && node http-server.js
```

## Stop

```powershell
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Stop-Process -Id $_.OwningProcess -Force"
```

## Status

```bash
# Health
curl -s http://localhost:3000/health
# Returns: {"status":"ok","service":"my-mcp-connector","version":"1.0.0","timestamp":"..."}

# Port check
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess"

# List tools
curl -s -X POST http://localhost:3000/mcp -H "Content-Type: application/json" -H "Accept: application/json, text/event-stream" -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configure

The connector has no config file — it reads from the system directly. Key behaviors:

- **`credential_env_present`** — lists env var names and value lengths only. Never exposes values.
- **`one_stop_shop_status`** — reads `E:\ONE-STOP-SHOP\` pipeline folders.
- **`vibe_skill_list`** — reads `~/.vibe/skills/skills/` directory.

### MCP client config (Pi agent)

The connector is accessed via the Unified MCP Gateway (port 3002), not directly. But it can also be used standalone:

```json
"my-mcp-connector": {
    "type": "streamable-http",
    "url": "http://localhost:3000/mcp",
    "timeout": 30
}
```

## Logs

| Log | Path |
|-----|------|
| Stdout | `C:\Users\souro\.mcp-autostart\logs\mcp-3000.out.log` |
| Stderr | `C:\Users\souro\.mcp-autostart\logs\mcp-3000.err.log` |
| PID file | `C:\Users\souro\.mcp-autostart\pids\mcp-3000.pid` |

## Cloudflare Tunnel

The connector is exposed via Cloudflare Tunnel for Mistral AI cloud access:
```cmd
C:\tmp\cloudflared.exe tunnel --url http://localhost:3000
```

Tunnel URL is ephemeral — check `~/.vibe/docs/TUNNEL-URLS-*.md` for the current URL.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 3000 not listening | Run `start-mcp-servers.ps1` |
| Health returns error | Check `mcp-3000.err.log` for Node.js errors |
| `credential_env_present` shows missing vars | Check HKCU environment variables. Already-running processes do NOT inherit new env vars — restart them. |
| `vibe_skill_list` empty | Check `~/.vibe/skills/skills/` directory exists and has SKILL.md files |
| Tunnel URL NXDOMAIN | Restart cloudflared, get new URL, update Mistral connectors |

## Gotchas

- **No auth** — the connector has no authentication. It should only be exposed via localhost or a Cloudflare Tunnel (not directly to the network).
- **Env vars are read at process start.** New env vars set in HKCU require a process restart to be visible.
- **Kill via PowerShell**, not Git Bash `kill` (PID namespace mismatch).
- **Start via `start-mcp-servers.ps1`** which handles both 3000 and 3001 idempotently.
