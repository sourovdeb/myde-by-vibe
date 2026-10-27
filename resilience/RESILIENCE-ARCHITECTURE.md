# Resilience Architecture — Fallback & Recovery System

**Date:** 2026-10-27
**Purpose:** Keep chat.mistral.ai, sourovdeb.com, and all MCP services connected even if the current tunnel or a local service disconnects.

---

## Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    EXTERNAL LAYER                             │
│  chat.mistral.ai  ←→  Cloudflare Tunnel  ←→  sourovdeb.com   │
│       (Mistral AI)      (trycloudflare.com)      (WordPress)  │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    LOCAL LAYER (Sourov's PC)                  │
│                                                               │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │  Health Monitor  │───→│  status.json (every 30s)        │  │
│  │  (health-monitor │    │  All 4 services + external      │  │
│  │   .ps1)          │    │  checks                         │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │    Watchdog      │───→│  Auto-restart down services     │  │
│  │  (watchdog.ps1)  │    │  Max 5 restarts/hour/service    │  │
│  │                  │    │  Logs to watchdog.log           │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
│           │                                                   │
│           ▼                                                   │
│  ┌─────────────────┐    ┌─────────────────────────────────┐  │
│  │  Tunnel Failover │───→│  Backup Cloudflare tunnel       │  │
│  │  (tunnel-failover │    │  on primary tunnel failure      │  │
│  │   .ps1)          │    │  Writes new URL to status JSON  │  │
│  └─────────────────┘    └─────────────────────────────────┘  │
│                                                               │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │              MCP SERVICE STACK                           │  │
│  │                                                          │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │  │
│  │  │  Gateway     │  │  Latch MCP   │  │  Connector   │  │  │
│  │  │  (port 3002) │  │  (port 3939) │  │  (port 3000) │  │  │
│  │  │  39 tools    │  │  6 tools     │  │  5 tools     │  │  │
│  │  │  .exe ready  │  │  .exe ready  │  │  Node.js     │  │  │
│  │  └──────────────┘  └──────────────┘  └──────────────┘  │  │
│  │  ┌──────────────┐                                       │  │
│  │  │  Browser MCP │                                       │  │
│  │  │  (port 3001) │                                       │  │
│  │  │  15 tools    │                                       │  │
│  │  │  Node.js     │                                       │  │
│  │  └──────────────┘                                       │  │
│  └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Health Monitor (`health-monitor.ps1`)

**What it does:** Checks all 4 local MCP services + 2 external endpoints every 30 seconds.

| Check | Target | Method |
|-------|--------|--------|
| Gateway | `localhost:3002/health` | GET HTTP |
| Latch | `127.0.0.1:3939/mcp/mistral` | POST JSON-RPC `tools/list` |
| Connector | `localhost:3000/health` | GET HTTP |
| Browser MCP | `localhost:3001/health` | GET HTTP |
| Cloudflare Tunnel | `https://things-clerk-houston-gras.trycloudflare.com/health` | GET HTTPS |
| Website | `https://sourovdeb.com` | GET HTTPS |

**Output:** `status.json` — machine-readable status with timestamps, port states, HTTP results, process info.

**Usage:**
```powershell
# Run once
.\health-monitor.ps1 -Once

# Run continuously (default 30s interval)
.\health-monitor.ps1

# Custom interval
.\health-monitor.ps1 -IntervalSeconds 60
```

### 2. Watchdog (`watchdog.ps1`)

**What it does:** Checks service ports every 15 seconds. If a port is down, kills stale processes and restarts the service.

| Service | Port | Restart Script |
|---------|------|---------------|
| Gateway | 3002 | `E:\tools\unified-mcp-gateway\start.cmd` |
| Latch | 3939 | `E:\tools\latch\Latch-AutoStart.cmd` |
| Connector | 3000 | `C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1` |
| Browser MCP | 3001 | `C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1` |

**Safety:** Max 5 restarts per service per hour. State persisted in `watchdog-state.json`.

**Usage:**
```powershell
# Dry run (show what would restart, don't actually restart)
.\watchdog.ps1 -DryRun

# Run continuously
.\watchdog.ps1

# Custom interval + max restarts
.\watchdog.ps1 -IntervalSeconds 30 -MaxRestarts 3
```

### 3. Tunnel Failover (`tunnel-failover.ps1`)

**What it does:** Monitors the primary Cloudflare tunnel. If it goes down, starts a backup tunnel and writes the new URL to `tunnel-failover-status.json`.

**Failover flow:**
1. Primary tunnel health check fails (HTTP timeout/error)
2. Starts `cloudflared.exe tunnel --url http://localhost:3002`
3. Extracts new `*.trycloudflare.com` URL from cloudflared log
4. Writes status JSON with action instructions
5. When primary recovers, stops backup tunnel

**Manual step required:** After failover, update the Mistral AI connector URL at `chat.mistral.ai/connections/marketplace` to point to the new backup tunnel URL.

**Usage:**
```powershell
.\tunnel-failover.ps1
.\tunnel-failover.ps1 -PrimaryUrl 'https://custom-tunnel.trycloudflare.com/health' -CheckIntervalSeconds 30
```

---

## Failover Decision Tree

```
Service down?
├── Local service (gateway/latch/connector/browser)
│   └── Watchdog auto-restarts (max 5/hour)
│       └── Still down after 5 restarts → Alert operator
│
└── Cloudflare tunnel down?
    └── Tunnel failover starts backup tunnel
        └── Operator updates Mistral connector URL
            └── Primary recovers → Backup stops automatically
```

---

## Starting Everything

```powershell
# Start all three monitors as background processes
.\start-all.ps1

# Or start individually
.\health-monitor.ps1 &
.\watchdog.ps1 &
.\tunnel-failover.ps1 &
```

---

## Files

| File | Purpose | Gitignored? |
|------|---------|-------------|
| `health-monitor.ps1` | Service health checker | No |
| `watchdog.ps1` | Auto-restart watchdog | No |
| `tunnel-failover.ps1` | Tunnel failover monitor | No |
| `start-all.ps1` | Launch all monitors | No |
| `status.json` | Health monitor output | Yes |
| `watchdog.log` | Watchdog log | Yes |
| `watchdog-state.json` | Restart counters | Yes |
| `tunnel-failover-status.json` | Failover status | Yes |
| `tunnel-failover.log` | Failover log | Yes |
| `backup-tunnel.log` | Backup tunnel stdout | Yes |
| `backup-tunnel.log.err` | Backup tunnel stderr | Yes |

---

## GitHub Actions CI/CD

All three .exe builds are automated via GitHub Actions:

| Workflow | Trigger | Builds |
|----------|---------|--------|
| `build-latch.yml` | Push to `latch/**` or tag `latch-v*` | `latch.exe` (Rust, Windows x64) |
| `build-gateway.yml` | Push to `unified-mcp-gateway/**` or tag `gateway-v*` | `gateway.exe` (Node SEA, Windows x64) |
| `build-control-center.yml` | Push to `sourov-control-center/**` or tag `control-center-v*` | `Sourov Control Center.exe` (PyInstaller) |
| `test-extension.yml` | Push/PR to `chrome-extension/**` | Manifest validation, JS syntax, secrets scan |

**Artifacts:** Each build uploads a downloadable artifact (30-day retention).
**Releases:** Tag with `latch-v*`, `gateway-v*`, or `control-center-v*` to auto-create a GitHub Release.

---

## Known Limitations

1. **Tunnel failover requires manual connector update** — Mistral AI connectors can't be updated programmatically from this PC without browser automation. The status JSON includes the exact action needed.
2. **Watchdog process matching** — Uses `CommandLine` and `Path` heuristics to find stale processes. May need refinement if process names change.
3. **Cloudflare tunnel URLs are ephemeral** — Every cloudflared restart generates a new URL. The health-monitor and tunnel-failover scripts reference the current URL; update after manual tunnel restarts.
4. **No alerting** — The system logs and writes status files but doesn't send notifications (email, SMS, etc.). The `notify` tool in the gateway could be extended for this.
