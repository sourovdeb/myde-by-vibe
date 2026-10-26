# Sourov Control Center

A lightweight native Windows .exe UI for monitoring and controlling the Sourov PC automation stack.

## Specs

| Property | Value |
|----------|-------|
| Binary size | 11.5 MB (single .exe) |
| RAM (private) | ~68 MB (1.4 MB Python + 66.8 MB WebView2) |
| RAM (working set) | ~113 MB (includes shared DLLs) |
| Startup time | <2s |
| Engine | Python 3.12 + pywebview 6.2 (WebView2) |
| Packaged with | PyInstaller 6.22 (onefile, windowed) |

## Features

- **Service Dashboard** — Real-time status of all 4 MCP services (Gateway, Latch, Connector, Browser Control)
- **Start/Stop Controls** — Start or stop any service with one click
- **System Monitor** — Live RAM, CPU, and Disk usage with color-coded bars
- **Gateway Tools Panel** — Shows all 39 available MCP tools
- **Quick Access Links** — One-click access to Latch Panel, Gateway Health, folders, Mistral AI, GitHub

## Files

| File | Purpose |
|------|---------|
| `app.py` | Python backend — pywebview window + API methods |
| `index.html` | Frontend UI — dark theme dashboard |
| `build.bat` | PyInstaller build script |
| `setup-shortcuts.ps1` | Creates startup/desktop shortcuts + taskbar pin |
| `control-center-autostart.vbs` | Silent VBS launcher for startup |
| `dist/Sourov Control Center.exe` | Built application (11.5 MB) |

## Build

```bash
# Install dependencies
python -m pip install --break-system-packages pywebview pyinstaller

# Build .exe
python -m PyInstaller --name "Sourov Control Center" --windowed --onefile --clean --noconfirm --add-data "index.html;." --hidden-import webview --hidden-import webview.platforms.winforms --hidden-import pythonnet --hidden-import clr_loader app.py

# Setup shortcuts
powershell -File setup-shortcuts.ps1
```

## Run

- **Double-click:** `dist/Sourov Control Center.exe`
- **Startup:** Automatically launches on Windows login (Startup folder shortcut)
- **Desktop:** Shortcut on desktop
- **Taskbar:** Pinned (via setup script)

## API Methods (Python → JS)

| Method | Description |
|--------|-------------|
| `get_services()` | Returns health status of all 4 services |
| `get_system_info()` | Returns RAM, CPU, disk usage |
| `get_processes()` | Returns list of relevant processes |
| `start_service(key)` | Starts a service by key |
| `stop_service(key)` | Stops a service by key |
| `open_url(url)` | Opens URL in default browser |
| `open_folder(path)` | Opens folder in Explorer |
| `get_gateway_health()` | Detailed gateway health check |
| `get_gateway_tools()` | Lists all 39 MCP tools |
| `minimize_window()` | Minimizes the window |
| `close_window()` | Closes the window |
| `get_app_info()` | Returns app metadata |
