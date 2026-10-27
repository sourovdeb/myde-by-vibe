"""content-scheduler: sourovdeb.com -> LinkedIn / Medium / YouTube / podcast queues.

Enriched 2026-10-27 with Latch MCP integration:
  - Checks Latch/Resolve/OBS status at start
  - Saves queue summary to local file for Pi/Vibe/other agents

Patterns used (verified in docs.mistral.ai/studio/workflows):
  @workflows.workflow.define(name=..., execution_timeout=...), @workflows.workflow.entrypoint,
  @workflows.activity(start_to_close_timeout, retry_policy_*, heartbeat_timeout), activity_heartbeat,
  workflows.InteractiveWorkflow.wait_for_input, workflow.now(), workflow.execute_workflow (child).
Scheduling is done OUTSIDE the worker with client.workflows.schedules.schedule_workflow (see schedule.py).
"""
import json
from datetime import timedelta

from temporalio.workflow import unsafe as _wf_unsafe
with _wf_unsafe.imports_passed_through():
    import httpx
import mistralai.workflows as workflows
import mistralai.workflows.plugins.mistralai as wm
from mistralai.workflows import activity_heartbeat, workflow
from pydantic import BaseModel, Field, field_validator

from shared.approval import ask_approval
from shared.config import out_dir
from shared.llm import GenRequest, VerifyRequest, agnes_generate, typesafe_verify
from shared.latch import latch_health

SITE = "https://sourovdeb.com"
# Platform constraints learned in production:
LINKEDIN_MAX_DAYS_AHEAD = 90       # LinkedIn scheduler cap (~3 months) + daily post limit
MEDIUM_PARAGRAPH_BATCH = 12        # Medium drops text when pasted fast: save every 12 paragraphs


PROMPTS = {
    "linkedin": "Write a LinkedIn post (<=1,300 chars) for ELT teachers from this lesson. Hook line, 3 practical tips, question CTA, link at end. 3-5 hashtags.",
    "medium": "Produce SEO fields for a Medium story: seo_title (<=60 chars), seo_description (140-156 chars), 5 topics.",
    "youtube": "Write a 60-90s YouTube Shorts script + title (<=70 chars) + description with chapters and the article link.",
    "podcast": "Write a 120-word podcast episode pitch and 5 talking points from this lesson.",
}


class Params(BaseModel):
    categories: list[str] = Field(default_factory=lambda: ["english-teaching", "philosophy"])
    batch_size: int = Field(7, ge=1, le=20)   # one week of items per run keeps payloads << 2 MB
    channels: list[str] = Field(default_factory=lambda: ["linkedin", "medium", "youtube", "podcast"])
    plant_typos: int = 0                      # user's spot-the-error game (2-5), 0 = off
    require_approval: bool = True
    check_local_tools: bool = True            # check Latch/Resolve/OBS at start

    @field_validator("plant_typos")
    @classmethod
    def _typos(cls, v: int) -> int:
        if v != 0 and not 2 <= v <= 5:
            raise ValueError("plant_typos must be 0 (off) or 2-5")
        return v

    @field_validator("channels")
    @classmethod
    def _channels(cls, v: list[str]) -> list[str]:
        bad = [c for c in v if c not in PROMPTS]
        if bad:
            raise ValueError(f"unknown channels {bad}; allowed {sorted(PROMPTS)}")
        return list(dict.fromkeys(v))  # de-dupe, keep order


class Post(BaseModel):
    id: int
    title: str
    link: str
    excerpt: str
    content_chars: int


class Derivative(BaseModel):
    post_id: int
    channel: str
    title: str
    body: str
    tags: list[str] = []
    seo_title: str = ""
    seo_description: str = ""   # Medium story settings: 140-156 chars
    canonical_url: str = ""


class QueueResult(BaseModel):
    queued: int
    skipped_duplicates: int
    rejected: int
    unverified: int = 0
    local_tools: dict = {}
    summary_file: str = ""


@workflows.activity(start_to_close_timeout=timedelta(minutes=5), heartbeat_timeout=timedelta(seconds=60),
                    retry_policy_max_attempts=3, retry_policy_backoff_coefficient=2.0)
