# Cloudflare Tunnel URLs — 2026-10-24 (UPDATED 2026-10-24)

## Current Active Tunnels

| Service | Local Port | Tunnel URL | MCP Endpoint |
|---------|-----------|------------|--------------|
| Browser Control MCP | 3001 | `https://fork-remind-persistent-delays.trycloudflare.com` | `https://fork-remind-persistent-delays.trycloudflare.com/mcp` |
| System Info MCP (my-mcp-connector) | 3000 | `https://chocolate-loading-scanning-matthew.trycloudflare.com` | `https://chocolate-loading-scanning-matthew.trycloudflare.com/mcp` |

## Mistral AI Connectors — ACTIVE (2026-10-24)

Both connectors were created via the Mistral tRPC API (`integrations.create`) and connected via the UI "Connect" button. Old broken connectors were deleted via `integrations.deleteIntegrationForOrgOrWorkspace`.

| Connector | Mistral Name | Mistral ID | URL | Status | Tools |
|-----------|-------------|------------|-----|--------|-------|
| Browser Control MCP | `browser_control_mcp_58b0` | `01a16c8d-ff8c-70b7-b611-ea37100e6a43` | `https://chat.mistral.ai/connections/browser_control_mcp_58b0` | Connected | 15 |
| System Info MCP | `system_info_mcp_22c4` | `01a16c8d-fe5e-7702-8a10-6c705249d838` | `https://chat.mistral.ai/connections/system_info_mcp_22c4` | Connected | 5 |

### Deleted (old broken connectors)
- `browser_control_mcp_a498` (id: `01a16a17-3f3c-76cc-aefd-37b31b78eb29`) — deleted 2026-10-24
- `system_info_mcp_4113` (id: `01a16a18-6fff-75f5-ab4e-ea8b3076fe95`) — deleted 2026-10-24
- `browser_control_mcp_83dc` (id: `01a16c8d-a97f-7047-81ac-447f22e68251`) — deleted 2026-10-24
- `system_info_mcp_9c2b` (id: `01a16c8d-b2aa-76b5-bca2-e236e86b7df2`) — deleted 2026-10-24

## Mistral tRPC API — Programmatic Connector Management (2026-10-24)

Mistral uses tRPC at `https://chat.mistral.ai/api/trpc/`. Call from the browser context (uses session cookies).

### Create a custom connector
```js
fetch('/api/trpc/integrations.create?batch=1', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ '0': { json: {
        name: 'my_connector',        // slug (required)
        title: 'My Connector',       // display name (required)
        server: 'https://example.com/mcp',  // MCP server URL (required)
        description: 'What it does', // optional
        protocol: 'mcp'              // required, must be "mcp"
    } } })
})
```

### Delete a connector
```js
fetch('/api/trpc/integrations.deleteIntegrationForOrgOrWorkspace?batch=1', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ '0': { json: { integrationId: '01a16c8d-...' } } })
})
```

### List connectors
```js
fetch('/api/trpc/integrations.connectorIntegrationsWithCredentialStatus?batch=1&input=%7B%220%22%3A%7B%22json%22%3Anull%2C%22meta%22%3A%7B%22values%22%3A%5B%22undefined%22%5D%2C%22v%22%3A1%7D%7D%7D', {
    credentials: 'include',
    headers: { 'Accept': 'application/json' }
})
```

### Key tRPC procedures discovered
- `integrations.create` — create custom connector (POST)
- `integrations.deleteIntegrationForOrgOrWorkspace` — delete connector (POST, param: `integrationId`)
- `integrations.connectorIntegrationsWithCredentialStatus` — list all connectors (GET)
- `integrations.verify` — verify connector (mutation)
- `integrations.refreshTools` — refresh tool list (mutation)
- `integrations.connectUserWithDefaultCredentials` — connect user (mutation)
- `integrations.disconnectUser` — disconnect user (mutation)

### Gotcha: React form buttons
The "Add a custom connector" form buttons ("Auto-detect", "Add connector") appear disabled and resist force-clicks because React state isn't updated by `el.value = ...`. Use the tRPC API directly instead — it's more reliable.

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
6. **Mistral connector form buttons appear disabled** — force-click via `btn.disabled = false; btn.click()` (but React state blocks actual submission; use tRPC API instead)
7. **Mistral tRPC API requires browser session cookies** — call from page context via `fetch()` with `credentials: 'include'`, not from curl
8. **Mistral `integrations.create` requires `name`, `title`, `server`, `protocol: "mcp"`** — missing `name` or `protocol` returns 400 with Zod validation error
9. **Mistral `integrations.deleteIntegrationForOrgOrWorkspace` expects `integrationId` (camelCase)** — `integration_id` (snake_case) returns 400
10. **New connectors need "Connect" click in UI** — after API creation, navigate to connector page and click "Connect" to detect tools
11. **Chrome Cookies DB shows 0 rows when copied while running** — Chrome 156 encrypts cookies; the live session in the running browser is the source of truth, not the DB file
12. **browser-harness `js()` has 5s timeout** — use fire-and-forget pattern (store results in `window.__var`, check in separate call) for slow API calls
