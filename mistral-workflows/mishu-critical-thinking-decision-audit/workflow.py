"""mishu-critical-thinking-decision-audit
A conversational workflow (Vibe Work) that audits a decision or a claim before you act on it:
frame -> assumptions -> evidence -> bias check -> pre-mortem -> options/criteria scoring -> decision record
-> follow-up review timer. Also usable in class: students submit an argument, get a Socratic audit.

Enriched 2026-10-27 with Latch MCP integration:
  - Checks Latch/Resolve/OBS status at start
  - Saves decision record to local file (in addition to out_dir) for Pi/Vibe/other agents

Documented primitives: InteractiveWorkflow, send_assistant_message, wait_for_input(ChatInput),
TodoList/TodoListItem progress, workflow.execute_workflow (child, wait=False), and a durable timer
made from workflow.wait_condition(..., timeout=...) in the follow-up child workflow."""
import asyncio
import json
from datetime import timedelta

import mistralai.workflows as workflows
import mistralai.workflows.plugins.mistralai as wm
from pydantic import BaseModel, Field

from shared.config import out_dir
from shared.llm import GenRequest, VerifyRequest, agnes_generate, typesafe_verify
from shared.latch import latch_health

BIASES = ["confirmation", "sunk cost", "anchoring", "availability", "overconfidence",
          "status quo", "groupthink", "framing"]


class Params(BaseModel):
    decision: str = ""                     # empty -> ask in chat
    mode: str = "decision"                 # decision | argument (classroom)
    review_after_days: int = Field(30, ge=1, le=365)
    check_local_tools: bool = True         # check Latch/Resolve/OBS at start


class DecisionRecord(BaseModel):
    decision: str
    assumptions: str
    bias_flags: str
    premortem: str
    options_matrix: str
    choice: str
    review_after_days: int
    local_tools: dict = {}


class ReviewParams(BaseModel):
    record: DecisionRecord


@workflows.activity(start_to_close_timeout=timedelta(minutes=1), retry_policy_max_attempts=3)
async def save_record(rec: DecisionRecord) -> str:
    import re
    from pathlib import Path
    import hashlib
    d = out_dir("decisions")
    slug = re.sub(r"[^a-z0-9]+", "-", rec.decision.lower())[:50].strip("-") or "decision"
    h = hashlib.sha1(rec.decision.encode()).hexdigest()[:8]  # same decision -> same file (idempotent),
    p = d / f"{slug}-{h}.json"                                 # different decisions never collide
    p.write_text(json.dumps(rec.model_dump(), indent=2, ensure_ascii=False), encoding="utf-8")
    return str(p)


async def _ask(wf, prompt: str, suggestions: list[str] | None = None) -> str:
    sug = [[wm.TextChunk(text=s)] for s in (suggestions or [])]
    try:
        r = await wf.wait_for_input(wm.ChatInput(prompt, suggestions=sug), timeout=timedelta(days=3))
    except asyncio.TimeoutError:
        return ""
    return r.message[0].text if r.message else ""


@workflows.workflow.define(name="mishu-decision-review", execution_timeout=timedelta(days=400))
class DecisionReview(workflows.InteractiveWorkflow):
    """Child: wakes up after N days and runs a short outcome review (calibration loop)."""
    @workflows.workflow.entrypoint
    async def run(self, params: ReviewParams) -> str:
        # Durable timer built from the documented primitive: wait_condition never satisfied -> TimeoutError.
        try:
            await workflows.workflow.wait_condition(lambda: False,
                                                    timeout=timedelta(days=params.record.review_after_days))
        except asyncio.TimeoutError:
            pass
        await wm.send_assistant_message(
            f"Review time for: **{params.record.decision}**. You chose: {params.record.choice}.")
        outcome = await _ask(self, "What happened? Which assumption held or failed?")
        return await agnes_generate(GenRequest(system="Write a 5-line decision post-mortem with one lesson.",
                                               prompt=f"{params.record.model_dump_json()}\nOUTCOME: {outcome}"))


