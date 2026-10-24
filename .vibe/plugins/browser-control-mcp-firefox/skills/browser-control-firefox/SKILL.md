---
name: browser-control-firefox
namespace: browserControlFirefox
version: 1.0.0
description: Control local Firefox browser via MCP - list tabs, navigate, click, type, screenshot, execute JS
user-invocable: true
allowed-tools:
  - firefox_list_tabs
  - firefox_new_tab
  - firefox_switch_tab
  - firefox_close_tab
  - firefox_navigate
  - firefox_get_page_info
  - firefox_screenshot
  - firefox_execute_js
  - firefox_click
  - firefox_type
  - firefox_get_dom
  - firefox_scroll
  - firefox_wait_for_element
  - firefox_get_element_text
  - firefox_handle_dialog
---

# Browser Control MCP (Firefox)

Control your local Firefox browser through MCP tools. Firefox uses the WebDriver protocol (via geckodriver + selenium-webdriver), not CDP. This skill provides 12 tools for Firefox browser automation.

## Available Tools

### Tab Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `firefox_list_tabs` | List all open tabs | None |
| `firefox_new_tab` | Open new tab | `url` (required) |
| `firefox_switch_tab` | Switch to tab | `target_id` or `index` |
| `firefox_close_tab` | Close tab | `target_id` or `index` |

### Navigation

| Tool | Description | Parameters |
|------|-------------|------------|
| `firefox_navigate` | Navigate to URL | `url` (required) |
| `firefox_get_page_info` | Get page info | None |

### Interaction

| Tool | Description | Parameters |
|------|-------------|------------|
| `firefox_click` | Click at coordinates | `x`, `y` (required) |
| `firefox_type` | Type text | `text` (required) |
| `firefox_scroll` | Scroll page | `x`, `y` (optional) |

### Content

| Tool | Description | Parameters |
|------|-------------|------------|
| `firefox_screenshot` | Take screenshot | `path` (required) |
| `firefox_execute_js` | Execute JavaScript | `code` (required) |
| `firefox_get_dom` | Get HTML content | `selector` (optional) |

### Advanced

| Tool | Description | Parameters |
|------|-------------|------------|
| `firefox_wait_for_element` | Wait for a CSS selector to appear | `selector` (required), `timeout_ms` (optional, default 10000) |
| `firefox_get_element_text` | Get text, HTML, and attributes of an element | `selector` (required) |
| `firefox_handle_dialog` | Handle JS alert/confirm/prompt dialogs | `action` (required: accept/dismiss), `prompt_text` (optional) |

## Examples

### List all tabs
```javascript
await browserControlFirefox.firefox_list_tabs({});
```

### Open a new tab
```javascript
await browserControlFirefox.firefox_new_tab({ url: "https://example.com" });
```

### Navigate current tab
```javascript
await browserControlFirefox.firefox_navigate({ url: "https://google.com" });
```

### Take a screenshot
```javascript
await browserControlFirefox.firefox_screenshot({ path: "H:/screenshot.png" });
```

### Execute JavaScript
```javascript
await browserControlFirefox.firefox_execute_js({
  code: "document.title"
});
```

## Architecture

```
Mistral AI (cloud)
    ↓ HTTP/JSON-RPC
Browser Control MCP Server (localhost:3003)
    ↓ WebDriver Protocol (HTTP)
geckodriver (localhost:4444)
    ↓ Marionette Protocol
Firefox Browser (local)
```

## Requirements

- Firefox browser installed
- geckodriver (auto-downloaded via `npm run install-geckodriver`)
- Node.js 18+
- `selenium-webdriver` npm package

## Server Management

```bash
# Install dependencies
cd ~/.vibe/plugins/browser-control-mcp-firefox/server
npm install

# Download geckodriver (one-time)
npm run install-geckodriver

# Start server
npm start

# Check health
curl http://localhost:3003/health

# Test MCP endpoint
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Configuration

Create `.env` file in the server directory:

```env
PORT=3003
HOST=0.0.0.0
GECKODRIVER_PORT=4444
# FIREFOX_PATH=C:\Program Files\Mozilla Firefox\firefox.exe
HEADLESS=false
BROWSER_TIMEOUT=30000
```

## Notes

- Firefox does NOT support CDP — this server uses WebDriver/geckodriver instead
- geckodriver is auto-downloaded via `npm run install-geckodriver`
- The server auto-starts geckodriver and Firefox on first tool call
- Uses a dedicated `DebugProfile` to avoid profile-locking issues
- If Firefox is already running, close it first — geckodriver needs to launch it
