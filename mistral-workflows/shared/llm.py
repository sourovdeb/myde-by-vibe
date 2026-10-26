"""Shared activities: cheap generation (Agnes AI) and verification/dedupe (TypeSafe).

Keys come from env via shared.config.require (process env -> ~/.vibe/.env -> ~/.vibe/.env_secrets.md).
  AGNES_API_KEY, AGNES_BASE_URL (default https://apihub.agnes-ai.com/v1), AGNES_MODEL (default agnes-2.5-flash)
  TYPESAFE_API_KEY, TYPESAFE_BASE_URL (default https://api.typesafe.ai; POST /v1/systemone, live-confirmed 2026-10-22),
  TYPESAFE_MODEL (default jev-latest), TYPESAFE_REQUIRED=1 to fail closed
All network I/O lives in activities. Missing keys raise a NON-retryable error (retrying won't help).
"""
import os
from datetime import timedelta

from temporalio.workflow import unsafe as _wf_unsafe
with _wf_unsafe.imports_passed_through():
    import httpx
import mistralai.workflows as workflows
from pydantic import BaseModel, Field

from shared.config import dry_run, load_env, redact, require


def _agnes_base() -> str:
    return os.environ.get("AGNES_BASE_URL", "https://apihub.agnes-ai.com/v1").rstrip("/")


def _agnes_model() -> str:
    return os.environ.get("AGNES_MODEL", "agnes-2.5-flash")


class GenRequest(BaseModel):
    system: str
    prompt: str = Field(max_length=60000)       # keep activity payloads well under 2 MB
    max_tokens: int = Field(1500, ge=16, le=8000)
    temperature: float = Field(0.6, ge=0.0, le=1.5)


class VerifyRequest(BaseModel):
    text: str
    kind: str = "dedupe"          # "dedupe" | "fact" | "style"
    corpus_key: str | None = None


class VerifyResult(BaseModel):
    ok: bool
    score: float | None = None
    notes: str = ""
    checked: bool = True          # False = verifier not configured / skipped


@workflows.activity(
    start_to_close_timeout=timedelta(minutes=3),
    retry_policy_max_attempts=4,
    retry_policy_backoff_coefficient=2.0,
)
async def agnes_generate(req: GenRequest) -> str:
    """One chat completion. Safe to retry: returns text only, no side effects."""
    load_env()
    if dry_run():
        return f"[DRY RUN] would call {_agnes_model()} ({len(req.prompt)} prompt chars)"
    key = require("AGNES_API_KEY")  # raises MissingSecret (message has the NAME only)
    async with httpx.AsyncClient(timeout=120) as c:
        r = await c.post(
            f"{_agnes_base()}/chat/completions",
            headers={"Authorization": f"Bearer {key}"},
            json={"model": _agnes_model(),
                  "messages": [{"role": "system", "content": req.system},
                               {"role": "user", "content": req.prompt}],
                  "max_tokens": req.max_tokens, "temperature": req.temperature},
        )
        if r.status_code in (401, 403):  # bad key: do not burn retries
            raise RuntimeError(f"Agnes auth failed HTTP {r.status_code}")
        r.raise_for_status()
        try:
            return r.json()["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, ValueError) as e:
            raise RuntimeError(redact(f"Agnes returned unexpected shape: {r.text[:300]}")) from e


@workflows.activity(
    start_to_close_timeout=timedelta(minutes=2),
    retry_policy_max_attempts=3,
    retry_policy_backoff_coefficient=2.0,
)
async def typesafe_verify(req: VerifyRequest) -> VerifyResult:
    """Verification/dedupe via TypeSafe System One (one Noul question per call).
    If TypeSafe isn't configured or MW_DRY_RUN=1: fail OPEN with checked=False (callers must surface that
    to the human) unless TYPESAFE_REQUIRED=1, then fail CLOSED (ok=False)."""
    load_env()
    key = os.environ.get("TYPESAFE_API_KEY")
    base = os.environ.get("TYPESAFE_BASE_URL", "https://api.typesafe.ai")
    required = os.environ.get("TYPESAFE_REQUIRED", "") in {"1", "true", "yes"}
    if not key or dry_run():
        return VerifyResult(ok=not required, checked=False,
                            notes="TypeSafe not configured or dry run; verification skipped")
    question = _TS_QUESTIONS.get(req.kind, _TS_QUESTIONS["fact"])
    state = {"text": req.text[:50000], "reference_set": req.corpus_key or ""}
    async with httpx.AsyncClient(timeout=60) as c:
        r = await c.post(f"{base.rstrip('/')}/v1/systemone",
                         headers={"Authorization": f"Bearer {key}"},
                         json={"model": os.environ.get("TYPESAFE_MODEL", "jev-latest"), "state": state,
                               "questions": {"check": {"type": "noul", "instructions": question}}})
        if r.status_code in (401, 403):
            raise RuntimeError(f"TypeSafe auth failed HTTP {r.status_code}")
        r.raise_for_status()
        p = float(r.json()["answers"]["check"]["noul"])
        return VerifyResult(ok=p >= 0.5, score=p, notes=f"TypeSafe noul={p:.2f} kind={req.kind}")


_TS_QUESTIONS = {
    "dedupe": "The text is original content and not a near-duplicate or light rewording of something already published",
    "fact": "The text makes no claims that look invented, unsupported or internally inconsistent",
    "style": "The text is clear, uses short factual sentences and has no filler or marketing hype",
}
