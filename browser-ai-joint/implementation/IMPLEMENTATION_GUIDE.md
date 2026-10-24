# Browser Automation Unified - Implementation Guide

## Overview

This guide walks you through implementing the complete browser automation system with Chrome, Firefox, Opera, WordPress, and OpenCode integration.

## Prerequisites

### System Requirements
- Windows 10/11 (tested on Windows 10 22H2)
- Node.js v18+ (recommended v20+)
- PowerShell 5.1+
- At least 4GB free RAM (8GB+ recommended)
- Chrome, Firefox, Opera browsers installed

### Software Dependencies
```bash
# Install Node.js from https://nodejs.org/
# Then install global tools
npm install -g pm2
npm install -g nodemon
```

## Installation

### 1. Clone or Navigate to Project
```powershell
cd H:\chrome-communication-extension\browser-automation-unified
```

### 2. Install MCP Server Dependencies

#### Browser Control MCP (Chrome)
```powershell
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp
npm install
```

#### Browser Control MCP (Firefox)
```powershell
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox
npm install
npm run install-geckodriver
```

#### Browser Control MCP (Opera)
```powershell
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera
npm install
```

#### WordPress MCP Server
```powershell
cd $env:USERPROFILE\chrome-communication-extension
npm install express axios body-parser cors minimist
```

#### OpenCode MCP Wrapper
```powershell
cd $env:USERPROFILE\chrome-communication-extension\mcp-wrappers
npm install express axios body-parser cors minimist
```

### 3. Verify Installation
```powershell
# Check Node.js
node --version
# Should be v18+ or v20+

# Check npm
npm --version

# Check if geckodriver is installed
geckodriver --version
```

## Setup Chrome DebugFull Profile (Chrome 156+)

Chrome 156+ blocks `--remote-debugging-port` on the default profile. We need to create a separate profile.

### Step 1: Create DebugFull Profile
```powershell
# Run the setup script
cd H:\chrome-communication-extension\browser-automation-unified\scripts
.\chrome-debug.ps1
```

Or manually:
```powershell
$Source = "C:\Users\souro\AppData\Local\Google\Chrome\User Data\Default"
$Destination = "C:\Users\souro\AppData\Local\Google\Chrome\DebugFull"

# Copy the default profile
Copy-Item -Path $Source -Destination $Destination -Recurse -Force
```

### Step 2: Verify Profile
```powershell
Test-Path "C:\Users\souro\AppData\Local\Google\Chrome\DebugFull"
```

### Step 3: Test Chrome with DebugFull
```powershell
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' \
  -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'

# Check if CDP is working
Start-Sleep -Seconds 5
curl http://localhost:9222/json/version
```

## Start All Services

### Option 1: Use PowerShell Script
```powershell
cd H:\chrome-communication-extension\browser-automation-unified\scripts
.\start-servers.ps1 --all
```

This will:
1. Start all MCP servers (Chrome, Firefox, Opera, WordPress, Opencode)
2. Start geckodriver for Firefox
3. Start Chrome with debugging (port 9222)
4. Start Opera with debugging (port 9223)

### Option 2: Manual Start

#### Start MCP Servers
```powershell
# Chrome MCP (port 3001)
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp
Start-Process node -ArgumentList "server/http-server.js" -WindowStyle Hidden

# Firefox MCP (port 3003) + geckodriver
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox
Start-Process geckodriver -ArgumentList "--port=4444" -WindowStyle Hidden
Start-Process node -ArgumentList "server/http-server.js" -WindowStyle Hidden

# Opera MCP (port 3002)
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera
Start-Process node -ArgumentList "server/http-server.js" -WindowStyle Hidden

# WordPress MCP (port 3008)
cd $env:USERPROFILE\chrome-communication-extension
Start-Process node -ArgumentList "wordpress-mcp-server.js --port 3008" -WindowStyle Hidden

# Opencode MCP (port 3004)
cd $env:USERPROFILE\chrome-communication-extension\mcp-wrappers
Start-Process node -ArgumentList "opencode-mcp-server.js --port 3004" -WindowStyle Hidden
```

#### Start Browsers
```powershell
# Chrome with DebugFull (port 9222)
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' \
  -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'

# Opera (port 9223)
Start-Process 'C:\Program Files\Opera\launcher.exe' \
  -ArgumentList '--remote-debugging-port=9223'

# Firefox (connects to geckodriver on port 4444)
Start-Process 'C:\Program Files\Mozilla Firefox\firefox.exe'
```

