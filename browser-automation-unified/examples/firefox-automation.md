# Firefox Automation Examples

## Basic Navigation

### Open a URL
```
/browser new_tab browser:firefox url:https://sourovdeb.com
```

### Navigate to a page
```
/browser navigate browser:firefox url:https://sourovdeb.com/about
```

### Refresh the page
```
/browser refresh browser:firefox
```

### Go back and forward
```
/browser go_back browser:firefox
/browser go_forward browser:firefox
```

## Tab Management

### List all tabs
```
/browser list_tabs browser:firefox
```

### Switch to a specific tab
```
/browser switch_tab browser:firefox tab_id:2
```

### Close a tab
```
/browser close_tab browser:firefox tab_id:4
```

## Page Interaction

### Click an element
```
/browser click browser:firefox selector:#submit-button
```

### Type text into an element
```
/browser type browser:firefox selector:#username text:myusername
```

### Clear an element
```
/browser clear browser:firefox selector:#search-input
```

### Scroll the page
```
/browser scroll browser:firefox direction:down pixels:500
```

## Data Extraction

### Get page information
```
/browser get_page_info browser:firefox
```

### Get full page HTML
```
/browser get_dom browser:firefox
```

### Get element text
```
/browser get_element_text browser:firefox selector:h1
```

### Take a screenshot
```
/browser screenshot browser:firefox path:firefox-screenshot.png
```

## JavaScript Execution

### Execute simple code
```
/browser execute_js browser:firefox code:"return document.title"
```

### Get all links on page
```
/browser execute_js browser:firefox code:"return Array.from(document.querySelectorAll('a[href]')).map(a => ({text: a.textContent, href: a.href}))"
```

## Firefox-Specific Examples

### Test Firefox-only features
```
# Check if Firefox
/browser execute_js browser:firefox code:"return navigator.userAgent.includes('Firefox')"
```

### Use Firefox preferences
```
# Get Firefox version
/browser execute_js browser:firefox code:"return navigator.userAgent"
```

## WebDriver-Specific Commands

### Get browser capabilities
```
/browser execute_js browser:firefox code:"return {browser: navigator.userAgent, platform: navigator.platform, cookiesEnabled: navigator.cookieEnabled}"
```

## Real-World Workflows

### Login workflow
```
/browser navigate browser:firefox url:https://example.com/login
/browser wait_for_element browser:firefox selector:#username timeout:5000
/browser type browser:firefox selector:#username text:myuser
/browser type browser:firefox selector:#password text:mypassword
/browser click browser:firefox selector:#login-button
/browser wait_for_navigation browser:firefox timeout:10000
```

### Form submission
```
/browser navigate browser:firefox url:https://example.com/contact
/browser wait_for_element browser:firefox selector:#contact-form timeout:5000
/browser type browser:firefox selector:#name text:John Doe
/browser type browser:firefox selector:#email text:john@example.com
/browser type browser:firefox selector:#message text:Hello
/browser click browser:firefox selector:#submit-button
```

### Data scraping
```
/browser navigate browser:firefox url:https://example.com/products
/browser wait_for_element browser:firefox selector:.product timeout:5000
/browser execute_js browser:firefox code:"
  return Array.from(document.querySelectorAll('.product')).map(p => ({
    name: p.querySelector('.name').textContent,
    price: p.querySelector('.price').textContent
  }))
"
```

## Setup Instructions

### Prerequisites

1. **Install Firefox**
   - Download from [mozilla.org](https://www.mozilla.org/firefox/)
   - Or use system package manager

2. **Install geckodriver**
   ```bash
   cd %USERPROFILE%\.vibe\plugins\browser-control-mcp-firefox
   npm install
   npm run install-geckodriver
   ```

3. **Start geckodriver**
   ```powershell
   geckodriver --port=4444
   ```

4. **Start Firefox MCP server**
   ```powershell
   cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox
   node server/http-server.js
   ```

### Verify Setup

```bash
# Check geckodriver is running
curl http://localhost:4444/status

# Check Firefox MCP server
curl http://localhost:3003/health

# List Firefox tabs
/browser list_tabs browser:firefox
```

## Troubleshooting

### geckodriver not found
```
# Install geckodriver
cd %USERPROFILE%\.vibe\plugins\browser-control-mcp-firefox
npm run install-geckodriver
```

### Firefox not in PATH
```powershell
# Find Firefox path
Get-Command firefox

# Or use full path
Start-Process 'C:\Program Files\Mozilla Firefox\firefox.exe'
```

### Port already in use
```powershell
# Find process using port
netstat -ano | findstr 4444

# Kill process
Stop-Process -Id PROCESS_ID -Force
```

### Connection refused
```
# Check if geckodriver is running
Get-Process geckodriver

# If not, start it
geckodriver --port=4444
```
