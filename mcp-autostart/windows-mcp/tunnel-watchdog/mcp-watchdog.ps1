# mcp-watchdog.ps1 — keep Latch (3939) and mcp-bridge (8765) alive, report tunnels.
# Created 2026-10-27. Never kills processes; only starts missing servers.
# Tunnels are reported (URL + age), never auto-started.
# Usage:
#   powershell -File mcp-watchdog.ps1            # one pass
#   powershell -File mcp-watchdog.ps1 -Loop      # run forever (used by Startup vbs)

param([switch]$Loop)

$ErrorActionPreference = 'Continue'
$here = Split-Path -Parent $MyInvocation.MyCommand.Path
$script:lastAttempt = @{}   # dedupe: don't re-spawn within 10 minutes
$retryWindowMin = 10
$cfgPath = Join-Path $here 'mcp-watchdog.config.json'
if (-not (Test-Path $cfgPath)) {
  $cfgPath = 'C:\Users\souro\.mcp-autostart\mcp-watchdog.config.json'
}
$cfg = Get-Content $cfgPath -Raw | ConvertFrom-Json

function Write-Log([string]$msg) {
  $line = '[{0}] {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $msg
  Add-Content -Path $cfg.log_file -Value $line -Encoding UTF8
  if (-not $Loop) { Write-Output $line }
}

function Test-Port([int]$port) {
  try {
    $c = [System.Net.Sockets.TcpClient]::new()
    $ar = $c.BeginConnect('127.0.0.1', $port, $null, $null)
    $ok = $ar.AsyncWaitHandle.WaitOne(800, $false) -and $c.Connected
    $c.Close()
    return $ok
  } catch { return $false }
}

function Get-FreeMB {
  [math]::Round((Get-CimInstance Win32_OperatingSystem).FreePhysicalMemory / 1KB)
}

function Find-PidOnPort([int]$port) {
  try {
    (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction Stop | Select-Object -First 1).OwningProcess
  } catch { $null }
}

function Discover-TunnelUrls([object]$cfg) {
  $urls = @()
  foreach ($dir in $cfg.tunnel_log_dirs) {
    if (-not (Test-Path $dir)) { continue }
    Get-ChildItem -Path $dir -Filter '*.log' -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -gt (Get-Date).AddHours(-6) } |
      ForEach-Object {
        $match = Select-String -Path $_.FullName -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | Select-Object -Last 1
        if ($match) {
          $urls += [pscustomobject]@{
            url = ($match.Matches[0].Value.TrimEnd([char]34))
            source = $_.FullName
            age_min = [math]::Round(((Get-Date) - $_.LastWriteTime).TotalMinutes, 1)
          }
        }
      }
  }
  # mcp-bridge keeps its own public_url; include it as a known entry.
  $brcfg = Join-Path $env:APPDATA 'mcp-bridge\config.json'
  if ((Test-Path $brcfg) -and (ConvertFrom-Json (Get-Content $brcfg -Raw)).public_url) {
    $urls += [pscustomobject]@{
      url = (ConvertFrom-Json (Get-Content $brcfg -Raw)).public_url
      source = $brcfg
      age_min = $null
    }
  }
  return $urls
}

while ($true) {
  $state = [ordered]@{
    as_of = Get-Date -Format 'o'
    free_mb = Get-FreeMB
    local = [ordered]@{}
    tunnels = [ordered]@{}
    warnings = @()
  }

  foreach ($s in $cfg.servers) {
    $alive = Test-Port $s.port
    $entry = [ordered]@{ alive = $alive; port = $s.port; pid = $(Find-PidOnPort $s.port) }
    if (-not $alive -and $s.auto_restart) {
      $last = $script:lastAttempt.$($s.name)
      $recent = ($last -and ((Get-Date) - $last) -lt (New-TimeSpan -Minutes $retryWindowMin))
      if ($state.free_mb -lt $s.ram_guard_mb) {
        $state.warnings += "restart-skipped $($s.name): free RAM $([math]::Round($state.free_mb/1MB,1)) GB < guard $($s.ram_guard_mb) MB"
        Write-Log "skip restart $($s.name) (RAM guard)"
      } elseif ($recent) {
        Write-Log "skip restart $($s.name): already attempted within $retryWindowMin min"
      } else {
        Write-Log "starting $($s.name) -> $($s.start_cmd)"
        Start-Process -FilePath 'cmd.exe' -ArgumentList "/c `"$($s.start_cmd)`"" -WindowStyle Hidden
        $entry.restart_attempt = $true
        $script:lastAttempt.$($s.name) = Get-Date
      }
    } elseif (-not $alive) {
      $state.warnings += "down $($s.name): no listener on $($s.port) and auto_restart=false"
    }
    $state.local.$($s.name) = $entry
  }

  $urls = @(Discover-TunnelUrls $cfg)
  $state.tunnels['known'] = $urls
  if ($urls.Count -eq 0) {
    $state.warnings += 'no tunnel URL found in the last 6h of cloudflared logs; cloud callers may be stale'
  }

  $state | ConvertTo-Json -Depth 5 | Set-Content -Path $cfg.state_file -Encoding UTF8
  Write-Log ("servers: " + (($cfg.servers | ForEach-Object { "$($_.name)=" + $(if (Test-Port $_.port) {'up'} else {'DOWN'}) }) -join ', ') + " | tunnels known: $($urls.Count)")

  if (-not $Loop) { break }
  Start-Sleep -Seconds $cfg.loop_seconds
}
