#!/usr/bin/env python3
"""
Resolve Bridge — Control DaVinci Resolve via Latch MCP.

Run with Resolve's bundled Python:
  "C:\\Program Files\\Blackmagic Design\\DaVinci Resolve\\ResolvePython\\ResolvePython.exe" resolve_bridge.py <command> [args]

Commands:
  status              — Check if Resolve is running and scripting is available
  list_projects       — List all projects in the current project manager
  get_current         — Get info about the currently open project
  list_timelines      — List all timelines in the current project
  get_timeline_info   — Get detailed info about a timeline (name, duration, tracks)
  list_media_pool     — List top-level items in the Media Pool
  get_resolve_version — Get Resolve version info

Output: JSON to stdout. Errors: JSON with "error" key to stdout, exit code 1.
"""

import sys
import os
import json
import traceback

# Add Resolve's scripting module to path
RESOLVE_PATH = r"C:\Program Files\Blackmagic Design\DaVinci Resolve"
SCRIPT_MODULE_PATH = os.path.join(RESOLVE_PATH, "ResolvePython", "lib", "modules")
if SCRIPT_MODULE_PATH not in sys.path:
    sys.path.insert(0, SCRIPT_MODULE_PATH)


def output(data):
    print(json.dumps(data, indent=2, default=str))


def error(msg, detail=None):
    result = {"error": msg}
    if detail:
        result["detail"] = str(detail)
    print(json.dumps(result, indent=2))
    sys.exit(0)


def get_resolve():
    """Import and initialize DaVinciResolveScript."""
    try:
        import DaVinciResolveScript as dvr
        resolve = dvr.scriptapp("Python")
        if resolve is None:
            error("Cannot connect to DaVinci Resolve. Is Resolve running with external scripting enabled?")
        return resolve
    except ImportError as e:
        error("Cannot import DaVinciResolveScript module", str(e))
    except Exception as e:
        error("Failed to initialize Resolve scripting", str(e))


def cmd_status():
    """Check Resolve connection status."""
    try:
        import DaVinciResolveScript as dvr
        resolve = dvr.scriptapp("Python")
        if resolve is None:
            output({"status": "disconnected", "message": "Resolve is not running or external scripting is disabled"})
            return
        pm = resolve.GetProjectManager()
        version = resolve.GetVersion()
        output({
            "status": "connected",
            "version": version,
            "product": "DaVinci Resolve",
            "scripting": "enabled"
        })
    except Exception as e:
        output({"status": "error", "message": str(e)})


def cmd_list_projects():
    """List all projects."""
    resolve = get_resolve()
    pm = resolve.GetProjectManager()
    projects = pm.GetProjectList()
    output({"projects": projects, "count": len(projects)})


def cmd_get_current():
    """Get current project info."""
    resolve = get_resolve()
    pm = resolve.GetProjectManager()
    project = pm.GetCurrentProject()
    if project is None:
        error("No project is currently open")
    name = project.GetName()
    output({
        "name": name,
        "current": True
    })


def cmd_list_timelines():
    """List all timelines in the current project."""
    resolve = get_resolve()
    pm = resolve.GetProjectManager()
    project = pm.GetCurrentProject()
    if project is None:
        error("No project is currently open")
    
    timeline_count = project.GetTimelineCount()
    timelines = []
    for i in range(1, timeline_count + 1):
        timeline = project.GetTimelineByIndex(i)
        if timeline:
            timelines.append({
                "index": i,
                "name": timeline.GetName(),
                "id": timeline.GetUniqueId()
            })
    
    output({
        "project": project.GetName(),
        "timeline_count": timeline_count,
        "timelines": timelines
    })


def cmd_get_timeline_info():
    """Get detailed info about a timeline."""
    if len(sys.argv) < 4:
        error("Usage: resolve_bridge.py get_timeline_info <timeline_name_or_index>")
    
    target = sys.argv[3]
    resolve = get_resolve()
    pm = resolve.GetProjectManager()
    project = pm.GetCurrentProject()
    if project is None:
        error("No project is currently open")
    
    # Find timeline by name or index
    timeline = None
    if target.isdigit():
        timeline = project.GetTimelineByIndex(int(target))
    else:
        for i in range(1, project.GetTimelineCount() + 1):
            t = project.GetTimelineByIndex(i)
            if t and t.GetName() == target:
                timeline = t
                break
    
    if timeline is None:
        error(f"Timeline not found: {target}")
    
    # Get timeline properties
    info = {
        "name": timeline.GetName(),
        "id": timeline.GetUniqueId(),
    }
    
    # Try to get additional properties
    try:
        info["start_frame"] = timeline.GetStartFrame()
    except Exception:
        pass
    try:
        info["end_frame"] = timeline.GetEndFrame()
    except Exception:
        pass
    try:
        info["start_timecode"] = timeline.GetStartTimecode()
    except Exception:
        pass
    try:
        info["timeline_format"] = timeline.GetTimelineFormat()
    except Exception:
        pass
    
    # Get track count
    try:
        video_tracks = timeline.GetVideoTrackCount()
        audio_tracks = timeline.GetAudioTrackCount()
        info["video_tracks"] = video_tracks
        info["audio_tracks"] = audio_tracks
    except Exception:
        pass
    
    output(info)


def cmd_list_media_pool():
    """List top-level items in the Media Pool."""
    resolve = get_resolve()
    pm = resolve.GetProjectManager()
    project = pm.GetCurrentProject()
    if project is None:
        error("No project is currently open")
    
    media_pool = project.GetMediaPool()
    root_folder = media_pool.GetRootFolder()
    
    clips = []
    for clip in root_folder.GetClips():
        props = clip.GetClipProperty()
        clips.append({
            "name": clip.GetName(),
            "properties": props
        })
    
    output({
        "project": project.GetName(),
        "root_clip_count": len(clips),
        "clips": clips
    })


def cmd_get_resolve_version():
    """Get Resolve version info."""
    resolve = get_resolve()
    version = resolve.GetVersion()
    output({"version": version})


COMMANDS = {
    "status": cmd_status,
    "list_projects": cmd_list_projects,
    "get_current": cmd_get_current,
    "list_timelines": cmd_list_timelines,
    "get_timeline_info": cmd_get_timeline_info,
    "list_media_pool": cmd_list_media_pool,
    "get_resolve_version": cmd_get_resolve_version,
}


def main():
    if len(sys.argv) < 2:
        output({
            "usage": "resolve_bridge.py <command> [args]",
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
