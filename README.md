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
| `tools/mcp-servers/` | Clean-room v2 rewrites of the two local MCP servers behind the Vibe MCP Bridge: `my-mcp-connector.js` (:3000, 5 tools) and `browser-control-mcp.js` (:3001, 15 tools). Single-file Node, zero deps, 50-test suite (mock CDP — see README for verified limits). |
| `sessions/` | Dated session notes. |
| `vibe/` | Snapshot of the Vibe configuration used for this work (config, plugins, skills). |
| `vibe/plugins/vibe-mcp-bridge/vibe-mcp-bridge.php` | Fallback copy of the WordPress Vibe MCP Bridge plugin v1.1.0 (2026-10-25: admin form to add/edit MCP server entries + `vibe_mcp_servers_last_backup` rollback option). |
| `MCP-CLOUD-CONNECTOR-RUNBOOK.md` | Durable reconnect procedure for the Mistral cloud → Cloudflare tunnel → local MCP chain (ports, verify steps, tRPC connector flow, red-alert register). |
| `sessions/2026-10-25-guardian-audit.md` | Session notes: guardian threshold remediation, MCP chain recovery, bridge v1.1.0, efficiency audit, open red alerts. |
| `sessions/2026-10-25-mcp-server-upgrade.md` | Session notes: MCP server audit, clean-room v2 rebuild, request-handler bug found and fixed by the test suite, 50/50 test results and honest limits. |
| `sessions/2026-10-25-full-verification.md` | Three-layer verification (Vibe direct → Agnes cross-reference → TypeSafe with negative control) of all plugins, extension, MCP servers, tunnels and connectors; session problems as reminders; open decisions. |
| `H-drive/` | Mirror of the H-drive skill copy referenced by recovery work. |
| `latch/` | Rust source for Latch MCP bridge (port 3939, 6 tools: file ops, run_task, desktop control). Builds to `latch.exe` via `cargo build --release`. CI: `.github/workflows/build-latch.yml`. |
| `unified-mcp-gateway/` | Unified MCP Gateway source (port 3002, 39 tools: 13 native + 26 proxied). Node.js SEA build produces `gateway.exe`. CI: `.github/workflows/build-gateway.yml`. |
| `resilience/` | Fallback & recovery system: health-monitor.ps1 (30s checks), watchdog.ps1 (auto-restart), tunnel-failover.ps1 (backup Cloudflare tunnel). See `resilience/RESILIENCE-ARCHITECTURE.md`. |
| `sourov-control-center/` | Sourov Control Center — Python+pywebview .exe UI for managing all MCP services. CI: `.github/workflows/build-control-center.yml`. |
| `chrome-extension/` | Double Control Extension v2.1.0 — Chrome extension with Latch MCP toggle, debug panel, and gateway integration. CI: `.github/workflows/test-extension.yml`. |
| `.github/workflows/` | GitHub Actions CI/CD: build-latch.yml, build-gateway.yml, build-control-center.yml, test-extension.yml. All produce downloadable artifacts; tagged releases auto-publish. |

## PC Control Architecture (2026-10-27)

```
chat.mistral.ai / Pi / Vibe
        |
        v
+-------------------------+
|  Cloudflare Tunnel      |  https://things-clerk-houston-gras.trycloudflare.com
|  (ephemeral trycloudflare)|
+-------------------------+
        |
        v
+-------------------------+
|  Unified MCP Gateway    |  Port 3002 - 39 tools (13 native + 26 proxied)
|  gateway.exe (Node SEA) |  run_command, manage_process, screenshot, clipboard,
|  or: node server.js     |  manage_file, manage_service, network_info,
|                         |  install_package, notify, window_management,
|                         |  registry_read, get_env, system_info_extended
|                         |  + proxied: latch (6), connector (5), browser (15)
+-------------------------+
        |
        +--> Latch MCP (3939) - latch.exe (Rust, 507KB)
        |     list_files, read_file, search_files, write_file, run_task, control_desktop
        +--> my-mcp-connector (3000) - Node.js
        |     health_check, system_info, one_stop_shop_status, credential_env_present, vibe_skill_list
        +--> browser-control-mcp (3001) - Node.js
              15 browser_* tools (Chrome CDP automation)

+-------------------------+
|  Resilience Layer       |  health-monitor.ps1 -> watchdog.ps1 -> tunnel-failover.ps1
|  (resilience/)          |  Auto-restart down services, backup tunnel on failure
+-------------------------+

+-------------------------+
|  Sourov Control Center  |  sourov-control-center/ - .exe UI (Python+pywebview)
|  (sourov-control-center)|  Start/stop all services, view status, quick actions
+-------------------------+
```

**Build artifacts (via GitHub Actions):**
- `latch.exe` - Rust release build (windows-latest, ~500KB)
- `gateway.exe` - Node SEA single-executable (~120MB, includes Node runtime)
- `Sourov Control Center.exe` - PyInstaller onefile (~12MB)

**Fallback chain:** If the primary Cloudflare tunnel disconnects, `tunnel-failover.ps1` starts a backup tunnel and writes the new URL to `tunnel-failover-status.json`. Update the Mistral AI connector to the new URL. If a local service crashes, `watchdog.ps1` auto-restarts it (max 5/hour).

## Conventions

- Every claim in these documents carries its date; re-verify before relying on it.
- Scripts read credentials from environment variables only.
- WordPress operations use REST with Application Passwords or SSH + WP-CLI;
  the `deploy.php` gateway is a last resort (see the security notice in
  `wp-ai-chatbot-connector`).
