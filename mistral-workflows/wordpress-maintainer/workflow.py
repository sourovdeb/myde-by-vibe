"""wordpress-maintainer: backups -> update check -> minor updates (approved) -> verify -> SEO audit -> broken links.
Read-only checks are automatic; every write (updates, link fixes) waits for approval.
Update status is read from the Hostinger hosting API (list_updates); WP-CLI @production is only used for
backup/apply/checksums and is optional for checksums.

Enriched 2026-10-27 with Latch MCP integration:
  - Checks Latch/Resolve/OBS status at start; saves report to local file
  - Report file accessible by Pi, Vibe, and other agents via Latch file tools
"""
import asyncio
import json
from datetime import timedelta

import httpx
import mistralai.workflows as workflows
import mistralai.workflows.plugins.mistralai as wm
from mistralai.workflows import activity_heartbeat
from typing import Literal

from pydantic import BaseModel, Field

from shared.approval import ask_approval
from shared.config import dry_run, out_dir
from shared.latch import latch_health

SITE = "https://sourovdeb.com"
WP = ["wp", "@production"]  # alias in ~/.wp-cli/config.yml; production never the default


class Params(BaseModel):
    mode: Literal["weekly", "monthly"] = "weekly"
    max_link_checks: int = Field(400, ge=1, le=2000)   # bound CPU/network
    link_concurrency: int = Field(4, ge=1, le=8)       # no "parallel storms"
    dry_run: bool = False                               # read-only run: no backup write, no updates
    check_local_tools: bool = True                      # check Latch/Resolve/OBS at start


class Report(BaseModel):
    backup: str
    updates_available: list[dict]
    updates_applied: bool
    checksum_ok: bool
    verify_error: str = ""
    dry_run: bool = False
    seo_issues: list[dict]
    broken_links: list[dict]
    local_tools: dict = {}       # Latch/Resolve/OBS status snapshot
    report_file: str = ""        # local path where the report JSON was saved


async def _wp(*args: str, timeout: int = 600) -> str:
    p = await asyncio.create_subprocess_exec(*WP, *args, stdout=asyncio.subprocess.PIPE,
                                             stderr=asyncio.subprocess.PIPE)
    out, err = await asyncio.wait_for(p.communicate(), timeout)
    if p.returncode:
        raise RuntimeError(err.decode()[:2000])
    return out.decode()


@workflows.activity(start_to_close_timeout=timedelta(minutes=15), retry_policy_max_attempts=2)
async def backup_db(tag: str) -> str:
    path = f"~/backups/{tag}.sql"
    await _wp("db", "export", path, "--add-drop-table")
    return path


HAPI = "https://developers.hostinger.com/api/hosting/v1"
HOSTINGER_USERNAME = "u839078121"   # hosting account (not a secret)
HOSTINGER_SOFTWARE = "29805488"     # WordPress installation id for sourovdeb.com (not a secret)


