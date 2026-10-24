#!/usr/bin/env powershell
# Start all browser automation MCP servers
#
# Usage:
#   .\start-servers.ps1 [--all] [--mcp] [--agents] [--wordpress] [--opencode] [--chrome] [--firefox] [--opera]
#   .\start-servers.ps1 --port-base 3000
#
# Examples:
#   Start all servers:
#     .\start-servers.ps1 --all
#
#   Start MCP servers only:
#     .\start-servers.ps1 --mcp
#
#   Start with custom port base:
#     .\start-servers.ps1 --port-base 4000

param(
    [switch]$All,
    [switch]$Mcp,
    [switch]$Agents,
    [switch]$WordPress,
    [switch]$Opencode,
    [switch]$Chrome,
    [switch]$Firefox,
    [switch]$Opera,
    [int]$PortBase = 3000
)

# Configuration
$Config = @{
    Chrome = @{
        Name = "browser-control-mcp"
        Path = "$env:USERPROFILE\.vibe\plugins\browser-control-mcp"
        Port = $PortBase + 1
        Start = "node server/http-server.js"
    }
    Firefox = @{
        Name = "browser-control-mcp-firefox"
        Path = "$env:USERPROFILE\.vibe\plugins\browser-control-mcp-firefox"
        Port = $PortBase + 3
        Start = "node server/http-server.js"
        Prerequisite = "geckodriver --port=$($PortBase + 4444)"
    }
    Opera = @{
        Name = "browser-control-mcp-opera"
        Path = "$env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera"
        Port = $PortBase + 2
        Start = "node server/http-server.js"
    }
    WordPress = @{
        Name = "wordpress-mcp-server"
        Path = "$env:USERPROFILE\chrome-communication-extension"
        Port = $PortBase + 8
        Start = "node wordpress-mcp-server.js --port $($PortBase + 8)"
    }
    Opencode = @{
        Name = "opencode-mcp-server"
        Path = "$env:USERPROFILE\.vibe\plugins\browser-control-mcp-opera"
        Port = $PortBase + 4
        Start = "node mcp-wrappers/opencode-mcp-server.js --port $($PortBase + 4)"
    }
    ChromeDebug = @{
        Name = "chrome-debug"
        Port = 9222
        Command = "powershell -Command \"Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull'\""
    }
    OperaDebug = @{
        Name = "opera-debug"
        Port = 9223
        Command = "Start-Process 'C:\Program Files\Opera\launcher.exe' -ArgumentList '--remote-debugging-port=9223'"
    }
}

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
    $Color = $Colors[$Type]
    Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $($Color)[$Type]$($Colors.Reset) $Message"
}

function Write-Header {
    param([string]$Message)
    Write-Host "$($Colors.Header)$Message$($Colors.Reset)"
}

function Test-Port {
    param([int]$Port, [int]$Timeout = 1000)
    try {
        $Client = New-Object System.Net.WebClient
        $Client.Timeout = $Timeout
        $Response = $Client.DownloadString("http://localhost:$Port/health")
        return $true
    } catch {
        return $false
    }
}

function Start-ProcessAsync {
    param([string]$Command, [string]$WorkingDirectory, [string]$Name)
    
    try {
        if ($WorkingDirectory -and (Test-Path $WorkingDirectory)) {
            $StartInfo = New-Object System.Diagnostics.ProcessStartInfo
            $StartInfo.FileName = "powershell.exe"
            $StartInfo.Arguments = "-Command \"$Command\""
            $StartInfo.WorkingDirectory = $WorkingDirectory
            $StartInfo.UseShellExecute = $false
            $StartInfo.RedirectStandardOutput = $true
            $StartInfo.RedirectStandardError = $true
            $StartInfo.CreateNoWindow = $true
            
            $Process = New-Object System.Diagnostics.Process
            $Process.StartInfo = $StartInfo
            $Process.Start() | Out-Null
            
            Write-Status "Starting $Name..." "Info"
            Start-Sleep -Seconds 2
            
            if (Test-Port $Port) {
                Write-Status "$Name started successfully on port $Port" "Success"
                return $true
            } else {
                Write-Status "$Name started but health check failed on port $Port" "Warning"
                return $true
            }
        } else {
            Write-Status "Directory not found: $WorkingDirectory" "Warning"
            return $false
        }
    } catch {
        Write-Status "Failed to start $Name: $_" "Error"
        return $false
    }
}

