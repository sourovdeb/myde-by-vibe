# Latch

Small local MCP program for this PC. It does not merge chats.

- Grok CLI already talks to Grok's cloud. That terminal is not the website thread.
- Pi keeps the model you logged into inside Pi.
- Vibe already talks to Mistral, including Vibe in the browser.
- Latch only queues a task for one of those CLIs, or reads a file you allowed.

Grok's custom connector must be a public `https` URL. `localhost` and `192.168` addresses are rejected. Paste the tunnel, not port 3939.

This crate does not replace `start-mcp-servers.ps1`. That script still starts the Node servers on 3000 and 3001. Latch listens on 3939 only when you run it.

## Commands

```
latch status
latch on
latch off
latch serve
latch stdio
latch check-url https://your-tunnel.example/mcp
```

Settings file: `%USERPROFILE%\.mcp-autostart\latch.json` (or `~/.mcp-autostart/latch.json`). See `latch.json.example`. The server switch is `server_on`. `latch off` keeps the process able to answer `initialize`, and refuses tools.

Shell runs only a command that matches the allow list exactly, and never through a shell. File reads must stay inside `folders`.

## Mock tests

`cargo test` uses `MockRunner`. No CLI is started. No cloud is called. The HTTP test binds `127.0.0.1` and speaks JSON-RPC to itself.
