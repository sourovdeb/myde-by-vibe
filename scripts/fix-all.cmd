@echo off
REM ============================================================
REM  Fix All - One-click recovery for tunnels + connectors
REM  Run this when Mistral AI connectors show "Needs attention"
REM ============================================================
REM
REM  What it does:
REM    1. Checks/restarts Cloudflare tunnels (tunnel-manager.ps1)
REM    2. Updates Mistral AI connectors (connector-autofix.py)
REM    3. Reports status
REM
REM  If Cloudflare rate-limits (429), wait 15-30 minutes and retry.
REM ============================================================

echo.
echo ============================================
echo  Fix All - Tunnel + Connector Recovery
echo  Time: %date% %time%
echo ============================================
echo.

REM Step 0: Check local services
echo [0/3] Checking local MCP services...
echo.
curl -s -o nul -w "  Connector (3000): HTTP %%{http_code}\n" http://localhost:3000/health
curl -s -o nul -w "  Browser MCP (3001): HTTP %%{http_code}\n" http://localhost:3001/health
curl -s -o nul -w "  Gateway (3002): HTTP %%{http_code}\n" http://localhost:3002/health
curl -s -o nul -w "  Latch MCP (3939): HTTP %%{http_code}\n" -X POST http://localhost:3939/mcp/mistral -H "Content-Type: application/json" -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/list\"}"
echo.

REM Step 1: Fix tunnels
echo [1/3] Fixing Cloudflare tunnels...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\souro\.mcp-autostart\tunnel-manager.ps1" -Auto
if errorlevel 1 (
    echo.
    echo WARNING: Tunnel recovery had issues.
    echo This may be Cloudflare rate limiting (HTTP 429).
    echo Wait 15-30 minutes and run this script again.
    echo.
    echo You can also try manually:
    echo   powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\souro\.mcp-autostart\tunnel-manager.ps1" -Restart
    echo.
)

REM Step 2: Fix connectors
echo.
echo [2/3] Fixing Mistral AI connectors...
echo.
C:\tmp\mistral-sdk-venv\Scripts\python.exe "C:\Users\souro\.mcp-autostart\connector-autofix.py" --fix
if errorlevel 1 (
    echo.
    echo WARNING: Connector fix had issues.
    echo Check that tunnels are up first (step 1).
    echo.
)

REM Step 3: Final status
echo.
echo [3/3] Final status check...
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "C:\Users\souro\.mcp-autostart\tunnel-manager.ps1" -Check
echo.

echo ============================================
echo  Done. Check https://chat.mistral.ai/connections
echo  You may need to click "Connect" on new connectors.
echo ============================================
echo.
pause
