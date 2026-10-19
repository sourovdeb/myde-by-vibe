# Double Control Extension - Installation Guide

> **Status 2026-10-19 (verified live):** browser-harness v0.1.13 connected to the real
> Chrome profile and listed its tabs; MCP server (`browser-harness-mcp`) passed an
> initialize + tools/list smoke test (23 tools) and is registered in Vibe
> (`C:\Users\souro\.vibe\config.toml`, backup: `config.toml.bak-before-browser-harness-mcp`);
> browser-harness SKILL.md registered for OpenCode (`E:\apps\opencode\config\skills\browser-harness\`)
> and Vibe (`C:\Users\souro\.vibe\skills\skills\browser-harness\`); recordings: ON (user consented).

## Overview

This extension provides **double control** over Chrome:
1. **browser-harness**: External control via Chrome DevTools Protocol (CDP)
2. **Chrome Extension**: In-browser UI and API for enhanced control

## Verified environment facts

- Executables live at `E:\tools\uv-tools\bin\browser-harness.exe` and `browser-harness-mcp.exe`
  (uv tool, Python 3.12). NOT `C:\Users\souro\.local\bin`.
- Chrome is 155.x. Remote debugging is enabled via `chrome://inspect/#remote-debugging`
  checkbox ("Allow remote debugging for this browser instance") + clicking **Allow** on the
  first connection. `--remote-debugging-port` is ignored on the default profile since Chrome 136.
- **PowerShell gotcha:** piping heredocs into `browser-harness` injects a BOM (U+FEFF) and
  Python fails. Workaround: write the script with `[IO.File]::WriteAllText(...)` then
  `cmd /c 'type script.py | browser-harness'`.
- `screenshot()` fails on `chrome://` pages (Chrome restriction, not a bug). Works on normal pages.
- Attached tabs get a 🐴 marker in the title (disable with `BH_TAB_MARKER=0`).

## What You Get

- **browser-harness** (already installed): Control Chrome from external tools
- **Chrome Extension**: Popup UI showing all tabs, ability to click and switch
- **Dual Control**: Both systems can see and control Chrome simultaneously

## Installation

### Step 1: Chrome Extension

1. Open Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top right corner)
4. Click **Load unpacked**
5. Navigate to and select the folder: `H:\chrome-communication-extension`
6. Click **Select Folder**

The extension icon will appear in your Chrome toolbar.

### Step 2: Verify browser-harness

browser-harness is already installed. Verify it works:

```bash
# Check if daemon is running
browser-harness doctor

# List current tabs
browser-harness <<'PY'
print(list_tabs())
PY
```

### Step 3: Test Double Control

1. **Via Chrome Extension**:
   - Click the extension icon in Chrome toolbar
   - You'll see a list of all open tabs
   - Click any tab to switch to it
   - Click "Refresh Tabs" to update the list

2. **Via browser-harness**:
   ```bash
   # Open a new tab
   browser-harness <<'PY'
   new_tab("https://github.com")
   print(page_info())
   PY
   
   # List all tabs
   browser-harness <<'PY'
   for tab in list_tabs():
       print(tab['title'], tab['url'])
   PY
   
   # Switch to a tab
   browser-harness <<'PY'
   tabs = list_tabs()
   if tabs:
       switch_tab(tabs[0]['target_id'])
       print(page_info())
   PY
   ```

## File Structure

```
chrome-communication-extension/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service worker (tab tracking)
├── popup.html            # Extension popup UI
├── popup.js              # Popup JavaScript
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── test_double_control.bat # Test script
└── INSTALLATION_GUIDE.md  # This file
```

## API Reference

### browser-harness Functions (External Control)

- `list_tabs()`: Get list of all open tabs
- `new_tab(url)`: Open a new tab
- `switch_tab(target_id)`: Switch to a specific tab
- `close_tab(tab_id)`: Close a tab
- `page_info()`: Get current page information
- `click_at_xy(x, y)`: Click at specific coordinates
- `type_text(text)`: Type text into focused element
- `capture_screenshot(path=None, full=False, max_dim=None)`: Take a screenshot
  (NOTE: plain `screenshot()` does NOT exist in v0.1.13 — corrected 2026-10-19)

### Extension API (In-browser Control)

The extension popup provides:
- Real-time list of all tabs
- Click to switch tabs
- Auto-refresh every 2 seconds

### External Communication

The extension can communicate with external tools via `chrome.runtime.onConnectExternal`:

```javascript
// From external tool
const port = chrome.runtime.connect("extension_id");
port.postMessage({ type: "get_tabs" });
port.onMessage.addListener((msg) => {
  if (msg.type === "tabs") {
    console.log(msg.tabs);
  }
});
```

## Troubleshooting

### Chrome not responding
- Make sure Chrome is running with remote debugging: `--remote-debugging-port=9222`
- Restart Chrome and try again

### Extension not loading
- Check Chrome's console for errors: `chrome://extensions/` > Inspect views > Console
- Verify manifest.json is valid
- Ensure all required permissions are declared

### browser-harness not connecting
- Run `browser-harness doctor` to diagnose
- Check that Chrome is running with CDP enabled
- Verify the daemon is running

## Usage Examples

### Example 1: Open multiple tabs
```bash
browser-harness <<'PY'
urls = [
    "https://github.com",
    "https://example.com",
    "https://chromium.org"
]
for url in urls:
    new_tab(url)
    time.sleep(0.5)
print("Opened", len(urls), "tabs")
PY
```

### Example 2: Get all tab titles
```bash
browser-harness <<'PY'
tabs = list_tabs()
for i, tab in enumerate(tabs, 1):
    print(f"{i}. {tab['title']}")
PY
```

### Example 3: Screenshot current page
```bash
browser-harness <<'PY'
import os
screenshot("screenshot.png")
print("Screenshot saved")
PY
```

## Next Steps

1. Test both browser-harness and the extension
2. Explore the available functions
3. Integrate with your automation workflows
4. Customize the extension for your needs

## Repository

To upload to GitHub:

```bash
cd H:\chrome-communication-extension
git remote add origin https://github.com/sourovdeb/chrome-communication-extension.git
git push -u origin master
```

Or create the repository manually on GitHub and then push.
