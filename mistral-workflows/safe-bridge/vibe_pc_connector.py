"""vibe-pc-connector (SAFE BRIDGE, v2.0.0)

Read-only, allow-listed bridge between Mistral cloud agents and Sourov's PC.
There is deliberately NO shell, NO free-form command string, NO file write and NO
process start. A cloud request can only pick one of five named, read-only activities:

  health_check            worker alive + python version
  system_info             OS, CPU count, CPU %, RAM % (no usernames, env, paths)
  one_stop_shop_status    E:\\ONE-STOP-SHOP pipeline folders and file counts (names only)
  credential_env_present  which expected env-var NAMES are set, with value LENGTH only
  vibe_skill_list         skill folder names under ~/.vibe/skills

Why: a durable workflow that runs arbitrary strings on the PC is remote code execution
reachable by anyone holding the Mistral workspace key. See
E:\\ONE-STOP-SHOP\\mistral-workflows\\SAFE-BRIDGE.md.
"""
from __future__ import annotations

import os
import platform
import sys
from datetime import timedelta
from pathlib import Path
from typing import Literal

from mistralai import workflows
from pydantic import BaseModel, Field

VERSION = "2.0.0"
ONE_STOP_SHOP = Path(os.environ.get("ONE_STOP_SHOP_DIR", r"E:\ONE-STOP-SHOP"))
VIBE_HOME = Path(os.environ.get("VIBE_HOME", str(Path.home() / ".vibe")))
MAX_ENTRIES = 200  # keep payloads tiny (2 MB limit) and listings bounded

# Names only. Values are never read into the result, only len().
EXPECTED_ENV = [
    "MISTRAL_API_KEY", "MISTRAL_WORKFLOWS_API_KEY", "AGNES_API_KEY", "TYPESAFE_API_KEY",
    "HOSTINGER_API_TOKEN", "DEVTO_API_KEY", "CORE_API_KEY", "SKYVERN_API_KEY",
]

Action = Literal["health_check", "system_info", "one_stop_shop_status",
                 "credential_env_present", "vibe_skill_list"]


class BridgeInput(BaseModel):
    action: Action = Field(..., description="One of the five allow-listed read-only actions")
    request_id: str = ""


class BridgeResult(BaseModel):
    action: str
    ok: bool
    request_id: str = ""
    data: dict = Field(default_factory=dict)
    error: str = ""


_RETRY = dict(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)


@workflows.activity(**_RETRY)
async def health_check() -> dict:
    return {"status": "ok", "bridge_version": VERSION, "python": platform.python_version()}


@workflows.activity(**_RETRY)
async def system_info() -> dict:
    d = {"os": platform.system(), "os_release": platform.release(), "cpu_count": os.cpu_count()}
    try:
        import psutil  # optional
        d["cpu_percent"] = psutil.cpu_percent(interval=0.5)
        d["ram_percent"] = psutil.virtual_memory().percent
    except Exception:
        d["cpu_percent"] = d["ram_percent"] = None
    return d


@workflows.activity(**_RETRY)
async def one_stop_shop_status() -> dict:
    if not ONE_STOP_SHOP.is_dir():
        return {"exists": False}
    dirs = {}
    for p in sorted(ONE_STOP_SHOP.iterdir())[:MAX_ENTRIES]:
        if p.is_dir() and not p.name.startswith("."):
            try:
                dirs[p.name] = sum(1 for _ in p.iterdir())
            except OSError:
                dirs[p.name] = -1
    return {"exists": True, "dirs": dirs}


@workflows.activity(**_RETRY)
async def credential_env_present() -> dict:
    return {name: {"set": bool(os.environ.get(name)), "length": len(os.environ.get(name, ""))}
            for name in EXPECTED_ENV}


@workflows.activity(**_RETRY)
async def vibe_skill_list() -> dict:
    root = VIBE_HOME / "skills"
    names = sorted(p.name for p in root.iterdir() if p.is_dir())[:MAX_ENTRIES] if root.is_dir() else []
    return {"count": len(names), "skills": names}


ACTIONS = {
    "health_check": health_check,
    "system_info": system_info,
    "one_stop_shop_status": one_stop_shop_status,
    "credential_env_present": credential_env_present,
    "vibe_skill_list": vibe_skill_list,
}


@workflows.workflow.define(
    name="vibe-pc-connector",
    workflow_display_name="Vibe-PC Safe Bridge",
    workflow_description="Read-only, allow-listed status bridge to Sourov's PC. No shell, no writes.",
)
class VibePCConnectorWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: BridgeInput) -> BridgeResult:
        fn = ACTIONS.get(input.action)
        if fn is None:  # pydantic already rejects, this is defence in depth
            return BridgeResult(action=str(input.action), ok=False, request_id=input.request_id,
                                error="action not allow-listed")
        try:
            return BridgeResult(action=input.action, ok=True, request_id=input.request_id, data=await fn())
        except Exception as e:  # never echo env or paths back
            return BridgeResult(action=input.action, ok=False, request_id=input.request_id,
                                error=type(e).__name__)


@workflows.workflow.define(
    name="vibe-pc-connector-status",
    workflow_display_name="Vibe-PC Safe Bridge Status",
    workflow_description="Health check of the safe bridge.",
)
class VibePCConnectorStatusWorkflow:
    @workflows.workflow.entrypoint
    async def run(self, input: dict | None = None) -> BridgeResult:
        return BridgeResult(action="health_check", ok=True, data=await health_check())
