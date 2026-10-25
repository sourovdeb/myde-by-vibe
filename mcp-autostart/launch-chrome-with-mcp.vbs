' launch-chrome-with-mcp.vbs (2026-10-25)
' Silent Chrome launcher: ensures the local MCP stack (ports 3000/3001) is up,
' then opens Google Chrome. No window flashes, no agent involvement.
'
' Usage:
'   (double-click or shortcut target) -> starts MCP servers, then Chrome
'   cscript launch-chrome-with-mcp.vbs servers-only -> starts MCP servers, skips Chrome (test)
'
' The starter is idempotent: already-listening ports are skipped.

Dim sh, mode, baseDir, ps1
Set sh = CreateObject("WScript.Shell")
baseDir = "C:\Users\souro\.mcp-autostart"
ps1 = baseDir & "\start-mcp-servers.ps1"

mode = ""
If WScript.Arguments.Count > 0 Then mode = LCase(WScript.Arguments(0))

' Ensure MCP servers are listening BEFORE Chrome comes up
sh.Run "powershell -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & ps1 & """", 0, True

If mode <> "servers-only" Then
  sh.Run """C:\Program Files\Google\Chrome\Application\chrome.exe""", 0, False
End If
