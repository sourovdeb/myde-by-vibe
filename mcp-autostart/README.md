# MCP AutoStart (3000/3001) — no agent dependency

Created 2026-10-25. Guarantee: the two local MCP servers are up whenever Chrome
is opened (or right after logon), started by plain Windows infrastructure only
— no Vibe, OpenCode, Pi, or any other agent involved.

## Services

| Port | Service | Entry point | Tools |
|------|---------|-------------|-------|
| 3000 | my-mcp-connector | `C:\Users\souro\.vibe\plugins\my-mcp-connector\server\http-server.js` | 5 system tools |
| 3001 | browser-control-mcp | `C:\Users\souro\.vibe\plugins\browser-control-mcp\server\http-server.js` | 15 browser tools |

Both start as `node <http-server.js>` (deps in each folder's `node_modules`;
no `.env` needed — ports come from in-file defaults). Node: `C:\Program Files\nodejs\node.exe`.

## Files (live copy: `C:\Users\souro\.mcp-autostart\`)

- `start-mcp-servers.ps1` — idempotent starter. TCP port-check per service;
  starts anything not listening via detached `Start-Process` (hidden window,
  output to `logs\<name>.out.log` / `.err.log`, pid in `pids\<name>.pid`).
  Exits 0 when both local MCPs are up. Optional Cloudflare-tunnel restart
  behind env flag `MCP_AUTOSTART_TUNNELS=1` (tunnels are ephemeral URLs —
  after a restart the Mistral connectors must be re-pointed manually; see
  `~\.vibe\docs\TUNNEL-URLS-2026-10-24.md`).
- `launch-chrome-with-mcp.vbs` — silent launcher used as the Chrome shortcut
  target: runs the starter (waits for it), then starts
  `C:\Program Files\Google\Chrome\Application\chrome.exe` with no flags.
  Arg `servers-only` skips Chrome (used by the Startup entry).
- `mcp-servers-autostart.vbs` — servers-only logon runner.
- `backup\` — original Chrome desktop + Start-menu `.lnk` files.

## Triggers (two independent layers)

1. **Chrome click (crash self-heal, primary user path):** the desktop and
   Start-menu "Google Chrome" shortcuts are retargeted to
   `wscript.exe "...\launch-chrome-with-mcp.vbs"` (Chrome icon preserved via
   IconLocation). Taskbar pins resolve through the same .lnk chain, so
   clicking Chrome anywhere starts the servers first (~1-2 s) then Chrome.
2. **Logon (whole-session guarantee):** `MCP-3000-3001-autostart.lnk` in
   `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup` runs
   `mcp-servers-autostart.vbs` at logon. (Task Scheduler registration was
   tried and failed with Access denied on this machine, ACL; Startup folder
   is the non-elevated equivalent.)

## Verified 2026-10-25

- Kill test: both node processes stopped → `cscript launch...vbs servers-only`
  → ports 3000/3001 listening again within 2 s; new pids written.
- `/health` 3000 → HTTP 200 `{"status":"ok",...}`.
- 3001 `/health` takes ~75 s: it probes browser-harness (60 s internal timeout).
  The starter therefore uses TCP port checks, never `/health`, and never blocks
  Chrome on it. Don't read 3001's health with a short client timeout.

## Maintenance

- Uninstall: restore `backup\*.lnk` targets, delete the Startup `.lnk`, delete
  `C:\Users\souro\.mcp-autostart\`.
- If a plugin folder moves, edit the two service rows in
  `start-mcp-servers.ps1` (single source of truth).
