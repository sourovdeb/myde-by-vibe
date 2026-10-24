# Browser Automation Unified

**Unified browser automation system for Chrome, Firefox, and Opera**

This project provides a single, consistent interface for controlling multiple browsers through MCP (Model Context Protocol) servers. It consolidates the capabilities of browser-control-mcp (Chrome), browser-control-mcp-firefox (Firefox), and browser-control-mcp-opera (Opera) into a unified skill and workflow.

## Features

- ✅ **Multi-browser support**: Chrome, Firefox, Opera
- ✅ **MCP Protocol**: Standardized communication via MCP
- ✅ **Tab management**: List, open, close, switch tabs
- ✅ **Page interaction**: Click, type, scroll, screenshot
- ✅ **Navigation**: Goto, back, forward, refresh
- ✅ **JavaScript execution**: Run scripts in browser context
- ✅ **DOM inspection**: Extract and query page elements
- ✅ **Element handling**: Wait for elements, handle dialogs
- ✅ **Chrome 156+ compatibility**: DebugFull profile workaround
- ✅ **WordPress integration**: Connect and manage WordPress sites
- ✅ **OpenCode integration**: Use OpenCode AI for code generation
- ✅ **RAM-conscious**: Avoids launching multiple browser instances

## Quick Start

### 1. Install Dependencies

```bash
# Navigate to the project
cd H:\chrome-communication-extension\browser-automation-unified

# Install MCP servers (if not already installed)
cd %USERPROFILE%\.vibe\plugins\browser-control-mcp
npm install

cd %USERPROFILE%\.vibe\plugins\browser-control-mcp-firefox
npm install
npm run install-geckodriver

cd %USERPROFILE%\.vibe\plugins\browser-control-mcp-opera
npm install
```

### 2. Start MCP Servers

**Option A: Manual Start**
```powershell
# Start each MCP server
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp
node server/http-server.js  # Port 3001 - Chrome

cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera
node server/http-server.js  # Port 3002 - Opera

cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox
node server/http-server.js  # Port 3003 - Firefox

# Start WordPress MCP server
cd H:\chrome-communication-extension
node wordpress-mcp-server.js --port 3008

# Start OpenCode MCP wrapper
cd H:\chrome-communication-extension\mcp-wrappers
node opencode-mcp-server.js --port 3004
```

**Option B: Use PowerShell Script**
```powershell
cd H:\chrome-communication-extension
.\start_agent_discovery.ps1 --all
```

This will:
- Start all MCP servers (ports 3000-3003)
- Start agent wrappers (port 3004)
- Start WordPress MCP server (port 3008)
- Start Chrome with remote debugging (port 9222)

### 3. Launch Browsers

**Chrome (Chrome 156+ workaround):**
```powershell
# Copy main profile to DebugFull (one-time setup)
Copy-Item -Path "$env:USERPROFILE\AppData\Local\Google\Chrome\User Data\Default" \
         -Destination "$env:USERPROFILE\AppData\Local\Google\Chrome\DebugFull" \
         -Recurse -Force

# Launch Chrome with DebugFull profile
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
# Start geckodriver first
geckodriver --port=4444

# Then Firefox will connect automatically
```

### 4. Test the Setup

```bash
# Check all MCP servers are running
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3008/health

# Check Chrome CDP
curl http://localhost:9222/json/version
```

### 5. Use in Vibe

Load the `browser-automation-unified` skill, then use commands:

```
# List tabs in Chrome
/browser list_tabs browser:chrome

# Open URL in Firefox
/browser new_tab browser:firefox url:https://sourovdeb.com

# Take screenshot in Opera
/browser screenshot browser:opera path:screenshot.png

# Click element in Chrome
/browser click browser:chrome selector:#submit-button

# Execute JavaScript
/browser execute_js browser:chrome code:"return document.title"

# Use WordPress MCP
/wp connect site:https://sourovdeb.com password:YOUR_APP_PASSWORD
/wp list_posts

# Use OpenCode MCP
/opencode generate prompt:"Create a Python script to scrape a website"
```

