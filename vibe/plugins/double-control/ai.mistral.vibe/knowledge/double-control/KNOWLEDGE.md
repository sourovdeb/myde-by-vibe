---
name: double-control
description: Complete guide to the Double Control Chrome automation system - browser-harness MCP + Chrome Extension for seamless tab management and browser automation.
display_name: Double Control System
yaml_compatible: true
---

# Double Control System - Complete Guide

## Overview

**Double Control** provides two simultaneous, complementary ways to control Chrome:

1. **browser-harness MCP** (External) - Chrome DevTools Protocol control via MCP server
2. **Double Control Extension** (In-Browser) - Chrome Extension with visual UI and external messaging

Both systems can see and control Chrome **simultaneously**, giving you maximum flexibility.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Chrome Browser                            │
│  ┌─────────────────┐  ┌─────────────────────────────────┐  │
│  │  CDP Interface   │  │  Double Control Extension        │  │
│  │  (DevTools)      │  │  - Service Worker (background.js) │  │
│  │                 │  │  - Popup UI (popup.html)          │  │
│  │  port 9222+      │  │  - Icons                          │  │
│  └────────┬────────┘  └─────────────┬───────────────────┘  │
└───────────┼────────────────────────────┼────────────────────┘
            │                                │
            ▼                                ▼
┌─────────────────────────┐    ┌─────────────────────────┐
│  browser-harness-mcp.exe │    │  Chrome Extension API     │
│  (MCP Server)            │    │  (onConnectExternal)      │
│                         │    │                          │
│  - list_tabs()          │    │  - chrome.tabs.query()    │
│  - new_tab()            │    │  - chrome.tabs.create()   │
│  - switch_tab()          │    │  - chrome.tabs.update()   │
│  - close_tab()          │    │  - chrome.tabs.remove()   │
│  - capture_screenshot()  │    │                          │
│  - click()              │    │                          │
│  - type()               │    │                          │
│  - page_info()          │    │                          │
└─────────────────────────┘    └─────────────────────────┘
            │                                │
            ▼                                ▼
┌─────────────────────────────────────────────────────────────┐
│                    Vibe / MCP Client                          │
│  - tools.browser_harness.* (23 tools)                        │
│  - browser-double-control skill                              │
│  - double-control plugin                                     │
└─────────────────────────────────────────────────────────────┘
```

## Installation

### Prerequisites

- Chrome browser (155.x tested)
- Git Bash (for browser-harness CLI)
- Python 3.12+ (for browser-harness)
- Vibe CLI (for MCP integration)

### Component Locations

| Component | Location | Status |
|-----------|----------|--------|
| Extension Files | `H:\chrome-communication-extension\` | ✅ Installed |
| browser-harness | `E:\tools\uv-tools\bin\browser-harness.exe` | ✅ Installed |
| browser-harness-mcp | `E:\tools\uv-tools\bin\browser-harness-mcp.exe` | ✅ Installed |
| Vibe Plugin | `C:\Users\souro\.vibe\plugins\double-control\` | ✅ Created |
| Vibe Config | `C:\Users\souro\.vibe\config.toml` | ✅ Configured |

### Chrome Extension Installation

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked**
5. Select folder: `H:\chrome-communication-extension`
6. Click **Select Folder**
7. Extension icon (🎛️) appears in toolbar

### MCP Server Configuration

Already configured in `C:\Users\souro\.vibe\config.toml`:

```toml
[[mcp_servers]]
name = "browser-harness"
transport = "stdio"
command = "E:\\tools\\uv-tools\\bin\\browser-harness-mcp.exe"
args = []
startup_timeout_sec = 60.0
tool_timeout_sec = 300.0
prompt = "Control the user's real Chrome via browser-harness CDP daemon"
```

## Usage

### Via browser-harness CLI

```bash
# Check status
browser-harness doctor

# List tabs
browser-harness <<'PY'
for tab in list_tabs():
    print(tab['title'], tab['url'])
PY

# Open tab
browser-harness <<'PY'
new_tab("https://github.com")
PY

