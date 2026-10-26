# Mistral AI Gateway Connector — Setup Complete (2026-10-27)

## Status: LIVE — 39 tools available in Mistral AI Work

The Unified MCP Gateway is now connected to Mistral AI (chat.mistral.ai) as a custom MCP connector. Mistral AI Work can now control the PC through the gateway.

## Connector Details

| Property | Value |
|----------|-------|
| Name | `sourov_gateway_full_pc_control_7b5b` |
| ID | `01a17a0a-7493-7374-8092-2902122ff01c` |
| Title | Sourov Gateway — Full PC Control |
| Server | `https://things-clerk-houston-gras.trycloudflare.com/mcp` |
| Auth | Bearer token (credential: `gateway-bearer-auth`, status: valid, is_default: true) |
| Tools | 39 (6 Latch + 5 connector + 15 browser + 13 native) |
| Status | Authenticated, tools detected |

## 39 Tools Available

### Latch (6 tools — proxied)
`list_files`, `read_file`, `search_files`, `write_file`, `run_task`, `control_desktop`

### my-mcp-connector (5 tools — proxied)
`health_check`, `system_info`, `one_stop_shop_status`, `credential_env_present`, `vibe_skill_list`

### browser-control-mcp (15 tools — proxied)
`browser_list_tabs`, `browser_new_tab`, `browser_switch_tab`, `browser_close_tab`, `browser_navigate`, `browser_get_page_info`, `browser_screenshot`, `browser_execute_js`, `browser_click`, `browser_type`, `browser_get_dom`, `browser_scroll`, `browser_wait_for_element`, `browser_get_element_text`, `browser_handle_dialog`

### Native Gateway Tools (13)
`run_command`, `manage_process`, `screenshot`, `clipboard`, `manage_file`, `manage_service`, `network_info`, `install_package`, `notify`, `window_management`, `registry_read`, `get_env`, `system_info_extended`

## Setup Method (tRPC API)

The connector was created via Mistral's tRPC API from the browser context (requires session cookies):

### Step 1: Create connector
```javascript
POST /api/trpc/integrations.create?batch=1
Body: {"0":{"json":{
  name: "sourov-gw-<random>",
  title: "Sourov Gateway — Full PC Control",
  description: "Unified MCP Gateway — 39 tools for full PC control",
  server: "https://things-clerk-houston-gras.trycloudflare.com/mcp",
  protocol: "mcp",
  headers: { "Authorization": "Bearer PLACEHOLDER" }
}}}
```
Note: The `headers` field is REQUIRED (without it, 500). It auto-creates a broken credential.

### Step 2: Create valid credential (authHeaders format)
```javascript
POST /api/trpc/integrations.createConsumerCredential?batch=1
Body: {"0":{"json":{
  integrationId: "<connector-id>",
  name: "gateway-bearer-auth",
  title: "Gateway Bearer Token",
  consumerType: "user",
  authHeaders: [{ key: "Authorization", value: "Bearer <GATEWAY_AUTH_TOKEN>" }]
}}}
```
This creates a credential with `status_type: "valid"`.

### Step 3: Set valid credential as default
```javascript
POST /api/trpc/integrations.setDefaultCredential?batch=1
Body: {"0":{"json":{
  integrationId: "<connector-id>",
  credentialName: "gateway-bearer-auth",
  scope: "user"
}}}
```
The `scope` field is required (values: "user", "org", "workspace", "system").

### Step 4: Refresh tools
```javascript
POST /api/trpc/integrations.refreshTools?batch=1
Body: {"0":{"json":{
  integrationId: "<connector-id>"
}}}
```
Returns all 39 tools from the gateway.

### Step 5: Click "Reconnect" in the UI
Navigate to `https://chat.mistral.ai/connections/<connector-name>` and click "Reconnect" to finalize.

## Key Gotchas

1. **`integrations.create` requires `headers` field** — without it, returns 500. The `headers` field auto-creates a broken credential (authentication_type: "none", status: "invalid").
2. **`createConsumerCredential` with `authHeaders` format creates a VALID credential** — but fails with 500 if a credential already exists for the connector.
3. **`createConsumerCredential` with `credentialFields` format is BROKEN** — creates credential with `authentication_type: "none"`.
4. **`setDefaultCredential` requires `scope` field** — values: "user", "org", "workspace", "system".
5. **`refreshTools` triggers tool detection** — returns the full tools list from the MCP server.
6. **Token transfer to browser context** — use `window.name` (persists across same-tab navigations) to pass the token from a `file://` page to the `https://chat.mistral.ai` page without embedding it in JS expressions.
7. **Never print the gateway token** — read from `.env` file, transfer via `window.name`, delete temp files immediately.

## Architecture

```
Mistral AI Work (chat.mistral.ai)
    ↓ HTTPS + Bearer Auth
Cloudflare Tunnel (things-clerk-houston-gras.trycloudflare.com)
    ↓ localhost:3002
Unified MCP Gateway (Node.js, port 3002)
    ├──→ Latch MCP (localhost:3939) — 6 tools
    ├──→ my-mcp-connector (localhost:3000) — 5 tools
    ├──→ browser-control-mcp (localhost:3001) — 15 tools
    └──→ 13 native tools (run_command, manage_process, screenshot, etc.)
```

## RAM Usage

| Component | RAM |
|-----------|-----|
| Unified MCP Gateway | ~65 MB |
| Cloudflared (gateway tunnel) | ~47 MB |
| Sourov Control Center (.exe) | ~68 MB private (~113 MB working set) |
| **Total gateway stack** | **~112 MB** |
