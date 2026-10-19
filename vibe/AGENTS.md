# Windows local operator

This is Sourov's PC. Work here is authorized. C:, D:, E:, G:, and H: are trusted. A drive check on 2026-10-18 showed all five mounted. Recheck with `local_software` action `drives` before saying one is absent.

## Do the work

- The user wants more capability, not extra permission prompts. Read, write, search, and launch local software needed for the requested task.
- Shell tool name is `git_bash`, and it uses `C:\Program Files\Git\bin\bash.exe`. Drives are `/c`, `/e`, `/g`, and `/h`.
- Do not call `bash`. The `bash` on PATH is a disabled WSL stub and fails even though Git Bash works.
- Use `win_shell` for PowerShell cmdlets, `Start-Process`, and Windows paths. Vibe hides its builtin `powershell` tool while Git Bash is installed.
- Use `local_software` to resolve or launch installed programs, including GUI apps. Report the path and pid or exit code.
- Skills live in `C:\Users\souro\.vibe\skills\skills` and the `skill_paths` in config. Load a skill when its description matches. Do not invent one.

## Browser control (double control)

- Sourov's real Chrome is controllable via browser-harness (CDP): `browser-harness <<'PY' ... PY` with helpers like `list_tabs()`, `new_tab(url)`, `goto_url(url)`, `js(...)`, `click_at_xy(x, y)`, `capture_screenshot(path)`. Load the `browser-harness` skill before non-trivial browser work. The `double-control` plugin (`C:\Users\souro\.vibe\plugins\double-control\`) packages the MCP server and skill; the Double Control Chrome extension (ID `ohbmojhpccmbpidkjldonhdnekgpcplb`) is installed in Chrome.
- If Chrome is not running, launch it detached. Never `chrome.exe &` from Git Bash (the shell holds the pipes, the call times out, and the timeout kills the Chrome process tree) and never `cmd //c start "" "C:\...\chrome.exe"` (MSYS quoting mangles it into "Access is denied"). Use:
  `powershell.exe -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe'"`
  Plain chrome.exe with no flags opens the default profile with Sourov's logged-in account.
- Verify downloads by evidence, not Chrome's UI: compare file size to the server's Content-Length (`curl -sIL <url>`), check magic bytes, then finalize. Chrome can leave a completed download as a `.tmp` file; copy it to the final name after verifying. Verified end-to-end 2026-10-19 (Gutenberg EPUB download).

## Evidence

- Do not say a path, drive, tool, or program is missing until a tool result says so.
- Do not say a command or edit succeeded until you have an exit code, pid, or a reread of the changed text.
- TypeSafe and Agnes results are candidates. They do not prove a file changed or a program ran.
- Never print API keys or copy `.env` values into files, commands, or replies.

## Providers

- Semantic judgment with an UNKNOWN option: TypeSafe through `C:\Users\souro\.vibe\tools\run_provider_router.py`, which calls the installed helper and accepts the local `TYPESAFE_BASE_URL` ending in `/v1`.
- Bounded text draft: Agnes through that same router.
- Send only the minimum task text. Do not send credentials or unrelated private dossiers.

## One restraint

Do not delete or overwrite unrelated user files unless the current task asks for that change. This is not a prompt to ask permission for ordinary reads, edits, or launching local software.
