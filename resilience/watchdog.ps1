#Requires -Version 5.1
<#
.SYNOPSIS
    Sourov Resilience — Auto-Restart Watchdog
.DESCRIPTION
    Monitors all MCP services and auto-restarts any that go down.
    Uses the health-monitor's status.json as input, or checks ports directly.
    Logs all restart actions to watchdog.log.
.PARAMETER IntervalSeconds
    Check interval (default: 15)
.PARAMETER MaxRestarts
    Max restarts per service per hour (default: 5)
.PARAMETER DryRun
    Show what would be restarted without actually restarting
#>
param(
    [int]$IntervalSeconds = 15,
    [int]$MaxRestarts = 5,
    [switch]$DryRun
)

$ErrorActionPreference = 'Continue'
$LogFile = Join-Path $PSScriptRoot "watchdog.log"
$StateFile = Join-Path $PSScriptRoot "watchdog-state.json"

# Service definitions with restart info
$WatchServices = @(
    @{
        Name        = 'gateway'
        Port        = 3002
        StartScript = 'E:\tools\unified-mcp-gateway\start.cmd'
        StartArgs   = @()
        ProcessName = 'node'
        ProcessFilter = { param($p) $p.Path -like '*unified-mcp-gateway*' -or $p.CommandLine -like '*unified-mcp-gateway*' }
    },
    @{
        Name        = 'latch'
        Port        = 3939
        StartScript = 'E:\tools\latch\Latch-AutoStart.cmd'
        StartArgs   = @()
        ProcessName = 'latch'
        ProcessFilter = { param($p) $p.ProcessName -eq 'latch' }
    },
    @{
        Name        = 'connector'
        Port        = 3000
        StartScript = 'C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1'
        StartArgs   = @()
        ProcessName = 'node'
        ProcessFilter = { param($p) $p.CommandLine -like '*my-mcp-connector*' }
    },
    @{
        Name        = 'browser'
        Port        = 3001
        StartScript = 'C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1'
        StartArgs   = @()
        ProcessName = 'node'
        ProcessFilter = { param($p) $p.CommandLine -like '*browser-control-mcp*' }
    }
)

function Write-Log {
    param([string]$Message, [string]$Level = 'INFO')
    $ts = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
    $line = "[$ts] [$Level] $Message"
    Add-Content -Path $LogFile -Value $line -Encoding UTF8
    $color = switch ($Level) {
        'ERROR' { 'Red' }
        'WARN'  { 'Yellow' }
        'RESTART' { 'Magenta' }
        default { 'Gray' }
    }
    Write-Host $line -ForegroundColor $color
}

function Test-PortOpen {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Get-RestartState {
    if (Test-Path $StateFile) {
        try { return Get-Content $StateFile -Raw | ConvertFrom-Json } catch { return @{} }
    }
    return @{}
}

function Save-RestartState {
    param([hashtable]$State)
    $State | ConvertTo-Json -Depth 3 | Out-File -FilePath $StateFile -Encoding UTF8
}

function Get-RestartCount {
    param([hashtable]$State, [string]$ServiceName)
    $key = "${ServiceName}_restarts"
    $hourKey = "${ServiceName}_hour"
    $currentHour = (Get-Date -Format 'yyyy-MM-dd-HH')

    if ($State.$hourKey -ne $currentHour) {
        # Reset counter for new hour
        $State.$key = 0
        $State.$hourKey = $currentHour
    }
    return $State.$key
}

function Set-RestartCount {
    param([hashtable]$State, [string]$ServiceName, [int]$Count)
    $key = "${ServiceName}_restarts"
    $State.$key = $Count
}

function Restart-Service {
    param([hashtable]$Svc, [hashtable]$State)

    $name = $Svc.Name
    $restartCount = Get-RestartCount -State $State -ServiceName $name
    if ($restartCount -ge $MaxRestarts) {
        Write-Log "SKIP restart of '$name' — max restarts ($MaxRestarts) reached this hour" 'WARN'
        return $false
    }

    Write-Log "RESTARTING '$name' (port $($Svc.Port)) — attempt $($restartCount + 1)/$MaxRestarts" 'RESTART'

    if ($DryRun) {
        Write-Log "DRY RUN: would execute $($Svc.StartScript)" 'WARN'
        return $true
    }

    try {
        # Kill existing processes for this service
        $procs = Get-Process -Name $Svc.ProcessName -ErrorAction SilentlyContinue | Where-Object { & $Svc.ProcessFilter $_ }
        foreach ($p in $procs) {
            Write-Log "Killing stale process: $($p.ProcessName) (PID $($p.Id))" 'WARN'
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
        }

        # Start the service
        if ($Svc.StartScript -and (Test-Path $Svc.StartScript)) {
            if ($Svc.StartScript -like '*.ps1') {
                Start-Process -FilePath 'powershell.exe' -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$($Svc.StartScript)`"" -WindowStyle Hidden
            } else {
                Start-Process -FilePath 'cmd.exe' -ArgumentList "/c `"$($Svc.StartScript)`"" -WindowStyle Hidden
            }
            Write-Log "Started '$name' via $($Svc.StartScript)" 'RESTART'
        } else {
            Write-Log "No start script for '$name' — cannot auto-restart" 'ERROR'
            return $false
        }

        # Update restart count
        Set-RestartCount -State $State -ServiceName $name -Count ($restartCount + 1)
        Save-RestartState -State $State
        return $true
    } catch {
        Write-Log "Failed to restart '$name': $_" 'ERROR'
        return $false
    }
}

function Invoke-Watchdog {
    $state = Get-RestartState
    $ts = Get-Date -Format 'HH:mm:ss'

    foreach ($svc in $WatchServices) {
        $portOpen = Test-PortOpen -Port $svc.Port
        if (-not $portOpen) {
            Write-Log "[$ts] '$($svc.Name)' port $($svc.Port) is DOWN" 'ERROR'
            Restart-Service -Svc $svc -State $state
        }
    }

    # Save state periodically
    Save-RestartState -State $state
}

# Main loop
Write-Host "=== Sourov Resilience Watchdog ===" -ForegroundColor Cyan
Write-Host "Interval: ${IntervalSeconds}s | Max restarts/hour: $MaxRestarts | DryRun: $DryRun" -ForegroundColor Gray
Write-Host "Log: $LogFile" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

Write-Log "Watchdog started (interval: ${IntervalSeconds}s, max restarts: $MaxRestarts/hour)"

while ($true) {
    Invoke-Watchdog
    Start-Sleep -Seconds $IntervalSeconds
}