function Start-McpServers {
    Write-Header "Starting MCP Servers..."
    
    $Started = @()
    
    if ($Chrome -or $All -or $Mcp) {
        if (Start-ProcessAsync -Command $Config.Chrome.Start -WorkingDirectory $Config.Chrome.Path -Name $Config.Chrome.Name -Port $Config.Chrome.Port) {
            $Started += $Config.Chrome.Name
        }
    }
    
    if ($Firefox -or $All -or $Mcp) {
        # Start geckodriver first
        Write-Status "Starting geckodriver for Firefox..." "Info"
        Start-Process geckodriver -ArgumentList "--port=$($Config.Firefox.Port + 1140)" -WindowStyle Hidden
        Start-Sleep -Seconds 2
        
        if (Start-ProcessAsync -Command $Config.Firefox.Start -WorkingDirectory $Config.Firefox.Path -Name $Config.Firefox.Name -Port $Config.Firefox.Port) {
            $Started += $Config.Firefox.Name
        }
    }
    
    if ($Opera -or $All -or $Mcp) {
        if (Start-ProcessAsync -Command $Config.Opera.Start -WorkingDirectory $Config.Opera.Path -Name $Config.Opera.Name -Port $Config.Opera.Port) {
            $Started += $Config.Opera.Name
        }
    }
    
    return $Started
}

function Start-AgentServers {
    Write-Header "Starting Agent Servers..."
    
    $Started = @()
    
    if ($Opencode -or $All -or $Agents) {
        if (Start-ProcessAsync -Command $Config.Opencode.Start -WorkingDirectory $Config.Opencode.Path -Name $Config.Opencode.Name -Port $Config.Opencode.Port) {
            $Started += $Config.Opencode.Name
        }
    }
    
    return $Started
}

function Start-WordPressServer {
    Write-Header "Starting WordPress MCP Server..."
    
    if (Start-ProcessAsync -Command $Config.WordPress.Start -WorkingDirectory $Config.WordPress.Path -Name $Config.WordPress.Name -Port $Config.WordPress.Port) {
        return @($Config.WordPress.Name)
    }
    
    return @()
}

function Start-DebugBrowsers {
    Write-Header "Starting Debug Browsers..."
    
    $Started = @()
    
    if ($Chrome -or $All) {
        # Check if DebugFull profile exists
        $DebugFullPath = "C:\Users\souro\AppData\Local\Google\Chrome\DebugFull"
        if (-not (Test-Path $DebugFullPath)) {
            Write-Status "Creating DebugFull profile..." "Info"
            $Source = "C:\Users\souro\AppData\Local\Google\Chrome\User Data\Default"
            if (Test-Path $Source) {
                Copy-Item -Path $Source -Destination $DebugFullPath -Recurse -Force
                Write-Status "DebugFull profile created" "Success"
            } else {
                Write-Status "Default Chrome profile not found" "Warning"
            }
        }
        
        # Start Chrome
        try {
            Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe' \
                -ArgumentList '--remote-debugging-port=9222','--user-data-dir=C:\Users\souro\AppData\Local\Google\Chrome\DebugFull' \
                -WindowStyle Normal
            Write-Status "Chrome started with debugging on port 9222" "Success"
            $Started += "chrome-debug"
        } catch {
            Write-Status "Failed to start Chrome: $_" "Error"
        }
    }
    
    if ($Opera -or $All) {
        try {
            Start-Process 'C:\Program Files\Opera\launcher.exe' \
                -ArgumentList '--remote-debugging-port=9223' \
                -WindowStyle Normal
            Write-Status "Opera started with debugging on port 9223" "Success"
            $Started += "opera-debug"
        } catch {
            Write-Status "Failed to start Opera: $_" "Error"
        }
    }
    
    return $Started
}

function Get-NetstatPorts {
    param([int[]]$Ports)
    
    $Result = @{}
    foreach ($Port in $Ports) {
        $Result[$Port] = $false
    }
    
    try {
        $Netstat = netstat -ano | Select-String -Pattern "LISTENING"
        foreach ($Line in $Netstat) {
            foreach ($Port in $Ports) {
                if ($Line -match ":$Port\s") {
                    $Result[$Port] = $true
                }
            }
        }
    } catch {
        Write-Status "Failed to check netstat: $_" "Warning"
    }
    
    return $Result
}

