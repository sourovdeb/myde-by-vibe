#Requires -Version 5.1
<#
.SYNOPSIS
    Sourov Resilience — Health Monitor
.DESCRIPTION
    Checks all local MCP services every N seconds. Writes status to JSON.
    Services: Gateway (3002), Latch (3939), Connector (3000), Browser MCP (3001)
    Also checks Cloudflare tunnel health and sourovdeb.com reachability.
.PARAMETER IntervalSeconds
    Check interval (default: 30)
.PARAMETER Once
    Run once and exit (no loop)
.PARAMETER StatusFile
    Path to write status JSON (default: status.json in this directory)
#>
param(
    [int]$IntervalSeconds = 30,
    [switch]$Once,
    [string]$StatusFile = (Join-Path $PSScriptRoot "status.json"),
    [string]$TunnelUrl = ''
)

$ErrorActionPreference = 'Continue'

# Service definitions
$Services = @(
    @{ Name = 'gateway';  Port = 3002; Url = 'http://localhost:3002/health';  ProcessName = 'node';     StartScript = 'E:\tools\unified-mcp-gateway\start.cmd' },
    @{ Name = 'latch';    Port = 3939; Url = 'http://127.0.0.1:3939/mcp/mistral'; ProcessName = 'latch'; StartScript = 'E:\tools\latch\Latch-AutoStart.cmd' },
    @{ Name = 'connector'; Port = 3000; Url = 'http://localhost:3000/health';  ProcessName = 'node';     StartScript = $null },
    @{ Name = 'browser';  Port = 3001; Url = 'http://localhost:3001/health';  ProcessName = 'node';     StartScript = $null }
)

# External checks
# NOTE: Cloudflare tunnel URLs are ephemeral — update $TunnelUrl after every cloudflared restart.
# If $TunnelUrl is empty, the tunnel check is skipped.
$ExternalChecks = @(
    @{ Name = 'website'; Url = 'https://sourovdeb.com' }
)
if ($TunnelUrl) {
    $ExternalChecks += @{ Name = 'cloudflare-tunnel'; Url = "$TunnelUrl/health" }
}

function Test-PortOpen {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue
    return $null -ne $conn
}

function Test-HttpHealth {
    param([string]$Url, [int]$TimeoutSec = 5)
    try {
        $resp = Invoke-WebRequest -Uri $Url -Method GET -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
        return @{ Ok = $true; StatusCode = $resp.StatusCode; Body = $resp.Content.Substring(0, [Math]::Min(200, $resp.Content.Length)) }
    } catch {
        # Latch /mcp/mistral requires POST — try that
        if ($Url -like '*/mcp/*') {
            try {
                $body = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
                $resp = Invoke-WebRequest -Uri $Url -Method POST -Body $body -ContentType 'application/json' -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
                return @{ Ok = $true; StatusCode = $resp.StatusCode; Body = 'MCP tools/list OK' }
            } catch {
                return @{ Ok = $false; Error = $_.Exception.Message }
            }
        }
        return @{ Ok = $false; Error = $_.Exception.Message }
    }
}

function Get-ServiceStatus {
    param([hashtable]$Svc)
    $portOpen = Test-PortOpen -Port $Svc.Port
    $httpResult = $null
    if ($portOpen) {
        $httpResult = Test-HttpHealth -Url $Svc.Url
    }
    $proc = @()
    if ($portOpen) {
        $proc = Get-NetTCPConnection -LocalPort $Svc.Port -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { Get-Process -Id $_.OwningProcess -ErrorAction SilentlyContinue } |
            Select-Object -First 5
    }

    return @{
        Name       = $Svc.Name
        Port       = $Svc.Port
        PortOpen   = $portOpen
        HttpOk     = if ($httpResult) { $httpResult.Ok } else { $false }
        HttpDetail = $httpResult
        Healthy    = ($portOpen -and $httpResult.Ok)
        Processes  = @($proc | ForEach-Object { @{ Pid = $_.Id; Name = $_.ProcessName; MemoryMB = [math]::Round($_.WorkingSet / 1MB, 1) } })
        CheckedAt  = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
    }
}

function Get-ExternalStatus {
    param([hashtable]$Check)
    $result = Test-HttpHealth -Url $Check.Url -TimeoutSec 10
    return @{
        Name      = $Check.Name
        Url       = $Check.Url
        Reachable = $result.Ok
        Detail    = $result
        CheckedAt = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
    }
}

function Invoke-HealthCheck {
    $status = @{
        Timestamp = (Get-Date -Format 'yyyy-MM-ddTHH:mm:sszzz')
        Services  = @($Services | ForEach-Object { Get-ServiceStatus -Svc $_ })
        External  = @($ExternalChecks | ForEach-Object { Get-ExternalStatus -Check $_ })
        Summary   = @{}
    }

    $healthyCount = ($status.Services | Where-Object { $_.Healthy }).Count
    $status.Summary = @{
        TotalServices   = $status.Services.Count
        HealthyServices = $healthyCount
        UnhealthyServices = $status.Services.Count - $healthyCount
        AllHealthy      = ($healthyCount -eq $status.Services.Count)
    }

    # Write status file
    $status | ConvertTo-Json -Depth 5 | Out-File -FilePath $StatusFile -Encoding UTF8

    # Console output
    $ts = Get-Date -Format 'HH:mm:ss'
    foreach ($svc in $status.Services) {
        $icon = if ($svc.Healthy) { 'OK' } else { 'DOWN' }
        $color = if ($svc.Healthy) { 'Green' } else { 'Red' }
        Write-Host "[$ts] $icon $($svc.Name) (port $($svc.Port))" -ForegroundColor $color
    }
    foreach ($ext in $status.External) {
        $icon = if ($ext.Reachable) { 'OK' } else { 'UNREACHABLE' }
        $color = if ($ext.Reachable) { 'Green' } else { 'Yellow' }
        Write-Host "[$ts] $icon $($ext.Name)" -ForegroundColor $color
    }
    Write-Host "[$ts] Summary: $healthyCount/$($status.Services.Count) services healthy" -ForegroundColor $(if ($status.Summary.AllHealthy) { 'Green' } else { 'Yellow' })

    return $status
}

# Main loop
Write-Host "=== Sourov Resilience Health Monitor ===" -ForegroundColor Cyan
Write-Host "Interval: ${IntervalSeconds}s | Status file: $StatusFile" -ForegroundColor Gray
Write-Host "Press Ctrl+C to stop" -ForegroundColor Gray
Write-Host ""

while ($true) {
    Invoke-HealthCheck
    if ($Once) { break }
    Write-Host ""
    Start-Sleep -Seconds $IntervalSeconds
}
