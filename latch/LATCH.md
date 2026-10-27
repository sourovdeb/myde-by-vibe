# Latch version 2

Small program on this PC. A cloud chat does not share its transcript with a local CLI. It can only call the tools you switched on.

Port `3939`. HTTP and stdio. The panel writes `latch.json`. Latch reads that file on every call.

## Tools

| Tool | What it does | Switch |
| --- | --- | --- |
| `list_files` | List one allowed folder | Read |
| `read_file` | Read one file in an allowed folder | Read |
| `search_files` | Find a short phrase in those folders | Read |
| `write_file` | Create or replace one file in an allowed folder | Edit |
| `run_task` | Run one exact allow-listed command. No shell | Scripts |
| `control_desktop` | List, focus, or type into an allow-listed window | Desktop |

Edit, scripts, and desktop start off.

`control_desktop` uses the Windows window API. It does not send hotkeys, move the mouse, or start a program. Starting a program is `run_task`. This Linux build refuses the desktop tool. The Windows code is in the crate and runs only when you build on Windows.

A file must stay inside a folder you listed. A symlink is refused. The settings file itself cannot be edited by a tool.

## Switches

Master: read, edit, scripts, desktop.

Each provider has the same four: Grok, Mistral, ChatGPT, Pi. A provider cannot do more than the master switch.

```
latch set master edit on
latch set grok edit on
latch set chatgpt edit off
latch panel
```

`latch panel` prints the switches and a local page address. Open it while `latch serve` is running. The page needs a token. Do not put that token in a cloud URL.

`latch on` and `latch off` still flip the server. While it is off, `initialize` works and tools do not.

## Connect a cloud

The address must be public `https`. `localhost` and `192.168` addresses are rejected.

| Provider | Path | Note |
| --- | --- | --- |
| Grok | `/mcp/grok` | Custom connector. Connect this one first. |
| Mistral | `/mcp/mistral` | Custom connector in Le Chat. Connect this one with Grok. |
| ChatGPT | `/mcp/chatgpt` | A free plan may not allow a custom connector. OpenAI may refuse write tools. |
| Pi | `/mcp/pi` | Pi stays on this PC. There is no Pi website to register. |

Stdio uses the master switches. It is not a cloud caller.

## The program

`latch.exe` is in the zip. It is the Windows build, about 500 KB. It uses normal Windows libraries only. Run `latch.exe status`, then `latch.exe panel`, then `latch.exe serve`.

It was linked here and not started. This build machine is Linux.

## Tests

`cargo test` passed here on 2026-10-26. 10 tests. No cloud was called.

1. A localhost URL is rejected. A public https URL is accepted.
2. Provider switches cannot exceed the master switches.
3. Server off still answers `initialize` and refuses tools.
4. `run_task` runs only an exact allow-listed line, and not through a shell.
5. Read, list, search, and write stay inside the folder. Edit off hides `write_file`. ChatGPT cannot write when its edit switch is off.
6. Desktop off hides the tool. An app that is not allow-listed is refused. The mock records an allowed type action. No window API is called.
7. The copilot envelope keeps system and user apart.
8. An old settings file migrates. Handoff tools are gone. Stdio still speaks JSON-RPC.
9. The panel saves switches. The next call sees them. A missing token gets 404. HTTP `initialize` still works.
10. A real temporary folder accepts a write inside it, refuses a file outside it, and refuses a symlink that points outside.

## What it is not

It does not merge the grok.com thread with the Grok CLI. It does not log Pi into a website. It does not replace the Node servers on ports 3000 and 3001.
