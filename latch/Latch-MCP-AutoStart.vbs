Set wsh = CreateObject("WScript.Shell")
rem Invisible per-user auto-start for Latch MCP + tunnel. Created 2026-10-27.
rem Idempotent: Latch-AutoStart.cmd skips anything already running.
wsh.Run "cmd /c E:\tools\latch\Latch-AutoStart.cmd", 0, False
