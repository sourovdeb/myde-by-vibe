"""Human-approval helper built only on documented primitives:
InteractiveWorkflow.wait_for_input + ChatInput(prompt, suggestions) + TextChunk,
send_assistant_message, and asyncio.TimeoutError on timeout.
Anything that is not a clear approval is treated as NOT approved (fail closed).
"""
import asyncio
from datetime import timedelta

import mistralai.workflows.plugins.mistralai as wm

APPROVE = {"approve", "approved", "yes", "y", "ok", "go", "lgtm", "oui"}
REJECT = {"reject", "rejected", "no", "n", "stop", "cancel", "non"}


def parse_decision(text: str) -> str:
    """Pure function (unit-tested). Returns approve | revise | reject."""
    low = (text or "").strip().lower().rstrip(".!")
    if not low:
        return "reject"
    first = low.split()[0].rstrip(":,")
    if first in {"revise", "change", "edit"}:
        return "revise"
    if low in APPROVE or first in {"approve", "approved"}:
        return "approve"
    return "reject"  # includes REJECT words and anything ambiguous


async def ask_approval(wf, summary: str, timeout: timedelta = timedelta(days=2)) -> tuple[str, str]:
    """Returns ("approve" | "revise" | "reject" | "timeout", raw_text). Call from an InteractiveWorkflow."""
    await wm.send_assistant_message(summary[:3800])
    try:
        reply = await wf.wait_for_input(
            wm.ChatInput("Approve, revise (say what to change), or reject?",
                         suggestions=[[wm.TextChunk(text="Approve")],
                                      [wm.TextChunk(text="Revise: ")],
                                      [wm.TextChunk(text="Reject")]]),
            timeout=timeout)
    except asyncio.TimeoutError:
        return "timeout", ""
    text = reply.message[0].text if reply.message else ""
    return parse_decision(text), text