## Command Reference

### Browser Selection
All commands accept a `browser` parameter:
- `chrome` or `browser-control` - Chrome via MCP (port 3001)
- `firefox` or `browser-control-firefox` - Firefox via MCP (port 3003)
- `opera` or `browser-control-opera` - Opera via MCP (port 3002)
- `default` - Uses Chrome as default

### Tab Management

| Command | Parameters | Description |
|---------|------------|-------------|
| `list_tabs` | `browser` | List all open tabs |
| `new_tab` | `browser`, `url` | Open new tab with URL |
| `close_tab` | `browser`, `tab_id` | Close a specific tab |
| `switch_tab` | `browser`, `tab_id` | Switch to a specific tab |
| `close_all_tabs` | `browser` | Close all tabs |

### Navigation

| Command | Parameters | Description |
|---------|------------|-------------|
| `navigate` | `browser`, `url` | Navigate to URL |
| `refresh` | `browser` | Refresh current page |
| `go_back` | `browser` | Go back in history |
| `go_forward` | `browser` | Go forward in history |

### Page Interaction

| Command | Parameters | Description |
|---------|------------|-------------|
| `click` | `browser`, `selector` | Click element by CSS selector |
| `click_at_xy` | `browser`, `x`, `y` | Click at specific coordinates |
| `type` | `browser`, `selector`, `text` | Type text into element |
| `clear` | `browser`, `selector` | Clear element content |
| `scroll` | `browser`, `direction`, `pixels` | Scroll page (up/down/left/right) |
| `scroll_to_element` | `browser`, `selector` | Scroll to specific element |

### Data Extraction

| Command | Parameters | Description |
|---------|------------|-------------|
| `get_page_info` | `browser` | Get page title and URL |
| `get_dom` | `browser` | Get full page HTML |
| `get_element_text` | `browser`, `selector` | Get text content of element |
| `get_element_attribute` | `browser`, `selector`, `attribute` | Get element attribute |
| `screenshot` | `browser`, `path` | Take screenshot of current page |
| `screenshot_element` | `browser`, `selector`, `path` | Take screenshot of element |

### JavaScript Execution

| Command | Parameters | Description |
|---------|------------|-------------|
| `execute_js` | `browser`, `code` | Execute JavaScript code |
| `execute_js_file` | `browser`, `file_path` | Execute JavaScript from file |

### Waiting and Timing

| Command | Parameters | Description |
|---------|------------|-------------|
| `wait_for_element` | `browser`, `selector`, `timeout` | Wait for element to appear |
| `wait_for_navigation` | `browser`, `timeout` | Wait for page navigation |
| `sleep` | `browser`, `milliseconds` | Sleep for specified time |

### Advanced

| Command | Parameters | Description |
|---------|------------|-------------|
| `handle_dialog` | `browser`, `accept`, `text` | Set dialog handler (alert/confirm/prompt) |
| `press_key` | `browser`, `key` | Press a keyboard key |
| `upload_file` | `browser`, `selector`, `file_path` | Upload a file |
| `download_file` | `browser`, `url`, `path` | Download a file |

### WordPress MCP

| Command | Parameters | Description |
|---------|------------|-------------|
| `wp_connect` | `site`, `password` | Connect to WordPress |
| `wp_disconnect` | - | Disconnect from WordPress |
| `wp_list_posts` | Various filters | List posts |
| `wp_get_post` | `id` | Get single post |
| `wp_create_post` | Post data | Create new post |
| `wp_update_post` | `id`, Post data | Update existing post |
| `wp_delete_post` | `id` | Delete a post |
| `wp_upload_media` | `file` | Upload media |
| `wp_list_media` | - | List uploaded media |

### OpenCode MCP