function Show-Status {
    Write-Header "=== SERVER STATUS ==="
    
    $AllPorts = @($Config.Chrome.Port, $Config.Firefox.Port, $Config.Opera.Port, $Config.WordPress.Port, $Config.Opencode.Port, 9222, 9223)
    $PortStatus = Get-NetstatPorts $AllPorts
    
    Write-Host "MCP Servers:" -ForegroundColor Cyan
    if ($PortStatus[$Config.Chrome.Port]) {
        Write-Host "  Chrome MCP ($($Config.Chrome.Port)): $($Colors.Success)RUNNING$($Colors.Reset)" 
    } else {
        Write-Host "  Chrome MCP ($($Config.Chrome.Port)): $($Colors.Error)STOPPED$($Colors.Reset)"
    }
    
    if ($PortStatus[$Config.Firefox.Port]) {
        Write-Host "  Firefox MCP ($($Config.Firefox.Port)): $($Colors.Success)RUNNING$($Colors.Reset)"
    } else {
        Write-Host "  Firefox MCP ($($Config.Firefox.Port)): $($Colors.Error)STOPPED$($Colors.Reset)"
    }
    
    if ($PortStatus[$Config.Opera.Port]) {
        Write-Host "  Opera MCP ($($Config.Opera.Port)): $($Colors.Success)RUNNING$($Colors.Reset)"
    } else {
        Write-Host "  Opera MCP ($($Config.Opera.Port)): $($Colors.Error)STOPPED$($Colors.Reset)"
    }
    
    if ($PortStatus[$Config.WordPress.Port]) {
        Write-Host "  WordPress MCP ($($Config.WordPress.Port)): $($Colors.Success)RUNNING$($Colors.Reset)"
    } else {
        Write-Host "  WordPress MCP ($($Config.WordPress.Port)): $($Colors.Error)STOPPED$($Colors.Reset)"
    }
    
    if ($PortStatus[$Config.Opencode.Port]) {
        Write-Host "  Opencode MCP ($($Config.Opencode.Port)): $($Colors.Success)RUNNING$($Colors.Reset)"
    } else {
        Write-Host "  Opencode MCP ($($Config.Opencode.Port)): $($Colors.Error)STOPPED$($Colors.Reset)"
    }
    
    Write-Host "`nDebug Ports:"
    if ($PortStatus[9222]) {
        Write-Host "  Chrome CDP (9222): $($Colors.Success)RUNNING$($Colors.Reset)"
    } else {
        Write-Host "  Chrome CDP (9222): $($Colors.Error)STOPPED$($Colors.Reset)"
    }
    
    if ($PortStatus[9223]) {
        Write-Host "  Opera CDP (9223): $($Colors.Success)RUNNING$($Colors.Reset)"
    } else {
        Write-Host "  Opera CDP (9223): $($Colors.Error)STOPPED$($Colors.Reset)"
    }
}

# Main execution
Write-Header "============================================"
Write-Header "  BROWSER AUTOMATION - SERVER MANAGER"
Write-Header "============================================"
Write-Host ""

# Determine what to start
if ($All) {
    Start-McpServers
    Start-AgentServers
    Start-WordPressServer
    Start-DebugBrowsers
} elseif ($Mcp) {
    Start-McpServers
} elseif ($Agents) {
    Start-AgentServers
} elseif ($WordPress) {
    Start-WordPressServer
} elseif ($Chrome -or $Firefox -or $Opera) {
    Start-McpServers
    Start-DebugBrowsers
} else {
    # Default: Start everything
    Start-McpServers
    Start-AgentServers
    Start-WordPressServer
    Start-DebugBrowsers
}

Write-Host ""
Show-Status

Write-Host ""
Write-Header "Next Steps:"
Write-Host "  1. Check all servers are running with: .\health-check.ps1"
Write-Host "  2. Load the browser-automation-unified skill in Vibe"
Write-Host "  3. Start testing with cross-browser commands"
Write-Host ""
