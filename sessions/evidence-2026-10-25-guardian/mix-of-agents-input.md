# Guardian Audit Input — sourovdeb.com, 2026-10-25

## Context
Site Guardian (WP plugin `sourov-site-guardian` v1.0.0) flagged `published_posts_below_threshold`
(published posts 729 vs configured threshold 900). Session applied two changes and audited
adjacent surfaces. All evidence below was verified live on 2026-10-25 via SSH to the Hostinger
box (92.249.46.84:65002) and direct endpoint reads.

## Claims under audit

C1. The guardian flag was genuine: `ssg_settings.min_published` = 900, published posts = 729,
so 729 < 900. (Evidence: PHP CLI option read + public /health JSON, both 2026-10-25.)

C2. Applied change 1: `min_published` updated 900 → 750 as an interim floor while the ~171-post
content gap (target 900) awaits the GAS publishing pipeline. Read-back: before=900 after=750
write=true, and the next /status still lists the threshold issue (729 < 750 by design).
Reversible: set option back to 900.

C3. Applied change 2: integrity baseline created via secured POST /resnapshot with the in-memory
API key. Read-back: files_hashed=10, baseline_at=2026-10-25T12:40:33Z, ok_count=10, healthy=true,
changed=[]. Before this, baseline_at=null and all 10 watched core files reported "no baseline",
i.e. tamper-detection was blind.

C4. Local MCP infrastructure down: health checks on localhost:3000 and localhost:3001 failed
(connection refused), cloudflared process not running, no recent tunnel log lines. Consequence:
the two Mistral cloud connectors (browser_control_mcp_58b0, system_info_mcp_22c4) point at
stale ephemeral trycloudflare URLs; any cloud-side MCP call will fail until servers restart
and connector URLs are re-registered. Also: AGENTS.md documents 15 tools for port 3001 but the
user's client shows 12 — count discrepancy unexplained (stale doc or removed tools).

C5. Secret exposure incident: during probing, the production MySQL password from wp-config.php
was echoed into the session transcript (a sed-based redaction silently failed). Mitigation:
rotate the DB password for user u839078121_gVGpV, update wp-config.php, sync the copy in
C:\Users\souro\.vibe\.env_secrets.md. The SSH password was used in-memory only (never printed).

C6. Easy MCP AI plugin v2.2.2 exposes 243 tools to external AI services (Claude/ChatGPT etc.)
via OAuth-style discovery + Basic-auth API key; its own routes live under /easy-mcp-ai/v1/.
Unauthenticated probes to the MCP namespace returned 404 (probe used a guessed namespace
path `easy-mcp/...`; the real namespace is `easy-mcp-ai/v1/` per its route table). Remaining
unverified: which external services currently hold valid tokens and whether any leaked.

C7. Vibe MCP Bridge v1.0.0 is a single-file admin plugin: registers option `vibe_mcp_servers`
and an admin menu page; grep found no public REST routes, no nonces visible, no
wp_remote_post/cron in the scanned file. Admin-only exposure (login required).

C8. The earlier 404 on POST /resnapshot was my own mistake: the first call used a GET-style
stream context (file_get_contents default method GET) against a POST-only route. Re-sent as an
explicit POST and succeeded. The route registration in the plugin is correct.

## Criteria
What a good result means here: (1) the guardian's only remaining flag is content volume, which is
being addressed by a documented pipeline; (2) tamper-detection actually functions; (3) no
unmitigated secret exposure remains; (4) the local→cloud MCP bridge state is accurately documented
with a concrete recovery command.

## Requested verdicts
Per claim: SUPPORTED / CONTRADICTED / MIXED / UNPROVEN against the evidence above, plus
severity ranking of the four red-alert candidates: C4 (bridge down), C5 (password exposure),
C6 (MCP tool surface), C7 (bridge plugin admin-only).
