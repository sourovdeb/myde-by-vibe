r"""Start the Mistral Workflows worker for all 5 enriched workflows.

Usage:
    .venv\Scripts\python.exe start_worker.py

Loads workflow modules by file path (directories have hyphens, so they
can't be imported as regular packages). Requires MISTRAL_API_KEY in env
or in a .env file in the project root.
"""

import asyncio
import importlib.util
import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(PROJECT_ROOT))

from mistralai.workflows.core.worker import run_worker  # noqa: E402


def _load_module(name: str, path: Path):
    """Load a Python module from a file path."""
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[name] = module
    spec.loader.exec_module(module)
    return module


# Load each workflow module by file path (dirs have hyphens -> not importable as packages)
_podcast = _load_module("podcast_producer_workflow", PROJECT_ROOT / "podcast-producer" / "workflow.py")
_wp = _load_module("wordpress_maintainer_workflow", PROJECT_ROOT / "wordpress-maintainer" / "workflow.py")
_cs = _load_module("content_scheduler_workflow", PROJECT_ROOT / "content-scheduler" / "workflow.py")
_acad = _load_module("academic_pipeline_workflow", PROJECT_ROOT / "academic-paper-pipeline" / "workflow.py")
_decision = _load_module("decision_audit_workflow", PROJECT_ROOT / "mishu-critical-thinking-decision-audit" / "workflow.py")

ALL_WORKFLOWS = [
    _podcast.PodcastProducer,
    _wp.WordPressMaintainer,
    _cs.ContentScheduler,
    _acad.AcademicPaperPipeline,
    _decision.DecisionReview,
    _decision.MishuDecisionAudit,
]


async def main() -> None:
    print(f"Starting worker with {len(ALL_WORKFLOWS)} workflows:")
    for wf in ALL_WORKFLOWS:
        print(f"  - {wf.__name__}")
    await run_worker(workflows=ALL_WORKFLOWS)


if __name__ == "__main__":
    asyncio.run(main())
