# Latch-Status.ps1 - refresh E:\tools\latch\status.json (live pids + last-known-good tunnel URL)
# Prefers a fresh URL from cf-tunnel.log; otherwise keeps the previous status.json value.
$log = 'E:\tools\latch\cf-tunnel.log'
$status = 'E:\tools\latch\status.json'
$url = ''
if (Test-Path $log) {
    $m = Select-String -Path $log -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($m) { $url = $m.Matches[0].Value }
}
if (-not $url -and (Test-Path $status)) {
    try { $old = (Get-Content $status -Raw | ConvertFrom-Json).tunnel_url; if ($old) { $url = $old } } catch {}
}
$listen = Get-NetTCPConnection -LocalPort 3939 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
$latchPid = if ($listen) { $listen.OwningProcess } else { $null }
$cf = Get-Process cloudflared -ErrorAction SilentlyContinue | Select-Object -First 1
$obj = [pscustomobject]@{
    generated       = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    tunnel_url      = $url
    latch_pid       = $latchPid
    latch_listen    = [bool]$latchPid
    cloudflared_pid = if ($cf) { $cf.Id } else { $null }
    note            = 'Quick-tunnel URL is ephemeral: when a fresh cloudflared start regenerates it, re-point the Mistral latch connector. The last known good URL is kept between boots.'
}
$obj | ConvertTo-Json | Set-Content -Encoding UTF8 $status
Write-Output ("status.json written: url={0} latch_pid={1} cf_pid={2}" -f $url, $latchPid, $(if ($cf) { $cf.Id } else { 'none' }))
