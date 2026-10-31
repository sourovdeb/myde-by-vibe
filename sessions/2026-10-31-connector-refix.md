# MCP Connector Refix Kit — 2026-10-31

Verified from a Mistral Vibe chat session on 2026-10-31 (~09:35 UTC) via the mistral_mcp connector.
Result: all 9 tunnel-based cloud connectors are unauthenticated and still point at pre-crash
quick-tunnel URLs from 2026-10-25/26. Live tunnel URLs exist only on the PC
(`%APPDATA%\mcp-stack\state.json`) — no remote source publishes them, and external probing
of trycloudflare hosts is non-discriminating (dead and live hosts return identical
bot-blocked responses).

## Verified connector inventory (2026-10-31)

| Connector | ID | Stale server URL | Service (port) |
|---|---|---|---|
| system_info_mcp_1786 | 01a17318-3396-7349-bbff-aedc1689a65f | https://minor-eva-book-ones.trycloudflare.com/mcp | my-mcp-connector (:3000) |
| system_info_mcp_a828 | 01a17318-140e-714a-a5aa-30ac1609885d | https://minor-eva-book-ones.trycloudflare.com/mcp | duplicate of 1786 |
| browser_control_mcp_a284 | 01a17318-349a-70ec-9327-767ef523bac7 | https://photos-loaded-weddings-enters.trycloudflare.com/mcp | browser-control-mcp (:3001) |
| browser_control_mcp_cdc2 | 01a17318-1a60-774c-96ea-0f96ae1b4c7d | https://photos-loaded-weddings-enters.trycloudflare.com/mcp | duplicate of a284 |
| latch_mcp_local_pc_tools_00da | 01a1794b-35e1-73f9-8a12-eb0778f4dc14 | https://jason-salvador-known-stood.trycloudflare.com/mcp/mistral | latch (:3939) |
| mcp_bridge_5de0 | 01a179f7-00ee-7249-b141-91598c3feb31 | https://mounts-scratch-jimmy-weight.trycloudflare.com/mcp | mcp-bridge (:8765, OAuth) |
| sourov_gateway_full_pc_control_da73 | 01a17a0a-1a9f-709b-937f-0e25428a99fb | https://things-clerk-houston-gras.trycloudflare.com/mcp | unified gateway (:3002) |
| sourov_gateway_full_pc_control_7b5b | 01a17a0a-7493-7374-8092-2902122ff01c | https://things-clerk-houston-gras.trycloudflare.com/mcp | duplicate of da73 |
| sourov_gateway_test_b_5161 | 01a17a0a-67f6-7525-939b-b444abd439e3 | https://things-clerk-houston-gras.trycloudflare.com/mcp | duplicate of da73 (test) |

Also unauthenticated but NOT tunnel-based (separate service-OAuth issue, out of scope here):
biorender, paypal.

`mcp-stack` manages tunnels only for 3939, 8765, 3000, 3001. The gateway (:3002) tunnel is
provisioned separately and is not in state.json — that is why all three gateway connectors
have been unfixable via `mcp-stack reconnect` alone.

## Step 1 — PC side: bring up live tunnels (PowerShell)

```
mcp-stack status        # if tunnels show live URLs, skip reconnect; note the 4 URLs
mcp-stack reconnect     # 429-safe sequential re-provision: tunnels for 3939, 8765, 3000, 3001
mcp-stack fix-url       # bridge public_url -> live 8765 tunnel (required for bridge OAuth)
```

Gateway (not managed by mcp-stack): start the gateway as usual (node server.js, path per
local layout), then run its tunnel manually and note the URL:

```
C:\tmp\cloudflared.exe tunnel --url http://localhost:3002 --no-autoupdate
```

`mcp-stack reconnect` stores the state URLs with the /mcp suffix already appended
(`st.tunnels` entries look like https://xxxx.trycloudflare.com/mcp), so paste them as-is.

## Step 2 — Mistral side: repoint the connectors

In chat.mistral.ai → Connections (custom connectors): for each kept connector, delete the stale
entry and add the custom MCP connector again with the new server URL, then click Connect
(tools are only detected after the Connect click — runbook-verified behavior).

Keep 5, delete 4 stale duplicates:

| Keep | New server URL |
|---|---|
| system_info (one of 1786/a828) | `<tunnel-3000>/mcp` |
| browser_control (one of a284/cdc2) | `<tunnel-3001>/mcp` |
| latch_mcp_local_pc_tools | `<tunnel-3939>/mcp/mistral` (note the /mistral suffix) |
| mcp_bridge | `<tunnel-8765>/mcp`, then complete the OAuth flow (public_url was set by fix-url) |
| sourov_gateway (da73) | `<tunnel-3002>/mcp` (manual tunnel from Step 1) |

Delete: the second system_info, the second browser_control, and gateway duplicates
7b5b and 5161 (all three gateway connectors point at the same URL; one is enough).
Deleting connectors is reversible only by re-adding them, so decide before deleting.

Scripted alternative (documented, unchanged): the tRPC route from a logged-in
chat.mistral.ai session — integrations.create (name, title, server, protocol "mcp") plus
integrations.deleteIntegrationForOrgOrWorkspace (camelCase integrationId) — see
MCP-CLOUD-CONNECTOR-RUNBOOK.md. connector-autofix.py (venv recreate) per the
2026-10-28 session note also remains valid.

## Step 3 — Verify

1. chat.mistral.ai/connections: each kept connector shows its tool list (5 / 15 / 6 / 7 / 39) and no "cannot reach" error.
2. From any Vibe chat, ask to verify: the mistral_mcp connector can list connectors and
   read their authenticated state, then live tool calls confirm end-to-end function.
3. Or self-verify per the runbook: POST initialize + tools/list to each tunnel URL.

## Durable fix (recommended, not built today)

Quick-tunnel URLs rotate on every restart or reboot, so this refix recurs every time.
Two options to make it permanent:

1. Named Cloudflare tunnel with a stable hostname (requires the domain zone on Cloudflare;
   sourovdeb.com DNS is currently at Hostinger).
2. Stable proxy layer: extend the WP vibe-mcp-bridge plugin into a forwarding proxy on
   sourovdeb.com; a PC-side script syncs the current tunnel URLs into the stored option on
   every rotation; all connectors then point at permanent sourovdeb.com URLs and never need
   editing again. Larger build; needs an auth design before exposing a public proxy.
