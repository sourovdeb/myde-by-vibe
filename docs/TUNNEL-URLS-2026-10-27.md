# Cloudflare Tunnel URLs (2026-10-27)

| Service | Port | Tunnel URL | PID |
|---------|------|-----------|-----|
| Latch MCP | 3939 | https://jason-salvador-known-stood.trycloudflare.com | 8516 |
| my-mcp-connector | 3000 | https://casey-bear-assumed-dui.trycloudflare.com | (shared) |
| browser-control-mcp | 3001 | https://flame-against-bent-sociology.trycloudflare.com | (shared) |
| **Unified MCP Gateway** | **3002** | **https://things-clerk-houston-gras.trycloudflare.com** | **cloudflared (new)** |
| StykFlow | 8765 | (separate tunnel) | 13028 |

## Unified MCP Gateway (NEW 2026-10-27)

- **Local:** http://localhost:3002/mcp
- **Tunnel:** https://things-clerk-houston-gras.trycloudflare.com/mcp
- **Tools:** 39 total (26 upstream proxied + 13 native)
- **RAM:** ~65 MB (gateway) + ~47 MB (cloudflared) = ~112 MB total
- **Autostart:** Startup folder shortcut + VBS script
- **Files:** E:\tools\unified-mcp-gateway\ (server.js, package.json, start.cmd, README.md)

### 13 Native Tools
run_command, manage_process, screenshot, clipboard, manage_file, manage_service,
network_info, install_package, notify, window_management, registry_read, get_env,
system_info_extended

### Upstream Proxied (26 tools)
- Latch (3939): list_files, read_file, search_files, write_file, run_task, control_desktop
- my-mcp-connector (3000): health_check, system_info, one_stop_shop_status, credential_env_present, vibe_skill_list
- browser-control-mcp (3001): 15 browser_* tools

## Mistral AI Connector (NEW 2026-10-27 ~01:10 UTC)

- **Connector name:** `sourov_gateway_full_pc_control_7b5b`
- **Connector ID:** `01a17a0a-7493-7374-8092-2902122ff01c`
- **Server:** `https://things-clerk-houston-gras.trycloudflare.com/mcp`
- **Auth:** Bearer token (credential `gateway-bearer-auth`, valid, default)
- **Tools:** 39 detected via `refreshTools`
- **Status:** Authenticated, ready for Mistral AI Work
- **Setup doc:** `docs/MISTRAL-GATEWAY-CONNECTOR-2026-10-27.md`

## Sourov Control Center (NEW 2026-10-27 ~01:07 UTC)

- **Location:** `E:\tools\sourov-control-center\dist\Sourov Control Center.exe`
- **Size:** 11.5 MB (single .exe, PyInstaller onefile)
- **RAM:** ~68 MB private (~113 MB working set with WebView2)
- **Engine:** Python 3.12 + pywebview 6.2 (WebView2)
- **Autostart:** Startup folder shortcut + VBS script
- **Desktop shortcut:** Created
- **Taskbar:** Pinned
- **Source:** `sourov-control-center/` in this repo