@workflows.activity(start_to_close_timeout=timedelta(minutes=5), retry_policy_max_attempts=3)
async def list_updates() -> list[dict]:
    """Read-only: core/plugin/theme update status from the Hostinger API (no WP-CLI needed).
    Token from HOSTINGER_API_TOKEN (or HOSTINGER_API_KEY); value is never logged."""
    import os
    from shared.config import load_env, redact
    load_env()
    token = os.environ.get("HOSTINGER_API_TOKEN") or os.environ.get("HOSTINGER_API_KEY")
    if not token:
        raise RuntimeError("HOSTINGER_API_TOKEN is not set (checked process env, ~/.vibe/.env, ~/.vibe/.env_secrets.md)")
    user = os.environ.get("HOSTINGER_USERNAME", HOSTINGER_USERNAME)
    sw = os.environ.get("HOSTINGER_WP_SOFTWARE", HOSTINGER_SOFTWARE)
    base = f"{HAPI}/accounts/{user}/wordpress/{sw}"
    hdr = {"Authorization": f"Bearer {token}", "Accept": "application/json"}
    out: list[dict] = []
    async with httpx.AsyncClient(timeout=30, headers=hdr) as c:
        async def get(path: str):
            for attempt in range(3):  # Hostinger returns sporadic 500s; retry briefly
                r = await c.get(base + path)
                if r.status_code < 500:
                    break
                await asyncio.sleep(2 * (attempt + 1))
            if r.status_code >= 400:
                raise RuntimeError(redact(f"Hostinger API {path} -> HTTP {r.status_code}: {r.text[:300]}"))
            j = r.json()
            return j.get("data", j) if isinstance(j, dict) else j
        core = await get("/updates")
        for cu in (core if isinstance(core, list) else ([core] if core else [])):
            out.append({"type": "core", "name": "wordpress", **(cu if isinstance(cu, dict) else {"update_version": cu})})
        for kind, path in (("plugin", "/plugins"), ("theme", "/themes")):
            for it in await get(path) or []:
                if str(it.get("update", "none")).lower() not in ("none", "", "false"):
                    out.append({"type": kind, "name": it.get("name"), "version": it.get("version"),
                                "status": it.get("status"), "update": it.get("update"),
                                "update_version": it.get("update_version", ""),
                                "vulnerabilities": len(it.get("vulnerabilities") or [])})
    return out


@workflows.activity(start_to_close_timeout=timedelta(minutes=30), heartbeat_timeout=timedelta(minutes=2),
                    retry_policy_max_attempts=1)  # writes: do not blindly retry
async def apply_minor_updates() -> None:
    if dry_run():
        return
    for step in (["plugin", "update", "--all", "--minor"], ["theme", "update", "--all"],
                 ["core", "update", "--minor"], ["core", "update-db"], ["cache", "flush"]):
        await _wp(*step)
        activity_heartbeat(step[0])


@workflows.activity(start_to_close_timeout=timedelta(minutes=10), retry_policy_max_attempts=2)
async def verify_site() -> bool:
    import shutil
    if shutil.which(WP[0]):  # WP-CLI optional; HTTP checks always run
        await _wp("core", "verify-checksums")
        await _wp("plugin", "verify-checksums", "--all")
    async with httpx.AsyncClient(timeout=20) as c:
        for u in (SITE, f"{SITE}/wp-sitemap.xml"):
            r = await c.get(u); r.raise_for_status()
    return True


@workflows.activity(start_to_close_timeout=timedelta(minutes=30), heartbeat_timeout=timedelta(minutes=2))
async def seo_audit(limit: int) -> list[dict]:
    """Title length, meta description, H1 count, noindex, canonical, thin content. Sequential, polite."""
    import re
    issues = []
    async with httpx.AsyncClient(timeout=20) as c:
        posts = (await c.get(f"{SITE}/wp-json/wp/v2/posts",
                             params={"per_page": min(limit, 100), "_fields": "id,link"})).json()
        for i, p in enumerate(posts):
            resp = await c.get(p["link"])
            if resp.status_code >= 400:
                issues.append({"id": p["id"], "url": p["link"], "issues": [f"http_{resp.status_code}"]})
                continue
            h = resp.text
            title = re.search(r"<title>(.*?)</title>", h, re.S)
            desc = (re.search(r'<meta[^>]+name=["\']description["\'][^>]+content=["\']([^"\']*)', h, re.I)
                    or re.search(r'<meta[^>]+content=["\']([^"\']*)["\'][^>]+name=["\']description', h, re.I))
            found = []
            if not title or not (30 <= len(title.group(1)) <= 65): found.append("title_length")
            if not desc or not (120 <= len(desc.group(1)) <= 160): found.append("meta_description")
            if len(re.findall(r"<h1[\s>]", h)) != 1: found.append("h1_count")
            if 'rel="canonical"' not in h: found.append("no_canonical")
            if re.search(r'<meta[^>]+robots[^>]+noindex', h, re.I): found.append("noindex")
            if found: issues.append({"id": p["id"], "url": p["link"], "issues": found})
            activity_heartbeat(i)
    return issues


