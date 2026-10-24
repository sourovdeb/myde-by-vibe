#!/usr/bin/env powershell
# Setup Chrome debugging with DebugFull profile for Chrome 156+
#
# Usage:
#   .\chrome-debug.ps1 [--start] [--stop] [--clean]
#
# Examples:
#   Create DebugFull profile and start Chrome:
#     .\chrome-debug.ps1 --start
#
#   Stop Chrome:
#     .\chrome-debug.ps1 --stop
#
#   Clean DebugFull profile:
#     .\chrome-debug.ps1 --clean

param(
    [switch]$Start,
    [switch]$Stop,
    [switch]$Clean,
    [int]$Port = 9222
)

# Configuration
$DebugFullPath = "C:\Users\souro\AppData\Local\Google\Chrome\DebugFull"
$ChromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
$DefaultProfile = "C:\Users\souro\AppData\Local\Google\Chrome\User Data\Default"

# Colors for output
$Colors = @{
    Success = "`e[92m"
    Error = "`e[91m"
    Warning = "`e[93m"
    Info = "`e[94m"
    Reset = "`e[0m"
}

function Write-Status {
    param([string]$Message, [string]$Type = "Info")
    $Color = $Colors[$Type]
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($Color)[$Type]$($Colors.Reset) $Message"
}

function Test-Port {
    param([int]$Port)
    try {
        $Client = New-Object System.Net.WebClient
        $Client.Timeout = 1000
        $Client.DownloadString("http://localhost:$Port/json/version") | Out-Null
        return $true
    } catch {
        return $false
    }
}

function Stop-Chrome {
    try {
        # Find Chrome processes with DebugFull profile
        $Processes = Get-WmiObject Win32_Process -Filter "Name = 'chrome.exe'" | 
                    Where-Object { $_.CommandLine -like "*--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull*" }
        
        if ($Processes) {
            foreach ($Process in $Processes) {
                $Process.Terminate() | Out-Null
                Write-Status "Stopped Chrome process (PID: $($Process.ProcessId))" "Success"
            }
            return $true
        } else {
            Write-Status "No Chrome processes found with DebugFull profile" "Warning"
            return $false
        }
    } catch {
        Write-Status "Error stopping Chrome: $_" "Error"
        return $false
    }
}

function Create-DebugFullProfile {
    if (Test-Path $DebugFullPath) {
        Write-Status "DebugFull profile already exists" "Info"
        return $true
    }
    
    if (-not (Test-Path $DefaultProfile)) {
        Write-Status "Default Chrome profile not found at $DefaultProfile" "Error"
        return $false
    }
    
    try {
        Write-Status "Creating DebugFull profile from Default..." "Info"
        Copy-Item -Path $DefaultProfile -Destination $DebugFullPath -Recurse -Force
        Write-Status "DebugFull profile created successfully" "Success"
        return $true
    } catch {
        Write-Status "Failed to create DebugFull profile: $_" "Error"
        return $false
    }
}

function Start-ChromeDebug {
    # Check if already running
    if (Test-Port $Port) {
        Write-Status "Chrome is already running on port $Port" "Warning"
        return $true
    }
    
    if (-not (Test-Path $ChromePath)) {
        Write-Status "Chrome not found at $ChromePath" "Error"
        return $false
    }
    
    # Ensure DebugFull profile exists
    if (-not (Create-DebugFullProfile)) {
        return $false
    }
    
    try {
        Start-Process -FilePath $ChromePath \
            -ArgumentList "--remote-debugging-port=$Port", '--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull' \
            -WindowStyle Normal
        
        Write-Status "Starting Chrome with debugging on port $Port..." "Info"
        
        # Wait for Chrome to start
        $Timeout = 10
        $Interval = 1
        $Elapsed = 0
        
        while ($Elapsed -lt $Timeout) {
            if (Test-Port $Port) {
                Write-Status "Chrome started successfully on port $Port" "Success"
                return $true
            }
            Start-Sleep -Seconds $Interval
            $Elapsed += $Interval
        }
        
        Write-Status "Chrome did not start within $Timeout seconds" "Error"
        return $false
    } catch {
        Write-Status "Failed to start Chrome: $_" "Error"
        return $false
    }
}

function Clean-DebugFullProfile {
    if (-not (Test-Path $DebugFullPath)) {
        Write-Status "DebugFull profile does not exist" "Info"
        return $true
    }
    
    # Stop Chrome first
    Stop-Chrome
    
    try {
        Write-Status "Removing DebugFull profile..." "Info"
        Remove-Item -Path $DebugFullPath -Recurse -Force
        Write-Status "DebugFull profile removed" "Success"
        return $true
    } catch {
        Write-Status "Failed to remove DebugFull profile: $_" "Error"
        return $false
    }
}

# Main execution
Write-Host "$($Colors.Header)Chrome Debugging Setup$($Colors.Reset)"
Write-Host ""

if ($Stop) {
    Write-Status "Stopping Chrome..." "Info"
    Stop-Chrome
} elseif ($Clean) {
    Write-Status "Cleaning DebugFull profile..." "Info"
    Clean-DebugFullProfile
} elseif ($Start) {
    Write-Status "Starting Chrome with debugging..." "Info"
    Start-ChromeDebug -Port $Port
} else {
    # Default: create profile and start
    Write-Status "Creating DebugFull profile..." "Info"
    Create-DebugFullProfile
    
    Write-Status "Starting Chrome with debugging..." "Info"
    Start-ChromeDebug -Port $Port
}

Write-Host ""
Write-Status "Done" "Success"
