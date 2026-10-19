---
name: local-software
description: Launch, open, or resolve software already installed on this Windows PC, and list mounted drives. Use instead of WSL bash or a guessed Program Files path.
---

# Local software

Use the `local_software` tool. Do not claim a program is missing until `resolve` or `search` returns no match.

- `drives` lists mounted drive letters. D: was absent on 2026-10-18; recheck rather than assuming it stays absent.
- `resolve` checks one name or path.
- `search` does a bounded search under Program Files, Local Programs, `E:\tools`, `E:\apps`, and the Resolve folder.
- `launch` starts an executable. Leave `wait` false for GUI apps and report the pid. Set `wait` true only when you need the exit code.
- From Git Bash, never launch a GUI app with `app.exe &`: the shell holds the pipes, the call times out, and the timeout kills the app. Launch detached with `powershell.exe -Command "Start-Process 'C:\path\app.exe'"` (verified with Chrome 2026-10-19).
- `open` uses the Windows file association for a file or folder.

`git_bash` can list `/c`, `/e`, `/g`, and `/h`. The `bash` command on PATH is a disabled WSL stub; do not use it. `win_shell` runs PowerShell when a Windows cmdlet is the right tool.

After launch, the evidence is the returned path and pid or exit code. A tool call without that result is not a successful launch.
