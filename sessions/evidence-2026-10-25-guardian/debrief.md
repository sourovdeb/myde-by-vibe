# Debrief — 2026-10-25 session (pi / mishu-wordpress-operations)

## What happened
1. Guardian flag `published_posts_below_threshold` diagnosed live (SSH): threshold `min_published=900`, published 729 → real gap of 171.
2. Executed (user-approved "do all"):
   - `min_published` 900 → 750 (interim floor; target 900 stays with the 171-post pipeline option, not started — needs visualize-first plan).
   - Integrity baseline created via secured `POST /resnapshot` (10 files, 12:40:33Z; healthy=true). Gotcha: route is POST-only; a GET-style stream call 404s silently.
3. Vibe (parallel agent) restored the MCP chain: servers 3000/3001 up, new cloudflared tunnels, connectors `a284`/`1786` created, old `58b0`/`22c4` deleted. **I re-verified**: both /health 200, chromeConnected:true, both tunnel URLs reachable from this machine.
4. 15-vs-12 tool discrepancy explained: the WP `vibe_mcp_servers` option was seeded with 12 tools; the live server source (`http-server.js`) registers 15. The admin UI showed the stale 12.
5. Vibe MCP Bridge updated to v1.1.0 (deployed 13:06Z): admin form to manually add/edit server entries (key/name/url/tools), nonce + capability checked, previous values kept in `vibe_mcp_servers_last_backup`. Lint clean, perms correct, stored option untouched.
6. Efficiency audit (read-only) of Index Hygiene / Origami Header / Particle Field / Site Enhancer — see findings below.

## Red-alert status
- **OPEN (yours)**: rotate MySQL password for `u839078121_gVGpV` — it was echoed into the 12:26Z transcript by a failed redaction (mine).
- Cleared: MCP stack down + stale connectors (verified up at 13:04Z).
- Easy MCP AI: 243 tools exposed to external AIs via OAuth/API-key — medium; check the token list in WP-admin, revoke stale external tokens. No public unauthenticated routes found.

## Efficiency findings (proposals only — nothing changed)
- **Site Enhancer `sse_journey()` (the one real cost)**: per travel-journal post request, uncached `get_posts(numberposts=200)` + `get_the_title()` per id ≈ up to ~200 DB round-trips. Suggested: 12h transient keyed by post id (same pattern `sse_related()` already uses), or precompute part numbers.
- Origami Header: 2.5KB footer JS, passive listeners, rAF-throttled — fine.
- Particle Field: 5.4KB, DPR capped 1.5, resize debounced 150ms, pauses when hidden, reduced-motion → static frame — fine; opt-out filter `sourov_particle_field_enabled(false)` exists for heavy pages.
- Index Hygiene: 404-gated lazy include of the 62KB redirect map; one-shot robots.txt repair guarded by option; sitemap tag prune is one query per generation — fine. Optional micro-opt: const-ify the map (opcache preload) if 404 volume grows.
- Dead code: `rank_math/json_ld` filter in Site Enhancer never fires (no Rank Math; site uses core sitemaps). Harmless.

## Open items
- "3. later ." from the task list — content unknown, not executed; clarify when relevant.
- Site Kit dashboard (#key-metrics): noted; Site Kit 1.190.0 active ⇒ guardian's empty `google_site_verification` is by design (its own UI says leave empty when Site Kit handles it). No action.
- Optional next: bridge form visual check at /wp-admin?page=vibe-mcp-bridge; then the 171-post batch plan (visualize-first).

## Rollbacks
- Bridge: `cp /tmp/vibe-mcp-bridge.php.bak-20261025 wp-content/plugins/vibe-mcp-bridge/vibe-mcp-bridge.php` (host) + restore `vibe_mcp_servers_last_backup` option if a bad save.
- Threshold: set `ssg_settings.min_published` back to 900 (or any value).
