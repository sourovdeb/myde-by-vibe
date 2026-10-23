# Browser Control MCP

Control your local Chrome browser through MCP (Model Context Protocol). This plugin allows Mistral AI to control your Chrome browser via HTTP, enabling cloud-to-local browser automation.

## Architecture

```
┌─────────────────┐     HTTP/JSON-RPC      ┌─────────────────────────┐
│  Mistral AI     │ ◄────────────────────► │  Browser Control MCP    │
│  (Cloud)        │    http://localhost:3001│  Server (Local PC)      │
└─────────────────┘                        └───────────┬─────────────┘
                                                       │
                                              subprocess│
                                                       ▼
                                           ┌─────────────────────┐
                                           │  browser-harness    │
                                           │  CLI                │
                                           └───────────┬─────────┘
                                                       │
                                              CDP (Chrome DevTools Protocol)
                                                       ▼
                                           ┌─────────────────────┐
                                           │  Chrome Browser     │
                                           │  (Local)            │
                                           └─────────────────────┘
```

## Features

- ✅ 12 browser control tools
- ✅ HTTP MCP server (port 3001)
- ✅ JSON-RPC 2.0 protocol
- ✅ CORS enabled
- ✅ Health check endpoint
- ✅ Vibe plugin structure
- ✅ Skill integration

## Tools

| Tool | Description |
|------|-------------|
| `browser_list_tabs` | List all open tabs |
| `browser_new_tab` | Open new tab with URL |
| `browser_switch_tab` | Switch to specific tab |
| `browser_close_tab` | Close a tab |
| `browser_navigate` | Navigate to URL |
| `browser_get_page_info` | Get current page info |
| `browser_screenshot` | Take screenshot |
| `browser_execute_js` | Execute JavaScript |
| `browser_click` | Click at coordinates |
| `browser_type` | Type text |
| `browser_get_dom` | Get HTML content |
| `browser_scroll` | Scroll the page |

## Quick Start

### 1. Install Dependencies

```bash
cd ~/.vibe/plugins/browser-control-mcp/server
npm install
```

### 2. Start the Server

```bash
npm start
# Server runs at: http://localhost:3001/mcp
```

### 3. Test the Server

```bash
# Health check
curl http://localhost:3001/health

# List tools
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# List browser tabs
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"browser_list_tabs","arguments":{}}}'
```

### 4. Expose to Mistral AI Cloud (via Cloudflare Tunnel)

`localhost:3001` is NOT reachable from Mistral AI cloud. You need a tunnel:

```bash
# Start Cloudflare Tunnel (one-time download: cloudflared.exe)
nohup /c/tmp/cloudflared.exe tunnel --url http://localhost:3001 > /c/tmp/cf-3001.log 2>&1 &
# Note the URL from the log, e.g.:
# https://cashiers-cheap-membership-chapel.trycloudflare.com
```

### 5. Add to Mistral AI

Go to: https://chat.mistral.ai/connections/marketplace

- **Connector name**: `Browser Control MCP`
- **Server**: `https://<tunnel-url>.trycloudflare.com/mcp` (NOT localhost)
- **Authentication**: None

**GOTCHA:** The "Auto-detect" and "Add connector" buttons appear disabled even with valid input. Force-click via browser JS:
```javascript
const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Auto-detect'));
btn.disabled = false; btn.click();
```

**GOTCHA:** Tunnel URLs are ephemeral — they change when cloudflared restarts. Update the connector URL after every restart.

See `docs/MCP-CONNECTOR-GUIDELINES.md` in the GitHub repo for the full setup guide.

## Requirements

- Node.js 18+
- Chrome browser running
- browser-harness installed (`pip install browser-harness` or via uv)
- Remote debugging enabled at `chrome://inspect/#remote-debugging`

## Configuration

Create `.env` file in the server directory:

```env
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
BROWSER_HARNESS=browser-harness
BROWSER_TIMEOUT=30000
```

## Security

- ✅ Read-only browser operations (no file system writes except screenshots)
- ✅ Local-only by default (binds to 0.0.0.0 but should be firewalled)
- ✅ No authentication by default (add if exposing to network)
- ✅ Input validation on all parameters

## License

MIT License

## Author

Sourov - https://sourovdeb.com
