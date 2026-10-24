---
name: browser-control-opera
namespace: browserControlOpera
version: 1.0.0
description: Control local Opera browser via MCP - list tabs, navigate, click, type, screenshot, execute JS
user-invocable: true
allowed-tools:
  - opera_list_tabs
  - opera_new_tab
  - opera_switch_tab
  - opera_close_tab
  - opera_navigate
  - opera_get_page_info
  - opera_screenshot
  - opera_execute_js
  - opera_click
  - opera_type
  - opera_get_dom
  - opera_scroll
---

# Browser Control MCP (Opera)

Control your local Opera browser through MCP tools. Opera is Chromium-based and supports the Chrome DevTools Protocol (CDP) natively. This skill provides 12 tools for Opera browser automation.

## Available Tools

### Tab Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `opera_list_tabs` | List all open tabs | None |
| `opera_new_tab` | Open new tab | `url` (required) |
| `opera_switch_tab` | Switch to tab | `target_id` or `index` |
| `opera_close_tab` | Close tab | `target_id` or `index` |

### Navigation

| Tool | Description | Parameters |
|------|-------------|------------|
| `opera_navigate` | Navigate to URL | `url` (required) |
| `opera_get_page_info` | Get page info | None |

### Interaction

| Tool | Description | Parameters |
|------|-------------|------------|
| `opera_click` | Click at coordinates | `x`, `y` (required) |
| `opera_type` | Type text | `text` (required) |
| `opera_scroll` | Scroll page | `x`, `y` (optional) |

### Content

| Tool | Description | Parameters |
|------|-------------|------------|
| `opera_screenshot` | Take screenshot | `path` (required) |
| `opera_execute_js` | Execute JavaScript | `code` (required) |
| `opera_get_dom` | Get HTML content | `selector` (optional) |

## Examples

### List all tabs
```javascript
await browserControlOpera.opera_list_tabs({});
```

### Open a new tab
```javascript
await browserControlOpera.opera_new_tab({ url: "https://example.com" });
```

### Navigate current tab
```javascript
await browserControlOpera.opera_navigate({ url: "https://google.com" });
```

### Take a screenshot
```javascript
await browserControlOpera.opera_screenshot({ path: "H:/screenshot.png" });
```

### Execute JavaScript
```javascript
await browserControlOpera.opera_execute_js({
  code: "document.title"
});
```

## Architecture

```
Mistral AI (cloud)
    ↓ HTTP/JSON-RPC
Browser Control MCP Server (localhost:3002)
    ↓ CDP WebSocket (Chrome DevTools Protocol)
Opera Browser (local, --remote-debugging-port=9223)
```

## Requirements

- Opera browser installed (or Opera GX)
- Node.js 18+
- `ws` npm package (WebSocket client for CDP)

## Server Management

```bash
# Start server
cd ~/.vibe/plugins/browser-control-mcp-opera/server
npm install
npm start

# Check health
curl http://localhost:3002/health

# Test MCP endpoint
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

Create `.env` file in the server directory:

```env
PORT=3002
HOST=0.0.0.0
CDP_PORT=9223
# OPERA_PATH=C:\Users\souro\AppData\Local\Programs\Opera\opera.exe
```

## Notes

- Opera is Chromium-based, so CDP works identically to Chrome
- The server auto-launches Opera with `--remote-debugging-port=9223` if not already running
- Uses a separate `DebugProfile` user-data-dir to avoid profile-locking issues
- If Opera is already running without debugging, close it first — the server will relaunch it with CDP enabled
