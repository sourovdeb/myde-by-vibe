# Session 2026-10-25 (later) — Full 3-layer verification: Vibe → Agnes → TypeSafe

Agent: Mistral Vibe. Every result below is from a tool output this session
(2026-10-25 ~13:17–13:35Z). Secrets never written here; values referenced by
name/length only.

## What was verified (one target at a time)

| # | Target | Test | Result |
|---|---|---|---|
| 1 | 15 WP plugins | `wp plugin list` via SSH + live checks | All **active**, versions match the admin list. Homepage 200 (www→non-www 301 first), robots.txt served, wp-sitemap.xml 200, `/library/`→`/#library` 301, post 712 → 200. Particle Field 1.0.0 / Origami 1.1.0 / Site Enhancer 1.2.0 assets enqueued. |
| 2 | Chrome extension | `chrome.developerPrivate` + popup page | Double Control Extension `pgenmhjililncdikjcbpidpgkglookmp`: **ENABLED**, UNPACKED from `C:\h\chrome-communication-extension`, **0 errors**. Popup renders "Refresh Tabs" + "Remote Debugging"; health readout live: `MCP 3000: UP | MCP 3001: UP +chrome`. |
| 3 | MCP 3000 | `/health` + `tools/list` + real `health_check` call | 5 tools (snake_case), live call returned data. |
| 4 | MCP 3001 | `/health` + `tools/list` + real `browser_list_tabs` call | Exactly 15 tools, `chromeConnected:true`, live call returned real tab data. |
| 5 | Both tunnels | `/health` + real tool calls via public URLs | Both 200; tool calls returned live data through the public internet. |
| 6 | Mistral connectors | Detail pages via browser (the hop a CLI-only agent cannot test) | `browser_control_mcp_a284` (15 tools) and `system_info_mcp_1786` (5 tools): full tool lists, **no** "cannot reach" error → Mistral's backend reaches both through the tunnels. |

Also confirmed live via `wp option get ssg_settings`: `min_published` **750**
(the interim change, now verified on the host), `google_site_verification`
empty (Site Kit handles it).

## Layer 2 — Agnes cross-reference (agnes-2.5-flash)

Given only the evidence pack (no access to tools), Agnes judged: chain claim
**SUPPORTED**, min_published **SUPPORTED**, plugins **PARTIALLY SUPPORTED**
(activation proven; per-plugin runtime — Akismet filtering, LinkedIn publishing
— not exercised), Bridge form/backup and sse_journey "not in pack" (both were
verified separately by direct inspection). Useful catches: name the plugin
behind an asset path explicitly; label inferred mappings as inferred.

## Layer 3 — TypeSafe (jev-latest, noul)

- Plugins active + site serving: **0.94** (confirmed)
- Extension + servers + tunnels + connectors end-to-end: **0.95** (confirmed)
- "min_published change was authorized" (negative control): **0.04** — correctly NOT established.

## Problems hit this session — reminders for the next agent

1. **G: and H: were unmounted** (external drive unplugged). The provider-router
   helper lives on H: (`H:\00_SKILLS_AGENTS\...\provider_router.py`) and was
   unreachable. Fallback that worked: call Agnes (`https://apihub.agnes-ai.com/v1/chat/completions`,
   model `agnes-2.5-flash`, set `max_tokens` 8000+) and TypeSafe
   (`https://api.typesafe.ai/v1/systemone`, model `jev-latest`, noul question)
   directly — exact request shapes in `E:\scripts\lib\ai.ps1`. Do not hard-depend on H: for tooling.
2. **browser-harness `switch_tab()` takes a targetId string, not a list index** —
   passing an int fails with a cryptic `Failed to deserialize params.targetId` error.
3. **SSH `find / -maxdepth 4` misses the WordPress install** — it lives at
   `~/domains/sourovdeb.com/public_html/` (deeper than 4 levels). Go straight there.
4. **The Bridge backup in `/tmp` on the host is volatile** — a host reboot wipes it.
   Copy it to a persistent path (e.g. `~/backups/`) before relying on it. Verified
   present 2026-10-25: `/tmp/vibe-mcp-bridge.php.bak-20261025`, 2055 bytes,
   md5 `78de5cae9765a3465917c77ebab6e660` (mtime Oct 23 18:14 — name/mtime mismatch, likely TZ).
5. **Ephemeral tunnel URLs break both Mistral connectors on every restart.** The
   durable fix is a named Cloudflare tunnel (needs a CF account) — still not done.
6. **DB password was echoed into an agent transcript 2026-10-25 12:26Z** (not into
   this repo — the repo's `credentials/` files carry truncated values only).
   Rotation in the Hostinger panel is still OPEN and is the top-priority item.
7. **`ssg_settings` still stores the old deploy-gateway key in plaintext** in the
   WP options table. One more reason to retire `deploy.php` and rotate that key.
8. **Mistral connections page shows a "Needs attention 1" badge** — likely the old
   `Wordpress_mcp` connector; unverified, check when next in the UI.

## Open decisions (owner: Sourov)

| # | Decision | Options |
|---|---|---|
| 1 | DB password rotation | Rotate in Hostinger panel → update `wp-config.php` + `~\.vibe\.env_secrets.md` |
| 2 | `min_published` | Keep 750 as interim, or revert to 900 and run the ~171-post batch (visualize-first plan required) |
| 3 | `sse_journey()` caching | Apply the 12h-transient fix (pattern already at line 97 of the same file); proposed, not applied |
| 4 | Backup durability | Copy `/tmp` backup to `~/backups/` on the host |
| 5 | Durable connector URLs | Named Cloudflare tunnel instead of ephemeral quick tunnels |

## Method note (the guideline)

Three independent layers agreed: direct tool tests (ground truth), an LLM
cross-reference constrained to the evidence pack (catches overclaims and
ambiguity), and a probabilistic verifier with a deliberately planted negative
control (catches "everything passes" bias). Reuse this pattern for any
"everything is fine" claim: test it, have it cross-read, and include one
question whose true answer is "no".