async def fetch_unqueued_posts(categories: list[str], limit: int) -> list[Post]:
    """Reads WP REST API (public) and filters out ids already present in the queue ledger."""
    from scripts.ledger import already_queued  # local file ledger, idempotent
    out: list[Post] = []
    page = 1
    async with httpx.AsyncClient(timeout=30) as c:
        while len(out) < limit and page < 50:
            r = await c.get(f"{SITE}/wp-json/wp/v2/posts",
                            params={"per_page": 50, "page": page, "_fields": "id,title,link,excerpt,content",
                                    "orderby": "date", "order": "asc"})
            if r.status_code == 400:   # past last page
                break
            r.raise_for_status()
            for p in r.json():
                if already_queued(p["id"]):
                    continue
                out.append(Post(id=p["id"], title=p["title"]["rendered"], link=p["link"],
                                excerpt=p["excerpt"]["rendered"][:600], content_chars=len(p["content"]["rendered"])))
                if len(out) >= limit:
                    break
            page += 1
            activity_heartbeat(page)
    return out


@workflows.activity(start_to_close_timeout=timedelta(minutes=2), retry_policy_max_attempts=3)
async def write_queue_rows(rows: list[Derivative]) -> int:
    """Appends approved rows to per-channel CSV queues (linkedin_queue.csv, medium_queue.csv, ...).
    Idempotent: upserts on (post_id, channel), so a retry after a partial write converges."""
    from scripts.ledger import upsert_rows
    return upsert_rows([r.model_dump() for r in rows])


@workflows.activity(start_to_close_timeout=timedelta(seconds=10), retry_policy_max_attempts=1)
async def save_queue_summary(summary: dict, tag: str) -> str:
    """Save queue summary as JSON for Pi/Vibe/other agents."""
    d = out_dir("scheduler", "summaries")
    p = d / f"queue-{tag}.json"
    p.write_text(json.dumps(summary, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return str(p)


@workflows.workflow.define(name="content-scheduler", execution_timeout=timedelta(days=3))
class ContentScheduler(workflows.InteractiveWorkflow):
    @workflows.workflow.entrypoint
    async def run(self, params: Params) -> QueueResult:
        tag = workflow.now().strftime("%Y-%m-%d-%H%M")

        # --- Check local tools via Latch ---
        local_tools: dict = {}
        if params.check_local_tools:
            try:
                local_tools = await latch_health()
                await wm.send_assistant_message(
                    f"Local tools: Latch {local_tools.get('tool_count', 0)} tools, "
                    f"Resolve {'connected' if local_tools.get('resolve_connected') else 'not running'}, "
                    f"OBS {'connected' if local_tools.get('obs_connected') else 'not running'}"
                )
            except Exception as e:
                local_tools = {"error": str(e)[:200]}

        posts = await fetch_unqueued_posts(params.categories, params.batch_size)
        queued = dupes = rejected = unverified = 0
        for post in posts:
            drafts: list[Derivative] = []
            for ch in params.channels:
                text = await agnes_generate(GenRequest(
                    system="You repurpose ELT lessons for Sourov Deb. Keep his voice; never invent quotes or facts.",
                    prompt=f"{PROMPTS[ch]}\n\nTITLE: {post.title}\nURL: {post.link}\nEXCERPT: {post.excerpt}"
                           + (f"\nPlant exactly {params.plant_typos} common spelling mistakes (spot-the-error game)."
                              if params.plant_typos and ch == "linkedin" else "")))
                check = await typesafe_verify(VerifyRequest(text=text, kind="dedupe", corpus_key=f"{ch}_queue"))
                if not check.checked:
                    unverified += 1
                if not check.ok:
                    dupes += 1
                    continue
                drafts.append(Derivative(post_id=post.id, channel=ch, title=post.title, body=text,
                                         canonical_url=post.link))
            if not drafts:
                continue
            if params.require_approval:
                preview = "\n\n".join(f"**{d.channel}**\n{d.body[:500]}" for d in drafts)
                if unverified:
                    preview += "\n\n_Note: TypeSafe dedupe was not configured; duplicates not checked._"
                decision, note = await ask_approval(self, f"Post {post.id}: {post.title}\n\n{preview}")
                if decision != "approve":
                    rejected += 1   # timeout/reject/revise -> not queued; revise is re-run next schedule
                    continue
            queued += await write_queue_rows(drafts)

        # --- Save queue summary locally ---
        summary = {
            "tag": tag,
            "queued": queued,
            "skipped_duplicates": dupes,
            "rejected": rejected,
            "unverified": unverified,
            "local_tools": local_tools,
        }
        summary_file = await save_queue_summary(summary, tag)

        return QueueResult(queued=queued, skipped_duplicates=dupes, rejected=rejected,
                           unverified=unverified, local_tools=local_tools, summary_file=summary_file)


if __name__ == "__main__":
    import asyncio
    asyncio.run(workflows.run_worker([ContentScheduler]))
