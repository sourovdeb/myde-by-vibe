# Sourov's Mistral Workflows

These are durable workflows (Mistral Workflows, Public Preview, built on Temporal) for sourovdeb.com, the ELT and Philosophy creator stack. They are scaffolds only: nothing has been registered or deployed.

## Index
| Workflow | What it does | Trigger |
|---|---|---|
| [content-scheduler](content-scheduler/) | Turns new site posts into LinkedIn, Medium, YouTube and podcast queue items, approved per post | Weekly schedule |
| [podcast-producer](podcast-producer/) | Article → script (approved) → audio → show notes → thumbnail brief | On demand / child |
| [wordpress-maintainer](wordpress-maintainer/) | Backup, approved minor updates, checksums, SEO audit, broken links | Weekly + monthly |
| [mishu-critical-thinking-decision-audit](mishu-critical-thinking-decision-audit/) | Socratic decision or argument audit with a pre-mortem and a 30-day outcome review | On demand (Vibe Work) |
| [academic-paper-pipeline](academic-paper-pipeline/) | Research idea → JEFL-style manuscript scaffold with DOI-verified citations | On demand, long-running |

Shared code: `shared/llm.py` (Agnes `agnes-2.5-flash` for cheap generation, TypeSafe for verification and dedupe), `shared/approval.py` (approve/revise/reject via `wait_for_input`), `scripts/ledger.py` (idempotent queue), `scripts/schedule_all.py` (schedules, created outside the worker).

## Safety & config (loops 01-30, 2026-10-21)
- `shared/config.py` loads keys from process env, then `~/.vibe/.env`, then `~/.vibe/.env_secrets.md`. Only names are ever logged.
- `MW_DRY_RUN=1` = no paid LLM calls, no WP updates. `MW_OUTPUT_ROOT` sets where outputs/queues go (Windows default `E:\ONE-STOP-SHOP\mistral-workflows`).
- Approvals fail closed: only a clear "approve/yes/ok" approves.
- PC bridge is read-only and allow-listed: see [SAFE-BRIDGE.md](SAFE-BRIDGE.md).
- Tests: `python tests/test_pure.py`. Change log: [loops/](loops/), [INDEX.md](INDEX.md), [CHECKPOINT.md](CHECKPOINT.md).

## Design rules (from the docs)
- The workflow code is deterministic. Use `workflow.now()`, `workflow.uuid4()`, and `workflow.random()`. All I/O happens in `@workflows.activity`.
- Every activity sets `start_to_close_timeout` and a retry policy. Long activities send heartbeats.
- There is a 2 s budget between activity calls and a 2 MB in/out limit per call. History is capped at 51,200 events or 50 MB, so batches stay small.
- The default `execution_timeout` is 1 h. Every workflow here that waits for a human raises it.
- Schedules use `client.workflows.schedules.schedule_workflow` (the `schedules=` decorator is deprecated). Times use `time_zone_name="Indian/Reunion"`.
- Keys come only from the environment (see `.env.example`).

## Setup (NOT run)
```bash
# key comes from env (~/.vibe/.env), never on the command line
uvx mistralai-workflows-cli@latest setup   # prompts or reads MISTRAL_WORKFLOWS_API_KEY
uv sync                         # installs mistralai-workflows[mistralai], httpx, pydantic
uv run python -c "import mistralai.workflows; print('ok')"
PYTHONPATH=. uv run python content-scheduler/workflow.py   # starts a worker
```

## Next steps
1. Rotate the Mistral API key that was pasted in chat, then run setup with the new key on your PC (`C:\Users\souro\.vibe` or `E:\ONE-STOP-SHOP`).
2. TypeSafe endpoint live-confirmed 2026-10-22: `POST https://api.typesafe.ai/v1/systemone` (model `jev-latest`). `shared/llm.py` now uses it; `TYPESAFE_BASE_URL` is optional. Only real (non-dry) runs call it.
3. Pick a TTS provider for `podcast-producer.render_audio`.
4. Add a WP-CLI `@production` alias, or switch `wordpress-maintainer` to the Hostinger API.
5. Deploy one worker, test `mishu-…` in Vibe Work (no external side effects), then run `scripts/schedule_all.py`.
6. Optional: consider Mistral Connectors (`connector()`, `@uses_connectors`, `Depends`) for GitHub, Notion and Drive once they are set up in Studio.

## Latch MCP Integration (2026-10-27)

All 5 workflows are enriched with Latch MCP awareness via `shared/latch.py` (327 lines, 20 activities). When Latch is reachable (port 3939), workflows can check DaVinci Resolve and OBS Studio status; when it's down, they degrade gracefully and continue.

### Enriched workflows

