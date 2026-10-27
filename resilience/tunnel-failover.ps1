#Requires -Version 5.1
<#
.SYNOPSIS
    Sourov Resilience — Cloudflare Tunnel Failover
.DESCRIPTION
    Monitors the primary Cloudflare tunnel. If it goes down, starts a backup tunnel
    and writes the new URL to tunnel-failover-status.json for the operator to update
    Mistral AI connectors.
.PARAMETER PrimaryUrl
    Primary tunnel URL to monitor (default: current gateway tunnel)
.PARAMETER CheckIntervalSeconds
    How often to check (default: 60)
.PARAMETER TargetPort
    Local port the tunnel forwards to (default: 3002 for gateway)
#>
param(
    [string]$PrimaryUrl = '',  # Set to current tunnel URL, e.g. 'https://your-tunnel.trycloudflare.com/health'
    [int]$CheckIntervalSeconds = 60,
    [int]$TargetPort = 3002
)

$ErrorActionPreference = 'Continue'
$StatusFile = Join-Path $PSScriptRoot "tunnel-failover-status.json"
$LogFile = Join-Path $PSScriptRoot "tunnel-failover.log"
$CloudflaredExe = "C:\tmp\cloudflared.exe"
$BackupTunnelProc = $null

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    $color = switch ($Level) {
        'ERROR' { 'Red' }
        'WARN'  { 'Yellow' }
        'FAILOVER' { 'Magenta' }
        default { 'Gray' }
    }
    Write-Host $line -ForegroundColor $color
}

function Test-TunnelHealth {
    param([string]$Url)
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec 10 -UseBasicParsing -ErrorAction Stop
        return @{ Ok = $true; StatusCode = $resp.StatusCode }
    } catch {
        return @{ Ok = $false; Error = $_.Exception.Message }
    }
}

function Get-TunnelUrlFromLog {
    param([string]$LogPath)
    if (-not (Test-Path $LogPath)) { return $null }
    $content = Get-Content $LogPath -Raw -ErrorAction SilentlyContinue
    if ($content -match 'https://[a-z0-9-]+\.trycloudflare\.com') {
        return $matches[0]
    }
    return $null
}

function Start-BackupTunnel {
    param([int]$Port)
    Write-Log "Starting backup Cloudflare tunnel for port $Port..." 'FAILOVER'

    if (-not (Test-Path $CloudflaredExe)) {
        Write-Log "cloudflared.exe not found at $CloudflaredExe" 'ERROR'
        return $null
    }

    $logPath = Join-Path $PSScriptRoot "backup-tunnel.log"
    if (Test-Path $logPath) { Remove-Item $logPath -Force }

    $proc = Start-Process -FilePath $CloudflaredExe -ArgumentList "tunnel --url http://localhost:$Port --no-autoupdate" -RedirectStandardOutput $logPath -RedirectStandardError "$logPath.err" -WindowStyle Hidden -PassThru

    # Wait for tunnel URL to appear in log
    $newUrl = $null
    for ($i = 0; $i -lt 30; $i++) {
        Start-Sleep -Seconds 2
        $newUrl = Get-TunnelUrlFromLog -LogPath $logPath
        if ($newUrl) { break }
    }

    if ($newUrl) {
        Write-Log "Backup tunnel UP: $newUrl" 'FAILOVER'
        return @{ Url = $newUrl; Pid = $proc.Id; LogPath = $logPath }
    } else {
        Write-Log "Backup tunnel failed to start (no URL in log after 60s)" 'ERROR'
        return $null
    }
}

function Stop-BackupTunnel {
    if ($script:BackupTunnelProc -and $script:BackupTunnelProc.Pid) {
        Write-Log "Stopping backup tunnel (PID $($script:BackupTunnelProc.Pid))..." 'WARN'
        Stop-Process -Id $script:BackupTunnelProc.Pid -Force -ErrorAction SilentlyContinue
        $script:BackupTunnelProc = $null
    }
}

function Write-Status {
    param([hashtable]$Status)
    $Status | ConvertTo-Json -Depth 4 | Out-File -FilePath $StatusFile -Encoding UTF8
}

# Main loop
if (-not $PrimaryUrl) {
    Write-Host "ERROR: -PrimaryUrl is required. Cloudflare tunnel URLs are ephemeral." -ForegroundColor Red
    Write-Host "  Get the current URL from the cloudflared log or TUNNEL-URLS doc." -ForegroundColor Yellow
    Write-Host "  Example: .	unnel-failover.ps1 -PrimaryUrl 'https://your-tunnel.trycloudflare.com/health'" -ForegroundColor Gray
    exit 1
}

Write-Host "=== Sourov Resilience — Tunnel Failover ===" -ForegroundColor Cyan
Write-Host "Primary: $PrimaryUrl" -ForegroundColor Gray
Write-Host "Interval: ${CheckIntervalSeconds}s | Target: localhost:$TargetPort" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

Write-Log "Tunnel failover monitor started (primary: $PrimaryUrl, interval: ${CheckIntervalSeconds}s)"

$script:BackupTunnelProc = $null
$failoverActive = $false

while ($true) {
    $health = Test-TunnelHealth -Url $PrimaryUrl
    $ts = Get-Date -Format 'HH:mm:ss'

    if ($health.Ok) {
        if ($failoverActive) {
            Write-Log "[$ts] Primary tunnel RECOVERED — stopping backup" 'FAILOVER'
            Stop-BackupTunnel
            $failoverActive = $false
        }
        Write-Host "[$ts] Primary tunnel: OK (HTTP $($health.StatusCode))" -ForegroundColor Green
    } else {
        Write-Host "[$ts] Primary tunnel: DOWN ($($health.Error))" -ForegroundColor Red

        if (-not $failoverActive) {
            Write-Log "[$ts] Primary tunnel DOWN — initiating failover" 'FAILOVER'
            $backup = Start-BackupTunnel -Port $TargetPort
            if ($backup) {
                $script:BackupTunnelProc = $backup
                $failoverActive = $true
                Write-Status -Status @{
                    Timestamp     = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
                    PrimaryUrl    = $PrimaryUrl
                    PrimaryStatus = 'DOWN'
                    BackupUrl     = $backup.Url
                    BackupPid     = $backup.Pid
                    Action        = 'UPDATE MISTRAL CONNECTOR: point to ' + $backup.Url + '/mcp'
                }
                Write-Host "[$ts] FAILOVER ACTIVE — Backup: $($backup.Url)" -ForegroundColor Magenta
                Write-Host "[$ts] ACTION REQUIRED: Update Mistral AI connector to $($backup.Url)/mcp" -ForegroundColor Yellow
            }
        } else {
            Write-Host "[$ts] Failover already active (backup: $($script:BackupTunnelProc.Url))" -ForegroundColor Magenta
        }
    }

    # Write status
    Write-Status -Status @{
        Timestamp     = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
        PrimaryUrl    = $PrimaryUrl
        PrimaryStatus = if ($health.Ok) { 'UP' } else { 'DOWN' }
        BackupUrl     = if ($script:BackupTunnelProc) { $script:BackupTunnelProc.Url } else { $null }
        BackupPid     = if ($script:BackupTunnelProc) { $script:BackupTunnelProc.Pid } else { $null }
        FailoverActive = $failoverActive
    }

    Start-Sleep -Seconds $CheckIntervalSeconds
}
