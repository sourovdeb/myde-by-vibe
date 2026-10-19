---
name: browser-double-control
description: Unified Chrome control via Double Control Extension + browser-harness MCP. List, open, switch, and manage tabs seamlessly using both in-browser and external CDP control. Supports screenshots, click, type, and tab management.
user-invocable: true
allowed-tools:
  - tools.connector_browser_harness.list_tabs
  - tools.connector_browser_harness.new_tab
  - tools.connector_browser_harness.switch_tab
  - tools.connector_browser_harness.close_tab
  - tools.connector_browser_harness.page_info
  - tools.connector_browser_harness.capture_screenshot
  - tools.connector_browser_harness.click_at_xy
  - tools.connector_browser_harness.type_text
  - tools.file_system.read_file
  - tools.file_system.write_file
  - tools.process.start
  - tools.process.stop
  - tools.process.list
---

# Double Control Chrome Integration

You have **two simultaneous control channels** over Chrome:

## Channel 1: browser-harness MCP (External CDP)
- Full Chrome DevTools Protocol access
- 23 tools available via `tools.browser_harness.*`
- Works via external process
- Can: open tabs, click, type, screenshot, switch tabs, list tabs, get page info

## Channel 2: Double Control Extension (In-Browser)
- Chrome Extension installed (ID: `ohbmojhpccmbpidkjldonhdnekgpcplb`)
- Popup UI showing all tabs
- Click to switch tabs
- Auto-refresh every 2 seconds
- External messaging enabled for programmatic control

## Quick Commands

### List all tabs
```python
tools.browser_harness.list_tabs()
```

### Open a new tab
```python
tools.browser_harness.new_tab(url="https://example.com")
```

### Switch to a tab
```python
tabs = tools.browser_harness.list_tabs()
tools.browser_harness.switch_tab(target_id=tabs[0]['target_id'])
```

### Take a screenshot
```python
tools.browser_harness.capture_screenshot(path="H:/screenshot.png")
```

### Get current page info
```python
tools.browser_harness.page_info()
```

## Workflow Integration

### Research workflow
```python
# Open research URL
tools.browser_harness.new_tab(url="https://research-site.com")

# Navigate and extract
tabs = tools.browser_harness.list_tabs()
for tab in tabs:
    tools.browser_harness.switch_tab(target_id=tab['target_id'])
    info = tools.browser_harness.page_info()
    # Process page...
```

### Batch operations
```python
# Open multiple tabs
urls = ["https://site1.com", "https://site2.com"]
for url in urls:
    tools.browser_harness.new_tab(url=url)

# Screenshot all
tabs = tools.browser_harness.list_tabs()
for i, tab in enumerate(tabs):
    tools.browser_harness.switch_tab(target_id=tab['target_id'])
    tools.browser_harness.capture_screenshot(path=f"H:/screenshots/tab_{i}.png")
```

## Extension Integration

The Chrome Extension provides:
- Visual tab list with click-to-switch
- Auto-refreshing tab status
- External messaging for programmatic control

To use the extension:
1. Click the extension icon in Chrome toolbar (🎛️ icon)
2. View list of all tabs
3. Click any tab to switch to it
4. Click "Refresh Tabs" to update the list

## Available Tools

| Tool | Description |
|------|-------------|
| `list_tabs` | Get list of all open tabs |
| `new_tab` | Open a new tab |
| `switch_tab` | Switch to a specific tab |
| `close_tab` | Close a tab |
| `page_info` | Get current page information |
| `capture_screenshot` | Take a screenshot |
| `click_at_xy` | Click at specific coordinates |
| `type_text` | Type text into focused element |

## Pro Tips

1. **Always check active tab**: Use `page_info()` to verify you're on the right tab
2. **Use target_id, not index**: Tab indices change; use `target_id` for reliability
3. **Screenshot timing**: Add `time.sleep(1)` after navigation before screenshotting
4. **Extension popup**: Open via Chrome toolbar for visual tab management
5. **Combined control**: Use both MCP for automation + extension for manual control

## Error Handling

```python
import time

try:
    tools.browser_harness.new_tab(url="https://example.com")
    time.sleep(2)  # Wait for page load
    tabs = tools.browser_harness.list_tabs()
    print(f"Success: {len(tabs)} tabs open")
except Exception as e:
    print(f"Error: {e}")
    # Fallback to extension UI
```
