"""Pure-function tests (no network, no Temporal). Run: uv run python -m pytest -q tests  (or python tests/test_pure.py)"""
import os, sys, tempfile, importlib, types
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

# Stub the mistral plugin so approval.parse_decision can be imported without the SDK.
if "mistralai.workflows.plugins.mistralai" not in sys.modules:
    try:
        import mistralai.workflows.plugins.mistralai  # noqa
    except Exception:
        for n in ["mistralai", "mistralai.workflows", "mistralai.workflows.plugins",
                  "mistralai.workflows.plugins.mistralai"]:
            sys.modules.setdefault(n, types.ModuleType(n))


def test_parse_decision():
    from shared.approval import parse_decision as p
    assert p("Approve") == "approve" and p("yes") == "approve" and p("approved!") == "approve"
    assert p("Revise: shorter intro") == "revise"
    assert p("") == "reject" and p("maybe") == "reject" and p("no") == "reject"


def test_env_loader_names_only():
    d = tempfile.mkdtemp()
    Path(d, ".env").write_text("FOO_TEST_KEY=abcdefgh12345\n# comment\nPLACE=<X>\n")
    Path(d, ".env_secrets.md").write_text("# Secrets\n`BAR_TEST_KEY=zzzzzzzz9999`\nFOO_TEST_KEY=other\n")
    os.environ["VIBE_HOME"] = d
    import shared.config as c; importlib.reload(c)
    names = c.load_env()
    assert set(names) == {"FOO_TEST_KEY", "BAR_TEST_KEY"}
    assert os.environ["FOO_TEST_KEY"] == "abcdefgh12345"  # .env wins over secrets.md
    assert "PLACE" not in os.environ
    assert c.redact("x abcdefgh12345 y") == "x <FOO_TEST_KEY> y"


def test_ledger_idempotent():
    d = tempfile.mkdtemp(); os.environ["QUEUE_DIR"] = d
    import scripts.ledger as L; importlib.reload(L)
    row = {"post_id": 1, "channel": "linkedin", "title": "t", "body": "é", "tags": ["a", "b"]}
    L.upsert_rows([row]); L.upsert_rows([row])
    assert L.already_queued(1) and not L.already_queued(2)
    assert len(L._load()) == 1





def test_safe_bridge_has_no_exec():
    """The connector must never regain a shell / file-write / process-start path."""
    import ast
    cands = [Path(os.environ.get("BRIDGE_FILE", "")),
             Path.home() / "sourov-workflows/src/workflows/vibe_pc_connector.py",
             ROOT / "safe-bridge/vibe_pc_connector.py"]
    f = next((c for c in cands if c.is_file()), None)
    if f is None:
        return
    src = f.read_text(encoding="utf-8")
    tree = ast.parse(src)
    names = {n.attr if isinstance(n, ast.Attribute) else getattr(n, "id", "") for n in ast.walk(tree)}
    for bad in ["subprocess", "create_subprocess_exec", "create_subprocess_shell", "popen", "startfile",
                "write_text", "write_bytes", "unlink", "rmtree", "exec", "eval"]:
        assert bad not in names, f"forbidden {bad} in bridge"
    for n in ast.walk(tree):  # os.system specifically (platform.system is fine)
        if isinstance(n, ast.Attribute) and n.attr == "system" and getattr(n.value, "id", "") == "os":
            raise AssertionError("os.system in bridge")
    assert '"execute"' not in src and "command_type" not in src


if __name__ == "__main__":
    for n, f in list(globals().items()):
        if n.startswith("test_"):
            f(); print("PASS", n)
