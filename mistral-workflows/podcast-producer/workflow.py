"""podcast-producer: article -> script -> audio -> show notes -> thumbnail brief.

Enriched 2026-10-27 with Latch MCP integration:
  - Saves script and episode metadata to local files (accessible by Resolve, OBS, Pi)
  - Checks DaVinci Resolve status via Latch; reports project/timeline info
  - Checks OBS Studio status via Latch; reports scene/stream/record state
  - All Latch calls degrade gracefully (workflow continues if Latch/Resolve/OBS down)

All generation uses cheap Agnes calls (shared.llm); the human reviews the script in Vibe Work.
Audio rendering is delegated to a TTS activity (provider left pluggable: Mistral TTS per docs
"Text to Speech", or the user's 'Video editor, podcast master, thumbnail creator' bot).
"""
import json
import re
from datetime import timedelta
from pathlib import Path

from temporalio.workflow import unsafe as _wf_unsafe
with _wf_unsafe.imports_passed_through():
    import httpx
import mistralai.workflows as workflows
import mistralai.workflows.plugins.mistralai as wm
from mistralai.workflows import activity_heartbeat
from pydantic import BaseModel, Field

from shared.approval import ask_approval
from shared.config import out_dir
from shared.llm import GenRequest, agnes_generate
from shared.latch import (
    latch_health,
    latch_resolve_status,
    latch_resolve_list_projects,
    latch_resolve_get_current,
    latch_resolve_list_timelines,
    latch_obs_status,
    latch_obs_list_scenes,
    latch_obs_get_current_scene,
    latch_obs_stream_status,
    latch_obs_record_status,
    ResolveStatus,
    ObsStatus,
)

WPM = 150  # speaking rate used to size scripts


class Params(BaseModel):
    article_url: str = Field(pattern=r"^https?://")
    target_minutes: int = Field(8, ge=1, le=40)
    voice: str = "default"
    host_name: str = "Sourov Deb"
    check_local_tools: bool = True  # set False to skip Latch/Resolve/OBS checks


class Article(BaseModel):
    title: str
    text: str
    url: str


class LocalToolStatus(BaseModel):
    """Snapshot of local PC tools (Resolve, OBS) via Latch."""
    latch_url: str = ""
    latch_tools: int = 0
    resolve_connected: bool = False
    resolve_version: str = ""
    resolve_project: str = ""
    resolve_timelines: int = 0
    obs_connected: bool = False
    obs_version: str = ""
    obs_current_scene: str = ""
    obs_streaming: bool = False
    obs_recording: bool = False


class Episode(BaseModel):
    title: str
    script: str
    audio_path: str
    show_notes: str
    thumbnail_brief: str
    status: str
    script_file: str = ""       # local path where the script was saved
    metadata_file: str = ""     # local path where episode metadata JSON was saved
    local_tools: LocalToolStatus | None = None


@workflows.activity(start_to_close_timeout=timedelta(minutes=2), retry_policy_max_attempts=3)
async def fetch_article(url: str) -> Article:
    import html
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        r = await c.get(url); r.raise_for_status()
    t = r.text
    m = re.search(r"<title>(.*?)</title>", t, re.S | re.I)
    title = html.unescape(m.group(1)).split("|")[0].strip() if m else url.rstrip("/").rsplit("/", 1)[-1]
    body = re.sub(r"<(script|style|nav|footer|header)[^>]*>.*?</\\1>", " ", t, flags=re.S)
    body = html.unescape(re.sub(r"\\s+", " ", re.sub(r"<[^>]+>", " ", body)))
    return Article(title=title, text=body[:40000], url=url)


@workflows.activity(start_to_close_timeout=timedelta(seconds=10), retry_policy_max_attempts=1)
async def save_script_locally(script: str, slug: str) -> str:
    """Save the podcast script to a local file so Resolve, OBS, Pi, and Vibe can read it."""
    d = out_dir("podcast", "scripts")
    p = d / f"{slug}.txt"
    p.write_text(script, encoding="utf-8")
    return str(p)


