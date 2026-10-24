# myde-by-vibe

Working archive for sourovdeb.com recovery and maintenance work, driven by
Mistral Vibe on Sourov's PC. Each top-level item records a completed, verified
workstream — sources of truth for what was done, when, and with what evidence.

## Contents

| Path | What it is |
|---|---|
| `INDEXING_RECOVERY_PLAN.md` | Verified GSC/WP state, engine rules, dependency-ordered workstreams for the indexing recovery. |
| `RECOVERY.md` | Recovery narrative and handoff notes. |
| `recovery-metrics.md` | Dated review points: junk tag cleanup, known defects (REST 502, `rank_math_redirections` query, cron DB errors), open items. |
| `elt365-dedup-manifest.md` | Manifest of the ELT365 dedup: 507 duplicates + 36 junk drafts trashed, canonicals verified. |
| `tools/wp_dedupe_elt365.py` | Idempotent ELT365 dedup script (dry-run by default, `--apply` to trash duplicates). Credentials come from `WP_URL` / `WP_USER` / `WP_APP_PASSWORD` env vars — never hardcoded. |
| `tools/particle-field.html` | Standalone interactive particle-field tool (swirl, trails, controls, screenshot export). |
| `sessions/` | Dated session notes. |
| `vibe/` | Snapshot of the Vibe configuration used for this work (config, plugins, skills). |
| `H-drive/` | Mirror of the H-drive skill copy referenced by recovery work. |

## Conventions

- Every claim in these documents carries its date; re-verify before relying on it.
- Scripts read credentials from environment variables only.
- WordPress operations use REST with Application Passwords or SSH + WP-CLI;
  the `deploy.php` gateway is a last resort (see the security notice in
  `wp-ai-chatbot-connector`).
