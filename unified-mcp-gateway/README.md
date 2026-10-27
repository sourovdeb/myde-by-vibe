# Unified MCP Gateway

Single MCP endpoint that aggregates all PC control tools for Mistral Work and local agents.

## Quick Start

```cmd
E:\tools\unified-mcp-gateway\start.cmd
```

Or programmatically:
```powershell
Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory 'E:\tools\unified-mcp-gateway' -WindowStyle Hidden
```

## Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Server info and tool list |
| `/health` | GET | Health check with upstream status |
| `/mcp` | POST | MCP JSON-RPC endpoint (tools/list, tools/call) |
| `/mcp` | GET | SSE stream (Streamable HTTP transport) |
| `/mcp` | DELETE | Terminate session |

## Tool Surface (39 tools)

### Upstream Proxied (26 tools)

| Server | Port | Tools |
|--------|------|-------|
| Latch MCP | 3939 | `list_files`, `read_file`, `search_files`, `write_file`, `run_task`, `control_desktop` |
| my-mcp-connector | 3000 | `health_check`, `system_info`, `one_stop_shop_status`, `credential_env_present`, `vibe_skill_list` |
| browser-control-mcp | 3001 | `browser_list_tabs`, `browser_new_tab`, `browser_switch_tab`, `browser_close_tab`, `browser_navigate`, `browser_get_page_info`, `browser_screenshot`, `browser_execute_js`, `browser_click`, `browser_type`, `browser_get_dom`, `browser_scroll`, `browser_wait_for_element`, `browser_get_element_text`, `browser_handle_dialog` |

### Native Tools (13 tools)

| Tool | Description |
|------|-------------|
| `run_command` | Execute allow-listed shell commands (read-only, safe) |
| `manage_process` | List, start, stop, or get info about Windows processes |
| `screenshot` | Capture primary screen to PNG file |
| `clipboard` | Read from or write to Windows clipboard |
| `manage_file` | Delete, move, rename, copy files; check existence; get file info |
| `manage_service` | List, start, stop Windows services; check status |
| `network_info` | IP addresses, gateway, DNS, listening ports, public IP |
| `install_package` | Install software via winget or chocolatey |
| `notify` | Send Windows toast notifications |
| `window_management` | List, minimize, maximize, restore, close, activate, resize, move windows |
| `registry_read` | Read Windows registry keys (read-only) |
| `get_env` | List environment variable names and value lengths (never exposes values) |
| `system_info_extended` | Detailed system info: OS, CPU, RAM, disks, GPU, uptime |

## Architecture

```
Mistral Work / Pi Agent
        │
        ▼
┌─────────────────────────┐
│  Unified MCP Gateway    │  Port 3002 (localhost) + Cloudflare Tunnel
│  ┌─────────────────┐    │
│  │  13 Native Tools │    │  Process mgmt, screenshot, clipboard, files,
│  │  (Node.js)       │    │  services, network, packages, notifications,
│  └─────────────────┘    │  windows, registry, env, system info
│  ┌─────────────────┐    │
│  │  Proxy Router    │    │  Routes tool calls to correct upstream
│  └─────────────────┘    │
└─────────────────────────┘
        │
        ├──► Latch MCP (3939) — file ops, run_task, desktop control
        ├──► my-mcp-connector (3000) — health, system info, credentials check
        └──► browser-control-mcp (3001) — Chrome automation (15 tools)
```

## RAM Usage

- Gateway process: ~65 MB (Node.js)
- Total MCP stack: ~120 MB (gateway + 3 upstream servers)
- Well under the 100 MB per-process target

## Security

- `run_command` uses a strict allow-list — only safe, read-only commands
- Dangerous commands (del, format, shutdown, reg, taskkill /f, etc.) are blocked
- `get_env` never exposes values — only names and lengths
- `registry_read` is read-only
- Firewall rules block external access to port 3002 (localhost only)
- Cloudflare Tunnel provides authenticated access for Mistral Work

## Configuration

Environment variables:
- `PORT` — Gateway port (default: 3002)
- `HOST` — Bind address (default: 0.0.0.0)

## Files

| File | Description |
|------|-------------|
| `server.js` | Main gateway server (1,182 lines) |
| `package.json` | Node.js package definition |
| `start.cmd` | Windows start script |
| `README.md` | This file |
