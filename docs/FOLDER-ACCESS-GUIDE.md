# Folder Access — How to Open the Gateway/Latch Window

## Where to Click to Open the Control Window

### Unified MCP Gateway

The gateway runs as a background Node.js process — it has **no window**. To check its status:

1. **Health check:** Open browser → `http://localhost:3002/health`
2. **Tools list:** Open browser → `http://localhost:3002/` (shows tool count)
3. **Logs:** Open `E:\tools\unified-mcp-gateway\gateway.log` in any text editor
4. **Start/Stop:** Double-click `E:\tools\unified-mcp-gateway\start.cmd` to start

### Latch Control Panel

Latch has a web-based control panel:

1. **Open the panel:** Run `E:\tools\latch\open-panel.ps1` or open `http://localhost:3939/panel` in your browser
2. **The panel shows:** server status, provider switches (Grok, Mistral, ChatGPT, Pi), folder list, command allow-list
3. **Toggle switches:** Click the toggles in the panel to enable/disable read, edit, scripts, desktop per provider

### Folder Access (What Folders Latch Can See)

Latch can only access folders listed in its config. Current allowed folders:

```
E:\
D:\
G:\
H:\
C:\Users\souro\.vibe
Downloads
```

**To add a folder:** Edit `C:\Users\souro\.mcp-autostart\latch.json` → add the path to the `"folders"` array → restart Latch.

**To add a folder via the panel:** Open the Latch panel → Files section → Add folder.

### Quick Reference

| What | Where |
|---|---|
| Gateway health | `http://localhost:3002/health` |
| Gateway tools | `http://localhost:3002/` |
| Gateway files | `E:\tools\unified-mcp-gateway\` |
| Latch panel | `http://localhost:3939/panel` or `E:\tools\latch\open-panel.ps1` |
| Latch config | `C:\Users\souro\.mcp-autostart\latch.json` |
| Latch files | `E:\tools\latch\` |
| Gateway tunnel | `https://things-clerk-houston-gras.trycloudflare.com` |
| Latch tunnel | `https://jason-salvador-known-stood.trycloudflare.com` |
| Autostart (both) | Startup folder: `shell:startup` |

### Taskbar Pinning

To pin the gateway or Latch to the taskbar:

1. **Gateway:** Right-click `E:\tools\unified-mcp-gateway\start.cmd` → **Send to** → **Desktop (create shortcut)** → drag the shortcut to the taskbar
2. **Latch:** Right-click `E:\tools\latch\Latch-MCP.cmd` → **Send to** → **Desktop (create shortcut)** → drag to taskbar
3. **Or:** Open the Startup folder (`Win+R` → `shell:startup`) — shortcuts here launch on boot
