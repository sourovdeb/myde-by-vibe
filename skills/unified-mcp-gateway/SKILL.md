---
name: unified-mcp-gateway
description: Control the Unified MCP Gateway (port 3002) — start, stop, status, configure. Gateway aggregates 39 tools: 13 native PC control tools + 26 proxied from Latch (6), Connector (5), and Browser MCP (15). Bearer token auth required. Use when the user asks about the gateway, PC control tools, or the unified MCP endpoint on port 3002.
user-invocable: true
metadata:
  display-name: Unified MCP Gateway
  short-description: Start/stop/configure Gateway (port 3002, 39 tools, Bearer auth)
---

# Unified MCP Gateway

The Gateway is a Node.js MCP server that aggregates all local MCP servers into one endpoint with 39 tools. It proxies requests to Latch (3939), my-mcp-connector (3000), and browser-control-mcp (3001), plus provides 13 native PC control tools.

## Quick Reference

| Property | Value |
|----------|-------|
| **Port** | 3002 |
| **Source** | `E:\tools\unified-mcp-gateway\server.js` (1296 lines) |
| **Config** | `E:\tools\unified-mcp-gateway\.env` |
| **Start script** | `E:\tools\unified-mcp-gateway\start.cmd` |
| **MCP endpoint** | `POST http://localhost:3002/mcp` |
| **Health** | `GET http://localhost:3002/health` |
| **Auth** | Bearer token (HKCU env var `GATEWAY_AUTH_TOKEN`, 64-char hex) |
| **Live PID** | 8268 (node) |
| **Node version** | v24.18.0 |

## Tools (39 total)

### Proxied from Latch (6)
`list_files`, `read_file`, `search_files`, `write_file`, `run_task`, `control_desktop`

### Proxied from my-mcp-connector (5)
`health_check`, `system_info`, `one_stop_shop_status`, `credential_env_present`, `vibe_skill_list`

### Proxied from browser-control-mcp (15)
`browser_list_tabs`, `browser_new_tab`, `browser_switch_tab`, `browser_close_tab`, `browser_navigate`, `browser_get_page_info`, `browser_screenshot`, `browser_execute_js`, `browser_click`, `browser_type`, `browser_get_dom`, `browser_scroll`, `browser_wait_for_element`, `browser_get_element_text`, `browser_handle_dialog`

### Native PC Control (13)

| Tool | Description | Key Params |
|------|-------------|------------|
| `run_command` | Execute an allow-listed shell command | `command` (required), `timeout_ms` |
| `manage_process` | List, start, stop, or get info on processes | `action` (list/start/stop/info), `filter`, `command`, `pid`, `name` |
| `screenshot` | Capture primary screen to file | `path` |
| `clipboard` | Read or write Windows clipboard | `action` (read/write), `text` |
| `manage_file` | Delete, move, rename, copy, check, or info on files | `action`, `path`, `destination`, `new_name` |
| `manage_service` | List, start, stop, or check Windows services | `action`, `name`, `filter` |
| `network_info` | Get network config: IPs, gateway, DNS, ports, public IP | — |
| `install_package` | Install via winget or chocolatey | `package` (required), `manager` (winget/choco) |
| `notify` | Send Windows toast notification | `message` (required), `title` |
| `window_management` | List, minimize, maximize, restore, close, activate, resize, move windows | `action`, `title`, `pid`, `x`, `y`, `width`, `height` |
| `registry_read` | Read Windows registry key values (read-only) | `path` (required) |
| `get_env` | List env var names and value lengths (never exposes values) | `filter` |
| `system_info_extended` | OS, CPU, RAM, disks, GPU, uptime | — |

## Start

```cmd
E:\tools\unified-mcp-gateway\start.cmd
```

Or manually:
```cmd
cd /d E:\tools\unified-mcp-gateway && node server.js
```

**Prerequisites:** Latch (3939), Connector (3000), and Browser MCP (3001) should be running first. The gateway proxies to them — if an upstream is down, its tools will return errors.

## Stop

```powershell
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3002 -ErrorAction SilentlyContinue | Stop-Process -Id $_.OwningProcess -Force"
```

## Status

```bash
# Health (shows upstream server status too)
curl -s http://localhost:3002/health
# Returns: {"status":"ok","service":"unified-mcp-gateway","version":"1.0.0","authEnabled":true,"nativeTools":13,"upstreamServers":{"latch":"ok","connector":"ok","browser":"ok"}}

# Port check
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3002 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess"
```

## Configure

### Config file: `E:\tools\unified-mcp-gateway\.env`

```
GATEWAY_AUTH_TOKEN=<64-char hex — NEVER print or copy>
GATEWAY_AUTH_ENABLED=true
```

### Auth token

The Bearer token is stored in:
1. **HKCU environment:** `GATEWAY_AUTH_TOKEN` (persistent across reboots)
2. **`.env` file:** `E:\tools\unified-mcp-gateway\.env`

To check it exists (by length only, never print):
```powershell
powershell.exe -NoProfile -Command "$t = [System.Environment]::GetEnvironmentVariable('GATEWAY_AUTH_TOKEN','User'); Write-Host \"GATEWAY_AUTH_TOKEN length: $($t.Length)\""
```

### Upstream servers

Defined in `server.js` at the top:
```js
const UPSTREAM_SERVERS = {
  latch:     { host: '127.0.0.1', port: 3939, prefix: '' },
  connector: { host: '127.0.0.1', port: 3000, prefix: '' },
  browser:   { host: '127.0.0.1', port: 3001, prefix: 'browser_' }
};
```

To change upstream ports, edit `server.js` and restart the gateway.

### MCP client config (Pi agent)

In `E:\ONE-STOP-SHOP\.pi\agent\mcp.json`:
```json
"unified-gateway": {
    "type": "streamable-http",
    "url": "http://localhost:3002/mcp",
    "headers": {
        "Authorization": "Bearer <GATEWAY_AUTH_TOKEN>"
    },
    "timeout": 60
}
```

## Logs

| Log | Path |
|-----|------|
| Gateway log | `E:\tools\unified-mcp-gateway\gateway.log` |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 3002 not listening | Run `E:\tools\unified-mcp-gateway\start.cmd` |
| 401 Unauthorized | Missing or wrong Bearer token. Check `GATEWAY_AUTH_TOKEN` env var. |
| Upstream shows "error" in health | Start the upstream server (latch/connector/browser) first |
| `run_command` rejected | Command not in allow-list. Check `server.js` for the allow-list. |
| `manage_process` stop fails | Use `pid` or `name`, NOT `port` |
| Gateway crashes on start | Check `gateway.log` for errors. Ensure Node.js >= 18 is installed. |

## Gotchas

- **Never print the auth token.** It is a 64-char hex. Check by length only.
- **`manage_process` stop requires `pid` or `name`, NOT `port`.**
- **`run_command` has an allow-list.** `start` is allowed (prefix match), `cmd /c` is NOT.
- **Upstream servers must be up first.** The gateway proxies to 3939, 3000, 3001. If they are down, proxied tools return errors.
- **Auth can be disabled** by setting `GATEWAY_AUTH_ENABLED=false` in `.env` (not recommended for production).
- **Kill via PowerShell**, not Git Bash `kill` (PID namespace mismatch).
- **Node SEA binary** available at CI artifacts (34.4 MB standalone exe). Source is `server.js`.
