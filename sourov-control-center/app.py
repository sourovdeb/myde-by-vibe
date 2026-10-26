#!/usr/bin/env python3
"""
Sourov Control Center — Lightweight PC Control UI
Uses pywebview (WebView2) for a native Windows window.
RAM: ~30-50 MB | Startup: <1s | Single .exe via PyInstaller
"""

import json
import os
import subprocess
import sys
import threading
import time
import urllib.request
import urllib.error
from pathlib import Path

import webview

# ── Paths ──────────────────────────────────────────────────────────────────
TOOLS_DIR = Path(r"E:\tools")
GATEWAY_DIR = TOOLS_DIR / "unified-mcp-gateway"
LATCH_DIR = TOOLS_DIR / "latch"
GATEWAY_ENV = GATEWAY_DIR / ".env"

# ── Service definitions ────────────────────────────────────────────────────
SERVICES = {
    "gateway": {
        "name": "Unified MCP Gateway",
        "port": 3002,
        "health_url": "http://localhost:3002/health",
        "start_cmd": ["cmd", "/c", str(GATEWAY_DIR / "start.cmd")],
        "start_vbs": str(GATEWAY_DIR / "gateway-autostart.vbs"),
        "description": "39 tools — full PC control via MCP",
        "icon": "🌐",
    },
    "latch": {
        "name": "Latch MCP",
        "port": 3939,
        "health_url": "http://localhost:3939/health",
        "start_cmd": ["cmd", "/c", str(LATCH_DIR / "Latch-AutoStart.cmd")],
        "start_vbs": str(LATCH_DIR / "Latch-AutoStart.vbs") if (LATCH_DIR / "Latch-AutoStart.vbs").exists() else None,
        "description": "Resolve + OBS bridge (15 commands)",
        "icon": "🔒",
    },
    "connector": {
        "name": "my-mcp-connector",
        "port": 3000,
        "health_url": "http://localhost:3000/health",
        "start_cmd": None,  # started externally
        "description": "System info + health tools (5 tools)",
        "icon": "🔧",
    },
    "browser": {
        "name": "Browser Control MCP",
        "port": 3001,
        "health_url": "http://localhost:3001/health",
        "start_cmd": None,  # started externally
        "description": "Chrome automation (15 tools)",
        "icon": "🌍",
    },
}

# ── Helpers ────────────────────────────────────────────────────────────────

def http_get(url, timeout=3):
    """Quick HTTP GET, returns (status_code, body) or (0, error)."""
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception:
        return 0, ""

def http_post(url, timeout=3):
    """Quick HTTP POST (for Latch health which requires POST)."""
    try:
        req = urllib.request.Request(url, method="POST", data=b"{}")
        req.add_header("Content-Type", "application/json")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="replace")
    except Exception:
        return 0, ""

def check_port(port, timeout=2):
    """Check if a TCP port is listening."""
    import socket
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(timeout)
        result = sock.connect_ex(("127.0.0.1", port))
        sock.close()
        return result == 0
    except Exception:
        return False

def get_process_list():
    """Get running node/python processes with memory usage."""
    try:
        result = subprocess.run(
            ["powershell", "-Command",
             "Get-Process | Where-Object {$_.ProcessName -match 'node|python|cloudflared|latch'} | "
             "Select-Object Id, ProcessName, @{N='WS_MB';E={[math]::Round($_.WorkingSet/1MB,1)}}, "
             "@{N='CPU';E={[math]::Round($_.CPU,1)}} | ConvertTo-Json -Compress"],
            capture_output=True, text=True, timeout=10
        )
        if result.returncode == 0 and result.stdout.strip():
            data = json.loads(result.stdout)
            if isinstance(data, dict):
                data = [data]
            return data
    except Exception:
        pass
    return []

def get_system_info():
    """Get RAM, CPU, disk info."""
    info = {}
    try:
        result = subprocess.run(
            ["powershell", "-Command",
             "$os = Get-CimInstance Win32_OperatingSystem; "
             "$free = $os.FreePhysicalMemory / 1MB; "
             "$total = $os.TotalVisibleMemorySize / 1MB; "
             "$used = $total - $free; "
             "$pct = [math]::Round($used / $total * 100, 1); "
             "$cpu = (Get-CimInstance Win32_Processor | Measure-Object -Property LoadPercentage -Average).Average; "
             "$disk = Get-CimInstance Win32_LogicalDisk -Filter \"DeviceID='C:'\"; "
             "$diskFree = [math]::Round($disk.FreeSpace / 1GB, 1); "
             "$diskTotal = [math]::Round($disk.Size / 1GB, 1); "
             "Write-Output \"RAM_FREE=$([math]::Round($free,1))\"; "
             "Write-Output \"RAM_TOTAL=$([math]::Round($total,1))\"; "
             "Write-Output \"RAM_PCT=$pct\"; "
             "Write-Output \"CPU=$([math]::Round($cpu,1))\"; "
             "Write-Output \"DISK_FREE=$diskFree\"; "
             "Write-Output \"DISK_TOTAL=$diskTotal\""],
            capture_output=True, text=True, timeout=10
        )
        for line in result.stdout.strip().split("\n"):
            if "=" in line:
                k, v = line.strip().split("=", 1)
                info[k] = v
    except Exception as e:
        info["error"] = str(e)
    return info