@workflows.activity(start_to_close_timeout=timedelta(minutes=45), heartbeat_timeout=timedelta(minutes=2))
async def broken_links(max_checks: int, concurrency: int) -> list[dict]:
    import re
    sem = asyncio.Semaphore(max(1, min(concurrency, 8)))
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as c:
        posts = (await c.get(f"{SITE}/wp-json/wp/v2/posts",
                             params={"per_page": 50, "_fields": "id,link,content"})).json()
        pairs = [(p["link"], u) for p in posts for u in set(re.findall(r'href="(https?://[^"#]+)"',
                                                                        p["content"]["rendered"]))][:max_checks]
        bad = []

        async def check(src, url):
            async with sem:
                try:
                    r = await c.head(url)
                    if r.status_code in (405, 403): r = await c.get(url)
                    if r.status_code >= 400: bad.append({"page": src, "url": url, "status": r.status_code})
                except httpx.HTTPError as e:
                    bad.append({"page": src, "url": url, "status": type(e).__name__})
        for i in range(0, len(pairs), 20):
            await asyncio.gather(*(check(s, u) for s, u in pairs[i:i + 20]))
            activity_heartbeat(i)
    return bad


@workflows.activity(start_to_close_timeout=timedelta(seconds=30), retry_policy_max_attempts=2)
async def save_report_locally(report_dict: dict, tag: str) -> str:
    """Save the maintenance report as JSON for Pi/Vibe/other agents to read."""
    d = out_dir("wordpress", "reports")
    p = d / f"maintainer-{tag}.json"
    p.write_text(json.dumps(report_dict, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return str(p)


@workflows.workflow.define(name="wordpress-maintainer", execution_timeout=timedelta(days=3))
class WordPressMaintainer(workflows.InteractiveWorkflow):
    @workflows.workflow.entrypoint
    async def run(self, params: Params) -> Report:
        tag = workflows.workflow.now().strftime("%Y-%m-%d-%H%M")

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

        backup = "(dry run: skipped)" if params.dry_run else await backup_db(tag)
        ups = await list_updates()
        applied = False
        if ups and not params.dry_run:
            decision, _ = await ask_approval(
                self, f"Backup saved ({backup}). {len(ups)} minor updates available:\n" +
                "\n".join(f"- {u['type']} {u.get('name', '')} {u.get('version', '')}->{u.get('update_version', '')}"
                          for u in ups[:40]), timeout=timedelta(hours=24))
            if decision == "approve":
                await apply_minor_updates()
                applied = True
        ok, verr = True, ""
        try:
            ok = await verify_site()
        except Exception as e:  # don't lose SEO/link results because checksums failed; flag loudly
            ok, verr = False, type(e).__name__ + ": " + str(e)[:300]
            await wm.send_assistant_message(f"Site verification FAILED after updates={applied}: {verr}. "
                                            f"Restore point: {backup}")
        seo = await seo_audit(100 if params.mode == "monthly" else 30)
        links = await broken_links(params.max_link_checks if params.mode == "monthly" else 100,
                                   params.link_concurrency)

        # --- Save report locally ---
        report_dict = {
            "tag": tag,
            "backup": backup,
            "updates_available": ups,
            "updates_applied": applied,
            "checksum_ok": ok,
            "verify_error": verr,
            "seo_issues": seo,
            "broken_links": links,
            "local_tools": local_tools,
        }
        report_file = await save_report_locally(report_dict, tag)

        return Report(backup=backup, updates_available=ups, updates_applied=applied, checksum_ok=ok,
                      seo_issues=seo, broken_links=links, verify_error=verr, dry_run=params.dry_run,
                      local_tools=local_tools, report_file=report_file)


if __name__ == "__main__":
    asyncio.run(workflows.run_worker([WordPressMaintainer]))
