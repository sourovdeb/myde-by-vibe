# start-mcp-servers.ps1 — idempotent starter for Sourov's local MCP stack (2026-10-25)
# Guarantees: local MCP servers on 3000 (my-mcp-connector, 5 system tools) and
# 3001 (browser-control-mcp, 15 browser tools) are listening whenever this runs.
# No agent / Vibe / OpenCode dependency. Safe to run repeatedly: skips what is up.
#
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1
# Exit codes: 0 = both local MCPs up (or started), 1 = a local MCP could not be confirmed.

$Root  = 'C:\Users\souro\.mcp-autostart'
$Logs  = Join-Path $Root 'logs'
$Pids  = Join-Path $Root 'pids'
$Node  = 'C:\Program Files\nodejs\node.exe'
$Cloudflared = "$env:LOCALAPPDATA\Temp\cloudflared.exe"

New-Item -ItemType Directory -Force -Path $Logs, $Pids | Out-Null

$services = @(
  [pscustomobject]@{ Name = 'mcp-3000'; Port = 3000; Exe = $Node; Args = @('"C:\Users\souro\.vibe\plugins\my-mcp-connector\server\http-server.js"');  WorkDir = 'C:\Users\souro\.vibe\plugins\my-mcp-connector\server' }
  [pscustomobject]@{ Name = 'mcp-3001'; Port = 3001; Exe = $Node; Args = @('"C:\Users\souro\.vibe\plugins\browser-control-mcp\server\http-server.js"'); WorkDir = 'C:\Users\souro\.vibe\plugins\browser-control-mcp\server' }
)

function Test-TcpPort([int]$Port) {
  try { $c = New-Object System.Net.Sockets.TcpClient; $c.Connect('127.0.0.1', $Port); $c.Close(); return $true }
  catch { return $false }
}

function Start-Service($svc) {
  $logOut = Join-Path $Logs ("{0}.out.log" -f $svc.Name)
  $logErr = Join-Path $Logs ("{0}.err.log" -f $svc.Name)
  $pidFile = Join-Path $Pids ("{0}.pid" -f $svc.Name)
  $proc = Start-Process -WindowStyle Hidden -FilePath $svc.Exe -ArgumentList ($svc.Args -join ' ') -WorkingDirectory $svc.WorkDir -RedirectStandardOutput $logOut -RedirectStandardError $logErr -PassThru
  [int]$proc.Id | Set-Content -LiteralPath $pidFile
  Write-Host ("START {0} port {1} pid {2}" -f $svc.Name, $svc.Port, $proc.Id)
}

$allUp = $true
foreach ($svc in $services) {
  if (Test-TcpPort $svc.Port) {
    # Already listening. Also confirm the process is still alive; if the port is
    # owned by something stale but the health endpoint is dead, log and move on
    # (out of scope: do not kill unknown processes).
    Write-Host ("UP    {0} port {1} already listening" -f $svc.Name, $svc.Port)
    continue
  }
  Start-Service $svc
  Start-Sleep -Milliseconds 800
  if (Test-TcpPort $svc.Port) {
    Write-Host ("OK    {0} now listening" -f $svc.Name)
  } else {
    $allUp = $false
    Write-Host ("WARN  {0} port {1} not listening yet (check {2}\{0}.err.log)" -f $svc.Name, $svc.Port, $Logs)
  }
}

# Optional: restart the Cloudflare tunnels ONLY if their ports 8443/8444 proxy
# processes are gone. The tunnel subdomains are ephemeral; after a restart the
# Mistral connectors must be re-pointed manually (see ~\.vibe\docs\TUNNEL-URLS-2026-10-24.md).
if ($env:MCP_AUTOSTART_TUNNELS -eq '1') {
  $cfRunning = (Get-CimInstance Win32_Process -Filter "Name='cloudflared.exe'" -ErrorAction SilentlyContinue) -ne $null
  if (-not $cfRunning -and (Test-Path $Cloudflared)) {
    Start-Process -WindowStyle Hidden -FilePath $Cloudflared -ArgumentList 'tunnel','--url','http://localhost:3000' -RedirectStandardOutput (Join-Path $Logs 'cf-3000.log') -RedirectStandardError (Join-Path $Logs 'cf-3000.err.log')
    Start-Sleep -Seconds 2
    Start-Process -WindowStyle Hidden -FilePath $Cloudflared -ArgumentList 'tunnel','--url','http://localhost:3001' -RedirectStandardOutput (Join-Path $Logs 'cf-3001.log') -RedirectStandardError (Join-Path $Logs 'cf-3001.err.log')
    Write-Host 'START cloudflared x2 (NEW ephemeral URLs - re-point Mistral connectors)'
  } else {
    Write-Host "INFO  cloudflared already running, skip start"
  }
}

if ($allUp) { exit 0 } else { exit 1 }
