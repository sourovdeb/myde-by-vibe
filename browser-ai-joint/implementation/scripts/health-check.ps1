#!/usr/bin/env powershell
# Check health of all browser automation servers
#
# Usage:
#   .\health-check.ps1
#   .\health-check.ps1 --verbose
#   .\health-check.ps1 --ports 3001,3002,3003,3008

param(
    [switch]$Verbose,
    [string]$Ports = "3000,3001,3002,3003,3004,3008,9222,9223"
)

# Colors for output
$Colors = @{
    Success = "`e[92m"
    Error = "`e[91m"
    Warning = "`e[93m"
    Info = "`e[94m"
    Header = "`e[95m"
    Reset = "`e[0m"
}

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    if ($Verbose -or $Type -ne "Info") {
        $Color = $Colors[$Type]
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($Color)[$Type]$($Colors.Reset) $Message"
    }
}

function Write-Header {
    param([string]$Message)
    Write-Host "$($Colors.Header)$Message$($Colors.Reset)"
}

function Test-Port {
    param([int]$Port, [int]$Timeout = 2000)
    try {
        $Client = New-Object System.Net.WebClient
        $Client.Timeout = $Timeout
        $Response = $Client.DownloadString("http://localhost:$Port/health")
        return @{ Success = $true; Response = $Response; Status = "OK" }
    } catch [System.Net.WebException] {
        return @{ Success = $false; Response = $_.Exception.Response; Status = "Connection failed" }
    } catch {
        return @{ Success = $false; Response = $_; Status = "Error: $_" }
    }
}

function Test-ChromeCDP {
    param([int]$Port = 9222)
    try {
        $Client = New-Object System.Net.WebClient
        $Client.Timeout = 2000
        $Response = $Client.DownloadString("http://localhost:$Port/json/version")
        return @{ Success = $true; Response = $Response; Status = "OK" }
    } catch {
        # For Chrome 156+, HTTP endpoints return 404, but WebSocket works
        try {
            $Client = New-Object System.Net.WebClient
            $Client.Timeout = 2000
            $Client.DownloadString("http://localhost:$Port/") | Out-Null
            return @{ Success = $true; Response = "HTTP endpoint exists (Chrome 156+)"; Status = "OK (HTTP 404 expected)" }
        } catch {
            return @{ Success = $false; Response = $_; Status = "Not responding" }
        }
    }
}

# Parse ports from comma-separated string
$PortList = $Ports -split ',' | ForEach-Object { [int]$_ }

Write-Header "============================================"
Write-Header "  BROWSER AUTOMATION - HEALTH CHECK"
Write-Header "============================================"
Write-Host ""

Write-Host "Checking ports: $($PortList -join ', ')"
Write-Host ""

$Results = @()

foreach ($Port in $PortList) {
    Write-Status "Checking port $Port..." "Info"
    
    if ($Port -in @(9222, 9223)) {
        # Chrome/Opera CDP ports
        $Result = Test-ChromeCDP -Port $Port
    } else {
        # MCP server ports
        $Result = Test-Port -Port $Port
    }
    
    $Results += $Result
    
    if ($Result.Success) {
        Write-Status "Port $Port: $($Colors.Success)HEALTHY$($Colors.Reset) - $($Result.Status)" "Success"
        if ($Verbose) {
            Write-Host "  Response: $($Result.Response.Substring(0, [Math]::Min(200, $Result.Response.Length)))..." -ForegroundColor Gray
        }
    } else {
        Write-Status "Port $Port: $($Colors.Error)UNHEALTHY$($Colors.Reset) - $($Result.Status)" "Error"
        if ($Verbose) {
            Write-Host "  Error: $_" -ForegroundColor Red
        }
    }
}

Write-Host ""

# Summary
$HealthyCount = ($Results | Where-Object { $_.Success }).Count
$UnhealthyCount = $Results.Count - $HealthyCount

Write-Header "=== SUMMARY ==="
Write-Host "Total ports checked: $($Results.Count)"
Write-Host "Healthy: $($Colors.Success)$HealthyCount$($Colors.Reset)"
Write-Host "Unhealthy: $($Colors.Error)$UnhealthyCount$($Colors.Reset)"

if ($HealthyCount -eq $Results.Count) {
    Write-Host "`n$($Colors.Success)All services are healthy!$($Colors.Reset)" 
} else {
    Write-Host "`n$($Colors.Error)Some services need attention$($Colors.Reset)"
    Write-Host "Start missing servers with: .\start-servers.ps1"
}

Write-Host ""

# Exit with appropriate code
if ($UnhealthyCount -gt 0) {
    exit 1
} else {
    exit 0
}