### Option 3: Use PM2 for Process Management
```powershell
# Install PM2
npm install -g pm2

# Start all services with PM2
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp
pm2 start server/http-server.js --name browser-control-chrome -- --port 3001

cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox
pm2 start server/http-server.js --name browser-control-firefox -- --port 3003
pm2 start "geckodriver --port=4444" --name geckodriver

cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera
pm2 start server/http-server.js --name browser-control-opera -- --port 3002

cd $env:USERPROFILE\chrome-communication-extension
pm2 start wordpress-mcp-server.js --name wordpress-mcp -- --port 3008

cd $env:USERPROFILE\chrome-communication-extension\mcp-wrappers
pm2 start opencode-mcp-server.js --name opencode-mcp -- --port 3004

# List all running processes
pm2 list

# Stop all processes
pm2 kill
```

## Verify Everything is Running

### Check Health
```powershell
cd H:\chrome-communication-extension\browser-automation-unified\scripts
.\health-check.ps1 --verbose
```

Or manually:
```bash
# MCP Servers
curl http://localhost:3001/health
curl http://localhost:3002/health
curl http://localhost:3003/health
curl http://localhost:3004/health
curl http://localhost:3008/health

# Chrome CDP
curl http://localhost:9222/json/version

# Opera CDP
curl http://localhost:9223/json/version
```

### Expected Output
```
Port 3001: HEALTHY - OK
Port 3002: HEALTHY - OK
Port 3003: HEALTHY - OK
Port 3004: HEALTHY - OK
Port 3008: HEALTHY - OK
Port 9222: HEALTHY - OK (Chrome CDP)
Port 9223: HEALTHY - OK (Opera CDP)
```

## Configure Double Control Extension

### 1. Load the Extension

The extension is already loaded as an unpacked extension. To verify:
1. Open Chrome
2. Go to `chrome://extensions/`
3. Ensure "Double Control - MCP Enhanced" is enabled

### 2. Set Mistral API Key (Optional)

For embeddings functionality:
1. Open the extension popup
2. In the "Keys" section, paste your Mistral API key
3. Click "Save"

### 3. Set WordPress Credentials

1. Open the extension popup
2. In the "WordPress credentials" section:
   - Site URL: `https://sourovdeb.com`
   - Username: (optional, for display)
   - Application password: (from WordPress)
3. Click "Save"

### 4. Check MCP Server Status

1. Open the extension popup
2. Click "Check /health" in the MCP servers section
3. All servers should show green ● up status

## Test Browser Automation

### Basic Tests

```
# List tabs in Chrome
/browser list_tabs browser:chrome

# Open a URL in Firefox
/browser new_tab browser:firefox url:https://sourovdeb.com

# Take screenshot in Opera
/browser screenshot browser:opera path:test-opera.png

# Execute JS in Chrome
/browser execute_js browser:chrome code:"return document.title"
```

### Cross-Browser Test

```
# Open same URL in all browsers
/browser new_tab browser:chrome url:https://google.com
/browser new_tab browser:firefox url:https://google.com
/browser new_tab browser:opera url:https://google.com

# Verify all tabs are open
/browser list_tabs browser:chrome
/browser list_tabs browser:firefox
/browser list_tabs browser:opera
```

## WordPress Integration

### 1. Generate Application Password

