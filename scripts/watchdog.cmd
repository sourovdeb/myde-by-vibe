@echo off
REM ============================================================
REM  MCP Watchdog - Runs in a loop, checks tunnels every 5 min
REM  Place a shortcut to this in the Startup folder to auto-start
REM  Or run manually: watchdog.cmd
REM ============================================================

echo.
echo ============================================
echo  MCP Watchdog Started
echo  Time: %date% %time%
echo  Press Ctrl+C to stop
echo ============================================
echo.

:loop
    echo [%date% %time%] Running tunnel check...
    powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "C:\Users\souro\.mcp-autostart\tunnel-manager.ps1" -Auto
    
    REM Check if tunnels are OK (exit code 0)
    if errorlevel 1 (
        echo [%date% %time%] WARNING: Some tunnels are down. Will retry in 5 minutes.
        REM If rate-limited, wait longer before next attempt
        if exist "C:\Users\souro\.mcp-autostart\tunnel-status.json" (
            echo [%date% %time%] Status file exists. Check tunnel-status.json for details.
        )
    ) else (
        echo [%date% %time%] All tunnels OK.
    )
    
    echo [%date% %time%] Sleeping 5 minutes...
    echo.
    timeout /t 300 /nobreak > nul
    
goto loop
