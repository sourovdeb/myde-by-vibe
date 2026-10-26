"""Latch MCP client — call Latch tools (run_task, list_files, read_file, search_files)
from inside Mistral Workflows activities.

Latch runs locally on port 3939 (E:\\tools\\latch\\latch.exe serve). The MCP endpoint
is POST /mcp/mistral (or /mcp/pi). When the Cloudflare tunnel is up, the same
endpoint is reachable at the tunnel URL for cloud-deployed workflows.

Configuration (env vars, loaded via shared.config):
  LATCH_MCP_URL     — MCP endpoint URL (default: http://127.0.0.1:3939/mcp/mistral)
  LATCH_TUNNEL_URL  — fallback tunnel URL (default: read from E:\\tools\\latch\\status.json)
  LATCH_ENABLED     — "0" disables all Latch calls (activities return a no-op result)

All network I/O lives in activities. Missing Latch (not running) is NOT an error —
activities return a structured "unavailable" result so workflows can degrade gracefully.
"""
from __future__ import annotations

import json
import os
from datetime import timedelta
from pathlib import Path
from typing import Any

import httpx
import mistralai.workflows as workflows
from pydantic import BaseModel, Field

from shared.config import load_env

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

_DEFAULT_LOCAL = "http://127.0.0.1:3939/mcp/mistral"
_STATUS_JSON = Path(r"E:\tools\latch\status.json")


def _latch_url() -> str:
    """Resolve the Latch MCP URL: env var > status.json tunnel > local default."""
    load_env()
    url = os.environ.get("LATCH_MCP_URL", "").strip()
    if url:
        return url.rstrip("/")
    # Try tunnel URL from status.json (written by Latch-Status.ps1)
    try:
        if _STATUS_JSON.is_file():
            data = json.loads(_STATUS_JSON.read_text(encoding="utf-8"))
            tunnel = data.get("tunnel_url", "").strip()
            if tunnel:
                return tunnel.rstrip("/") + "/mcp/mistral"
    except Exception:
        pass
    return _DEFAULT_LOCAL


def _latch_enabled() -> bool:
    return os.environ.get("LATCH_ENABLED", "1").strip().lower() not in {"0", "false", "no", "off"}


# ---------------------------------------------------------------------------
# Result models
# ---------------------------------------------------------------------------

class LatchResult(BaseModel):
    """Structured result from a Latch tool call."""
    ok: bool = True
    tool: str = ""
    output: str = ""
    parsed: dict[str, Any] | None = None
    error: str = ""
    unavailable: bool = False  # Latch not running / not reachable


class ResolveStatus(BaseModel):
    connected: bool = False
    version: str = ""
    message: str = ""


class ObsStatus(BaseModel):
    connected: bool = False
    obs_version: str = ""
    obs_studio_version: str = ""
    message: str = ""


# ---------------------------------------------------------------------------
# Low-level MCP call
# ---------------------------------------------------------------------------

@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_call_tool(name: str, arguments: dict[str, Any]) -> LatchResult:
    """Call any Latch MCP tool. Returns structured result; never raises on Latch being down."""
    if not _latch_enabled():
        return LatchResult(ok=False, tool=name, unavailable=True,
                           error="LATCH_ENABLED=0")
    url = _latch_url()
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "tools/call",
        "params": {"name": name, "arguments": arguments},
    }
    try:
        async with httpx.AsyncClient(timeout=25) as c:
            r = await c.post(url, json=payload,
                             headers={"Accept": "application/json, text/event-stream"})
            r.raise_for_status()
            body = r.text
    except Exception as e:
        return LatchResult(ok=False, tool=name, unavailable=True,
                           error=f"Latch unreachable at {url}: {type(e).__name__}: {str(e)[:200]}")

    # Parse JSON-RPC response
    try:
        data = json.loads(body)
    except json.JSONDecodeError:
        # SSE format: "data: {...}\n\n"
        for line in body.splitlines():
            if line.startswith("data: "):
                try:
                    data = json.loads(line[6:])
                    break
                except json.JSONDecodeError:
                    continue
        else:
            return LatchResult(ok=False, tool=name, error=f"Unparseable response: {body[:300]}")

    if "error" in data:
        return LatchResult(ok=False, tool=name, error=f"JSON-RPC error: {data['error']}")

    result = data.get("result", {})
    content = result.get("content", [])
    text = ""
    if content and isinstance(content, list):
        text = content[0].get("text", "") if isinstance(content[0], dict) else str(content[0])

    is_error = result.get("isError", False)

    # Try to parse the text as JSON (bridge scripts output JSON)
    parsed = None
    if text:
        try:
            parsed = json.loads(text)
        except (json.JSONDecodeError, TypeError):
            pass

    return LatchResult(
        ok=not is_error,
        tool=name,
        output=text,
        parsed=parsed,
        error=text if is_error else "",
    )


