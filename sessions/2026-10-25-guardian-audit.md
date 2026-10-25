# Session 2026-10-25 — Guardian flag remediation + MCP chain recovery + bridge v1.1.0

Agent: pi / mishu-wordpress-operations (with Vibe in parallel). Evidence paths inline; secrets never copied here.

## 1. `published_posts_below_threshold` (root cause + fix)

- Live state via SSH PHP bootstrap: `ssg_settings.min_published = 900`, published posts **729**, pages 52 → real gap 171 (guardian had reported "79 new posts since baseline" — its baseline counter, different denominator; both true).
- Executed with approval:
  - Integrity baseline: `POST /wp-json/sourov-site-guardian/v1/resnapshot` (route is **POST-only**; GET stream calls 404 silently) → `files_hashed: 10`, `baseline_at 2026-10-25T12:40:33Z`, `healthy=true`.
  - Threshold interim: `min_published` 900 → **750** (buffer 21 above 729). Reversible in one option write. Target 900 preserved; the ~171-post batch is the pending next step (visualize-first plan needed).
- `google_site_verification` empty is by design (Site Kit 1.190.0 active; guardian UI says leave empty when Site Kit handles it).

## 2. MCP chain (down → up, verified end-to-end from this machine)

- 12:52Z: ports 3000/3001 refusing connections, cloudflared not running, Mistral connectors pointing at stale ephemeral URLs → full-chain down.
- Vibe restarted everything 13:03–13:04Z. Verified 13:04–13:10Z:
  - `localhost:3000/health` 200 (`my-mcp-connector`); `localhost:3001/health` 200 (`browser-control-mcp`, `chromeConnected:true`).
  - cloudflared PIDs 1492, 6852 running; both new trycloudflare URLs 200 on `/health` from this PC.
  - MCP `initialize` + `tools/list` through the **public** tunnel URLs: 3001 → **15 tools**, 3000 → **5 tools** (snake_case live names; see runbook for drift note).
- New connectors: `browser_control_mcp_a284`, `system_info_mcp_1786`; old `58b0`/`22c4` deleted. Connector-side `connected:true` set in Mistral UI by Vibe; re-confirm after any tunnel restart.
- Runbook: `MCP-CLOUD-CONNECTOR-RUNBOOK.md` (repo root).

## 3. Vibe MCP Bridge → v1.1.0 (deployed 13:06Z)

- Before: admin page read-only; server entries (stale 12-tool list) only editable via DB.
- After: nonce + capability-checked form to edit/add servers (key/name/url/tools), previous values kept in `vibe_mcp_servers_last_backup` for one-step rollback.
- Deploy safety: host backup at `/tmp/vibe-mcp-bridge.php.bak-20261025` (md5 of pre-upload file), `php -l` clean, perms intact, stored option untouched (read back 12+5 pre-change).
- Fallback copy of the plugin in this repo: `vibe/plugins/vibe-mcp-bridge/vibe-mcp-bridge.php`.

## 4. Efficiency audit (read-only; nothing changed)

- **Site Enhancer `sse_journey()`** = the one real cost: per travel-journal post request, uncached `get_posts(numberposts=200)` + title fetch per id ≈ up to ~200 DB round-trips. Suggested: 12h transient (pattern already used by sibling `sse_related()`). Not applied.
- Origami Header (2.5KB footer JS, passive, rAF-throttled): fine. Particle Field (5.4KB, DPR≤1.5, debounced resize, pauses on hidden, reduced-motion static frame): fine, opt-out filter exists. Index Hygiene (404-gated lazy 62KB redirect map; one-shot option-guarded robots.txt repair): fine.
- Dead code: Site Enhancer `rank_math/json_ld` filter (no Rank Math installed).

## 5. Red alerts

- **OPEN**: MySQL password for `u839078121_gVGpV` was echoed into an agent transcript at 12:26Z (failed sed redaction). Rotate in Hostinger panel; update `wp-config.php` + `~\.vibe\.env_secrets.md`.
- Easy MCP AI: 243 tools exposed to external AIs (OAuth/API-key); audit/revoke stale external tokens in WP-admin.
- 171-post batch to reach the 900 target: not started (needs visualize-first plan).

## Rollbacks

- Bridge: `cp /tmp/vibe-mcp-bridge.php.bak-20261025 wp-content/plugins/vibe-mcp-bridge/vibe-mcp-bridge.php` (host) or restore from `vibe/plugins/vibe-mcp-bridge/` after downgrading; option rollback via `vibe_mcp_servers_last_backup`.
- Threshold: option write `ssg_settings.min_published` back to 900 (or desired value).
