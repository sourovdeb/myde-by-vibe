@echo off
rem ============================================================
rem  ONE-STOP-SHOP — One-Click Launcher (Vibe + Pi + Cloud)
rem  Created 2026-10-27. Idempotent: safe to run anytime.
rem
rem  Starts (skips what's already running):
rem    1. Latch MCP server (port 3939) + Cloudflare tunnel
rem    2. Mistral Workflows worker (all 5 enriched workflows)
rem    3. Verifies connectivity and prints status
rem ============================================================
setlocal EnableDelayedExpansion
title ONE-STOP-SHOP Launcher
color 0A

set "ROOT=E:\ONE-STOP-SHOP\mistral-workflows"
set "LATCH_DIR=E:\tools\latch"
set "VENV_PY=%ROOT%\.venv\Scripts\python.exe"

echo.
echo  ============================================
echo   ONE-STOP-SHOP — One-Click Launcher
echo   %DATE% %TIME%
echo  ============================================
echo.

rem --- 1. Latch MCP + Cloudflare tunnel (idempotent) ---
echo [1/4] Latch MCP server + Cloudflare tunnel...
call "%LATCH_DIR%\Latch-AutoStart.cmd"
echo.

rem --- 2. Verify Latch is reachable ---
echo [2/4] Verifying Latch MCP connectivity...
curl -s -m 5 -X POST http://127.0.0.1:3939/mcp/mistral -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\",\"params\":{}}" > "%TEMP%\latch_tools.json" 2>nul
if exist "%TEMP%\latch_tools.json" (
    findstr /C:"\"tools\"" "%TEMP%\latch_tools.json" >nul 2>&1
    if not errorlevel 1 (
        echo   [OK] Latch MCP responding on localhost:3939
    ) else (
        echo   [WARN] Latch responded but no tools found
    )
) else (
    echo   [FAIL] Latch MCP not responding on localhost:3939
)

rem --- 3. Read tunnel URL from status.json ---
echo [3/4] Reading tunnel status...
if exist "%LATCH_DIR%\status.json" (
    for /f "tokens=2 delims=:" %%a in ('findstr /C:"tunnel_url" "%LATCH_DIR%\status.json"') do (
        set "TUNNEL_URL=%%a"
    )
    echo   Tunnel URL:%TUNNEL_URL%
) else (
    echo   [WARN] No status.json found — tunnel may not be up yet
)

rem --- 4. Start Workflows worker (if not already running) ---
echo [4/4] Mistral Workflows worker...
tasklist /FI "IMAGENAME eq python.exe" 2>nul | findstr /I "python.exe" >nul 2>&1
if not errorlevel 1 (
    rem Check if any python process has "start_worker" in its command line
    wmic process where "name='python.exe'" get commandline 2>nul | findstr /I "start_worker" >nul 2>&1
    if not errorlevel 1 (
        echo   [OK] Workflows worker already running
        goto :summary
    )
)
echo   Starting workflows worker in new window...
start "Mistral Workflows Worker" /d "%ROOT%" cmd /k "%VENV_PY% start_worker.py"
echo   Worker launched. Check the new window for registration logs.

:summary
echo.
echo  ============================================
echo   STATUS SUMMARY
echo  ============================================
netstat -ano 2>nul | findstr /C:":3939 " | findstr /C:"LISTENING" >nul 2>&1
if not errorlevel 1 (echo   Latch MCP:     RUNNING (port 3939)) else (echo   Latch MCP:     NOT RUNNING)
tasklist /FI "IMAGENAME eq cloudflared.exe" 2>nul | findstr /I "cloudflared.exe" >nul 2>&1
if not errorlevel 1 (echo   CF Tunnel:     RUNNING) else (echo   CF Tunnel:     NOT RUNNING)
wmic process where "name='python.exe'" get commandline 2>nul | findstr /I "start_worker" >nul 2>&1
if not errorlevel 1 (echo   WF Worker:     RUNNING) else (echo   WF Worker:     NOT RUNNING)
echo.
echo   Latch panel:   http://127.0.0.1:3939/panel
echo   Tunnel URL:    %TUNNEL_URL%
echo   Workflows:     %ROOT%
echo  ============================================
echo.
pause
