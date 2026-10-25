' mcp-servers-autostart.vbs (2026-10-25)
' Logon autostart (Startup folder): ensures local MCP servers 3000/3001 are up.
' Servers only - does not open Chrome. Idempotent via the PowerShell starter.
Dim sh
Set sh = CreateObject("WScript.Shell")
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\souro\.mcp-autostart\start-mcp-servers.ps1""", 0, True