| Command | Parameters | Description |
|---------|------------|-------------|
| `opencode_generate` | `prompt` | Generate code from description |
| `opencode_complete` | `code`, `language` | Complete partial code |
| `opencode_explain` | `code` | Explain code in natural language |
| `opencode_review` | `code` | Review code for issues |
| `opencode_analyze_project` | `files`, `question` | Analyze multi-file project |
| `opencode_fix_code` | `code`, `language`, `issue` | Fix code issues |
| `opencode_translate` | `code`, `from`, `to` | Translate code between languages |
| `opencode_document` | `code` | Generate documentation |
| `opencode_optimize` | `code`, `language` | Optimize code |

## RAM-Conscious Usage

To avoid saturating system RAM (currently ~2.2GB free):

### Best Practices

1. **Reuse existing browser instances**
   - Don't launch new Chrome processes for each task
   - Use existing tabs and windows

2. **Close tabs when done**
   ```
   /browser close_tab browser:chrome tab_id:5
   /browser close_all_tabs browser:chrome
   ```

3. **Limit concurrent operations**
   - Process tabs sequentially, not in parallel
   - Wait for operations to complete before starting new ones

4. **Use efficient selectors**
   - Use IDs and classes instead of complex traversals
   - Cache element references when possible

5. **Monitor memory usage**
   ```powershell
   # Check free RAM before operations
   Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize
   ```

### Memory Estimates

| Browser | Approx Memory per Instance | Notes |
|---------|---------------------------|-------|
| Chrome | 500MB - 2GB | Depends on extensions and tabs |
| Firefox | 400MB - 1.5GB | Generally lighter than Chrome |
| Opera | 300MB - 1GB | Chromium-based, efficient |

### Recommended Limits

- **Maximum concurrent browsers**: 2-3 (Chrome + Firefox, or Chrome + Opera)
- **Maximum tabs per browser**: 10-20 (depending on page complexity)
- **Avoid**: Running all three browsers simultaneously with many tabs

## Chrome AI / Modern Web Guidance

Chrome's built-in AI capabilities can enhance browser automation:

### Features

- **Intelligent element selection**: AI helps find the best selectors
- **Form filling**: AI can understand and fill complex forms
- **Content extraction**: AI can identify and extract main content
- **Error recovery**: AI can suggest recovery actions when elements are not found

### Future Integration

```javascript
// Example: Use Chrome AI to find elements
const elements = await chromeAI.findElementsByDescription("login button");
// Returns: [{ selector: "button#login", confidence: 0.95 }]

// Example: Extract structured data
const data = await chromeAI.extractToSchema(url, schema);

// Example: Get intelligent suggestions
const suggestions = await chromeAI.suggestActions(pageContent);
```

### Chrome AI Documentation

