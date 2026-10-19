# Recovery Backup - Vibe Agent Configuration (2026-10-19)

This repository is the fallback recovery source for Sourov's Vibe agent configuration on his Windows PC. If local files are lost, corrupted, or rewritten by another process, restore them from here.

## Restore mapping

| Repository path | Local path (Windows) |
|---|---|
| vibe/AGENTS.md | C:\Users\souro\.vibe\AGENTS.md |
| vibe/config.toml | C:\Users\souro\.vibe\config.toml |
| vibe/skills/SOUL.md | C:\Users\souro\.vibe\skills\SOUL.md |
| vibe/skills/AGENTS.md | C:\Users\souro\.vibe\skills\AGENTS.md |
| vibe/skills/local-software/SKILL.md | C:\Users\souro\.vibe\skills\local-software\SKILL.md |
| vibe/skills/evidence-first/SKILL.md | C:\Users\souro\.vibe\skills\evidence-first\SKILL.md |
| vibe/skills/skills/browser-harness/SKILL.md | C:\Users\souro\.vibe\skills\skills\browser-harness\SKILL.md |
| vibe/skills/skills/02-job-opportunity-collection/SKILL.md | C:\Users\souro\.vibe\skills\skills\02-job-opportunity-collection\SKILL.md |
| vibe/skills/skills/mishu-wordpress-operations/SKILL.md | C:\Users\souro\.vibe\skills\skills\mishu-wordpress-operations\SKILL.md |
| vibe/skills/skills/mishu-deep-online-investigation/SKILL.md | C:\Users\souro\.vibe\skills\skills\mishu-deep-online-investigation\SKILL.md |
| vibe/plugins/double-control/ (all files) | C:\Users\souro\.vibe\plugins\double-control\ |
| H-drive/00_SKILLS_AGENTS/1-wordpress-manager/skills/sourov-wordpress-design-troubleshooting/SKILL.md | H:\00_SKILLS_AGENTS\1-wordpress-manager\skills\sourov-wordpress-design-troubleshooting\SKILL.md |

## What these files encode (verified 2026-10-19)

1. Detached GUI launch rule: powershell.exe -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe'". Never launch a GUI app as 'app.exe &' from Git Bash (the shell holds the pipes, the call times out, and the timeout kills the process tree). Never use 'cmd //c start' with nested quotes (MSYS mangles them into Access denied).
2. browser-harness verified end-to-end flow: doctor, list_tabs, new_tab, js() DOM extraction, js() element click, download verification.
3. Download verification by evidence: compare file size to the server Content-Length (curl -sIL), check magic bytes (PK for EPUB/ZIP), then finalize. Chrome can leave a completed download as a .tmp file that must be copied to its final name.
4. Double Control system: Chrome extension (ID ohbmojhpccmbpidkjldonhdnekgpcplb) + browser-harness MCP server (E:\tools\uv-tools\bin\browser-harness-mcp.exe) + double-control plugin in ~/.vibe/plugins/double-control/.

## Restore procedure

1. Fetch a file: curl -sL https://raw.githubusercontent.com/sourovdeb/myde-by-vibe/main/<repo-path> -o <local-path>
2. After restoring config.toml, validate it parses and lists both MCP servers: resolve and browser-harness.
3. Restart Vibe (or run /reload) so the MCP server and plugin reattach.

## Notes

- config.toml contains no credentials (paths, model aliases, permissions only). Never commit .env files, client_secret JSON, or credential values to this repository.
- The browser-harness MCP entry was lost from config.toml once on 2026-10-19 (the file was rewritten by another process mid-session). Recheck it after any Vibe config rewrite.
- Line endings in this backup may be normalized; content is what matters.
