"""academic-paper-pipeline: idea -> journal fit (e.g. JEFL) -> literature map -> outline -> section drafts
-> integrity checks -> author-guideline compliance -> submission pack. Human approval at each gate.
Literature comes from open scholarly APIs (Crossref, OpenAlex); every citation is verified to exist (DOI
resolves) before it can enter a draft. The author writes/owns the argument; AI drafts scaffolding only.

Enriched 2026-10-27 with Latch MCP integration:
  - Checks Latch/Resolve/OBS status at start
  - Saves each section draft and the final pack to local files for Pi/Vibe/other agents
"""
import asyncio
import json
import os
from datetime import timedelta

from temporalio.workflow import unsafe as _wf_unsafe
with _wf_unsafe.imports_passed_through():
    import httpx
import mistralai.workflows as workflows
import mistralai.workflows.plugins.mistralai as wm
from mistralai.workflows import activity_heartbeat
from pydantic import BaseModel, Field

from shared.approval import ask_approval
from shared.config import out_dir
from shared.llm import GenRequest, VerifyRequest, agnes_generate, typesafe_verify
from shared.latch import latch_health

MAILTO = os.environ.get("OPENALEX_MAILTO", "")  # polite pool for OpenAlex/Crossref
UA = {"User-Agent": f"sourov-academic-pipeline/1.1 (mailto:{MAILTO or 'unset'})"}
SECTIONS = ["Introduction", "Literature Review", "Methodology", "Findings", "Discussion", "Conclusion"]


class Params(BaseModel):
    working_title: str
    research_question: str
    journal: str = "Journal of English as a Foreign Language (JEFL)"
    guidelines_url: str = ""           # author guidelines page; parsed for word limit/style
    word_limit: int = Field(7000, ge=1000, le=20000)
    citation_style: str = "APA 7"
    check_local_tools: bool = True      # check Latch/Resolve/OBS at start


class Source(BaseModel):
    doi: str
    title: str
    year: int | None = None
    authors: str = ""


class Pack(BaseModel):
    outline: str
    sources: list[Source]
    sections: dict[str, str]
    compliance: str
    status: str
    local_tools: dict = {}
    pack_file: str = ""       # local path where the full pack JSON was saved


@workflows.activity(start_to_close_timeout=timedelta(minutes=5), heartbeat_timeout=timedelta(seconds=60),
                    retry_policy_max_attempts=3, retry_policy_backoff_coefficient=2.0)
async def search_literature(query: str, rows: int = 25) -> list[Source]:
    """OpenAlex works search (polite, single request). Returns only records that carry a DOI."""
    async with httpx.AsyncClient(timeout=30) as c:
        r = await c.get("https://api.openalex.org/works", headers=UA,
                        params={"search": query, "per-page": min(rows, 50), "filter": "has_doi:true",
                                **({"mailto": MAILTO} if MAILTO else {})})
        r.raise_for_status()
    out = []
    seen = set()
    for w in r.json().get("results", []):
        if not w.get("doi"):
            continue
        doi = w["doi"].replace("https://doi.org/", "").lower()
        if doi in seen:
            continue
        seen.add(doi)
        out.append(Source(doi=doi, title=w.get("title") or "",
                          year=w.get("publication_year"),
                          authors=", ".join(a["author"]["display_name"] for a in w.get("authorships", [])[:3])))
    activity_heartbeat(len(out))
    return out


@workflows.activity(start_to_close_timeout=timedelta(minutes=10), heartbeat_timeout=timedelta(seconds=60))
async def verify_dois(sources: list[Source]) -> list[Source]:
    """Crossref lookup for each DOI, sequential (no parallel storm). Drops anything that doesn't resolve."""
    ok = []
    async with httpx.AsyncClient(timeout=20) as c:
        for i, s in enumerate(sources[:40]):  # hard cap: polite to Crossref, bounded runtime
            try:
                r = await c.get(f"https://api.crossref.org/works/{s.doi}", headers=UA)
            except httpx.HTTPError:
                continue  # unverifiable -> excluded (fail closed for citations)
            if r.status_code == 200:
                ok.append(s)
            activity_heartbeat(i)
            await asyncio.sleep(0.3)
    return ok


