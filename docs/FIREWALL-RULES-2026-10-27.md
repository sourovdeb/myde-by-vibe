# Firewall Rules — Unified MCP Gateway (Port 3002)

## Required Rules

The Unified MCP Gateway on port 3002 needs firewall rules to block external access while allowing localhost.

### PowerShell Commands (run as Administrator)

```powershell
# Block all external inbound on port 3002
New-NetFirewallRule -DisplayName 'Gateway-Block-External' -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Block -Profile Any -Description 'Block external access to Unified MCP Gateway'

# Allow localhost only on Private/Domain profiles
New-NetFirewallRule -DisplayName 'Gateway-Allow-Localhost' -Direction Inbound -Protocol TCP -LocalPort 3002 -Action Allow -Profile Private,Domain -RemoteAddress 127.0.0.1 -Description 'Allow localhost access to Unified MCP Gateway'
```

### Verify

```powershell
Get-NetFirewallRule -DisplayName 'Gateway-*' | Select-Object DisplayName, Enabled, Direction, Action, Profile
```

### Expected Result

| Rule | Direction | Action | Profile | Purpose |
|---|---|---|---|---|
| Gateway-Block-External | Inbound | Block | Any | Block external access to port 3002 |
| Gateway-Allow-Localhost | Inbound | Allow | Private,Domain | Allow localhost only |

## Status (2026-10-27)

**NOT YET APPLIED** — requires Administrator elevation. The gateway is protected by:
1. Bearer token authentication (64-char hex, `Authorization: Bearer <token>`)
2. Cloudflare Tunnel (TLS termination at Cloudflare edge)
3. Localhost binding (gateway listens on `0.0.0.0:3002` but firewall should block external)

## Latch Firewall Rules (Port 3939)

| Rule | Enabled | Purpose |
|---|---|---|
| `latch` (x2) | Disabled | Controlled by `LATCH_PUBLIC` env var |
| `Latch-Block-External` | Enabled | Block external on port 3939 |
| `Latch-Allow-Localhost` | Enabled | Allow localhost on port 3939 |

See `docs/LATCH-PUBLIC-TOGGLE.md` for the Latch public/private toggle.
