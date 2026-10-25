# MCP servers (v2, clean-room rebuild, 2026-10-25)

Clean-room rewrites of the two local MCP servers behind the WordPress
Vibe MCP Bridge. The v1 sources live on the Windows PC and were not
available here, so both servers were rebuilt from the audited tool sets:
same tool names and ports, upgraded internals. They are not derived from
the v1 source.

Both are single-file Node scripts with zero npm dependencies. Node >= 16.

## Run

```bash
# My MCP Connector — port 3000
node my-mcp-connector.js

# Browser Control MCP — port 3001, needs Chrome with CDP enabled
chrome --remote-debugging-port=9222   # or your OS equivalent
node browser-control-mcp.js

# Tests (starts its own mock CDP, no Chrome needed)
node tests/run-tests.js
```

Each server speaks MCP Streamable HTTP on POST /mcp and self-reports on
GET / (service name, version, exact tool count). Both bind to 127.0.0.1
by default. If MYDE_MCP_TOKEN is set, POST /mcp requires
`Authorization: Bearer <token>`.

## Tools

my-mcp-connector (5): health_check, system_info, credential_env_present,
one_stop_shop_status, vibe_skill_list.

browser-control (15): browser_list_tabs, browser_new_tab, browser_navigate,
browser_get_page_info, browser_get_dom, browser_get_element_text,
browser_click, browser_type, browser_scroll, browser_execute_js,
browser_screenshot, browser_wait_for_element, browser_handle_dialog,
browser_switch_tab, browser_close_tab.

## Environment variables

| Variable | Server | Purpose |
|---|---|---|
| PORT | both | Listen port (3000 / 3001). |
| BIND_HOST | both | Bind address, default 127.0.0.1. |
| MYDE_MCP_TOKEN | both | Optional bearer token for POST /mcp. |
| CDP_HOST / CDP_PORT | browser | Chrome DevTools endpoint, default 127.0.0.1:9222. |
| CDP_CONNECT_TIMEOUT_MS / CDP_CALL_TIMEOUT_MS | browser | CDP connect/call timeouts (default 5000). |
| MYDE_VIBE_SKILLS_DIR | connector | Skills directory for vibe_skill_list. |
| MYDE_CREDENTIAL_ENVS | connector | Extra names appended to the default credential list. |
| MYDE_BROWSER_CONTROL_URL | connector | If set, one_stop_shop_status probes this URL. |
| WORDPRESS_APP_PASSWORD, HOSTINGER_API_KEY | connector | Default credential-presence list. Values are never returned, only presence. |

## Upgrades over v1

- GET / self-reports the exact live tool count (v1's bridge page showed a
  stale "12" for the 15-tool browser server; that count now comes from the
  server itself).
- Loopback-only bind by default; optional bearer auth.
- CDP client with connect and call timeouts and a per-target connection
  cache (v1 hung indefinitely when Chrome was unreachable).
- Async tool responses are awaited end-to-end (a v2-dev bug where every
  async tool call serialized to {} was caught by the tests and fixed before
  publish).
- Graceful SIGTERM shutdown; CLI banner names service and tool count.

## What the tests prove — and what they do not

`node tests/run-tests.js` runs 50 checks: JSON-RPC protocol behavior
(initialize, ping, tools/list, tools/call, unknown tool/method, parse
error, notifications, batches), all 20 tools end to end, GET /
self-reporting, bearer auth (401 without token, accepted with), CLI
startup, and SIGTERM shutdown via a real child process.

Honest limitations:

- The 15 browser tools were validated against a bundled mock CDP server,
  not a real Chrome instance. No real browser was tested here.
- The tests prove protocol and plumbing correctness, not fidelity to
  Chrome's actual CDP behavior across sites and dialogs.
- Recommended: run one live check on the PC before swapping these in for
  the v1 servers — start Chrome with --remote-debugging-port=9222, start
  browser-control-mcp.js, and call browser_navigate on a known page.
