# Opera Automation Examples

## Basic Navigation

### Open a URL
```
/browser new_tab browser:opera url:https://sourovdeb.com
```

### Navigate to a page
```
/browser navigate browser:opera url:https://sourovdeb.com/about
```

### Refresh the page
```
/browser refresh browser:opera
```

### Go back and forward
```
/browser go_back browser:opera
/browser go_forward browser:opera
```

## Tab Management

### List all tabs
```
/browser list_tabs browser:opera
```

### Switch to a specific tab
```
/browser switch_tab browser:opera tab_id:1
```

### Close a tab
```
/browser close_tab browser:opera tab_id:3
```

## Page Interaction

### Click an element
```
/browser click browser:opera selector:#submit-button
```

### Click at specific coordinates
```
/browser click_at_xy browser:opera x:100 y:200
```

### Type text into an element
```
/browser type browser:opera selector:#username text:myusername
```

### Clear an element
```
/browser clear browser:opera selector:#search-input
```

### Scroll the page
```
/browser scroll browser:opera direction:down pixels:500
```

## Data Extraction

### Get page information
```
/browser get_page_info browser:opera
```

### Get full page HTML
```
/browser get_dom browser:opera
```

### Get element text
```
/browser get_element_text browser:opera selector:h1
```

### Take a screenshot
```
/browser screenshot browser:opera path:opera-screenshot.png
```

## JavaScript Execution

### Execute simple code
```
/browser execute_js browser:opera code:"return document.title"
```

### Get all links on page
```
/browser execute_js browser:opera code:"return Array.from(document.querySelectorAll('a[href]')).map(a => ({text: a.textContent, href: a.href}))"
```

## Opera-Specific Examples

### Check Opera features
```
# Check if Opera
/browser execute_js browser:opera code:"return navigator.userAgent.includes('Opera') || navigator.userAgent.includes('OPR')"
```

### Use Opera's built-in features
```
# Opera has built-in ad blocker, VPN, battery saver
# These can be controlled via Opera's settings
```

## Real-World Workflows

### Login workflow
```
/browser navigate browser:opera url:https://example.com/login
/browser wait_for_element browser:opera selector:#username timeout:5000
/browser type browser:opera selector:#username text:myuser
/browser type browser:opera selector:#password text:mypassword
/browser click browser:opera selector:#login-button
/browser wait_for_navigation browser:opera timeout:10000
```

### Form submission
```
/browser navigate browser:opera url:https://example.com/contact
/browser wait_for_element browser:opera selector:#contact-form timeout:5000
/browser type browser:opera selector:#name text:John Doe
/browser type browser:opera selector:#email text:john@example.com
/browser type browser:opera selector:#message text:Hello
/browser click browser:opera selector:#submit-button
```

### Data scraping
```
/browser navigate browser:opera url:https://example.com/products
/browser wait_for_element browser:opera selector:.product timeout:5000
/browser execute_js browser:opera code:"
  return Array.from(document.querySelectorAll('.product')).map(p => ({
    name: p.querySelector('.name').textContent,
    price: p.querySelector('.price').textContent
  }))
"
```

### Tab management
```
# Open multiple tabs
/browser new_tab browser:opera url:https://google.com
/browser new_tab browser:opera url:https://github.com
/browser new_tab browser:opera url:https://sourovdeb.com

# List all tabs
/browser list_tabs browser:opera

# Switch between tabs
/browser switch_tab browser:opera tab_id:2
/browser switch_tab browser:opera tab_id:3

# Close tabs
/browser close_tab browser:opera tab_id:1
/browser close_tab browser:opera tab_id:2
```

## Setup Instructions

### Prerequisites

1. **Install Opera**
   - Download from [opera.com](https://www.opera.com/)
   - Install Opera Neon or Opera GX

2. **Start Opera MCP server**
   ```powershell
   cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera
   node server/http-server.js
   ```

### Verify Setup

```bash
# Check Opera MCP server
curl http://localhost:3002/health

# List Opera tabs
/browser list_tabs browser:opera
```

## Opera-Specific Features

### Opera's CDP Implementation

Opera uses the same Chromium DevTools Protocol as Chrome, so most Chrome commands work:

```
# Get browser version
/browser execute_js browser:opera code:"return navigator.userAgent"

# Get screen dimensions
/browser execute_js browser:opera code:"return {width: window.screen.width, height: window.screen.height}"

# Check if dark mode
/browser execute_js browser:opera code:"return window.matchMedia('(prefers-color-scheme: dark)').matches"
```

### Opera Extensions

Opera supports Chrome extensions, so you can use the same extensions:

```
# Check installed extensions
/browser execute_js browser:opera code:"return Array.from(document.querySelectorAll('.extension-icon')).map(e => e.title)"
```

## Troubleshooting

### Opera not installed
```powershell
# Check if Opera is installed
Get-Command opera

# Or check program files
Test-Path "C:\Program Files\Opera\launcher.exe"
```

### Opera not starting
```powershell
# Try starting Opera manually
Start-Process 'C:\Program Files\Opera\launcher.exe'

# Check if it's running
Get-Process opera
```

### CDP not connecting
```powershell
# Make sure Opera is started with debugging
Start-Process 'C:\Program Files\Opera\launcher.exe' -ArgumentList '--remote-debugging-port=9223'

# Check CDP endpoint
curl http://localhost:9223/json/version
```

### Port already in use
```powershell
# Find process using port
netstat -ano | findstr 9223

# Kill process
Stop-Process -Id PROCESS_ID -Force
```

## Performance Considerations

Opera generally uses less memory than Chrome:
- **Memory per instance**: 300MB - 1GB
- **Startup time**: Faster than Chrome
- **Compatibility**: Full Chrome extension support

### Memory comparison

| Browser | Memory Usage | Startup Time | Features |
|---------|--------------|--------------|----------|
| Chrome | High (500MB-2GB) | Medium | Full CDP |
| Firefox | Medium (400MB-1.5GB) | Medium | WebDriver |
| Opera | Low (300MB-1GB) | Fast | Full CDP |

### Recommendations

- Use Opera for **memory-constrained** operations
- Use Chrome for **full CDP feature set**
- Use Firefox for **web standards compliance**
- Combine browsers for **cross-browser testing**

## Cross-Browser Examples

### Run same action on all browsers
```
# Open URL in all browsers
/browser new_tab browser:chrome url:https://sourovdeb.com
/browser new_tab browser:firefox url:https://sourovdeb.com
/browser new_tab browser:opera url:https://sourovdeb.com

# Take screenshots from all browsers
/browser screenshot browser:chrome path:chrome-sourovdeb.png
/browser screenshot browser:firefox path:firefox-sourovdeb.png
/browser screenshot browser:opera path:opera-sourovdeb.png
```

### Compare page titles
```
# Get titles from all browsers
/browser get_page_info browser:chrome
SET chrome_title {result.title}

/browser get_page_info browser:firefox
SET firefox_title {result.title}

/browser get_page_info browser:opera
SET opera_title {result.title}

# Compare
IF chrome_title == firefox_title == opera_title
  ECHO All browsers show the same title
ELSE
  ECHO Titles differ across browsers
ENDIF
```
