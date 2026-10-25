# 2026-10-25 — MCP server audit and v2 clean-room rebuild

## Scope

The two local MCP servers registered in the WordPress Vibe MCP Bridge —
My MCP Connector (127.0.0.1:3000) and Browser Control MCP
(127.0.0.1:3001) — were audited, then rebuilt as upgraded v2 versions
and published to this repo under tools/mcp-servers/.

## Audit findings (evidence)

1. Duplicate connector registrations on the Mistral side: Browser Control
   MCP and System Info MCP appeared twice in the connections list.
   Cosmetic client-side duplication; not a server defect.
2. The bridge admin page reported "Browser Control MCP: 12 tools" while
   the running server exposed 15. The count was a hardcoded stale figure,
   not read from the server.
3. The site guardian's api_key (api_key_len=19) lives in the WordPress
   options table (ssg_settings), not in any environment variable — checked
   session env, HKCU user vars, Windows Credential Manager, .pi\secrets,
   and .vibe.env. Remediation of that storage is separate from this
   rebuild and remains open.
4. The v1 server sources are on the Windows PC and were not accessible
   from this environment, so v2 is a clean-room rebuild from the audited
   tool sets (same 5 + 15 tool names, same ports), not a patch of v1.

## What was built

tools/mcp-servers/my-mcp-connector.js (v2.0.0, 5 tools) and
tools/mcp-servers/browser-control-mcp.js (v2.0.0, 15 tools). Single-file
Node, zero npm dependencies, Node >= 16. MCP Streamable HTTP on
POST /mcp; GET / self-reports service name, version, and the exact live
tool count (fixes finding 2 structurally: the count can no longer drift
from reality). Loopback 127.0.0.1 bind by default. Optional
MYDE_MCP_TOKEN bearer auth. CDP client written from scratch with
connect/call timeouts and a per-target connection cache. Graceful SIGTERM
shutdown. Credential checks are presence-only; values never appear in any
response.

Also: tests/mock-cdp.js (minimal CDP endpoint simulator), tests/run-tests.js
(50-check suite), README.md (run instructions, env vars, honest test-scope
statement), example.env (commented template; no real values).

## Bug found and fixed during testing (before publish)

First test run: 29 passed, 21 failed. Root cause: requestHandler returned
the Promise from a .then() chain instead of the resolved value, so
JSON.stringify serialized every async tool call to {} — all 15 browser
tools plus one_stop_shop_status returned empty objects over HTTP while
passing in direct unit calls. Fixed by making requestHandler/handleOne
async and awaiting tool handlers end-to-end in both servers. After the
fix, a second latent issue surfaced: one_stop_shop_status correctly
reported degraded_credentials in the test environment because the two
default credential vars were not set there; the test harness now sets
fixture values.

## Test results

node tests/run-tests.js, Node v22.20.0, Linux sandbox:
run 1 — 50 passed, 0 failed. run 2 — 50 passed, 0 failed.
Coverage: JSON-RPC protocol (initialize, ping, tools/list, tools/call,
unknown tool -32602, unknown method -32601, parse error -32700,
notifications 202, batch arrays), all 5 connector tools, all 15 browser
tools, GET / self-report on both servers, bearer auth (401 without
token, accepted with), CLI child startup and SIGTERM shutdown.

## What was NOT verified (honest limits)

The 15 browser tools were validated against the bundled mock CDP server,
not a real Chrome instance. No real browser, real WordPress credential,
or real Hostinger API was touched. Auth and shutdown tests used a real
spawned child process but loopback only.

## Next steps

1. On the PC: start Chrome with --remote-debugging-port=9222, run
   node browser-control-mcp.js, and call browser_navigate on a known
   page — one live check before swapping v2 in for v1.
2. Register the v2 endpoints in the bridge; the tool counts now
   self-report and cannot go stale.
3. Separately: move the guardian api_key out of wp_options into an
   environment variable (open finding 3).
