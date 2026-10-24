---
name: browser-control
namespace: browserControl
version: 1.0.0
description: Control local Chrome browser via MCP - list tabs, navigate, click, type, screenshot, execute JS
user-invocable: true
allowed-tools:
  - browser_list_tabs
  - browser_new_tab
  - browser_switch_tab
  - browser_close_tab
  - browser_navigate
  - browser_get_page_info
  - browser_screenshot
  - browser_execute_js
  - browser_click
  - browser_type
  - browser_get_dom
  - browser_scroll
  - browser_wait_for_element
  - browser_get_element_text
  - browser_handle_dialog
---

# Browser Control MCP

Control your local Chrome browser through MCP tools. This skill provides 12 tools for browser automation.

## Available Tools

### Tab Management

| Tool | Description | Parameters |
|------|-------------|------------|
| `browser_list_tabs` | List all open tabs | None |
| `browser_new_tab` | Open new tab | `url` (required) |
| `browser_switch_tab` | Switch to tab | `target_id` or `index` |
| `browser_close_tab` | Close tab | `target_id` or `index` |

### Navigation

| Tool | Description | Parameters |
|------|-------------|------------|
| `browser_navigate` | Navigate to URL | `url` (required) |
| `browser_get_page_info` | Get page info | None |

### Interaction

| Tool | Description | Parameters |
|------|-------------|------------|
| `browser_click` | Click at coordinates | `x`, `y` (required) |
| `browser_type` | Type text | `text` (required) |
| `browser_scroll` | Scroll page | `x`, `y` (optional) |

### Content

| Tool | Description | Parameters |
|------|-------------|------------|
| `browser_screenshot` | Take screenshot | `path` (required) |
| `browser_execute_js` | Execute JavaScript | `code` (required) |
| `browser_get_dom` | Get HTML content | `selector` (optional) |

### Advanced

| Tool | Description | Parameters |
|------|-------------|------------|
| `browser_wait_for_element` | Wait for a CSS selector to appear | `selector` (required), `timeout_ms` (optional, default 10000) |
| `browser_get_element_text` | Get text, HTML, and attributes of an element | `selector` (required) |
| `browser_handle_dialog` | Handle JS alert/confirm/prompt dialogs | `action` (required: accept/dismiss), `prompt_text` (optional) |

## Examples

### List all tabs
```javascript
await browserControl.browser_list_tabs({});
```

### Open a new tab
```javascript
await browserControl.browser_new_tab({ url: "https://example.com" });
```

### Navigate current tab
```javascript
await browserControl.browser_navigate({ url: "https://google.com" });
```

### Take a screenshot
```javascript
await browserControl.browser_screenshot({ path: "H:/screenshot.png" });
```

### Execute JavaScript
```javascript
await browserControl.browser_execute_js({ 
  code: "document.title" 
});
```

### Get page DOM
```javascript
await browserControl.browser_get_dom({});
// or with selector
await browserControl.browser_get_dom({ selector: "#main-content" });
```

## Architecture

```
Mistral AI (cloud)
    ↓ HTTP/JSON-RPC
Browser Control MCP Server (localhost:3001)
    ↓ subprocess
browser-harness CLI
    ↓ CDP (Chrome DevTools Protocol)
Chrome Browser (local)
```

## Requirements

- Chrome browser running
- browser-harness installed and configured
- Remote debugging enabled at chrome://inspect/#remote-debugging

## Server Management

```bash
# Start server
cd ~/.vibe/plugins/browser-control-mcp/server
npm install
npm start

# Check health
curl http://localhost:3001/health

# Test MCP endpoint
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```
