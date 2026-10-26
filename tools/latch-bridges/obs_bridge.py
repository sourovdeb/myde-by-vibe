#!/usr/bin/env python3
r"""
OBS Bridge — Control OBS Studio via WebSocket from Latch MCP.

Run with the latch-bridges venv Python:
  E:\tools\latch-bridges\venv\Scripts\python.exe obs_bridge.py <command> [args]

Commands:
  status              — Check OBS WebSocket connection status
  get_version         — Get OBS version info
  list_scenes         — List all scenes
  get_current_scene   — Get the currently active scene
  switch_scene <name> — Switch to a scene by name
  list_sources        — List all sources
  get_stream_status   — Get streaming status
  get_record_status   — Get recording status
  list_profiles       — List streaming/recording profiles

Output: JSON to stdout. Errors: JSON with "error" key, exit code 1.

OBS WebSocket must be enabled: Tools > WebSocket Server Settings > Enable WebSocket server.
Default port: 4455. No authentication by default.
"""

import sys
import json
import traceback

try:
    import websocket
except ImportError:
    print(json.dumps({"error": "websocket-client not installed. Run: uv pip install --python E:/tools/latch-bridges/venv/Scripts/python.exe websocket-client"}))
    sys.exit(1)

OBS_HOST = "localhost"
OBS_PORT = 4455
OBS_PASSWORD = None  # Set if authentication is enabled


def output(data):
    print(json.dumps(data, indent=2, default=str))


def error(msg, detail=None):
    result = {"error": msg}
    if detail:
        result["detail"] = str(detail)
    print(json.dumps(result, indent=2))
    sys.exit(0)


def connect():
    """Connect to OBS WebSocket."""
    url = f"ws://{OBS_HOST}:{OBS_PORT}"
    try:
        ws = websocket.create_connection(url, timeout=5)
        return ws
    except Exception as e:
        error(f"Cannot connect to OBS WebSocket at {url}. Is OBS running with WebSocket enabled?", str(e))


def send_request(ws, request_type, request_data=None):
    """Send a request to OBS WebSocket and return the response."""
    request = {
        "op": 6,  # Request
        "d": {
            "requestType": request_type,
            "requestId": "latch-bridge",
            "requestData": request_data or {}
        }
    }
    ws.send(json.dumps(request))
    
    # Wait for response (op 7 = RequestResponse)
    while True:
        response = json.loads(ws.recv())
        if response.get("op") == 7:  # RequestResponse
            return response.get("d", {})
        # Skip other messages (events, etc.)


def cmd_status():
    """Check OBS WebSocket connection."""
    ws = connect()
    try:
        result = send_request(ws, "GetVersion")
        output({
            "status": "connected",
            "obs_version": result.get("responseData", {}).get("obsWebSocketVersion", "unknown"),
            "obs_studio_version": result.get("responseData", {}).get("obsStudioVersion", "unknown"),
            "platform": result.get("responseData", {}).get("platform", "unknown"),
        })
    finally:
        ws.close()


def cmd_get_version():
    """Get OBS version info."""
    ws = connect()
    try:
        result = send_request(ws, "GetVersion")
        output(result.get("responseData", {}))
    finally:
        ws.close()


def cmd_list_scenes():
    """List all scenes."""
    ws = connect()
    try:
        result = send_request(ws, "GetSceneList")
        data = result.get("responseData", {})
        output({
            "current_scene": data.get("currentProgramSceneName", ""),
            "scenes": [s.get("sceneName") for s in data.get("scenes", [])],
            "count": len(data.get("scenes", []))
        })
    finally:
        ws.close()


def cmd_get_current_scene():
    """Get the currently active scene."""
    ws = connect()
    try:
        result = send_request(ws, "GetCurrentProgramScene")
        data = result.get("responseData", {})
        output({
            "current_scene": data.get("currentProgramSceneName", ""),
            "scene_uuid": data.get("currentProgramSceneUuid", "")
        })
    finally:
        ws.close()


def cmd_switch_scene():
    """Switch to a scene by name."""
    if len(sys.argv) < 3:
        error("Usage: obs_bridge.py switch_scene <scene_name>")
    
    scene_name = sys.argv[2]
    ws = connect()
    try:
        result = send_request(ws, "SetCurrentProgramScene", {"sceneName": scene_name})
        status = result.get("status", "unknown")
        if status == "ok":
            output({"switched": True, "scene": scene_name})
        else:
            error(f"Failed to switch scene: {result}")
    finally:
        ws.close()


def cmd_list_sources():
    """List all sources."""
    ws = connect()
    try:
        result = send_request(ws, "GetSourceList")
        data = result.get("responseData", {})
        sources = [{"name": s.get("sourceName"), "type": s.get("sourceType")} for s in data.get("sources", [])]
        output({"sources": sources, "count": len(sources)})
    finally:
        ws.close()


def cmd_get_stream_status():
    """Get streaming status."""
    ws = connect()
    try:
        result = send_request(ws, "GetStreamStatus")
        data = result.get("responseData", {})
        output({
            "streaming": data.get("outputActive", False),
            "streaming_state": data.get("outputState", "unknown"),
            "stream_timecode": data.get("outputTimecode", ""),
        })
    finally:
        ws.close()


def cmd_get_record_status():
    """Get recording status."""
    ws = connect()
    try:
        result = send_request(ws, "GetRecordStatus")
        data = result.get("responseData", {})
        output({
            "recording": data.get("outputActive", False),
            "recording_state": data.get("outputState", "unknown"),
            "record_timecode": data.get("outputTimecode", ""),
            "output_path": data.get("outputPath", ""),
        })
    finally:
        ws.close()


def cmd_list_profiles():
    """List streaming/recording profiles."""
    ws = connect()
    try:
        result = send_request(ws, "GetProfileList")
        data = result.get("responseData", {})
        output({
            "profiles": data.get("profiles", []),
            "current_profile": data.get("currentProfileName", "")
        })
    finally:
        ws.close()


COMMANDS = {
    "status": cmd_status,
    "get_version": cmd_get_version,
    "list_scenes": cmd_list_scenes,
    "get_current_scene": cmd_get_current_scene,
    "switch_scene": cmd_switch_scene,
    "list_sources": cmd_list_sources,
    "get_stream_status": cmd_get_stream_status,
    "get_record_status": cmd_get_record_status,
    "list_profiles": cmd_list_profiles,
}


def main():
    if len(sys.argv) < 2:
        output({
            "usage": "obs_bridge.py <command> [args]",
            "commands": list(COMMANDS.keys())
        })
        return
    
    command = sys.argv[1]
    if command not in COMMANDS:
        error(f"Unknown command: {command}", f"Available: {', '.join(COMMANDS.keys())}")
    
    try:
        COMMANDS[command]()
    except SystemExit:
        raise
    except Exception as e:
        error(f"Command '{command}' failed", traceback.format_exc())


if __name__ == "__main__":
    main()