# Screenshot
browser-harness <<'PY'
capture_screenshot("screenshot.png")
PY
```

### Via MCP Tools (Vibe/TypeScript)

```typescript
// List tabs
const tabs = await tools.browser_harness.list_tabs();

// Open tab
await tools.browser_harness.new_tab({ url: "https://example.com" });

// Switch tab
await tools.browser_harness.switch_tab({ target_id: tabs[0].target_id });

// Screenshot
await tools.browser_harness.capture_screenshot({ path: "H:/screenshot.png" });
```

### Via Chrome Extension UI

1. Click 🎛️ icon in Chrome toolbar
2. View list of all open tabs
3. Click any tab to switch to it
4. Click "Refresh Tabs" to update the list

## Features

### browser-harness MCP Tools (23 total)

#### Tab Management
- `list_tabs()` - Get all open tabs with metadata
- `new_tab(url)` - Open a new tab
- `switch_tab(target_id)` - Switch to a specific tab
- `close_tab(tab_id)` - Close a tab

#### Page Interaction
- `page_info()` - Get current page URL, title, dimensions
- `click_at_xy(x, y)` - Click at specific coordinates
- `type_text(text)` - Type text into focused element
- `capture_screenshot(path, full, max_dim)` - Capture screenshot

#### Navigation
- `go_back()` - Navigate back
- `go_forward()` - Navigate forward
- `refresh()` - Refresh current page
- `navigate(url)` - Navigate to URL in current tab

#### Browser Control
- `doctor()` - Check system status
- `quit()` - Quit the browser

### Chrome Extension Features

#### Popup UI
- Real-time list of all tabs
- Tab titles and URLs displayed
- Active tab highlighted
- Click to switch to any tab
- Auto-refresh every 2 seconds

#### External Messaging
The extension supports external communication via `chrome.runtime.onConnectExternal`:

```javascript
// From external tool
const port = chrome.runtime.connect("ohbmojhpccmbpidkjldonhdnekgpcplb");

// Send message
port.postMessage({ 
  type: "get_tabs" 
});

// Receive response
port.onMessage.addListener((msg) => {
  if (msg.type === "tabs") {
    console.log("Tabs:", msg.tabs);
  }
});

// Open tab
port.postMessage({ 
  type: "open_tab",
  url: "https://example.com"
});

// Switch tab
port.postMessage({ 
  type: "switch_tab",
  tabId: 123
});

// Close tab
port.postMessage({ 
  type: "close_tab",
  tabId: 123
});
```

## Known Issues & Fixes

### PowerShell BOM Issue
**Problem:** Piping heredocs into `browser-harness` injects a BOM (U+FEFF) and Python fails.

**Fix:** Write script with `[IO.File]::WriteAllText()` then use `cmd /c 'type script.py | browser-harness'`

### Screenshot on chrome:// Pages
**Problem:** `capture_screenshot()` fails on `chrome://` pages (Chrome restriction)

**Fix:** Works on normal HTTP/HTTPS pages only

### Real Executable Path
**Problem:** Executables are at `E:\tools\uv-tools\bin\`, not `C:\Users\souro\.local\bin`

**Status:** ✅ Corrected in configuration

### screenshot() vs capture_screenshot()
**Problem:** v0.1.13 uses `capture_screenshot()`, not `screenshot()`

**Status:** ✅ Documented in INSTALLATION_GUIDE.md

## Examples

### Example 1: Research Workflow

```python
# Open research URLs
urls = [
    "https://en.wikipedia.org/wiki/Artificial_intelligence",
    "https://arxiv.org/list/cs.AI/recent",
    "https://github.com/trending"
]

for url in urls:
    tools.browser_harness.new_tab(url=url)
    time.sleep(1)

# Screenshot each
tabs = tools.browser_harness.list_tabs()
for i, tab in enumerate(tabs):
    tools.browser_harness.switch_tab(target_id=tab['target_id'])
    time.sleep(1)
    tools.browser_harness.capture_screenshot(path=f"H:/research/screenshot_{i}.png")
```

### Example 2: Tab Organization

```python
# Get all tabs
tabs = tools.browser_harness.list_tabs()

