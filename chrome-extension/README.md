# Double Control Chrome Extension

This extension works alongside browser-harness to provide **double control** over Chrome:

1. **browser-harness**: External control via Chrome DevTools Protocol (CDP)
2. **This extension**: In-browser UI and additional APIs for enhanced control

## Features

- **Tab Management**: View, open, close, and switch between tabs
- **Page Interaction**: Execute JavaScript and get page information
- **External Communication**: Communicate with external tools via Chrome's extension API
- **Dual Control**: Works alongside browser-harness for complete Chrome automation

## Structure

```
chrome-communication-extension/
├── manifest.json          # Extension manifest (v3)
├── background.js          # Service worker for tab tracking and communication
├── popup.html            # Extension popup UI
├── popup.js              # Popup JavaScript
├── content.js            # Content script injected into pages
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── external_tool.js      # External Node.js tool (optional)
├── extension_bridge.py    # Python bridge for browser-harness
└── README.md             # This file
```

## Installation

### Method 1: Load Unpacked (Development)

1. Open Chrome and go to `chrome://extensions/`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `chrome-communication-extension` folder
5. The extension will be installed and active

### Method 2: Pack for Distribution

1. In `chrome://extensions/`, find the "Double Control Extension"
2. Click **Pack extension**
3. This will create a `.crx` file and `.pem` private key
4. Share the `.crx` file for installation

## Usage

### In Chrome

1. Click the extension icon in the toolbar
2. View all open tabs in the popup
3. Click any tab to switch to it
4. Click **Refresh Tabs** to update the list

### With browser-harness

The extension works alongside browser-harness:

```bash
# List tabs via browser-harness
browser-harness <<'PY'
print(list_tabs())
PY

# Open a new tab
browser-harness <<'PY'
new_tab("https://example.com")
print(page_info())
PY
```

### External Communication

The extension exposes an API for external tools:

```javascript
// Connect to the extension
const port = chrome.runtime.connect("YOUR_EXTENSION_ID");

// Send a message
port.postMessage({ type: "get_tabs" });

// Receive tabs
port.onMessage.addListener((msg) => {
  if (msg.type === "tabs") {
    console.log("Open tabs:", msg.tabs);
  }
});
```

## Double Control Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Chrome Browser                          │
│  ┌─────────────┐    ┌───────────────────────────────────┐  │
│  │  Extension   │    │           browser-harness           │  │
│  │  UI & API    │    │  CDP-based external control        │  │
│  │  (popup)     │    │  - Tab management                  │  │
│  │             │    │  - Page interaction                │  │
│  │  background  │    │  - JavaScript execution            │  │
│  │  service     │    │  - Screenshot capture              │  │
│  │  worker     │    │  - Navigation                      │  │
│  └─────────────┘    └───────────────────────────────────┘  │
│                                                             │
│              ┌─────────────────────────────────────┐        │
│              │        Double Control               │        │
│              │   - Complete Chrome automation      │        │
│              │   - External tool integration        │        │
│              └─────────────────────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                        │
                        ▼
              External Tools (Python, Node.js, etc.)
```

## API Reference

### Extension Messages

The extension supports the following message types:

- `get_tabs`: Get list of all open tabs
- `open_tab`: Open a new tab with specified URL
- `close_tab`: Close a tab by ID
- `switch_tab`: Switch to a specific tab

### browser-harness Integration

See [browser-harness documentation](https://github.com/browser-use/browser-harness) for full API.

## Permissions

The extension requires the following permissions:

- `tabs`: Access tab information and manage tabs
- `storage`: Store extension data
- `scripting`: Inject scripts into pages
- `activeTab`: Access the currently active tab
- `webRequest`: Monitor and modify web requests
- `<all_urls>`: Access all websites

## Building

The extension is ready to use as-is. No build process is required.

## Testing

1. Load the extension in Chrome
2. Open browser-harness
3. Run commands to verify both systems can see and control tabs

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License
