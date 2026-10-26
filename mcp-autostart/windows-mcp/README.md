# windows-mcp / mcp-bridge

Tiny Rust MCP bridge for Windows: cloud chats (claude.ai custom connectors,
grok.com, Le Chat) call your local coding agents — `claude`, `grok`, `vibe`,
`pi` — as MCP tools, headless and read-only by default.

Created 2026-10-26. Follows the mcp-bridge 12-step plan (protocol eras,
OAuth-first, workflow tools, tray + admin settings, external tunnel).

## Build & size

```
cargo build --release
```

Size profile: `opt-level="z"`, `lto=true`, `codegen-units=1`, `panic="abort"`,
`strip=true`. Release binary measured at **~504 KB** (Linux; Windows target
similar) — well under the 2 MB goal. No reqwest, clap, or schemars; HTTP is
hand-rolled std; no TLS (TLS terminates at the tunnel).

## Run

```
mcp-bridge.exe              # normal (binds 127.0.0.1:8765/mcp, admin :8766)
mcp-bridge.exe --mock       # mock agents: returns canned output, spawns nothing
mcp-bridge.exe --check      # prints connector URLs to register in cloud chats
```

Config: `%APPDATA%\mcp-bridge\config.json` (created with defaults on first
run). Edit via the admin page at `http://127.0.0.1:8766/` (On/Off toggle,
per-agent enable/mode, allowed dirs, ports, passphrase).

## Architecture

```
claude.ai / grok.com / Le Chat      (cloud, HTTPS+OAuth)
        │
 Tailscale Funnel  --https=443 --set-path=/mcp  (external, not built here)
        │
 127.0.0.1:8765/mcp  ── mcp-bridge (this exe, std only)
        │ spawn argv, prompt via stdin
 claude -p / grok -p / vibe -p / pi -p
```

- **Both MCP eras**: old `initialize` handshake *and* 2026-07-28 stateless
  requests (`Mcp-Method` header, version in `_meta`, `ttlMs`/`cacheScope` in
  `tools/list` results).
- **Tools**: `bridge_list_agents`, `bridge_run_agent` (sync, 120 s timeout,
  100 KB cap), `bridge_start_agent`/`bridge_job_poll`/`bridge_job_cancel`
  (background, max 4 concurrent, incremental output delivery).
- **Auth**: dev bearer until step 8's full OAuth 2.1 lands (PKCE S256,
  `/authorize` passphrase page, dynamic client registration; metadata
  helpers `well_known`/`protected_resource` already in `src/auth.rs`).
  Set a passphrase in settings to activate the bearer check on `/mcp`;
  default `change-me` = no-auth dev mode.
- **Safety**: argv-only spawns (never shell strings), workdir must resolve
  inside `allowed_dirs`, default mode `readonly` per-CLI tool allowlist,
  admin port never routed through the tunnel, tray toggle = kill switch.

## Register as a custom connector

Local-only (desktop clients): `http://127.0.0.1:8765/mcp` via an
`mcp-remote` stdio shim — claude.ai's cloud cannot reach localhost.

Cloud chats (claude.ai → Customize → Connectors → Add custom connector,
grok.com/connectors, Le Chat custom MCP tab) need a **public HTTPS URL on
port 443**:

```
tailscale funnel --bg --https=443 --set-path=/mcp http://127.0.0.1:8765/mcp
```

Then register `https://<machine>.<tailnet>.ts.net/mcp`. (Funnel's public
listener only allows 443/8443/10000, and claude.ai only connects on 443 —
`funnel --bg 8765` will not work.)

## Tests

- 27 unit tests: `cargo test --lib` (protocol eras, allowlist, argv
  construction, auth, timeout/cap, no-shell-injection).
- E2E over real TCP: `cargo test --test e2e` — boots both servers on
  ephemeral ports and drives healthz, initialize, notification 202, ping,
  header-method tools/list, mock run, allowlist 403, job start/poll,
  discover, admin page/API, 404/400, disabled 503.

All passing as of 2026-10-26 (`27 + 27 + 1`).

## Status / next steps

Done: steps 1–7, 9 (admin), size recipe (step 12 measured).
Next: step 8 (full OAuth 2.1: authorize page, PKCE, `/register`, token
refresh), step 10 (tray icon; needs `tray-icon` + a Windows event loop —
add only when building on Windows), step 11 (tunnel control), step 12
(cargo-wix MSI). CLI flag table in `src/config.rs` (`Agent::argv`) is data
— verify each CLI's current flags before production use.
