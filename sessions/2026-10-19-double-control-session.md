# Session Log — 2026-10-19: Double Control System + Full Config Backup

## What this session accomplished

### 1. Double Control system built and verified
Two simultaneous control channels over Sourov's real Chrome (logged-in profile):

- **Channel 1 — browser-harness MCP (external CDP)**: connected to real Chrome,
  23 tools (list_tabs, new_tab, switch_tab, close_tab, capture_screenshot,
  click_at_xy, type_text, page_info, navigate, doctor, ...).
  - Executables: `E:\tools\uv-tools\bin\browser-harness.exe` and
    `E:\tools\uv-tools\bin\browser-harness-mcp.exe`
  - CLI heredoc usage: `browser-harness <<'PY' ... PY`
  - Registered in `C:\Users\souro\.vibe\config.toml` AND in the plugin's `mcp.json`
- **Channel 2 — Double Control Chrome Extension (in-browser)**: installed
  unpacked from `H:\chrome-communication-extension`
  - Extension ID: `ohbmojhpccmbpidkjldonhdnekgpcplb`
  - Popup UI lists all tabs, click to switch, auto-refresh every 2 s
  - External messaging via `chrome.runtime.onConnectExternal`

### 2. Live test performed (evidence, not claims)
- Launched the real pinned Chrome (user profile, logged in) via
  `powershell.exe -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe'"`
- Navigated to gutenberg.org and downloaded a Dostoevsky book through the
  real browser
- Download verification pattern: byte size vs `curl -sIL` Content-Length +
  magic bytes; Chrome leaves finished downloads as `.tmp` — copy to final name
- Screenshots taken and inspected during the process

### 3. Agent config updated (11 files) — all backed up in this repo
| Local file | Repo path | Change |
|---|---|---|
| `C:\Users\souro\.vibe\AGENTS.md` | `vibe/AGENTS.md` | "Browser control (double control)" section — loads every session |
| `C:\Users\souro\.vibe\skills\SOUL.md` | `vibe/skills/SOUL.md` | Capability line: operate real Chrome, prove results with evidence |
| `C:\Users\souro\.vibe\skills\AGENTS.md` | `vibe/skills/AGENTS.md` | "Live browser control" section in Chief of Staff contract |
| `C:\Users\souro\.vibe\config.toml` | `vibe/config.toml` | browser-harness MCP server entry restored |
| `skills\skills\browser-harness\SKILL.md` | `vibe/skills/skills/browser-harness/SKILL.md` | "Windows (this PC)" section: launch rule, download verification, screenshot-during-download gotcha |
| `skills\local-software\SKILL.md` | `vibe/skills/local-software/SKILL.md` | Detached launch rule for all GUI apps |
| `skills\evidence-first\SKILL.md` | `vibe/skills/evidence-first/SKILL.md` | Download-completion evidence pattern |
| `skills\skills\02-job-opportunity-collection\SKILL.md` | `vibe/skills/skills/02-job-opportunity-collection/SKILL.md` | Live browser note for JS listings / logged-in LinkedIn |
| `skills\skills\mishu-wordpress-operations\SKILL.md` | `vibe/skills/skills/mishu-wordpress-operations/SKILL.md` | Live interface checks via harness |
| `skills\skills\mishu-deep-online-investigation\SKILL.md` | `vibe/skills/skills/mishu-deep-online-investigation/SKILL.md` | Escalation path: curl → browser-harness for JS/bot-protected/logged-in pages |
| `H:\00_SKILLS_AGENTS\1-wordpress-manager\skills\sourov-wordpress-design-troubleshooting\SKILL.md` | `H-drive/00_SKILLS_AGENTS/1-wordpress-manager/skills/sourov-wordpress-design-troubleshooting/SKILL.md` | "A browser always exists on this PC" — harness replaces the old caveat |

### 4. Vibe plugin created and backed up
`C:\Users\souro\.vibe\plugins\double-control\` — full contents in
`vibe/plugins/double-control/` in this repo (plugin.json, mcp.json,
INSTRUCTIONS.md, hooks.toml, KNOWLEDGE.md, browser-double-control skill).

## Backup commits in this repo (branch `main`)
| Commit | Contents |
|---|---|
| `52a83fd` | RECOVERY.md, vibe/AGENTS.md, vibe/config.toml, vibe/skills/SOUL.md, vibe/skills/AGENTS.md |
| `efc2d67` | local-software, evidence-first, browser-harness, 02-job-opportunity-collection SKILL.md files |
| `eb2daf9` | mishu-wordpress-operations, mishu-deep-online-investigation, sourov-wordpress-design-troubleshooting |
| `b308e69` | double-control plugin (all 6 files) |
| (this commit) | sessions/2026-10-19-double-control-session.md |

## Gotchas discovered this session (remember these)
1. **Chrome launch rule**: use
   `powershell.exe -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe'"`
   — never `chrome.exe &` from Git Bash, never `cmd //c start` with nested quotes.
   This launches the real pinned taskbar Chrome with the logged-in profile.
2. **PowerShell BOM**: piping heredocs into `browser-harness` injects a BOM
   (U+FEFF). Write the script with `[IO.File]::WriteAllText()` then
   `cmd /c 'type script.py | browser-harness'`.
3. **Screenshot on chrome:// pages fails** (Chrome restriction) — works on
   normal HTTP/HTTPS pages only.
4. **Function name**: v0.1.13 uses `capture_screenshot()`, not `screenshot()`.
5. **Real exe path**: `E:\tools\uv-tools\bin\`, not `~\.local\bin`.
6. **config.toml is rewritten by another process** (active_model changed
   mid-session). After any rewrite, recheck that the `browser-harness` MCP
   entry survived. Backup of the pre-restore config:
   `config.toml.bak-before-browser-harness-restore`.
7. **Git identity**: no global git identity on this PC; use repo-local
   `Sourov <sourovdeb@example.com>` (matches H:\chrome-communication-extension).
8. **Line endings**: files in this repo may be LF-normalized; content is what
   matters on restore.
9. **Downloads**: Chrome leaves finished downloads as `.tmp` — copy to the
   final name, then verify size + magic bytes.

## Fallback / related repositories
- `https://github.com/sourovdeb/chrome-communication-extension` — extension source
- `https://github.com/sourovdeb/Smart-Browser` — portable Electron automation shell (reference)
- `https://github.com/sourovdeb/browser-bot` — Python + Playwright + Ollama automation (reference)

## Restore procedure
See `RECOVERY.md` at the repo root for the full local-path ↔ repo-path mapping
and step-by-step restore. This session log is the human-readable record of
*why* those files look the way they do.