@workflows.workflow.define(name="mishu-critical-thinking-decision-audit",
                           workflow_display_name="Mishu: Decision Audit",
                           workflow_description="Critical-thinking audit of a decision or argument",
                           execution_timeout=timedelta(days=7))
class MishuDecisionAudit(workflows.InteractiveWorkflow):
    @workflows.workflow.entrypoint
    async def run(self, params: Params) -> wm.ChatAssistantWorkflowOutput:
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

        decision = (params.decision or await _ask(self, "What decision (or argument) should we audit?")).strip()
        if not decision:
            return wm.ChatAssistantWorkflowOutput(content=[wm.TextOutput(
                text="No decision given (or timed out), so nothing was audited or saved.")])
        steps = [wm.TodoListItem(title=t, description=d) for t, d in [
            ("Frame", "Restate the question and success criteria"),
            ("Assumptions", "Surface hidden assumptions"),
            ("Bias check", "Scan for common cognitive biases"),
            ("Pre-mortem", "Imagine it failed: why?"),
            ("Options", "Score options against criteria"),
            ("Record", "Save the decision record")]]
        sys = ("You are Mishu, a Socratic critical-thinking coach. Ask, don't lecture. Be concise. "
               "Separate facts, inferences and values. Never fabricate evidence.")
        async with wm.TodoList(items=steps):
            async with steps[0]:
                criteria = await _ask(self, "What would a good outcome look like? List 2-4 criteria.")
            async with steps[1]:
                assumptions = await agnes_generate(GenRequest(system=sys, prompt=
                    f"List the 5 most load-bearing assumptions in: {decision}\nCriteria: {criteria}. "
                    "For each: how could we test it cheaply?"))
                await wm.send_assistant_message(assumptions)
                evidence = await _ask(self, "Which assumption are you least sure of, and what evidence do you have?")
            async with steps[2]:
                bias = await agnes_generate(GenRequest(system=sys, prompt=
                    f"Check for these biases {BIASES} in decision '{decision}' with evidence '{evidence}'. "
                    "Flag only likely ones, each with a debiasing question."))
                fact = await typesafe_verify(VerifyRequest(text=evidence, kind="fact"))
                note = "" if fact.ok else f"\n\nEvidence check: {fact.notes}"
                if not fact.checked:
                    note += "\n\n_Evidence was not machine-checked (TypeSafe not configured)._"
                await wm.send_assistant_message(bias + note)
            async with steps[3]:
                premortem = await _ask(self, "It's a year later and this went badly. Give the top 3 reasons why.")
            async with steps[4]:
                matrix = await agnes_generate(GenRequest(system=sys, prompt=
                    f"Build a markdown options x criteria matrix (1-5) for '{decision}'. Criteria: {criteria}. "
                    f"Pre-mortem risks: {premortem}. Include 'do nothing' and 'reversible small test' options."))
                await wm.send_assistant_message(matrix)
                choice = await _ask(self, "Which option do you choose, and what would make you change your mind?",
                                    ["Run the reversible small test first", "Do nothing for now"])
            async with steps[5]:
                rec = DecisionRecord(decision=decision, assumptions=assumptions, bias_flags=bias,
                                     premortem=premortem, options_matrix=matrix, choice=choice,
                                     review_after_days=params.review_after_days,
                                     local_tools=local_tools)
                path = await save_record(rec)
                await workflows.workflow.execute_workflow(
                    DecisionReview, params=ReviewParams(record=rec),
                    execution_timeout=timedelta(days=params.review_after_days + 30), wait=False)
        return wm.ChatAssistantWorkflowOutput(content=[wm.TextOutput(
            text=f"Decision record saved ({path}). I'll check back in {params.review_after_days} days.")])


if __name__ == "__main__":
    asyncio.run(workflows.run_worker([MishuDecisionAudit, DecisionReview]))