@workflows.activity(start_to_close_timeout=timedelta(seconds=10), retry_policy_max_attempts=1)
async def save_episode_metadata(episode_dict: dict, slug: str) -> str:
    """Save episode metadata as JSON for downstream tools (Resolve render queue, OBS show notes)."""
    d = out_dir("podcast", "episodes")
    p = d / f"{slug}.json"
    p.write_text(json.dumps(episode_dict, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return str(p)


@workflows.activity(start_to_close_timeout=timedelta(seconds=60), retry_policy_max_attempts=2)
async def check_local_tools() -> LocalToolStatus:
    """Check Resolve and OBS status via Latch MCP. Never raises - returns unavailable status."""
    status = LocalToolStatus()
    try:
        health = await latch_health()
        status.latch_url = health.get("latch_url", "")
        status.latch_tools = health.get("tool_count", 0)
        status.resolve_connected = health.get("resolve_connected", False)
        status.resolve_version = health.get("resolve_version", "")
        status.obs_connected = health.get("obs_connected", False)
        status.obs_version = health.get("obs_version", "")
    except Exception:
        pass

    # Enrich with project/timeline info if Resolve is connected
    if status.resolve_connected:
        try:
            cur = await latch_resolve_get_current()
            if cur.parsed:
                status.resolve_project = str(cur.parsed.get("name", ""))
        except Exception:
            pass
        try:
            tl = await latch_resolve_list_timelines()
            if tl.parsed:
                status.resolve_timelines = int(tl.parsed.get("timeline_count", 0))
        except Exception:
            pass

    # Enrich with OBS scene/stream info if OBS is connected
    if status.obs_connected:
        try:
            scene = await latch_obs_get_current_scene()
            if scene.parsed:
                status.obs_current_scene = str(scene.parsed.get("current_scene", ""))
        except Exception:
            pass
        try:
            stream = await latch_obs_stream_status()
            if stream.parsed:
                status.obs_streaming = bool(stream.parsed.get("streaming", False))
        except Exception:
            pass
        try:
            rec = await latch_obs_record_status()
            if rec.parsed:
                status.obs_recording = bool(rec.parsed.get("recording", False))
        except Exception:
            pass

    return status


@workflows.activity(start_to_close_timeout=timedelta(minutes=20), heartbeat_timeout=timedelta(seconds=60),
                    retry_policy_max_attempts=2)
async def render_audio(script: str, voice: str, episode_slug: str) -> str:
    """Chunked TTS -> local mp3 path. Idempotent: skips chunks already rendered (checkpoint via heartbeat).
    Provider intentionally unimplemented here; wire to Mistral TTS or an external service."""
    chunks = [p for p in script.split("\\n\\n") if p.strip()]
    for i, _ in enumerate(chunks):
        activity_heartbeat(i)
    _ = out_dir("podcast") / f"{episode_slug}.mp3"
    return ""


@workflows.workflow.define(name="podcast-producer", execution_timeout=timedelta(days=2))
class PodcastProducer(workflows.InteractiveWorkflow):
    @workflows.workflow.entrypoint
    async def run(self, params: Params) -> Episode:
        # --- Check local tools (Resolve, OBS) via Latch ---
        local_tools = None
        if params.check_local_tools:
            local_tools = await check_local_tools()
            tool_summary = (
                f"Latch: {local_tools.latch_tools} tools at {local_tools.latch_url}\n"
                f"Resolve: {'connected v' + local_tools.resolve_version if local_tools.resolve_connected else 'not running'}"
                f"{' (project: ' + local_tools.resolve_project + ', ' + str(local_tools.resolve_timelines) + ' timelines)' if local_tools.resolve_connected and local_tools.resolve_project else ''}\n"
                f"OBS: {'connected v' + local_tools.obs_version if local_tools.obs_connected else 'not running'}"
                f"{' (scene: ' + local_tools.obs_current_scene + ')' if local_tools.obs_connected and local_tools.obs_current_scene else ''}"
                f"{' [STREAMING]' if local_tools.obs_streaming else ''}"
                f"{' [RECORDING]' if local_tools.obs_recording else ''}"
            )
            await wm.send_assistant_message(f"Local tools status:\n{tool_summary}")

        # --- Fetch and generate ---
        art = await fetch_article(params.article_url)
        words = params.target_minutes * WPM

        script = await agnes_generate(GenRequest(
            system=(f"Write for the ear: short sentences, signposting, one story, recap. Host is "
                    f"{params.host_name}. Mark [PAUSE] and [MUSIC]. Never invent research claims. "
                    "Return only the script."),
            prompt=f"Write a ~{words}-word solo podcast script from:\n{art.title}\n{art.text[:12000]}",
            max_tokens=min(4000, words * 2)))

        for _ in range(3):  # bounded revision loop
            decision, note = await ask_approval(self, f"Script draft for **{art.title}**:\n\n{script[:3500]}")
            if decision == "approve":
                break
            if decision in {"reject", "timeout"}:
                return Episode(title=art.title, script=script, audio_path="", show_notes="",
                               thumbnail_brief="", status=decision, local_tools=local_tools)
            script = await agnes_generate(GenRequest(system="Revise the podcast script as instructed.",
                                                     prompt=f"INSTRUCTION: {note}\n\nSCRIPT:\n{script}",
                                                     max_tokens=4000))

        slug = re.sub(r"[^a-z0-9-]+", "-", art.url.rstrip("/").split("/")[-1].lower())[:60].strip("-") or "episode"

        # --- Save script locally (accessible by Resolve, OBS, Pi, Vibe) ---
        script_file = await save_script_locally(script, slug)
        await wm.send_assistant_message(f"Script saved to: `{script_file}`")

        # --- Render audio ---
        audio = await render_audio(script, params.voice, slug)

        # --- Generate show notes and thumbnail brief ---
        notes = await agnes_generate(GenRequest(
            system="Write podcast show notes.",
            prompt=f"Show notes: 2-line summary, 5 timestamped chapters (estimate at {WPM} wpm), "
                   f"key takeaways, link {art.url}. Script:\n{script[:8000]}"))
        thumb = await agnes_generate(GenRequest(
            system="You brief a thumbnail designer.",
            prompt=f"Thumbnail brief for '{art.title}': 3-5 word overlay text, focal image, colour palette, "
                   f"1:1 and 16:9 variants, readable at 120px."))

        # --- Save episode metadata ---
        episode_dict = {
            "title": art.title,
            "slug": slug,
            "article_url": art.url,
            "script_file": script_file,
            "audio_path": audio,
            "show_notes": notes,
            "thumbnail_brief": thumb,
            "target_minutes": params.target_minutes,
            "voice": params.voice,
            "host_name": params.host_name,
            "local_tools": local_tools.model_dump() if local_tools else None,
        }
        metadata_file = await save_episode_metadata(episode_dict, slug)

        status = "produced" if audio else "audio_pending"
        await wm.send_assistant_message(
            f"Episode metadata saved to: `{metadata_file}`\n"
            f"Status: {status}\n"
            f"Next steps: Open Resolve to import audio, switch OBS scene for recording, "
            f"or use Pi/Vibe to read the script file."
        )

        return Episode(title=art.title, script=script, audio_path=audio, show_notes=notes,
                       thumbnail_brief=thumb, status=status,
                       script_file=script_file, metadata_file=metadata_file,
                       local_tools=local_tools)


if __name__ == "__main__":
    import asyncio
    asyncio.run(workflows.run_worker([PodcastProducer]))
