#Requires -Version 5.1
<#
.SYNOPSIS
    Sourov Resilience - Start All Monitors
.DESCRIPTION
    Launches health-monitor, watchdog, and tunnel-failover as background
    PowerShell processes. Each runs in its own hidden window.
.PARAMETER DryRun
    Start watchdog in dry-run mode (no actual restarts)
.PARAMETER HealthOnly
    Only start the health monitor (no watchdog, no tunnel failover)
.PARAMETER NoFailover
    Skip the tunnel failover monitor
#>
param(
    [switch]$DryRun,
    [switch]$HealthOnly,
    [switch]$NoFailover,
    [string]$TunnelUrl = ''
)

$ErrorActionPreference = 'Stop'
$ScriptDir = $PSScriptRoot

Write-Host "=== Sourov Resilience - Starting All Monitors ===" -ForegroundColor Cyan
Write-Host "Script directory: $ScriptDir" -ForegroundColor Gray
Write-Host ""

# --- Health Monitor ---
Write-Host "[1/3] Starting Health Monitor..." -ForegroundColor Green
$hmArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptDir + '\health-monitor.ps1" -IntervalSeconds 30'
if ($TunnelUrl) { $hmArgs += ' -TunnelUrl "' + $TunnelUrl + '"' }
$hmProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $hmArgs -WindowStyle Hidden -PassThru
Write-Host "  Health Monitor PID: $($hmProc.Id)" -ForegroundColor Gray

if (-not $HealthOnly) {
    # --- Watchdog ---
    Write-Host "[2/3] Starting Watchdog..." -ForegroundColor Green
    $wdArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptDir + '\watchdog.ps1" -IntervalSeconds 15 -MaxRestarts 5'
    if ($DryRun) { $wdArgs += ' -DryRun' }
    $wdProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $wdArgs -WindowStyle Hidden -PassThru
    $wdLabel = if ($DryRun) { ' (DRY RUN)' } else { '' }
    Write-Host "  Watchdog PID: $($wdProc.Id)$wdLabel" -ForegroundColor Gray

    # --- Tunnel Failover ---
    if (-not $NoFailover) {
        Write-Host "[3/3] Starting Tunnel Failover..." -ForegroundColor Green
        $tfArgs = '-NoProfile -ExecutionPolicy Bypass -File "' + $ScriptDir + '\tunnel-failover.ps1" -CheckIntervalSeconds 60'
        if ($TunnelUrl) { $tfArgs += ' -PrimaryUrl "' + $TunnelUrl + '/health"' }
        $tfProc = Start-Process -FilePath 'powershell.exe' -ArgumentList $tfArgs -WindowStyle Hidden -PassThru
        Write-Host "  Tunnel Failover PID: $($tfProc.Id)" -ForegroundColor Gray
    } else {
        Write-Host "[3/3] Tunnel Failover: SKIPPED (-NoFailover)" -ForegroundColor Yellow
    }
} else {
    Write-Host "[2/3] Watchdog: SKIPPED (-HealthOnly)" -ForegroundColor Yellow
    Write-Host "[3/3] Tunnel Failover: SKIPPED (-HealthOnly)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "All monitors started. Check status files in:" -ForegroundColor Cyan
Write-Host "  $ScriptDir" -ForegroundColor Gray
Write-Host ""
Write-Host ""
Write-Host "NOTE: Cloudflare tunnel URLs are ephemeral. Pass -TunnelUrl to enable tunnel checks:" -ForegroundColor Yellow
Write-Host "  .\start-all.ps1 -TunnelUrl 'https://your-current-tunnel.trycloudflare.com'" -ForegroundColor Gray
Write-Host ""
Write-Host "To stop all monitors, run:" -ForegroundColor Yellow
Write-Host '  Stop-Process -Force -Id (Get-Process powershell | Where-Object { $_.CommandLine -like "*resilience*" }).Id' -ForegroundColor Gray