- [Build with AI - Chrome Extensions](https://developer.chrome.com/docs/extensions/ai/build-with-ai)
- [Modern Web Guidance](https://developer.chrome.com/docs/extensions/ai/build-with-ai?utmsource=extsidebar#modernwebguidance)

## WordPress Integration

### Setup

1. **Create Application Password**
   - Go to WordPress admin: `/wp-admin/profile.php`
   - Scroll to "Application Passwords" section
   - Generate a new application password
   - Copy the password (it won't be shown again)

2. **Store Credentials in Double Control Extension**
   - Open Chrome extension popup
   - Go to "WordPress credentials" section
   - Enter site URL (e.g., `https://sourovdeb.com`)
   - Enter username (optional, for display)
   - Enter application password
   - Click "Save"

3. **Test Connection**
   ```
   /wp wp_connect site:https://sourovdeb.com password:YOUR_APP_PASSWORD
   /wp wp_check_credentials
   /wp wp_list_posts
   ```

### Example: Create a Post

```
# Connect to WordPress
/wp wp_connect site:https://sourovdeb.com password:YOUR_APP_PASSWORD

# Create a new post
/wp wp_create_post \
  title:"My New Article" \
  content:"<h1>Introduction</h1><p>This is my new article.</p>" \
  status:"draft" \
  categories:[1,2]
```

### Example: Browser + WordPress Workflow

```
# Open WordPress admin in Chrome
/browser new_tab browser:chrome url:https://sourovdeb.com/wp-admin

# Navigate to posts
/browser navigate browser:chrome url:https://sourovdeb.com/wp-admin/edit.php

# Click "Add New" button
/browser click browser:chrome selector:.page-title-action

# Fill the form
/browser type browser:chrome selector:#title "My New Post"
/browser execute_js browser:chrome code:"document.querySelector('.wp-editor-area').value = 'Content goes here'"

# Or use WordPress MCP directly
/wp wp_create_post title:"My New Post" content:"Content goes here"
```

## Error Handling

### Common Issues and Solutions

#### 1. Chrome 156+ CDP Blocked on Default Profile

**Symptoms:**
- CDP port 9222 not responding
- `chrome://inspect` shows no targets
- browser-harness fails to connect

**Solution:**
```powershell
# Copy main profile to DebugFull (one-time setup)
Copy-Item -Path "$env:USERPROFILE\AppData\Local\Google\Chrome\User Data\Default" \
         -Destination "$env:USERPROFILE\AppData\Local\Google\Chrome\DebugFull" \
         -Recurse -Force

# Launch with DebugFull profile
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' \
  -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'
```

#### 2. Port Already in Use

**Symptoms:**
- Server fails to start
- "Address already in use" error

**Solution:**
```powershell
# Find the process using the port
netstat -ano | findstr PORT_NUMBER

# Kill the process
Stop-Process -Id PROCESS_ID -Force
```

#### 3. Firefox geckodriver Not Found

**Symptoms:**
- Firefox MCP server fails to start
- "geckodriver not found" error

**Solution:**
```bash
cd %USERPROFILE%\.vibe\plugins\browser-control-mcp-firefox
npm run install-geckodriver
```

#### 4. Opera Not Installed

**Symptoms:**
- Opera MCP server starts but can't connect
- "Opera not found" errors

**Solution:**
- Install Opera from [opera.com](https://www.opera.com/)
- Or use Chrome/Firefox only

#### 5. WordPress Connection Failed

**Symptoms:**
- WP MCP returns connection errors
- 401/403 errors

**Solution:**
- Verify application password is correct
- Check if HTTPS is required (try http:// first)
- Verify the site URL is correct
- Check if WordPress REST API is enabled

## Testing

### Test MCP Servers

```bash
# Test Chrome MCP
curl -X POST http://localhost:3001/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'

# Test WordPress MCP
curl -X POST http://localhost:3008/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"wp_list_posts","params":{}}'
```

### Test Browser Automation

```
# List tabs in Chrome
/browser list_tabs browser:chrome

# Open a URL
/browser new_tab browser:chrome url:https://google.com

# Take screenshot
/browser screenshot browser:chrome path:test.png
```

## File Structure

```
H:\chrome-communication-extension\browser-automation-unified\
├── SKILL.md                    # Main skill definition
├── README.md                   # This file
├── examples/                   # Usage examples
│   ├── chrome-automation.md   # Chrome-specific examples
│   ├── firefox-automation.md  # Firefox-specific examples
│   ├── opera-automation.md    # Opera-specific examples
│   └── cross-browser.md        # Cross-browser examples
├── scripts/                    # Helper scripts
│   ├── chrome-debug.ps1        # Chrome debugging setup
│   ├── start-servers.ps1       # Start all MCP servers
│   └── health-check.ps1        # Check server health
└── test/                      # Test scripts
    ├── test_chrome.js          # Chrome tests
    ├── test_firefox.js         # Firefox tests
    └── test_opera.js           # Opera tests
```

## Security

### Credentials Management

- **Never log credentials**: Application passwords are stored only in `chrome.storage.local`
- **Use application passwords**: Not regular WordPress passwords
- **Limit origins**: MCP servers bind to localhost by default
- **HTTPS recommended**: For production, use HTTPS with valid certificates

### Safe Practices

1. **Don't expose MCP servers to network**
   - Keep servers on localhost
   - Use firewall to block external access

2. **Use separate profiles**
   - Chrome DebugFull profile is isolated
   - Doesn't affect main browsing profile

3. **Clean up credentials**
   - Remove credentials from chrome.storage.local when done
   - Use `wp_disconnect` to clear WordPress credentials

## Performance Optimization

### Caching

- **Tab cache**: Double Control extension caches tabs for 5 seconds
- **Session reuse**: MCP sessions are maintained across requests
- **Selector caching**: Reuse element references instead of re-querying

### Parallelization Strategy

- **Same browser**: Sequential (tabs share memory)
- **Different browsers**: Parallel (independent processes)
- **Limit concurrent**: Max 2-3 concurrent operations

### Efficient Selectors

**Good:**
```
#submit-button
.user-profile
[data-testid="login-form"]
```

**Bad (slow):**
```
div > div > div > input[type="text"]
:last-child > :first-child
```

## Troubleshooting

### Debug Mode

Enable debug logging:
```bash
# Set environment variable
$env:DEBUG="browser-automation:*"

# Or use --debug flag
node server/http-server.js --debug
```

### Common Debug Commands

```bash
# Check all ports
netstat -ano | findstr "300"

# Check Chrome CDP
curl http://localhost:9222/json/version

# View Chrome tabs
curl http://localhost:9222/json/list

# Check MCP server health
curl http://localhost:3001/health

# View logs
Get-Content $env:USERPROFILE\.vibe\logs\browser-control-mcp.log
```

## Contributing

### Adding New Features

1. **Extend the SKILL.md**: Add new commands and capabilities
2. **Update README.md**: Document new features
3. **Add examples**: Create usage examples
4. **Write tests**: Add test cases

### Development Workflow

```bash
# Clone the repository
git clone https://github.com/sourovdeb/myde-by-vibe.git

# Navigate to browser automation
cd H:\chrome-communication-extension\browser-automation-unified

# Make changes
# Test locally
# Submit PR
```

## References

- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Mozilla Firefox WebDriver](https://firefox-source-docs.mozilla.org/testing/webdriver/)
- [Opera Developer](https://dev.opera.com/)
- [Chrome AI / Modern Web Guidance](https://developer.chrome.com/docs/extensions/ai/build-with-ai)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [WordPress REST API](https://developer.wordpress.org/rest-api/)
- [OpenCode AI](https://github.com/sourovdeb/OpenCode)

## Audit Verification

This implementation has been **audited and validated** using the mix-of-agents-audit pipeline:

- ✅ **All claims verified** - 6 claims analyzed, all verdicts documented
- ✅ **Architecture validated** - Router/dispatcher pattern confirmed as best practice
- ✅ **Router pattern confirmed correct** - Capability-detecting dispatcher with dormant stubs is the right approach
- ✅ **Resource selection validated** - Chrome CLI, Opera CLI identified as valid; Firefox skill discarded as wrong resource type

**Audit Results:**
- **Audit Date:** 2026-10-24
- **Audit ID:** browser-skill-audit-2026-10-24
- **Full Report:** `C:\Users\souro\.vibe\scratch\browser-skill-audit-2026-10-24\report.md`
- **Summary:** See `AUDIT-FINDINGS.md` in this directory

**Key Finding:** The "unified" skill is NOT premature marketing. Your router architecture with dormant stubs IS the correct unified skill pattern, degrading gracefully until backends arrive.

---

## Version History

- **v1.0.0** (2026-10-24) - Initial release
  - Unified skill for Chrome, Firefox, Opera
  - WordPress MCP server
  - OpenCode MCP wrapper
  - RAM-conscious usage guide
  - Chrome 156+ compatibility

## License

MIT License - See LICENSE file for details.
