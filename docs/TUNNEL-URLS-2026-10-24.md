# Cloudflare Tunnel URLs — 2026-10-24

## Current Active Tunnels

| Service | Local Port | Tunnel URL | MCP Endpoint |
|---------|-----------|------------|--------------|
| Browser Control MCP | 3001 | `https://fork-remind-persistent-delays.trycloudflare.com` | `https://fork-remind-persistent-delays.trycloudflare.com/mcp` |
| System Info MCP (my-mcp-connector) | 3000 | `https://chocolate-loading-scanning-matthew.trycloudflare.com` | `https://chocolate-loading-scanning-matthew.trycloudflare.com/mcp` |

## Mistral AI Connector Update Instructions

Go to `https://chat.mistral.ai/connections/marketplace` (or `https://console.mistral.ai/workflows`) and update:

1. **Browser Control MCP** connector (`browsercontrolmcpa498`):
   - Old URL: `https://cashiers-cheap-membership-chapel.trycloudflare.com/mcp` (DEAD)
   - New URL: `https://fork-remind-persistent-delays.trycloudflare.com/mcp`

2. **System Info MCP** connector (`systeminfomcp4113`):
   - Old URL: `https://artificial-hope-resulted-pad.trycloudflare.com/mcp` (DEAD)
   - New URL: `https://chocolate-loading-scanning-matthew.trycloudflare.com/mcp`

## Chrome CDP Workaround (Chrome 156+)

Chrome 156 blocks `--remote-debugging-port` with the default user profile. Workaround:

1. Copy the main profile to a new location:
   ```powershell
   # Copy essential profile data (cookies, localStorage, etc.)
   # See C:\tmp\copy_full_profile.ps1 for the full script
   ```

2. Launch Chrome with the copied profile:
   ```powershell
   Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
     -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'
   ```

3. Verify CDP is working:
   ```bash
   curl -s http://localhost:9222/json/version
   ```

4. browser-harness should now work with the DebugFull profile.

## Tunnel Restart Commands

```bash
# Browser Control MCP tunnel (port 3001)
nohup /c/tmp/cloudflared.exe tunnel --url http://localhost:3001 > /c/tmp/cf-3001.log 2>&1 &

# System Info MCP tunnel (port 3000)
nohup /c/tmp/cloudflared.exe tunnel --url http://localhost:3000 > /c/tmp/cf-3000.log 2>&1 &
```

## Server Start Commands

```bash
# Browser Control MCP server (port 3001)
# Use tools.process.start({command: 'node http-server.js', cwd: 'C:\\Users\\souro\\.vibe\\plugins\\browser-control-mcp\\server'})

# System Info MCP server (port 3000)
# Already running from before (PID 1774)
```

## Gotchas

1. **Tunnel URLs are ephemeral** — change every time cloudflared restarts
2. **Chrome 156 blocks `--remote-debugging-port` with default profile** — use a copied profile
3. **Chrome 156 DevTools HTTP endpoints return 404** — only WebSocket works
4. **`devtools.remote_debugging.user-enabled: true` in Local State** — opens a random port, but WebSocket connections are rejected with 403
5. **Git Bash `nohup node &` hangs** — use `tools.process.start()` for Node servers
6. **Mistral connector form buttons appear disabled** — force-click via `btn.disabled = false; btn.click()`
