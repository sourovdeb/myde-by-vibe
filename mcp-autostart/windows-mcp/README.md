# windows-mcp / mcp-bridge

Tiny Rust MCP bridge for Windows: cloud chats (claude.ai custom connectors,
grok.com, Le Chat) call your local coding agents — `claude`, `grok`, `vibe`,
`pi` — as MCP tools, headless and read-only by default.

Created 2026-10-26. All 12 steps of the mcp-bridge plan are implemented
(audited unit-by-unit; see Status for what is verified where).

## Build & size

```
cargo build --release                          # plain server (~548 KB)
cargo build --release --features tray         # with Windows tray (on Windows)
cargo check --features tray --target x86_64-pc-windows-gnu   # cross type-check
```

Size profile: `opt-level="z"`, `lto=true`, `codegen-units=1`, `panic="abort"`,
`strip=true`. Plain release measured **548 KB** (Linux). cargo-bloat: `std`
is 73% of .text; no droppable heavy dependency exists. Tray adds size only
in the `--features tray` build.

## Run

```
mcp-bridge.exe              # servers in foreground (tray build: tray on main thread)
mcp-bridge.exe --mock       # mock agents: canned output, spawns nothing
mcp-bridge.exe --check      # prints connector URLs to register in cloud chats
```

Config: `%APPDATA%\mcp-bridge\config.json` (defaults created on first run).
Settings page: `http://127.0.0.1:8766/` — On/Off toggle (starts/stops the
tunnel), per-agent enable/mode, allowed dirs, ports, passphrase, tunnel
command.

## Architecture

```
claude.ai / grok.com / Le Chat      (cloud, HTTPS+OAuth)
        │
 external tunnel (tailscale funnel / cloudflare; started by the toggle)
        │
 127.0.0.1:8765/mcp  ── mcp-bridge (this exe, std only)
        │ spawn argv, prompt via stdin
 claude -p / grok -p / vibe -p / pi -p
```

- **Both MCP eras**: old `initialize` handshake *and* 2026-07-28 stateless
  requests (`Mcp-Method` header, version in `_meta`, `ttlMs`/`cacheScope`).
- **Tools (7)**: `bridge_list_agents`, `bridge_run_agent` (sync, 120 s
  timeout, 100 KB cap), `bridge_start_agent`/`bridge_job_poll`/
  `bridge_job_cancel` (max 4 concurrent, incremental output),
  `bridge_list_workflows`, `bridge_run_workflow`.
- **One-click workflows**: named workflows in config map to your local
  agent + prompt template + workdir. Defaults pre-wired for the five
  mistral-workflows (podcast-producer, wordpress-maintainer,
  academic-paper-pipeline, content-scheduler,
  mishu-critical-thinking-decision-audit) pointing at
  `E:/ONE-STOP-SHOP/mistral-workflows`. Any connected chat (or local
  agent) runs one with a single `bridge_run_workflow` call; `background`
  returns a job id for long pipelines. Edit names/agents/prompts in the
  settings API or config.json — no recompile.
- **OAuth 2.1 (step 8)**: full single-user AS — RFC 9728/8414 metadata routes,
  dynamic client registration, `/authorize` passphrase consent page, PKCE
  S256 (hand-rolled SHA-256, FIPS 180-4 vectors + Python cross-check),
  single-use 60 s codes, bearer check on `/mcp` with `WWW-Authenticate`
  pointing at the metadata. Passphrase `change-me` = dev no-auth mode.
  **Limitations (audited, honest)**: tokens are non-cryptographic ids
  (time+counter hash) — acceptable for a single-user bridge, not a
  multi-tenant AS; no refresh-token grant yet; no TLS by design (the tunnel
  terminates TLS); state is in-memory (restart = re-consent).
- **Tray (step 10, `--features tray`, Windows-only)**: Enabled check item
  (kill switch), Open Settings, Copy connector URL, Quit. Tray on the main
  thread (Win32 event loop requirement), servers on background threads.
  `#![windows_subsystem = "windows"]` in that build. Verified by
  cross-compilation type-check; **runtime behavior needs a Windows test**.
- **Tunnel control (step 11)**: `tunnel_cmd` + `tunnel_args` in config
  (argv array, never shell), `{port}` placeholder, output to
  `%APPDATA%\mcp-bridge\tunnel.log`, started/stopped with the On/Off toggle
  via `Bridge::set_enabled` (single entry point shared by tray + admin API).
- **Safety**: argv-only spawns, stdin prompts, workdir allowlist, readonly
  per-CLI defaults, admin port never tunneled, tray toggle = kill switch.

## Register as a custom connector

Local-only (desktop clients): `http://127.0.0.1:8765/mcp` via an
`mcp-remote` stdio shim — claude.ai's cloud cannot reach localhost.

Cloud chats need a **public HTTPS URL on port 443** (claude.ai only
connects on 443; Funnel's public listener only allows 443/8443/10000):

```
tailscale funnel --bg --https=443 --set-path=/mcp http://127.0.0.1:8765/mcp
```

Then register `https://<machine>.<tailnet>.ts.net/mcp`. Put the same
command in config as `tunnel_cmd`/`tunnel_args` so the tray toggle
controls it:

```json
"tunnel_cmd": "tailscale",
"tunnel_args": ["funnel", "--bg", "--https=443", "--set-path=/mcp", "http://127.0.0.1:{port}/mcp"]
```

## Tests (77 + 30 scenarios, all passing)

- `cargo test --lib` ×2: 37 tests — protocol eras, allowlist, argv
  construction, OAuth (FIPS SHA-256 vectors, PKCE S256, flow, replay,
  redirect validation), auth wiring, tunnel (placeholders, start/stop,
  idempotence), timeout/cap, no-shell-injection.
- `cargo test --test mock30`: one suite, 30 numbered scenarios over real
  TCP — the full usable path: workflow listing/one-click/rendering, all 4
  agents, allowlist, kill switch, jobs, admin toggle-off-then-on, both
  protocol eras, error handling. `30/30 passed`.
- `cargo test --test e2e`: 2 flows over real TCP — the original full flow
  and the OAuth end-to-end (metadata → DCR → 401 → consent page → wrong
  passphrase 403 → 302 code → PKCE exchange → code replay rejected →
  authenticated tools/list → bogus token 401; consent passphrase now
  POSTed, never in URLs/history/logs).

## Status / verification honesty

| Step | State | Verified how |
|---|---|---|
| 1–7, 9 | done | unit + e2e tests on this machine |
| 8 OAuth | done | unit + e2e over TCP; PKCE cross-checked with Python hashlib; non-crypto token ids documented |
| 10 tray | code complete, **type-checked only** (`cargo check --features tray --target x86_64-pc-windows-gnu`); runtime untested — needs a Windows machine |
| 11 tunnel | done + live-tested (sleep process) | unit tests |
| 12 size/MSI | 548 KB measured; `wix/main.wxs` written; **MSI not built** — cargo-wix requires Windows; build there with `cargo wix` |

Before production use: verify each CLI's current headless/read-only flags
(table in `src/config.rs` is data, editable without recompiling logic).