# Close duplicate tabs
urls_seen = set()
for tab in tabs:
    if tab['url'] in urls_seen:
        tools.browser_harness.close_tab(tab_id=tab['target_id'])
    else:
        urls_seen.add(tab['url'])
```

### Example 3: Automated Form Filling

```python
# Navigate to form
tools.browser_harness.new_tab(url="https://example.com/form")
time.sleep(2)

# Click and type
tools.browser_harness.click_at_xy(x=100, y=200)  # Click name field
tools.browser_harness.type_text("John Doe")

tools.browser_harness.click_at_xy(x=100, y=250)  # Click email field
tools.browser_harness.type_text("john@example.com")

# Screenshot result
tools.browser_harness.capture_screenshot(path="form_filled.png")
```

### Example 4: Combined Control

```python
# Use browser-harness for automation
tools.browser_harness.new_tab(url="https://github.com")

# Use extension for manual verification
# User clicks 🎛️ icon and visually confirms tab is open

# Continue automation
tools.browser_harness.switch_tab(target_id=first_tab['target_id'])
```

## Performance Tips

1. **Add delays after navigation**: `time.sleep(1-2)` after `new_tab()` or `navigate()`
2. **Use target_id, not index**: Tab order changes; target_id is stable
3. **Cache tab lists**: Call `list_tabs()` once and reuse the data
4. **Batch operations**: Group related operations to minimize context switches
5. **Error handling**: Wrap in try/except with fallback to extension UI

## Security

- ✅ browser-harness uses real Chrome profile (logged-in sessions preserved)
- ✅ Extension has minimal permissions (tabs, storage, scripting, activeTab)
- ✅ External messaging requires explicit connection
- ✅ No data sent to external servers (all local)

## Troubleshooting

### browser-harness not connecting

1. **Check Chrome is running**: `browser-harness doctor`
2. **Check CDP**: Chrome must have remote debugging enabled
3. **Restart daemon**: Close Chrome, restart, then run `browser-harness doctor`

### Extension not loading

1. **Check Dev mode**: Must be enabled at `chrome://extensions/`
2. **Check manifest**: Verify `manifest.json` is valid
3. **Check console**: `chrome://extensions/` > Inspect views > Console
4. **Reload**: Click refresh icon on extension card

### MCP server not responding

1. **Check config**: Verify `config.toml` has correct path
2. **Check executable**: Verify `E:\tools\uv-tools\bin\browser-harness-mcp.exe` exists
3. **Restart Vibe**: Run `/reload` or restart Vibe CLI

### Commands not working

1. **Check permissions**: Extension needs tabs, storage, scripting, activeTab
2. **Check focus**: Ensure Chrome window is focused
3. **Check active tab**: Use `page_info()` to verify current tab

## File Structure

```
H:\chrome-communication-extension\
├── manifest.json          # Extension manifest v3
├── background.js          # Service worker (tab tracking)
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── test_double_control.bat # Test script
└── INSTALLATION_GUIDE.md  # Installation guide

C:\Users\souro\.vibe\plugins\double-control\
├── plugin.json           # Plugin manifest
├── mcp.json              # MCP server config
└── skills/
    └── browser-double-control/
        └── SKILL.md       # Integration skill
```

## Repository

- Local: `H:\chrome-communication-extension` (git repo)
- Remote: `https://github.com/sourovdeb/chrome-communication-extension` (to be created)
- Status: 2 commits ready to push

### Git Commands

```bash
cd /h/chrome-communication-extension
git add .
git commit -m "Your message"
git push origin master
```

## Related Projects

- **Smart-Browser**: Portable Electron automation shell (https://github.com/sourovdeb/Smart-Browser)
- **browser-bot**: Python + Playwright + Ollama automation (https://github.com/sourovdeb/browser-bot)
- **browser-harness**: CDP automation tool (https://github.com modelcontextprotocol/browser-harness)

## Version History

- **v0.1.0** (2026-10-19): Initial Chrome extension with basic tab management
- **v0.1.1** (2026-10-19): Added external messaging, integrated with browser-harness MCP
