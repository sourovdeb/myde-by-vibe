r"""Start the Mistral Workflows worker for all enriched workflows.

Usage:
    .venv\Scripts\python.exe start_worker.py

Syncs workflow files from hyphenated directories into workflow_modules/
(valid Python package) so Temporal's sandbox can import them. Requires
MISTRAL_API_KEY (or MISTRAL_WORKFLOWS_API_KEY) and DEPLOYMENT_NAME in env.
"""

import asyncio
import shutil
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from mistralai.workflows.core.worker import run_worker  # noqa: E402

# --- Sync: copy workflow.py from hyphenated dirs into workflow_modules/ ---
# Temporal's sandbox re-imports the workflow's module by name; hyphenated
# directories can't be imported as Python packages, so we mirror them here
# with valid module names. Re-copied on every start so edits propagate.
SYNC_MAP = {
    "podcast-producer": "podcast_producer_workflow.py",
    "wordpress-maintainer": "wordpress_maintainer_workflow.py",
    "content-scheduler": "content_scheduler_workflow.py",
    "academic-paper-pipeline": "academic_pipeline_workflow.py",
    "mishu-critical-thinking-decision-audit": "decision_audit_workflow.py",
}

_wf_dir = PROJECT_ROOT / "workflow_modules"
_wf_dir.mkdir(exist_ok=True)
for src_dir, dst_name in SYNC_MAP.items():
    src = PROJECT_ROOT / src_dir / "workflow.py"
    dst = _wf_dir / dst_name
    if src.exists():
        shutil.copy2(src, dst)

# --- Import workflow classes from the synced package ---
from workflow_modules.podcast_producer_workflow import PodcastProducer  # noqa: E402
from workflow_modules.wordpress_maintainer_workflow import WordPressMaintainer  # noqa: E402
from workflow_modules.content_scheduler_workflow import ContentScheduler  # noqa: E402
from workflow_modules.academic_pipeline_workflow import AcademicPaperPipeline  # noqa: E402
from workflow_modules.decision_audit_workflow import DecisionReview, MishuDecisionAudit  # noqa: E402

ALL_WORKFLOWS = [
    PodcastProducer,
    WordPressMaintainer,
    ContentScheduler,
    AcademicPaperPipeline,
    DecisionReview,
    MishuDecisionAudit,
]


async def main() -> None:
    print(f"Starting worker with {len(ALL_WORKFLOWS)} workflows:")
    for wf in ALL_WORKFLOWS:
        print(f"  - {wf.__name__}")
    await run_worker(workflows=ALL_WORKFLOWS)


if __name__ == "__main__":
    asyncio.run(main())
