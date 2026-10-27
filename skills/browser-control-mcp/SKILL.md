---
name: browser-control-mcp
description: Control the browser-control-mcp server (port 3001) — start, stop, status, configure. Provides 15 Chrome automation tools via CDP: list_tabs, new_tab, navigate, click, type, screenshot, execute_js, get_dom, scroll, and more. Use when the user asks about browser automation, Chrome control via MCP, or the browser MCP server on port 3001.
user-invocable: true
metadata:
  display-name: Browser Control MCP
  short-description: Start/stop/configure Browser MCP (port 3001, 15 Chrome CDP tools)
---

# Browser Control MCP

A Node.js MCP server that controls Sourov's real Chrome browser via CDP (Chrome DevTools Protocol) through browser-harness. Provides 15 browser automation tools.

## Quick Reference

| Property | Value |
|----------|-------|
| **Port** | 3001 |
| **Source** | `C:\Users\souro\.vibe\plugins\browser-control-mcp\server\http-server.js` |
| **Start script** | `C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1` |
| **MCP endpoint** | `POST http://localhost:3001/mcp` |
| **Health** | `GET http://localhost:3001/health` |
| **Auth** | None (localhost only) |
| **Live PID** | 2312 (node) |
| **Requires** | Chrome running with CDP (browser-harness) |

## Tools (15)

| Tool | Description | Key Params |
|------|-------------|------------|
| `browser_list_tabs` | List all open browser tabs with details | — |
| `browser_new_tab` | Open a new tab and navigate to a URL | `url` (required) |
| `browser_switch_tab` | Switch active context to a tab | `target_id` or `index` |
| `browser_close_tab` | Close a specific tab | `target_id` or `index` |
| `browser_navigate` | Navigate current tab to a URL | `url` (required) |
| `browser_get_page_info` | Get current page URL, title, readiness | — |
| `browser_screenshot` | Capture screenshot to file | `path` (required) |
| `browser_execute_js` | Execute JavaScript in page context | `code` (required) |
| `browser_click` | Click at x,y coordinates | `x`, `y` (both required) |
| `browser_type` | Type text into focused element | `text` (required) |
| `browser_get_dom` | Get full page HTML or element HTML | `selector` (optional) |
| `browser_scroll` | Scroll page by x,y pixels | `x`, `y` |
| `browser_wait_for_element` | Wait for an element to appear | `selector` (required) |
| `browser_get_element_text` | Get text content of an element | `selector` (required) |
| `browser_handle_dialog` | Handle alert/confirm/prompt dialogs | — |

## Start

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1
```

This script is idempotent — it starts both Browser MCP (3001) and Connector (3000), skipping any already listening.

**Manual start:**
```cmd
cd "C:\Users\souro\.vibe\plugins\browser-control-mcp\server" && node http-server.js
```

**Prerequisite — Chrome must be running.** If Chrome is not running, launch it detached:
```powershell
powershell.exe -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe'"
```

## Stop

```powershell
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue | Stop-Process -Id $_.OwningProcess -Force"
```

## Status

```bash
# Health (shows chromeConnected status)
curl -s http://localhost:3001/health
# Returns: {"status":"ok","service":"browser-control-mcp","version":"1.0.0","browserHarness":"available","chromeConnected":true}

# Port check
powershell.exe -NoProfile -Command "Get-NetTCPConnection -LocalPort 3001 -State Listen -ErrorAction SilentlyContinue | Select-Object LocalPort, OwningProcess"
```

## Configure

The browser-control-mcp has no config file. It uses browser-harness to connect to Chrome via CDP.

### Chrome CDP setup

For browser-harness to control Chrome, Chrome must be launched with remote debugging. Two approaches:

**1. Copied profile (recommended for Chrome 156+):**
```powershell
# Copy the main profile once
# Script: C:\tmp\copy_full_profile.ps1
# Then launch with:
chrome.exe --remote-debugging-port=9222 --user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull
```

**2. Default profile (older Chrome):**
```powershell
chrome.exe --remote-debugging-port=9222
```

**Gotcha:** Chrome 156+ blocks `--remote-debugging-port` with the default user profile. The flag is silently ignored. Use the copied-profile approach.

### MCP client config (Pi agent)

Accessed via the Unified MCP Gateway (port 3002) or directly:
```json
"browser-control-mcp": {
    "type": "streamable-http",
    "url": "http://localhost:3001/mcp",
    "timeout": 30
}
```

## Logs

| Log | Path |
|-----|------|
| Stdout | `C:\Users\souro\.mcp-autostart\logs\mcp-3001.out.log` |
| Stderr | `C:\Users\souro\.mcp-autostart\logs\mcp-3001.err.log` |
| PID file | `C:\Users\souro\.mcp-autostart\pids\mcp-3001.pid` |

## Cloudflare Tunnel

Exposed via Cloudflare Tunnel for Mistral AI cloud access:
```cmd
C:\tmp\cloudflared.exe tunnel --url http://localhost:3001
```

Tunnel URL is ephemeral — check `~/.vibe/docs/TUNNEL-URLS-*.md` for the current URL.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Port 3001 not listening | Run `start-mcp-servers.ps1` |
| `chromeConnected: false` | Chrome not running or CDP not available. Launch Chrome. |
| `browserHarness: "unavailable"` | browser-harness daemon not running. Check browser-harness installation. |
| Tools timeout | `browser_execute_js` has a 5s timeout. For slow operations, use fire-and-forget: store results in `window.__var` and check in a separate call. |
| Chrome 156+ CDP blocked | Use copied profile: `--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull` |
| Dialog blocking | `browser_handle_dialog` only handles FUTURE dialogs. For already-open dialogs, CDP `Page.handleJavaScriptDialog` is needed (not exposed). |
| Tunnel URL NXDOMAIN | Restart cloudflared, get new URL, update Mistral connectors |

## Gotchas

- **Chrome must be running** with CDP enabled for browser tools to work.
- **Chrome 156+ blocks `--remote-debugging-port` with the default profile.** Use the copied-profile approach.
- **`browser_execute_js` has a 5s timeout.** For slow async operations, use fire-and-forget pattern.
- **`browser_handle_dialog` only handles FUTURE dialogs.** It overrides `window.alert/confirm/prompt` via JS. Cannot dismiss already-open dialogs.
- **Direct MCP calls to `browser_execute_js` may run in an isolated world.** `fetch()` from isolated world does NOT carry session cookies → 403 on cookie-auth endpoints. Use main-world JS or the page's own handlers.
- **Never close tabs you did not create.**
- **Kill via PowerShell**, not Git Bash `kill` (PID namespace mismatch).
- **No auth** — only expose via localhost or Cloudflare Tunnel.