1. Log in to WordPress admin
2. Go to `/wp-admin/profile.php`
3. Scroll to "Application Passwords" section
4. Click "Add New"
5. Enter a name (e.g., "MCP Server")
6. Click "Add New Application Password"
7. **Copy the generated password** (it won't be shown again)

### 2. Store in Extension

As shown above in the Double Control Extension setup.

### 3. Test WordPress MCP

```
# Connect to WordPress
/wp wp_connect site:https://sourovdeb.com password:YOUR_APP_PASSWORD

# Check connection
/wp wp_check_credentials

# List posts
/wp wp_list_posts per_page:5

# Create a test post
/wp wp_create_post \
  title:"Test Post from MCP" \
  content:"<p>This is a test post created via MCP.</p>" \
  status:"draft"
```

### 4. Test in Browser

```
# Navigate to WordPress admin
/browser new_tab browser:chrome url:https://sourovdeb.com/wp-admin

# Login (if needed)
/browser wait_for_element browser:chrome selector:#user_login timeout:5000
/browser type browser:chrome selector:#user_login text:admin
/browser type browser:chrome selector:#user_pass text:YOUR_APP_PASSWORD
/browser click browser:chrome selector:#wp-submit

# Navigate to posts
/browser navigate browser:chrome url:https://sourovdeb.com/wp-admin/edit.php
/browser wait_for_navigation browser:chrome timeout:5000

# Verify test post exists
/browser execute_js browser:chrome code:"return Array.from(document.querySelectorAll('.row-title')).filter(t => t.textContent.includes('Test Post from MCP')).length > 0"
```

## OpenCode Integration

### 1. Start OpenCode Server

OpenCode needs to be running on port 3005 (default).

```powershell
# If OpenCode is not running, start it
# (Assuming OpenCode is installed and configured)
```

### 2. Test OpenCode MCP

```
# Check health
/opencode opencode_health

# Generate code
/opencode opencode_generate \
  prompt:"Create a Python function to calculate factorial" \
  language:"python"

# Explain code
/opencode opencode_explain \
  code:"function factorial(n) { return n <= 1 ? 1 : n * factorial(n - 1); }" \
  language:"javascript"
```

## RAM Management

### Check Free RAM

```powershell
Get-CimInstance Win32_OperatingSystem | Select-Object FreePhysicalMemory,TotalVisibleMemorySize
```

### Memory Usage Guidelines

| Task | Recommended Free RAM |
|------|---------------------|
| Single browser | 2GB |
| Two browsers | 3GB |
| Three browsers | 4GB+ |
| Cross-browser testing | 4GB+ |

### Clean Up Resources

```powershell
# Close all Chrome instances
Get-Process chrome | Stop-Process -Force

# Close all geckodriver instances
Get-Process geckodriver | Stop-Process -Force

# Close all Node.js servers
Get-Process node | Stop-Process -Force

# Or use PM2
pm2 kill
```

### Restart Services

If you encounter issues, restart services:
```powershell
cd H:\chrome-communication-extension\browser-automation-unified\scripts
.\chrome-debug.ps1 --stop
.\start-servers.ps1 --all
```

## Troubleshooting

### Common Issues

#### 1. Chrome CDP Not Working

**Symptoms:**
- `curl http://localhost:9222/json/version` fails
- browser-harness can't connect

**Solution:**
```powershell
# Stop all Chrome
Get-Process chrome | Stop-Process -Force

# Restart with DebugFull
cd H:\chrome-communication-extension\browser-automation-unified\scripts
.\chrome-debug.ps1 --stop
.\chrome-debug.ps1 --start
```

#### 2. Firefox geckodriver Not Found

**Symptoms:**
- Firefox MCP server fails to start
- "geckodriver not found" error

**Solution:**
```powershell
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox
npm run install-geckodriver
```

#### 3. Port Already in Use

**Symptoms:**
- Server fails to start
- "Address already in use" error

**Solution:**
```powershell
# Find process using port
netstat -ano | findstr PORT_NUMBER

# Kill process
Stop-Process -Id PROCESS_ID -Force
```

#### 4. WordPress Connection Failed

**Symptoms:**
- WP MCP returns connection errors
- 401/403 errors

**Solution:**
- Verify application password is correct
- Check if HTTPS is required (try http:// first)
- Verify the site URL is correct
- Check if WordPress REST API is enabled

#### 5. Chrome 156+ Default Profile Blocking

**Symptoms:**
- CDP works only with DebugFull, not default profile
- `--remote-debugging-port` is ignored on default profile

**Solution:**
Always use DebugFull profile:
```powershell
Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' \
  -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'
```

### Debug Commands

```bash
# List all listening ports
netstat -ano | findstr LISTENING

# Check specific port
netstat -ano | findstr 9222

# View Chrome processes
Get-Process chrome | Select-Object Id, StartTime, Path

# View Node.js processes
Get-Process node | Select-Object Id, StartTime, Path

# View logs
Get-Content $env:USERPROFILE\.vibe\logs\browser-control-mcp.log
```

## Security Considerations

### Credentials
- **Never log credentials**: Application passwords are stored only in `chrome.storage.local`
- **Use application passwords**: Not regular WordPress passwords
- **Limit origins**: MCP servers bind to localhost by default

### Network
- All MCP servers bind to `localhost` by default
- For production, consider:
  - Using HTTPS with valid certificates
  - Firewall rules to restrict access
  - VPN or SSH tunneling for remote access

### Chrome DebugFull Profile
- The DebugFull profile is isolated from your main browsing
- It doesn't have your extensions, bookmarks, or cookies
- You may need to copy extensions manually if needed

## Performance Tips

### Caching
- Tab cache: Double Control extension caches tabs for 5 seconds
- Session reuse: MCP sessions are maintained across requests
- Selector caching: Reuse element references instead of re-querying

### Parallelization
- **Same browser**: Sequential (tabs share memory)
- **Different browsers**: Parallel (independent processes)
- **Limit concurrent**: Max 2-3 concurrent operations

### Efficient Selectors
- Use IDs: `#submit-button`
- Use classes: `.btn.primary`
- Use data attributes: `[data-action="submit"]`
- Avoid complex traversals: `div > div > div > button`

### Batch Operations
- Combine multiple actions in one command
- Example: Fill and submit form in one sequence

## Maintenance

### Update Servers

```powershell
# Update browser-control-mcp
cd $env:USERPROFILE\.vibe\plugins\browser-control-mcp
git pull origin main
npm install

# Update all plugins
cd $env:USERPROFILE\.vibe\plugins
Get-ChildItem -Directory | ForEach-Object {
    Push-Location $_.FullName
    git pull origin main 2>$null
    npm install 2>$null
    Pop-Location
}
```

### Monitor Services

Create a monitoring script:
```powershell
# Save as monitor.ps1
while ($true) {
    Clear-Host
    Write-Host "=== Service Monitor ===" -ForegroundColor Cyan
    
    $Ports = @(3001, 3002, 3003, 3004, 3008, 9222, 9223)
    foreach ($Port in $Ports) {
        try {
            $Client = New-Object System.Net.WebClient
            $Client.Timeout = 1000
            $Client.DownloadString("http://localhost:$Port/health") | Out-Null
            Write-Host "Port $Port: HEALTHY" -ForegroundColor Green
        } catch {
            Write-Host "Port $Port: DOWN" -ForegroundColor Red
        }
    }
    
    Start-Sleep -Seconds 10
}
```

### Clean Up

```powershell
# Stop all services
pm2 kill
Get-Process chrome | Stop-Process -Force
Get-Process geckodriver | Stop-Process -Force
Get-Process node | Stop-Process -Force

# Clean DebugFull profile
Remove-Item -Path "C:\Users\souro\AppData\Local\Google\Chrome\DebugFull" -Recurse -Force
```

## Next Steps

### 1. Load the Skill in Vibe

```
/skill browser-automation-unified
```

### 2. Try Cross-Browser Commands

See examples in:
- `H:\chrome-communication-extension\browser-automation-unified\examples\`

### 3. Automate Your Workflows

Create custom scripts for your specific needs:
- Web scraping
- Form automation
- Cross-browser testing
- WordPress management
- Code generation with OpenCode

### 4. Integrate with Other Tools

- Use with TypeSafe for verification
- Use with Agnes for bulk generation
- Use with Mistral for advanced tasks

## Support

### Documentation
- [Browser Automation SKILL.md](SKILL.md)
- [README.md](README.md)
- [Examples](examples/)

### Resources
- [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/)
- [Mozilla Firefox WebDriver](https://firefox-source-docs.mozilla.org/testing/webdriver/)
- [Opera Developer](https://dev.opera.com/)
- [MCP Protocol](https://modelcontextprotocol.io/)
- [WordPress REST API](https://developer.wordpress.org/rest-api/)

### Community
- GitHub: [sourovdeb/myde-by-vibe](https://github.com/sourovdeb/myde-by-vibe)
- Issues: Report issues in the GitHub repository
- Contributions: Pull requests welcome!

## Appendix: Port Reference

| Service | Port | Protocol | Description |
|---------|------|----------|-------------|
| my-mcp-connector | 3000 | MCP | System info server |
| browser-control-mcp | 3001 | MCP | Chrome browser control |
| browser-control-mcp-opera | 3002 | MCP | Opera browser control |
| browser-control-mcp-firefox | 3003 | MCP | Firefox browser control |
| opencode-mcp-server | 3004 | MCP | OpenCode AI agent |
| (reserved) | 3005 | - | OpenCode server port |
| (reserved) | 3006 | - | Available for new servers |
| (reserved) | 3007 | - | Available for new servers |
| wordpress-mcp-server | 3008 | MCP | WordPress REST API |
| Chrome CDP | 9222 | CDP | Chrome debugging port |
| Opera CDP | 9223 | CDP | Opera debugging port |
| geckodriver | 4444 | WebDriver | Firefox driver port |

## Version History

- **v1.0.0** (2026-10-24) - Initial implementation guide
  - Complete setup instructions
  - Chrome 156+ DebugFull workaround
  - All MCP servers configuration
  - WordPress and OpenCode integration
  - RAM management guidelines
  - Troubleshooting section
