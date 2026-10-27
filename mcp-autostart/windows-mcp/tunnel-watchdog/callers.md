# Caller registry — who connects to this PC, and how they fail over

Created 2026-10-27. One row per caller. When a tunnel restarts, its trycloudflare
URL changes; every caller below must be re-pointed to the URL recorded in
`C:\Users\souro\.mcp-autostart\tunnel-state.json`.

| Caller | Kind | Connector / mechanism | What to re-point on tunnel change |
|---|---|---|---|
| Le Chat / Mistral — `browser_control_mcp_58b0` | custom MCP connector | chat.mistral.ai/connections/marketplace (tRPC `integrations.*`, browser cookies) | connector server URL |
| Le Chat / Mistral — `system_info_mcp_22c4` | custom MCP connector | same | connector server URL |
| Le Chat / Mistral — `sourovdeb_wordpress_easy_mcp_bridge_read_only_token_a71a` | Easy MCP AI bridge (read-only token id 8) | same + WordPress REST app password in secrets file | bridge URL |
| Grok — "mcp-bridge" custom connector | custom connector | grok.com add-connector dialog (OAuth 2.1 consent on first connect) | URL; re-consent if auth changes |
| Pi (this PC) | stdio | `E:\ONE-STOP-SHOP\.pi\agent\mcp.json` → `latch.exe` stdio | nothing (loopback) |
| Latch cloud paths `/mcp/grok`, `/mcp/mistral`… | HTTP | Latch config `public_url` | `public_url` in latch.json |

## Fallback semantics (what exists today, honestly)

- **Local servers** (latch 3939, mcp-bridge 8765): the watchdog restarts them
  if dead (RAM-guarded, never kills). This is the layer where outages heal
  automatically.
- **Tunnels**: NOT auto-restarted by the watchdog (each cloudflared costs ~47 MB).
  A dead tunnel shows up as `no tunnel URL found` in `tunnel-state.json` warnings.
  Cheap fixes, in order: start one from the mcp-bridge admin page toggle, or run
  `nohup /c/tmp/cloudflared.exe tunnel --url http://localhost:<port> > log 2>&1 &`.
- **Callers**: a stale URL is a per-caller problem, not a site problem. Keep the
  registry above current; when adding a future caller, add one row here so the
  next tunnel change re-points it in one pass.
- **What CI does**: `.github/workflows/win-exes.yml` builds both exes on every
  push/PR touching `mcp-autostart/windows-mcp/**` and publishes them as GitHub
  Release assets on `v*` tags. It does NOT host the tunnel — the servers must
  keep running on this PC.