@workflows.activity(start_to_close_timeout=timedelta(minutes=2), retry_policy_max_attempts=3)
async def fetch_guidelines(url: str) -> str:
    if not url:
        return ""
    import re, html
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as c:
        r = await c.get(url, headers=UA)
        if r.status_code >= 400:
            return f"(guidelines fetch failed: HTTP {r.status_code})"
        t = r.text
    return html.unescape(re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", t)))[:15000]


@workflows.activity(start_to_close_timeout=timedelta(seconds=10), retry_policy_max_attempts=1)
async def save_section_draft(section: str, draft: str, slug: str) -> str:
    """Save a section draft to a local file for Pi/Vibe/other agents."""
    import re
    safe = re.sub(r"[^a-z0-9]+", "-", section.lower())[:30]
    d = out_dir("academic", "drafts", slug)
    p = d / f"{safe}.md"
    p.write_text(draft, encoding="utf-8")
    return str(p)


@workflows.activity(start_to_close_timeout=timedelta(seconds=10), retry_policy_max_attempts=1)
async def save_pack_locally(pack_dict: dict, slug: str) -> str:
    """Save the full submission pack as JSON."""
    d = out_dir("academic", "packs")
    p = d / f"{slug}.json"
    p.write_text(json.dumps(pack_dict, indent=2, ensure_ascii=False, default=str), encoding="utf-8")
    return str(p)


@workflows.workflow.define(name="academic-paper-pipeline", execution_timeout=timedelta(days=60))
class AcademicPaperPipeline(workflows.InteractiveWorkflow):
    @workflows.workflow.entrypoint
    async def run(self, p: Params) -> Pack:
        # --- Check local tools via Latch ---
        local_tools: dict = {}
        if p.check_local_tools:
            try:
                local_tools = await latch_health()
                await wm.send_assistant_message(
                    f"Local tools: Latch {local_tools.get('tool_count', 0)} tools, "
                    f"Resolve {'connected' if local_tools.get('resolve_connected') else 'not running'}, "
                    f"OBS {'connected' if local_tools.get('obs_connected') else 'not running'}"
                )
            except Exception as e:
                local_tools = {"error": str(e)[:200]}

        sys = (f"You are an academic writing assistant for an ELT researcher targeting {p.journal}. "
               f"Use {p.citation_style}. Cite ONLY from the provided verified source list; write [CITATION NEEDED] otherwise.")
        guide = await fetch_guidelines(p.guidelines_url)
        found = await search_literature(f"{p.research_question} EFL")
        sources = await verify_dois(found)
        if not sources:
            await wm.send_assistant_message("No DOI-verified sources found; drafts will use [CITATION NEEDED].")
        src_txt = "\n".join(f"- {s.authors} ({s.year}). {s.title}. doi:{s.doi}" for s in sources)

        outline = await agnes_generate(GenRequest(system=sys, prompt=
            f"Title: {p.working_title}\nRQ: {p.research_question}\nSections: {SECTIONS}\n"
            f"Word limit {p.word_limit}. Give an IMRaD outline with per-section word budgets and the gap "
            f"statement.\nVerified sources:\n{src_txt}", max_tokens=2500))
        decision, note = await ask_approval(self, f"Outline + {len(sources)} verified sources:\n\n{outline[:3500]}",
                                            timeout=timedelta(days=14))
        if decision != "approve":
            return Pack(outline=outline, sources=sources, sections={}, compliance="", status=decision,
                        local_tools=local_tools)

        import re
        slug = re.sub(r"[^a-z0-9-]+", "-", p.working_title.lower())[:50].strip("-") or "paper"

        sections: dict[str, str] = {}
        for sec in SECTIONS:   # sequential: each section sees the approved previous ones
            draft = await agnes_generate(GenRequest(system=sys, max_tokens=3000, prompt=
                f"Draft the {sec} section following this outline:\n{outline}\n\nSources:\n{src_txt}\n"
                + ("Mark data placeholders as [AUTHOR DATA]." if sec in ("Methodology", "Findings") else "")))
            sections[sec] = draft
            # Save each section draft locally
            await save_section_draft(sec, draft, slug)
            d, n = await ask_approval(self, f"**{sec}** draft:\n\n{draft[:3500]}", timeout=timedelta(days=14))
            if d == "approve":
                pass
            elif d == "revise":
                sections[sec] = await agnes_generate(GenRequest(system=sys, max_tokens=3000,
                                                                prompt=f"Revise per: {n}\n\n{draft}"))
            elif d in ("reject", "timeout"):
                sections[sec] = "[AUTHOR TO WRITE]"

        full = "\n\n".join(f"## {k}\n{v}" for k, v in sections.items())
        integrity = await typesafe_verify(VerifyRequest(text=full[:200000], kind="fact"))
        cited = sum(full.count(s.doi) for s in sources)
        needed = full.count("[CITATION NEEDED]")
        compliance = await agnes_generate(GenRequest(system="You check manuscripts against author guidelines.",
            prompt=f"Guidelines:\n{guide or '(not provided)'}\nWord limit {p.word_limit}, style {p.citation_style}.\n"
                   f"Check: word count, abstract length, keywords, anonymisation, citation-reference match, "
                   f"AI-use disclosure statement. Manuscript:\n{full[:30000]}"))
        await wm.send_assistant_message(f"Compliance report:\n{compliance}\n\nIntegrity: {integrity.notes or 'ok'}"
                                        f"{'' if integrity.checked else ' (NOT CHECKED)'}\n"
                                        f"Verified-DOI mentions: {cited}; [CITATION NEEDED]: {needed}")

        # --- Save full pack locally ---
        pack_dict = {
            "working_title": p.working_title,
            "research_question": p.research_question,
            "journal": p.journal,
            "outline": outline,
            "sources": [s.model_dump() for s in sources],
            "sections": sections,
            "compliance": compliance,
            "local_tools": local_tools,
        }
        pack_file = await save_pack_locally(pack_dict, slug)
        await wm.send_assistant_message(f"Submission pack saved to: `{pack_file}`")

        return Pack(outline=outline, sources=sources, sections=sections, compliance=compliance,
                    status="ready_for_author_review", local_tools=local_tools, pack_file=pack_file)


if __name__ == "__main__":
    asyncio.run(workflows.run_worker([AcademicPaperPipeline]))
