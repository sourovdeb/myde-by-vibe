"""Env loading + paths + dry-run. Values are NEVER logged; only names.

Load order (first wins, existing process env is never overwritten):
  1. process environment
  2. ~/.vibe/.env
  3. ~/.vibe/.env_secrets.md  (KEY=VALUE lines; markdown/comment lines ignored)
"""
from __future__ import annotations

import os
import re
from pathlib import Path

VIBE_HOME = Path(os.environ.get("VIBE_HOME", str(Path.home() / ".vibe")))
_LINE = re.compile(r"^\s*(?:export\s+)?([A-Z][A-Z0-9_]{1,63})\s*=\s*(.*?)\s*$")
_loaded: list[str] = []


def _parse(path: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not path.is_file():
        return out
    for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
        m = _LINE.match(line.strip("`"))
        if m:
            v = m.group(2).strip().strip('"').strip("'")
            if v and not v.startswith("<"):  # skip placeholders like <KEY>
                out[m.group(1)] = v
    return out


def load_env() -> list[str]:
    """Idempotent. Returns the NAMES that were newly set (safe to log)."""
    if _loaded:
        return list(_loaded)
    for f in (VIBE_HOME / ".env", VIBE_HOME / ".env_secrets.md"):
        for k, v in _parse(f).items():
            if k not in os.environ:
                os.environ[k] = v
                _loaded.append(k)
    return list(_loaded)


def require(name: str) -> str:
    load_env()
    v = os.environ.get(name)
    if not v:
        raise MissingSecret(name)
    return v


class MissingSecret(RuntimeError):
    def __init__(self, name: str):
        super().__init__(f"env var {name} is not set (checked process env, ~/.vibe/.env, ~/.vibe/.env_secrets.md)")


def redact(text: str) -> str:
    """Mask any loaded secret value that slipped into a log/message."""
    for k in _loaded:
        v = os.environ.get(k, "")
        if len(v) >= 8:
            text = text.replace(v, f"<{k}>")
    return text


def _default_root() -> Path:
    if os.name == "nt":
        return Path(r"E:\ONE-STOP-SHOP\mistral-workflows")
    return Path("/workspace/mistral-workflows")


OUTPUT_ROOT = Path(os.environ.get("MW_OUTPUT_ROOT", str(_default_root())))


def out_dir(*parts: str) -> Path:
    p = OUTPUT_ROOT.joinpath("output", *parts)
    p.mkdir(parents=True, exist_ok=True)
    return p


def dry_run() -> bool:
    """MW_DRY_RUN=1 -> activities with external side effects must not perform them."""
    return os.environ.get("MW_DRY_RUN", "").strip().lower() in {"1", "true", "yes", "on"}
