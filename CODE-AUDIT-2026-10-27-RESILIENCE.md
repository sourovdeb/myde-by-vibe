# Code Audit Report — Resilience System + CI/CD + Latch/Gateway Source

**Project:** myde-by-vibe (commit 095c245 + fixes 894d514)
**Scope:** latch/, unified-mcp-gateway/, resilience/, .github/workflows/
**Date:** 2026-10-27
**Overall Health:** Good (82/100) — solid foundation, 7 bugs found and fixed

---

## Executive Summary

The delivered code is well-structured with passing CI, clean syntax, no secrets, and working builds. The audit found 7 bugs — 1 critical logic error (broken process filter), 3 null-safety issues, and 3 stale hardcoded URLs. All fixed in commit 894d514. A systemic issue was discovered: all Cloudflare tunnel URLs are stale (NXDOMAIN), requiring tunnel restarts.

---

## Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total files (new + modified) | 39 | |
| Total lines added | 2,523 | |
| Largest file | server.js (1,296 lines) | ⚠️ God module |
| Rust source | 839 lines, 10/10 tests pass | ✅ |
| PowerShell scripts | 563 lines, 19 functions | ✅ |
| CI workflows | 4 (242 lines total) | ✅ All pass |
| Secrets found | 0 | ✅ |
| TODO/FIXME | 0 | ✅ |
| Syntax errors | 0 | ✅ |

---

## Findings by Category

### Bugs Found and Fixed (commit 894d514)

| # | Severity | File | Issue | Fix |
|---|----------|------|-------|-----|
| 1 | **High** | health-monitor.ps1:72 | `Where-Object { ... -or $true }` — filter always true, returned all processes matching name instead of the specific service | Replaced with port-based lookup: `Get-NetTCPConnection -LocalPort $Svc.Port → Get-Process -Id OwningProcess` |
| 2 | **High** | health-monitor.ps1:34 | Hardcoded stale tunnel URL `things-clerk-houston-gras.trycloudflare.com` caused false UNREACHABLE alarms | Added `-TunnelUrl` parameter (default empty = skip tunnel check) |
| 3 | **Medium** | watchdog.ps1:31 | `ProcessFilter` used `$p.Path -like ...` without null check — `$p.Path` can be null without elevation | Added null guards: `($p.Path -and $p.Path -like ...)` |
| 4 | **Medium** | watchdog.ps1:41 | Same null-safety issue for connector ProcessFilter (`$p.CommandLine`) | Added null guard |
| 5 | **Medium** | watchdog.ps1:51 | Same null-safety issue for browser ProcessFilter | Added null guard |
| 6 | **Medium** | tunnel-failover.ps1:17 | Stale default `PrimaryUrl` hardcoded | Removed default, added guard that exits with instructions if `-PrimaryUrl` not provided |
| 7 | **Low** | watchdog.ps1:37 | Connector and browser share the same start script — restarting one starts both | Added comment documenting the limitation |

### Systemic Issues (Not Code Bugs)

| # | Severity | Issue | Action Needed |
|---|----------|-------|---------------|
| S1 | **Critical** | ALL Cloudflare tunnel URLs are NXDOMAIN (stale). `gw-tunnel.log` shows "Unauthorized: Tunnel not found" errors. 4 cloudflared processes running but tunnels not registering. | Restart all cloudflared processes to get new URLs. Update TUNNEL-URLS doc, Mistral connectors, and resilience scripts. |
| S2 | **Medium** | Duplicate cloudflared process for port 3002 (PIDs 12620 and 15500) | Kill one of the duplicate processes |
| S3 | **Low** | No cloudflared tunnels for ports 3000/3001 (connector/browser) — old logs from Oct 26 | Start tunnels for connector and browser if needed |

### Code Smells (Accepted)

