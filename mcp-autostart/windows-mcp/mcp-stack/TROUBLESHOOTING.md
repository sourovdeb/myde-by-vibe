# MCP Stack Troubleshooting Runbook (no-agent edition)

> Created 2026-10-27 after the session where all four Cloudflare quick tunnels died and every
> Mistral connector stopped authorizing. Read this file BEFORE calling an agent next time.
> The stack: `latch :3939`, `mcp-bridge :8765`, `sysinfo :3000`, `browser :3001` +
> 4 cloudflared quick tunnels. Supervisor: `E:\tools\mcp-stack\mcp-stack.exe`.

## One-command triage

```bat
E:\tools\mcp-stack\mcp-stack.exe doctor
```

It prints each server (OK/DOWN), each tunnel (live / 429-rate-limited / DEAD), whether the
bridge's `public_url` still resolves, and the exact next command for each problem.

## Symptom → fix table

| Symptom | Cause (verified 2026-10-27) | Fix |
|---|---|---|
| Mistral authorize fails at `…trycloudflare.com/mcp` | quick-tunnel host rotated/died; `public_url` or connector points at a dead host | `mcp-stack reconnect` → `mcp-stack status` → paste the 4 new URLs into `chat.mistral.ai/connections`; for the bridge URL also `mcp-stack fix-url` (writes live 8765 URL into `%APPDATA%\mcp-bridge\config.json` and restarts the bridge) |
| `http://127.0.0.1:3939/panel` → "not found" | the panel route requires `?token=<64>` — opening bare `/panel` always 404s even when latch is fine | get the correct URL (token not printed to chat): `E:\tools\latch\latch.exe panel > %APPDATA%\mcp-stack\latch-panel-url.txt` then open that file |
| `:8767` admin page unreachable but `:8765`/`:8766` up | admin_port config or an earlier stop of the bridge; bridge binds all three at once | `mcp-stack start -bridge`; the 8767 admin page also has Start/Stop buttons |
| All 4 tunnel spawns fail with "provisioning failed with status 429" | Cloudflare rate-limits quick-tunnel *provisioning* after repeated respawns (the respawn loop itself causes it) | do NOT retry in a tight loop; wait ≥ 2 minutes; `mcp-stack reconnect` paces 40 s between spawns and adds a 120 s backoff when it detects a recent 429 |
| A server port is DOWN | process died (reboot, crash, RAM OOM) | `mcp-stack start -latch|-bridge|-sysinfo|-browser` (or `start --all`). The silent watcher (`--watch`) already does this automatically if free RAM ≥ 1536 MB |
| Tunnels came up but `status` shows "url pending" | URL capture reads `%APPDATA%\mcp-stack\logs\tunnel-PORT.err`; if the line is still absent after 30 s it was a 429 | check that `.err` file; if 429, back off and `mcp-stack reconnect` |
| After reboot everything is dead including autostart | the Startup VBS only re-runs the watcher; tunnels are re-provisioned only when `start` runs with a live cloudflared path | `mcp-stack start --all` (pacing needed: add 20–40 s between manual runs; `reconnect` does it) |

## Prevention (already in place, 2026-10-27)

1. **Watcher with tunnel respawn + 429 backoff** — `mcp-stack.exe start --all --silent --watch`
   (installed in Startup as `mcp-stack-autostart.vbs`): restarts any dead *server*, respawns any
   dead *tunnel*, and refuses provisioning when the last attempt was 429 (waits 120 s).
2. **RAM floor** — watch skips all restarts under 1536 MB free; spawn checks a 1 GB combined budget.
3. **Never spawn duplicate cfs** — `reconnect` kills the recorded pid first; manual cloudflared
   launches (the old `cf2-*` batch) are what created the duplicates that OOM-killed the whole set.
   One launcher = `mcp-stack`, full stop.
4. **`doctor` flags the two stale-URL traps**: dead `public_url` host in the bridge config, and
   "no tunnel URLs captured yet".

## Still open (needs Sourov)

- **Named Cloudflare tunnel** (stable hostname, no rotation, no 429 churn): log into
  dash.cloudflare.com → Networks → Tunnels → create worker `sourov-mcp` + 4 hosted services;
  then replace `C:\tmp\cloudflared.exe tunnel --url …` with `cloudflared tunnel run sourov-mcp`.
  Until then every reboot/rotation repoints 4 Mistral connectors.
- **Mistral connector URLs**: after every reconnect, paste the 4 fresh URLs into
  `chat.mistral.ai/connections` (tRPC bulk-recreate available if API session is live).
- **Grok OAuth 2.1 consent**: connector registered but consent never completed.

## Session audit (what broke and why, compact)

- 05:5x–06:1x UTC — repeated `start --all` retries + a PS1-era duplicate-cf habit → 8+ cf
  instances → provisioning 429-storm → all cfs exited → all 4 public hosts dead → authorize
  failures on `mounts-scratch-jimmy-weight` (already-dead host) in the bridge config.
- 10:2x — duplicate mcp-stack watchers (10608/15960) briefly coexisted; keep only one:
  `Get-Process mcp-stack` should show exactly 1 watcher.
- Defects found in this pass (fixed in the new binary): URL extractor read the wrong log file
  (`.log` instead of `.err`), grabbed the Cloudflare terms URL from the banner, `-tunnels` alone
  spawned nothing, watch loop could re-spawn into a 429 storm. All closed; 4 unit tests + build green.
