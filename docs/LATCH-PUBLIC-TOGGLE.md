# Latch Public Toggle

Latch has a built-in public/private toggle controlled by the `LATCH_PUBLIC` environment variable.

## How It Works

| Mode | `LATCH_PUBLIC` | Firewall | Access |
|---|---|---|---|
| **Private (default)** | Unset or `0` | Blocks external on port 3939 | Localhost only |
| **Public** | `1` | Allows external on port 3939 | Local network + localhost |

The Cloudflare tunnel always works because `cloudflared` connects via `localhost:3939` — the tunnel is not affected by the firewall toggle.

## How to Toggle

### Set to Public (allow local network access)

```powershell
# User-level (persists across reboots)
[System.Environment]::SetEnvironmentVariable('LATCH_PUBLIC', '1', 'User')
```

Then restart Latch (or reboot) to apply the firewall change.

### Set to Private (localhost only — default)

```powershell
# User-level
[System.Environment]::SetEnvironmentVariable('LATCH_PUBLIC', '0', 'User')
```

Or remove the variable entirely:

```powershell
[System.Environment]::SetEnvironmentVariable('LATCH_PUBLIC', $null, 'User')
```

### Verify Current State

```powershell
# Check env var
[System.Environment]::GetEnvironmentVariable('LATCH_PUBLIC', 'User')

# Check firewall rules
Get-NetFirewallRule -DisplayName 'latch' | Select-Object DisplayName, Enabled
```

## Implementation

The toggle is implemented in `E:\tools\latch\Latch-AutoStart.cmd`:

```cmd
if "%LATCH_PUBLIC%"=="1" (
  netsh advfirewall firewall set rule name="latch" new enable=yes
) else (
  netsh advfirewall firewall set rule name="latch" new enable=no
)
```

The firewall rules `latch` (x2) control inbound access on port 3939. When disabled (private mode), only localhost connections are accepted. The `Latch-Block-External` and `Latch-Allow-Localhost` rules provide additional protection.

## Current State (2026-10-27)

- `LATCH_PUBLIC`: not set (private mode)
- Firewall rules `latch`: Disabled (external blocked)
- Cloudflare tunnel: Active (`https://jason-salvador-known-stood.trycloudflare.com`)
- Local access: `http://localhost:3939`