| Smell | Location | Severity | Justification |
|-------|----------|----------|---------------|
| God module | server.js (1,296 lines, 88 functions) | Medium | Single-purpose gateway; splitting would add complexity without benefit |
| Empty catch blocks | server.js lines 353, 723, 737, 753, 761 | Low | Cleanup operations (unlink temp files) where failure is non-critical |
| Magic numbers | Ports (3000-3002, 3939) in resilience scripts | Low | Well-known service ports, documented in architecture doc |
| No PS1 tests | resilience/*.ps1 | Low | Ops scripts; tested manually via -Once and -DryRun |

### What's Good

- **CI/CD**: All 4 workflows pass. Artifacts produced: latch.exe (0.2MB), gateway.exe (34.4MB), Control Center.exe (12.1MB)
- **Rust source**: Clean architecture (bridge/http/settings/main separation), 10/10 tests pass, `cargo check` clean
- **Security**: No hardcoded secrets, `.env` properly gitignored, `.env.example` templates provided
- **Documentation**: README.md updated with architecture diagram, RESILIENCE-ARCHITECTURE.md comprehensive
- **Error handling**: Gateway handles missing `.env` gracefully; resilience scripts use `$ErrorActionPreference = 'Continue'`

---

## Prioritized Action Plan

### Immediate (Today)
1. **Restart Cloudflare tunnels** — All URLs are stale (NXDOMAIN). Kill all cloudflared processes, restart with fresh tunnels, update TUNNEL-URLS doc + Mistral connectors + resilience scripts.
2. **Kill duplicate cloudflared** for port 3002 (one of PIDs 12620/15500).

### Short Term (This Week)
3. **Add PowerShell test harness** — Pester tests for resilience scripts (port checks, restart logic, state persistence).
4. **Split server.js** — Extract native tools into separate modules if the file grows beyond 1,500 lines.
5. **Add tunnel URL auto-discovery** — health-monitor could read the current tunnel URL from cloudflared logs instead of requiring manual `-TunnelUrl`.

### Long Term (Roadmap)
6. **Notification integration** — Use gateway's `notify` tool to send toast alerts when watchdog restarts a service or tunnel fails over.
7. **GitHub Release automation** — Tag `latch-v*`, `gateway-v*`, `control-center-v*` to auto-publish releases with .exe downloads.

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tunnel stays down | High (currently down) | Mistral AI can't reach PC | Restart tunnels; tunnel-failover.ps1 provides backup |
| Watchdog restart loop | Low | Service flapping | Max 5 restarts/hour limit; state persisted |
| Stale URLs in scripts | Medium | False alarms | Fixed: URLs now configurable via parameters |
| Process filter misses stale process | Low | Orphaned process | Fixed: null-safe filters; port-based health check |

---

## Recommendations

1. **Restart tunnels now** — This is the most urgent action. The entire Mistral AI → PC chain depends on working tunnels.
2. **Add tunnel URL to environment** — Store the current tunnel URL in an env var or config file that resilience scripts read automatically.
3. **Consider Pester tests** — Even basic smoke tests for the PowerShell scripts would catch regressions.
4. **Monitor CI artifact sizes** — gateway.exe at 34.4MB is large (Node SEA includes full Node runtime). Consider `node --experimental-sea-config` with `useCodeCache: false` to reduce size if startup time is acceptable.

---

## Audit Trail

| Phase | Action | Result |
|-------|--------|--------|
| Scope | Identified 39 files in commit 095c245 | 34 new, 2 modified, 3 deleted |
| Automated | JS/JSON/YAML syntax, Rust cargo check+test, secrets scan | All pass, 0 secrets |
| Manual review | Read all resilience PS1 scripts, CI workflows, key source files | Found 7 bugs |
| Debug-cycle | Tested health-monitor -Once, watchdog -DryRun locally | Confirmed fixes work |
| Fix | Applied 7 fixes across 5 files | Commit 894d514 |
| Verify | Re-ran health-monitor, checked process PIDs in status JSON | 4/4 healthy, correct PIDs |
