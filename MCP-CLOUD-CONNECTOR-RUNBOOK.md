# MCP Cloud Connector Runbook — Mistral AI ↔ local browser/system MCP (2026-10-25)

Fallback source of truth for the Mistral cloud → Cloudflare tunnel → local MCP server →
Chrome/PC chain. Repo copy of the live bridge plugin: `vibe/plugins/vibe-mcp-bridge/vibe-mcp-bridge.php` (v1.1.0).
Last verified state: 2026-10-25 ~13:10Z from this machine.

## Components (local, Sourov PC)

| Piece | Where | Notes |
|---|---|---|
| browser-control-mcp | `~\.vibe\plugins\browser-control-mcp\server\http-server.js` | port **3001**, 15 tools, CDP to Chrome (profile DebugFull, port 9222) |
| my-mcp-connector | `~\.vibe\plugins\my-mcp-connector\` | port **3000**, 5 tools: `health_check`, `system_info`, `one_stop_shop_status`, `credential_env_present`, `vibe_skill_list` |
| cloudflared | `C:\tmp\cloudflared.exe` (v2026.10.3) | ephemeral trycloudflare subdomains — **regenerate on every restart** |
| WordPress bridge | `vibe-mcp-bridge` v1.1.0 on sourovdeb.com | admin form to add/edit server entries; rollback option `vibe_mcp_servers_last_backup`; host backup `/tmp/vibe-mcp-bridge.php.bak-20261025` |

## Live state at 2026-10-25 (verify fresh before relying on it)

- Tunnels: 3001 → `https://photos-loaded-weddings-enters.trycloudflare.com`, 3000 → `https://minor-eva-book-ones.trycloudflare.com` (documented in `~\.vibe\docs\TUNNEL-URLS-2026-10-24.md`, top block).
- Mistral connectors: `browser_control_mcp_a284` (id `01a17318-349a-70ec-9327-767ef523bac7`), `system_info_mcp_1786` (id `01a17318-3396-7349-bbff-aedc1689a65f`). Old `58b0`/`22c4` deleted 2026-10-25.
- Verified 2026-10-25: both `/health` 200, `chromeConnected:true`, `initialize` + `tools/list` through the public tunnel URLs return 15 and 5 tools respectively. Connector-side `connected/canCall` was set by Vibe in the Mistral UI; re-confirm in `chat.mistral.ai/connections` after any tunnel restart (URLs are ephemeral).

## Reconnect procedure (tunnel side broke)

1. **Local servers**: confirm ports 3000/3001 listening (`Get-NetTCPConnection -LocalPort 3000,3001`). Restart via `tools.process.start()` (not Git Bash `nohup &`); servers read `~\.vibe\.env` for keys — never print them.
2. **Chrome**: if `chromeConnected:false`, Chrome must run with the DebugFull profile on 9222 (`--remote-debugging-port=9222 --user-data-dir=...\DebugFull`).
3. **Tunnels**: start cloudflared per the commands in `~\.vibe\docs\TUNNEL-URLS-2026-10-24.md`; note the NEW subdomains; update that doc's top block (append-only).
4. **Mistral connectors**: from a logged-in `chat.mistral.ai` page context, tRPC `integrations.create` (requires `name`, `title`, `server`, `protocol:"mcp"`) pointing at the new URL, then click **Connect** in the UI (API alone will not detect tools); delete the stale connector with `integrations.deleteIntegrationForOrgOrWorkspace` (`integrationId` camelCase).
5. **Verify end-to-end**: POST MCP `initialize` to `<tunnel>/mcp` (Accept: `application/json, text/event-stream`), then `tools/list` with the session header. Browser Control = 15 tools, System Info = 5.
6. Update `~\.vibe\HANDOFF.md` with the new URLs + connector IDs (this repo's runbook stays the durable copy).

## Verified later 2026-10-25 (~13:35Z, Vibe — 3-layer check)

- End-to-end re-verified with real `tools/call` through **both public tunnel
  URLs**: 3001 `browser_list_tabs` returned live Chrome tabs, 3000
  `health_check` returned live JSON. Connector detail pages at
  `chat.mistral.ai/connections/<name>` show full tool lists (15 / 5) and no
  "cannot reach" error — Mistral's backend reaches both servers.
- The bridge backup in host `/tmp` is **volatile** (host reboot wipes it).
  Verified present 2026-10-25: `/tmp/vibe-mcp-bridge.php.bak-20261025`, 2055
  bytes, md5 `78de5cae9765a3465917c77ebab6e660`. Copy to `~/backups/` before relying on it.
- Fallback when H: is unmounted (happened 2026-10-25): the provider-router
  helper is unreachable, but Agnes and TypeSafe can be called directly —
  request shapes in `E:\scripts\lib\ai.ps1` (`Invoke-Agnes`,
  `Invoke-TypeSafeCheck`).
- Full session record: `sessions/2026-10-25-full-verification.md`.

## Known data drift (fix when convenient)

- WP `vibe_mcp_servers` option (pre-v1.1.0 seed) lists 12 browser tools in camelCase (e.g. `healthcheck`); the live 3000 server registers snake_case names (`health_check`). The bridge's admin form now lets the stored list be edited — sync it to the live names.
- AGENTS.md "browser-control-mcp (port 3001): 15 tools" is correct; older 12-tool mentions in various notes are stale.

## Red-alert register (as of 2026-10-25)

- **OPEN**: rotate MySQL password for `u839078121_gVGpV` — value was echoed into an agent transcript 2026-10-25 12:26Z. Rotate in Hostinger panel, then update `wp-config.php` + `~\.vibe\.env_secrets.md`.
- Easy MCP AI v2.2.2 exposes 243 tools to external AIs (OAuth/API-key). Audit token list in WP-admin; revoke stale external tokens.
- Guardian threshold interim: `ssg_settings.min_published` set 900 → 750 on 2026-10-25 (published = 729). Target 900 remains via the pending ~171-post batch. Integrity baseline resnapshotted 12:40:33Z.


## 2026-10-31 status addendum

Verified via mistral_mcp from a Vibe chat on 2026-10-31: all 9 tunnel-based cloud connectors remain stale, still pointing at the 2026-10-25/26 pre-crash quick-tunnel hosts. Full verified inventory, PC-side commands, per-connector repoint table, and consolidation (keep 5, drop 4 duplicates): see sessions/2026-10-31-connector-refix.md. Note: the gateway (:3002) tunnel is NOT owned by mcp-stack and must be provisioned manually — mcp-stack reconnect only covers 3939, 8765, 3000, 3001.
