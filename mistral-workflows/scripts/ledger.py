"""File-based idempotent ledger shared with the existing pipeline (/workspace/*_queue.csv).
Keys: (post_id, channel). Safe for activity retries."""
import csv
import os
from pathlib import Path

from shared.config import OUTPUT_ROOT

ROOT = Path(os.environ.get("QUEUE_DIR", str(OUTPUT_ROOT / "queues")))
LEDGER = ROOT / "ledger.csv"
FIELDS = ["post_id", "channel", "title", "body", "tags", "seo_title", "seo_description", "canonical_url"]


def _load() -> dict[tuple[str, str], dict]:
    if not LEDGER.exists():
        return {}
    with LEDGER.open(newline="", encoding="utf-8") as f:
        return {(r["post_id"], r["channel"]): r for r in csv.DictReader(f)}


def already_queued(post_id: int) -> bool:
    return any(k[0] == str(post_id) for k in _load())


def upsert_rows(rows: list[dict]) -> int:
    ROOT.mkdir(parents=True, exist_ok=True)
    data = _load()
    for r in rows:
        r = {k: (";".join(v) if isinstance(v, list) else str(v)) for k, v in r.items() if k in FIELDS}
        if not r.get("post_id") or not r.get("channel"):
            raise ValueError("ledger row needs post_id and channel")
        data[(r["post_id"], r["channel"])] = r
    tmp = LEDGER.with_suffix(".tmp")
    with tmp.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(data.values())
    tmp.replace(LEDGER)  # atomic
    return len(rows)
