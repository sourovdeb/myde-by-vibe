# Browser Control MCP (Opera)

Control your local Opera browser through MCP (Model Context Protocol). Opera is Chromium-based and supports the Chrome DevTools Protocol (CDP) natively, making it a drop-in alternative to the Chrome variant.

## Architecture

```
┌─────────────────┐     HTTP/JSON-RPC      ┌─────────────────────────┐
│  Mistral AI     │ ◄────────────────────► │  Browser Control MCP    │
│  (Cloud)        │    http://localhost:3002│  Server (Local PC)      │
└─────────────────┘                        └───────────┬─────────────┘
                                                       │
                                              CDP WebSocket
                                              (Chrome DevTools Protocol)
                                                       ▼
                                           ┌─────────────────────┐
                                           │  Opera Browser      │
                                           │  (--remote-debugging│
                                           │   -port=9223)       │
                                           └─────────────────────┘
```

## Features

- 15 browser control tools (same interface as Chrome variant)
- Self-contained CDP WebSocket client (no browser-harness dependency)
- Auto-launches Opera with remote debugging if not running
- HTTP MCP server (port 3002)
- JSON-RPC 2.0 protocol
- CORS enabled
- Health check endpoint

## Tools

| Tool | Description |
|------|-------------|
| `opera_list_tabs` | List all open tabs |
| `opera_new_tab` | Open new tab with URL |
| `opera_switch_tab` | Switch to specific tab |
| `opera_close_tab` | Close a tab |
| `opera_navigate` | Navigate to URL |
| `opera_get_page_info` | Get current page info |
| `opera_screenshot` | Take screenshot |
| `opera_execute_js` | Execute JavaScript |
| `opera_click` | Click at coordinates |
| `opera_type` | Type text |
| `opera_get_dom` | Get HTML content |
| `opera_scroll` | Scroll the page |
| `opera_wait_for_element` | Wait for a CSS selector to appear (with timeout) |
| `opera_get_element_text` | Get text, HTML, and attributes of an element |
| `opera_handle_dialog` | Handle JS alert/confirm/prompt dialogs |

## Quick Start

### 1. Install Dependencies

```bash
cd ~/.vibe/plugins/browser-control-mcp-opera/server
npm install
```

### 2. Start the Server

```bash
npm start
# Server runs at: http://localhost:3002/mcp
```

### 3. Test the Server

```bash
# Health check
curl http://localhost:3002/health

# List tools
curl -X POST http://localhost:3002/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 4. Expose to Mistral AI Cloud (via Cloudflare Tunnel)

```bash
nohup /c/tmp/cloudflared.exe tunnel --url http://localhost:3002 > /c/tmp/cf-3002.log 2>&1 &
```

## Requirements

- Node.js 18+
- Opera browser (or Opera GX) installed
- `ws` npm package (installed via `npm install`)

## Configuration

```env
PORT=3002
HOST=0.0.0.0
CDP_PORT=9223
# OPERA_PATH=C:\Users\souro\AppData\Local\Programs\Opera\opera.exe
BROWSER_TIMEOUT=30000
```

## Opera Executable Paths (auto-detected)

The server checks these paths in order:
1. `OPERA_PATH` environment variable
2. `%LOCALAPPDATA%\Programs\Opera\opera.exe`
3. `%LOCALAPPDATA%\Programs\Opera GX\opera.exe`
4. `C:\Program Files\Opera\opera.exe`
5. `C:\Program Files (x86)\Opera\opera.exe`
6. `C:\Program Files\Opera GX\opera.exe`
7. `C:\Program Files (x86)\Opera GX\opera.exe`

## License

MIT License

## Author

Sourov - https://sourovdeb.com
