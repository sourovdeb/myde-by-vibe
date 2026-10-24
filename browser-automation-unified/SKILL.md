# Browser Automation Unified - SKILL

## Overview

Unified browser automation skill for controlling Chrome, Firefox, and Opera browsers through a single, consistent interface. This skill consolidates the capabilities of:
- `browserControl:browser-control` (Chrome via MCP)
- `browserControlFirefox:browser-control-firefox` (Firefox via MCP)
- `browserControlOpera:browser-control-opera` (Opera via MCP)
- Chrome AI / Modern Web Guidance (future integration)

## When to Use

Use this skill when you need to:
- Control browsers programmatically (click, type, navigate, screenshot)
- Automate cross-browser testing
- Perform web scraping with rendering
- Manage tabs and windows
- Interact with JS-rendered or bot-protected pages
- Use Chrome's AI capabilities (Modern Web Guidance)

## Capabilities by Browser

### Chrome (browser-control-mcp)
- ✅ Tab management (list, open, close, switch)
- ✅ Navigation (goto, back, forward, refresh)
- ✅ Page interaction (click, type, scroll)
- ✅ JavaScript execution
- ✅ Screenshot capture
- ✅ DOM inspection
- ✅ Element text extraction
- ✅ Wait for elements
- ✅ Handle dialogs (alert/confirm/prompt)
- ✅ Chrome 156+ compatible (DebugFull profile workaround)

### Firefox (browser-control-mcp-firefox)
- ✅ Tab management
- ✅ Navigation
- ✅ Page interaction
- ✅ JavaScript execution
- ✅ Screenshot capture
- ✅ DOM inspection
- ✅ Uses WebDriver/geckodriver

### Opera (browser-control-mcp-opera)
- ✅ Tab management
- ✅ Navigation
- ✅ Page interaction
- ✅ JavaScript execution
- ✅ Screenshot capture
- ✅ Direct CDP WebSocket connection
- ✅ Auto-launches Opera with debugging port

## Quick Start

### 1. Ensure MCP Servers are Running

```powershell
# Start all browser control MCP servers
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp
node server/http-server.js  # Port 3001 - Chrome

cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera
node server/http-server.js  # Port 3002 - Opera

cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox
npm run install-geckodriver  # Download geckodriver first
node server/http-server.js  # Port 3003 - Firefox
```

### 2. Launch Browsers with Debugging

**Chrome (Chrome 156+ workaround):**
```powershell
# First, copy main profile to DebugFull
Copy-Item -Path "$env:USERPROFILE\AppData\Local\Google\Chrome\User Data\Default" \
         -Destination "$env:USERPROFILE\AppData\Local\Google\Chrome\DebugFull" \
         -Recurse -Force

# Then launch with DebugFull profile
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' \
  -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'
```

**Opera:**
```powershell
Start-Process 'C:\Program Files\Opera\launcher.exe' \
  -ArgumentList '--remote-debugging-port=9223'
```

**Firefox:**
```powershell
# geckodriver must be running first
geckodriver --port=4444
```

### 3. Use in Vibe

```
Load the browser-automation-unified skill, then:

# List tabs in Chrome
/browser list_tabs browser:chrome

# Open URL in Firefox
/browser new_tab browser:firefox url:https://sourovdeb.com

# Take screenshot in Opera
/browser screenshot browser:opera path:screenshot.png

# Execute JS in Chrome
/browser execute_js browser:chrome code:"document.title"
```

## Command Reference

### Browser Selection
All commands accept a `browser` parameter:
- `chrome` or `browser-control` - Chrome (port 3001)
- `firefox` or `browser-control-firefox` - Firefox (port 3003)
- `opera` or `browser-control-opera` - Opera (port 3002)
- `default` - Uses Chrome as default

### Tab Management

| Command | Description | Example |
|---------|-------------|---------|
| `list_tabs` | List all open tabs | `/browser list_tabs browser:chrome` |
| `new_tab` | Open new tab | `/browser new_tab browser:chrome url:https://example.com` |
| `close_tab` | Close a tab | `/browser close_tab browser:chrome tab_id:5` |
| `switch_tab` | Switch to tab | `/browser switch_tab browser:chrome tab_id:3` |

### Navigation

| Command | Description | Example |
|---------|-------------|---------|
| `navigate` | Navigate to URL | `/browser navigate browser:chrome url:https://example.com` |
| `refresh` | Refresh page | `/browser refresh browser:chrome` |
| `go_back` | Go back | `/browser go_back browser:chrome` |
| `go_forward` | Go forward | `/browser go_forward browser:chrome` |

### Page Interaction

| Command | Description | Example |
|---------|-------------|---------|
| `click` | Click element | `/browser click browser:chrome selector:#button` |
| `click_at_xy` | Click at coordinates | `/browser click_at_xy browser:chrome x:100 y:200` |
| `type` | Type text | `/browser type browser:chrome selector:#input text:"Hello"` |
| `scroll` | Scroll page | `/browser scroll browser:chrome direction:down pixels:500` |
| `wait_for_element` | Wait for element | `/browser wait_for_element browser:chrome selector:.loaded timeout:5000` |

### Data Extraction

