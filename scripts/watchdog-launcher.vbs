' MCP Watchdog Launcher - Place in Startup folder
' Launches watchdog.cmd hidden at login

Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd /c C:\Users\souro\.mcp-autostart\watchdog.cmd", 0, False
Set WshShell = Nothing
