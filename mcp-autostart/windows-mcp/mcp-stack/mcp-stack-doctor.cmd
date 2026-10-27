@echo off
REM One-click MCP stack self-service: diagnose, then show the runbook next to this file.
where mcp-stack >nul 2>nul
if %errorlevel%==0 (
  mcp-stack doctor
) else (
  E:\tools\mcp-stack\mcp-stack.exe doctor
)
echo.
start "" notepad "%~dp0TROUBLESHOOTING.md"
