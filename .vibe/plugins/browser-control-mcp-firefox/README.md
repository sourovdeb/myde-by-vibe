# Browser Control MCP (Firefox)

Control your local Firefox browser through MCP (Model Context Protocol). Firefox does not support CDP, so this plugin uses the WebDriver protocol via geckodriver and selenium-webdriver.

## Architecture

```
┌─────────────────┐     HTTP/JSON-RPC      ┌─────────────────────────┐
│  Mistral AI     │ ◄────────────────────► │  Browser Control MCP    │
│  (Cloud)        │    http://localhost:3003│  Server (Local PC)      │
└─────────────────┘                        └───────────┬─────────────┘
                                                       │
                                              WebDriver Protocol (HTTP)
                                                       ▼
                                           ┌─────────────────────┐
                                           │  geckodriver        │
                                           │  (localhost:4444)   │
                                           └───────────┬─────────┘
                                                       │
                                              Marionette Protocol
                                                       ▼
                                           ┌─────────────────────┐
                                           │  Firefox Browser    │
                                           │  (Local)            │
                                           └─────────────────────┘
```

## Features

- 12 browser control tools (same interface as Chrome/Opera variants)
- WebDriver protocol via geckodriver + selenium-webdriver
- Auto-downloads geckodriver on setup
- Auto-launches Firefox on first tool call
- HTTP MCP server (port 3003)
- JSON-RPC 2.0 protocol
- CORS enabled
- Health check endpoint

## Tools

| Tool | Description |
|------|-------------|
| `firefox_list_tabs` | List all open tabs |
| `firefox_new_tab` | Open new tab with URL |
| `firefox_switch_tab` | Switch to specific tab |
| `firefox_close_tab` | Close a tab |
| `firefox_navigate` | Navigate to URL |
| `firefox_get_page_info` | Get current page info |
| `firefox_screenshot` | Take screenshot |
| `firefox_execute_js` | Execute JavaScript |
| `firefox_click` | Click at coordinates |
| `firefox_type` | Type text |
| `firefox_get_dom` | Get HTML content |
| `firefox_scroll` | Scroll the page |

## Quick Start

### 1. Install Dependencies

```bash
cd ~/.vibe/plugins/browser-control-mcp-firefox/server
npm install
```

### 2. Download geckodriver (one-time)

```bash
npm run install-geckodriver
```

### 3. Start the Server

```bash
npm start
# Server runs at: http://localhost:3003/mcp
```

### 4. Test the Server

```bash
# Health check
curl http://localhost:3003/health

# List tools
curl -X POST http://localhost:3003/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

### 5. Expose to Mistral AI Cloud (via Cloudflare Tunnel)

```bash
nohup /c/tmp/cloudflared.exe tunnel --url http://localhost:3003 > /c/tmp/cf-3003.log 2>&1 &
```

## Requirements

- Node.js 18+
- Firefox browser installed
- geckodriver (auto-downloaded via `npm run install-geckodriver`)
- `selenium-webdriver` npm package (installed via `npm install`)

## Configuration

```env
PORT=3003
HOST=0.0.0.0
GECKODRIVER_PORT=4444
# FIREFOX_PATH=C:\Program Files\Mozilla Firefox\firefox.exe
HEADLESS=false
BROWSER_TIMEOUT=30000
```

## Firefox Executable Paths (auto-detected)

The server checks these paths in order:
1. `FIREFOX_PATH` environment variable
2. `C:\Program Files\Mozilla Firefox\firefox.exe`
3. `C:\Program Files (x86)\Mozilla Firefox\firefox.exe`
4. `%LOCALAPPDATA%\Mozilla Firefox\firefox.exe`
5. `C:\Program Files\Firefox Developer Edition\firefox.exe`
6. `C:\Program Files\Nightly\firefox.exe`

## geckodriver

The `install-geckodriver.js` script downloads the latest geckodriver release from GitHub:
- Fetches release info from `api.github.com/repos/mozilla/geckodriver/releases/latest`
- Downloads the win64 ZIP asset
- Extracts `geckodriver.exe` to the server directory

## License

MIT License

## Author

Sourov - https://sourovdeb.com