@workflows.activity(start_to_close_timeout=timedelta(seconds=15), retry_policy_max_attempts=2)
async def latch_list_tools() -> list[str]:
    """List available Latch MCP tool names."""
    if not _latch_enabled():
        return []
    url = _latch_url()
    payload = {"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}
    try:
        async with httpx.AsyncClient(timeout=10) as c:
            r = await c.post(url, json=payload,
                             headers={"Accept": "application/json, text/event-stream"})
            r.raise_for_status()
            data = json.loads(r.text)
            tools = data.get("result", {}).get("tools", [])
            return [t.get("name", "") for t in tools if isinstance(t, dict)]
    except Exception:
        return []


# ---------------------------------------------------------------------------
# run_task — execute allow-listed commands (Resolve, OBS bridges)
# ---------------------------------------------------------------------------

# Python interpreter path (space-free, used in Latch allow-list)
_PY = r"C:\Users\souro\.local\bin\python3.12.exe"
_BRIDGES = r"E:\tools\latch-bridges"


def _resolve_cmd(sub: str) -> str:
    return f"{_PY} {_BRIDGES}\\resolve_cmd.py {sub}"


def _obs_cmd(sub: str) -> str:
    return f"{_PY} {_BRIDGES}\\obs_cmd.py {sub}"


@workflows.activity(start_to_close_timeout=timedelta(seconds=60), retry_policy_max_attempts=2)
async def latch_run_task(command: str) -> LatchResult:
    """Execute an allow-listed command via Latch run_task."""
    return await latch_call_tool("run_task", {"command": command})


# ---------------------------------------------------------------------------
# Resolve helpers
# ---------------------------------------------------------------------------

@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_resolve_status() -> ResolveStatus:
    r = await latch_run_task(_resolve_cmd("status"))
    if r.unavailable:
        return ResolveStatus(connected=False, message="Latch unavailable")
    p = r.parsed or {}
    return ResolveStatus(
        connected=p.get("status") == "connected",
        version=str(p.get("version", "")),
        message=p.get("message", p.get("error", r.output[:200])),
    )


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_resolve_list_projects() -> LatchResult:
    return await latch_run_task(_resolve_cmd("list_projects"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_resolve_get_current() -> LatchResult:
    return await latch_run_task(_resolve_cmd("get_current"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_resolve_list_timelines() -> LatchResult:
    return await latch_run_task(_resolve_cmd("list_timelines"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_resolve_list_media_pool() -> LatchResult:
    return await latch_run_task(_resolve_cmd("list_media_pool"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_resolve_version() -> LatchResult:
    return await latch_run_task(_resolve_cmd("get_resolve_version"))


# ---------------------------------------------------------------------------
# OBS helpers
# ---------------------------------------------------------------------------

@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_obs_status() -> ObsStatus:
    r = await latch_run_task(_obs_cmd("status"))
    if r.unavailable:
        return ObsStatus(connected=False, message="Latch unavailable")
    p = r.parsed or {}
    return ObsStatus(
        connected=p.get("status") == "connected",
        obs_version=str(p.get("obs_version", "")),
        obs_studio_version=str(p.get("obs_studio_version", "")),
        message=p.get("error", p.get("message", r.output[:200])),
    )


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_obs_list_scenes() -> LatchResult:
    return await latch_run_task(_obs_cmd("list_scenes"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_obs_get_current_scene() -> LatchResult:
    return await latch_run_task(_obs_cmd("get_current_scene"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_obs_list_sources() -> LatchResult:
    return await latch_run_task(_obs_cmd("list_sources"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_obs_stream_status() -> LatchResult:
    return await latch_run_task(_obs_cmd("get_stream_status"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_obs_record_status() -> LatchResult:
    return await latch_run_task(_obs_cmd("get_record_status"))


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def latch_obs_list_profiles() -> LatchResult:
    return await latch_run_task(_obs_cmd("list_profiles"))


# ---------------------------------------------------------------------------
# File operations (Latch sandbox: E:\tools\latch-share)
# ---------------------------------------------------------------------------

@workflows.activity(start_to_close_timeout=timedelta(seconds=15), retry_policy_max_attempts=2)
async def latch_list_files(path: str = "") -> LatchResult:
    return await latch_call_tool("list_files", {"path": path})


@workflows.activity(start_to_close_timeout=timedelta(seconds=15), retry_policy_max_attempts=2)
async def latch_read_file(path: str) -> LatchResult:
    return await latch_call_tool("read_file", {"path": path})


@workflows.activity(start_to_close_timeout=timedelta(seconds=15), retry_policy_max_attempts=2)
async def latch_search_files(query: str) -> LatchResult:
    return await latch_call_tool("search_files", {"query": query})


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

@workflows.activity(start_to_close_timeout=timedelta(seconds=15), retry_policy_max_attempts=1)
async def latch_health() -> dict[str, Any]:
    """Check Latch connectivity and return status summary."""
    tools = await latch_list_tools()
    resolve = await latch_resolve_status()
    obs = await latch_obs_status()
    return {
        "latch_url": _latch_url(),
        "latch_enabled": _latch_enabled(),
        "tools_available": tools,
        "tool_count": len(tools),
        "resolve_connected": resolve.connected,
        "resolve_version": resolve.version,
        "obs_connected": obs.connected,
        "obs_version": obs.obs_studio_version,
    }