| Command | Description | Example |
|---------|-------------|---------|
| `get_page_info` | Get page title/URL | `/browser get_page_info browser:chrome` |
| `get_dom` | Get full DOM | `/browser get_dom browser:chrome` |
| `get_element_text` | Get element text | `/browser get_element_text browser:chrome selector:h1` |
| `screenshot` | Take screenshot | `/browser screenshot browser:chrome path:shot.png` |

### JavaScript Execution

| Command | Description | Example |
|---------|-------------|---------|
| `execute_js` | Execute JS code | `/browser execute_js browser:chrome code:"return document.title"` |

### Advanced

| Command | Description | Example |
|---------|-------------|---------|
| `handle_dialog` | Set dialog handler | `/browser handle_dialog browser:chrome accept:true` |
| `check_health` | Check MCP server health | `/browser check_health browser:chrome` |
| `list_tools` | List available tools | `/browser list_tools browser:chrome` |

## RAM-Conscious Usage

To avoid saturating RAM:

1. **Reuse existing browser instances** - Don't launch new Chrome processes
2. **Close tabs when done** - Use `close_tab` to free memory
3. **Use headless mode** - When possible, use headless browsers
4. **Limit concurrent operations** - Process tabs sequentially, not in parallel
5. **Monitor memory** - Check RAM before heavy operations

```powershell
# Check free RAM before launching browsers
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize
```

## Chrome AI / Modern Web Guidance Integration

Chrome's AI capabilities can enhance browser automation:

- **Intelligent element selection** - AI helps find the best selectors
- **Form filling** - AI can understand and fill complex forms
- **Content extraction** - AI can identify and extract main content
- **Error recovery** - AI can suggest recovery actions

### Future Integration Points

```javascript
// Example: Use Chrome AI to find elements
const elements = await chromeAI.findElementsByDescription("login button");
// Returns: [{ selector: "button#login", confidence: 0.95 }]

// Example: Extract structured data
const data = await chromeAI.extractToSchema(url, schema);
```

## WordPress Integration

For WordPress-specific automation, use the WordPress MCP server:

```
# Connect to WordPress
/wp connect site:https://sourovdeb.com user:admin password:APP_PASSWORD

# Then use browser automation for WordPress admin
/browser navigate browser:chrome url:https://sourovdeb.com/wp-admin
/browser click browser:chrome selector:#menu-posts
```

## Error Handling

### Common Issues

1. **Chrome 156+ CDP blocked on default profile**
   - Solution: Use DebugFull copied profile as shown above

2. **Port already in use**
   - Solution: Kill existing process: `netstat -ano | findstr PORT` then `taskkill /PID PID /F`

3. **Firefox not installed**
   - Solution: Install Firefox or use Chrome/Firefox only

4. **Opera not installed**
   - Solution: Install Opera or use Chrome/Firefox only

5. **MCP server not responding**
   - Solution: Check server logs, verify port, restart server

### Debug Commands

```bash
# Check all MCP server health
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health

# Check Chrome CDP
curl http://localhost:9222/json/version
```

## Security Considerations

1. **Never log credentials** - Application passwords are stored only in chrome.storage.local
2. **Use application passwords** - Not regular WordPress passwords
3. **Limit origins** - MCP servers bind to localhost by default
4. **HTTPS recommended** - For production, use HTTPS with valid certificates

## Performance Tips

1. **Cache selectors** - Reuse element references instead of re-querying
2. **Batch operations** - Combine multiple actions in one command
3. **Use wait_for_element** - Avoid race conditions
4. **Parallelize smartly** - Different browsers can run in parallel
5. **Clean up** - Close tabs and browser instances when done

## File Structure

```
H:\chrome-communication-extension\browser-automation-unified\
├── SKILL.md                    # This file
├── README.md                   # Detailed documentation
├── IMPLEMENTATION_GUIDE.md     # Implementation instructions
├── examples/                   # Usage examples
│   ├── chrome-automation.js   # Chrome examples
│   ├── firefox-automation.js  # Firefox examples
│   └── opera-automation.js    # Opera examples
└── test/                      # Test scripts
    ├── test_chrome.js          # Chrome tests
    ├── test_firefox.js         # Firefox tests
    └── test_opera.js           # Opera tests
```

## Future Enhancements

1. **Cross-browser test suites** - Run same tests on all browsers
2. **Synchronized actions** - Perform same action across all browsers
3. **AI-powered selectors** - Use Chrome AI for intelligent element finding
4. **Visual testing** - Compare screenshots across browsers
5. **Performance benchmarks** - Compare browser performance
6. **Accessibility testing** - Automated accessibility checks

## References

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Mozilla Firefox WebDriver](https://firefox-source-docs.mozilla.org/testing/webdriver/)
- [Opera Developer](https://dev.opera.com/)
- [Chrome AI / Modern Web Guidance](https://developer.chrome.com/docs/extensions/ai/build-with-ai)
- [MCP Protocol](https://modelcontextprotocol.io/)

## Version History

- v1.0.0 (2026-10-24) - Initial unified skill definition
- v1.1.0 (2026-10-24) - Added RAM-conscious usage section
- v1.2.0 (2026-10-24) - Added Chrome AI integration notes
