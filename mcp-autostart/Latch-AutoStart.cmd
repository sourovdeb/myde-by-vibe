@echo off
rem Latch MCP AutoStart - idempotent, boot-safe, per-user (no admin needed)
rem Created 2026-10-27. Run manually too: it skips anything already up.
cd /d E:\tools\latch

rem --- 1. local MCP server (binds 0.0.0.0:3939; reachability limited by Windows Firewall + provider caps) ---
netstat -ano | findstr /C:":3939 " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 (
  echo Latch already listening on 3939.
  goto :tunnel
)
start "" /b E:\tools\latch\latch.exe serve >> E:\tools\latch\latch-serve.log 2>&1

rem wait up to 15 s for the port
set /a tries=0
:waitport
ping -n 2 127.0.0.1 >nul
netstat -ano | findstr /C:":3939 " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 goto :tunnel
set /a tries+=1
if %tries% lss 8 goto :waitport
echo Latch did not come up on 3939; see latch-serve.log
:tunnel

rem --- 2. Cloudflare quick tunnel (idempotent: skip if cloudflared already running) ---
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | findstr /I "cloudflared.exe" >nul 2>&1
if not errorlevel 1 (
  echo cloudflared already running; keeping existing tunnel URL.
  goto :status
)
if not exist E:\tools\latch\cloudflared.exe (
  copy /Y C:\tmp\cloudflared.exe E:\tools\latch\cloudflared.exe >nul 2>&1
)
del /q E:\tools\latch\cf-tunnel.log 2>nul
start "" /b E:\tools\latch\cloudflared.exe tunnel --url http://localhost:3939 --no-autoupdate > E:\tools\latch\cf-tunnel.log 2>&1
rem give the tunnel a moment to print its URL
ping -n 15 127.0.0.1 >nul
:status

rem --- 3. status.json: live URL + pids, refreshed on every boot ---
powershell -NoProfile -ExecutionPolicy Bypass -File E:\tools\latch\Latch-Status.ps1 >nul 2>&1
rem keep this window open only when run interactively
if "%1"=="interactive" pause
exit /b 0