| Workflow | Latch activities used |
|---|---|
| podcast-producer | `latch_health`, `latch_resolve_status`, `latch_resolve_list_projects`, `latch_resolve_get_current`, `latch_resolve_list_timelines`, `latch_obs_status`, `latch_obs_list_scenes`, `latch_obs_get_current_scene`, `latch_obs_stream_status`, `latch_obs_record_status` |
| wordpress-maintainer | `latch_health`, `latch_obs_status`, `latch_obs_stream_status`, `latch_obs_record_status` |
| content-scheduler | `latch_health`, `latch_obs_status`, `latch_obs_list_scenes` |
| academic-paper-pipeline | `latch_health`, `latch_resolve_status` |
| mishu-critical-thinking-decision-audit | `latch_health` |

### One-click launcher

- **`start-all.cmd`** — idempotent launcher: starts Latch MCP + Cloudflare tunnel (via `E:\tools\latch\Latch-AutoStart.cmd`), verifies connectivity, reads tunnel URL from `status.json`, starts the workflows worker. Desktop shortcut: `C:\Users\souro\Desktop\ONE-STOP-SHOP Launcher.lnk`.
- **`start_worker.py`** — loads all 6 workflow classes via `importlib.util.spec_from_file_location` (dirs have hyphens, can't import as packages), calls `run_worker()`.
- Run manually: `cd E:\ONE-STOP-SHOP\mistral-workflows && .venv\Scripts\python.exe start_worker.py`

### Latch bridge scripts

- `E:\tools\latch-bridges\resolve_bridge.py` — 7 Resolve commands (status, list_projects, get_current, list_timelines, get_timeline_info, list_media_pool, get_resolve_version)
- `E:\tools\latch-bridges\obs_bridge.py` — 9 OBS commands (status, get_version, list_scenes, get_current_scene, switch_scene, list_sources, get_stream_status, get_record_status, list_profiles). Note: `switch_scene` is defined but NOT in the Latch allow-list (read-only posture).
- Allow-list: 15 commands in `C:\Users\souro\.mcp-autostart\latch.json` (7 Resolve + 8 OBS, no switch_scene)

### Chrome extension v2.0.0

- `C:\h\chrome-communication-extension\` — bumped to v2.0.0 with Latch MCP section in popup (health check, tunnel URL, tool list, panel button). Host permissions added for `localhost:3939` and `*.trycloudflare.com`.
- Extension ID: `pgenmhjililncdikjcbpidpgkglookmp` (loaded unpacked). Reload at `chrome://extensions/` after file changes.

### Audits (2026-10-27)

- **Security audit**: `E:\ONE-STOP-SHOP\SECURITY-AUDIT-2026-10-27.md` — 2 CRITICAL (unauthenticated Latch MCP endpoints, `window.eval` in content.js), 2 HIGH, 3 MEDIUM, 2 LOW, 2 INFO. Patches proposed, NOT applied.
- **Code audit**: `E:\ONE-STOP-SHOP\CODE-AUDIT-2026-10-27.md` — Health 82/100 (Good). 2,261 LOC, 14 files, 0 syntax errors.
- **Mix-of-agents audit**: `E:\ONE-STOP-SHOP\MIX-OF-AGENTS-AUDIT-2026-10-27.md` — 12/12 claims SUPPORTED.

### GitHub

All code pushed to `https://github.com/sourovdeb/myde-by-vibe` (commit `26207c2` on `main`, 2026-10-27): 39 files, 3,932 insertions. Includes enriched workflows, shared/latch.py, start_worker.py, start-all.cmd, chrome-extension v2.0.0, audit reports, .gitignore files, Latch-AutoStart.cmd, Latch-Status.ps1.

## Sources
- Overview, installation: https://docs.mistral.ai/studio/workflows/getting-started/installation
- Workflows core concepts (determinism, execution_timeout, limits): https://docs.mistral.ai/studio/workflows/getting-started/core_concepts/workflows
- Activities (retry, heartbeats): https://docs.mistral.ai/studio/workflows/getting-started/core_concepts/activities
- Scheduling: https://docs.mistral.ai/studio/workflows/building-workflows/scheduling
- Conversational workflows / wait_for_input / TodoList / Agent: https://docs.mistral.ai/studio/workflows/interacting-with-workflows/conversational_workflows
- Waiting for conditions: https://docs.mistral.ai/studio/workflows/building-workflows/waiting_for_conditions
- Child workflows: https://docs.mistral.ai/studio/workflows/building-workflows/sub_workflows
- Connectors: https://docs.mistral.ai/studio/workflows/building-workflows/connectors
- Repurposing best practice: https://scheduler.social/blog/how-to-repurpose-content , https://kompozy.io/content-repurposing/guide , https://n8n.io/workflows/14080
- WordPress: https://developer.wordpress.org/news/2024/09/website-security-checks-wp-cli-for-site-owners-and-administrators/ , https://eseospace.com/blog/wp-cli-guide/ , https://gigapress.net/wordpress-maintenance-checklist-2026/