def get_gateway_token():
    """Read gateway auth token from .env (never printed to UI)."""
    try:
        env_path = GATEWAY_ENV
        if env_path.exists():
            for line in env_path.read_text().split("\n"):
                if line.startswith("GATEWAY_AUTH_TOKEN="):
                    return line.split("=", 1)[1].strip()
    except Exception:
        pass
    return None

# ── API exposed to JavaScript ──────────────────────────────────────────────

class Api:
    """Methods callable from the WebView2 frontend via window.pywebview.api.*"""

    def get_services(self):
        """Return status of all services."""
        result = {}
        for key, svc in SERVICES.items():
            port_open = check_port(svc["port"])
            health_code, health_body = http_get(svc["health_url"])
            # Latch requires POST for health
            if key == "latch" and health_code == 0:
                health_code, health_body = http_post(svc["health_url"])

            healthy = port_open and health_code in (200, 201)
            result[key] = {
                "name": svc["name"],
                "port": svc["port"],
                "healthy": healthy,
                "port_open": port_open,
                "health_code": health_code,
                "description": svc["description"],
                "icon": svc["icon"],
                "can_start": svc.get("start_cmd") is not None or svc.get("start_vbs") is not None,
                "can_stop": True,
            }
        return result

    def get_system_info(self):
        return get_system_info()

    def get_processes(self):
        return get_process_list()

    def start_service(self, key):
        """Start a service."""
        svc = SERVICES.get(key)
        if not svc:
            return {"ok": False, "error": "Unknown service"}
        try:
            if svc.get("start_vbs") and Path(svc["start_vbs"]).exists():
                subprocess.Popen(["cscript", "//nologo", svc["start_vbs"]],
                               creationflags=subprocess.CREATE_NO_WINDOW)
            elif svc.get("start_cmd"):
                subprocess.Popen(svc["start_cmd"],
                               creationflags=subprocess.CREATE_NO_WINDOW)
            else:
                return {"ok": False, "error": "No start command defined"}
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def stop_service(self, key):
        """Stop a service by killing processes on its port."""
        svc = SERVICES.get(key)
        if not svc:
            return {"ok": False, "error": "Unknown service"}
        try:
            port = svc["port"]
            result = subprocess.run(
                ["powershell", "-Command",
                 f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | "
                 f"ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}"],
                capture_output=True, text=True, timeout=10
            )
            return {"ok": True, "output": result.stdout.strip()}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def open_url(self, url):
        """Open URL in default browser."""
        try:
            subprocess.Popen(["cmd", "/c", "start", "", url],
                           creationflags=subprocess.CREATE_NO_WINDOW)
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def open_folder(self, path):
        """Open folder in Explorer."""
        try:
            subprocess.Popen(["explorer", path])
            return {"ok": True}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def get_gateway_health(self):
        """Get detailed gateway health."""
        code, body = http_get("http://localhost:3002/health")
        try:
            return {"code": code, "data": json.loads(body) if body else None}
        except Exception:
            return {"code": code, "data": body}

    def get_gateway_tools(self):
        """Get list of tools from the gateway (requires auth)."""
        token = get_gateway_token()
        if not token:
            return {"ok": False, "error": "No auth token found"}
        try:
            payload = json.dumps({
                "jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}
            }).encode()
            req = urllib.request.Request(
                "http://localhost:3002/mcp", data=payload, method="POST"
            )
            req.add_header("Content-Type", "application/json")
            req.add_header("Authorization", f"Bearer {token}")
            with urllib.request.urlopen(req, timeout=5) as resp:
                data = json.loads(resp.read().decode())
                tools = data.get("result", {}).get("tools", [])
                return {"ok": True, "count": len(tools), "tools": [t.get("name", "") for t in tools]}
        except Exception as e:
            return {"ok": False, "error": str(e)}

    def minimize_window(self):
        """Minimize the window."""
        for w in webview.windows:
            w.minimize()

    def close_window(self):
        """Close the window."""
        for w in webview.windows:
            w.destroy()

    def get_app_info(self):
        return {
            "name": "Sourov Control Center",
            "version": "1.0.0",
            "gateway_url": "http://localhost:3002",
            "latch_panel_url": "http://localhost:3939/panel",
            "latch_dir": str(LATCH_DIR),
            "gateway_dir": str(GATEWAY_DIR),
        }


# ── Main ───────────────────────────────────────────────────────────────────

def main():
    api = Api()

    # Find the HTML file (works both in dev and PyInstaller bundle)
    if getattr(sys, "frozen", False):
        # Running as PyInstaller bundle
        base_path = Path(sys._MEIPASS)
    else:
        base_path = Path(__file__).parent

    html_path = base_path / "index.html"

    window = webview.create_window(
        title="Sourov Control Center",
        url=str(html_path),
        width=900,
        height=650,
        resizable=True,
        min_size=(700, 500),
        background_color="#1a1a2e",
        js_api=api,
    )

    webview.start(
        debug=False,
        private_mode=False,
    )


if __name__ == "__main__":
    main()
