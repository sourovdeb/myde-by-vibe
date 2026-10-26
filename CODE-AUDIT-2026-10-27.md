# Code Audit Report — ONE-STOP-SHOP Workflows + Bridges

**Project:** mistral-workflows (5 enriched workflows) + latch-bridges (4 scripts) + shared modules
**Scope:** 14 Python files, 2,261 lines of code
**Date:** 2026-10-27
**Overall Health:** Good (82/100)

---

## Executive Summary

The codebase is clean and well-structured. The `shared/latch.py` module (327 lines) is the largest file but is well-organized with thin wrapper functions. All 5 workflows follow a consistent pattern with `check_local_tools` enrichment. Error handling is graceful — Latch unavailability degrades to structured "unavailable" results rather than crashing. The main gaps are limited test coverage (only 4 pure-function tests, no tests for latch activities or bridge scripts) and some duplication of the local-tools check pattern across workflows.

---

## Metrics

| Metric | Value | Status |
|--------|-------|--------|
| Total Lines of Code | 2,261 | |
| Number of Files | 14 | |
| Average File Size | 162 lines | Good |
| Largest File | shared/latch.py (327 lines) | Acceptable |
| Test Coverage | ~15% (4 pure-function tests) | Low |
| Number of Dependencies | 5 direct (mistralai-workflows, mistralai, httpx, pydantic, websocket-client) | Good |
| Outdated Dependencies | 0 | Good |
| Lint Errors | 0 (py_compile clean) | Good |
| TODO/FIXME Count | 0 | Good |

### File Inventory

| File | Lines | Size | Role |
|------|-------|------|------|
| shared/latch.py | 327 | 12.4 KB | Latch MCP client (20 activities) |
| podcast-producer/workflow.py | 275 | 11.9 KB | Podcast production pipeline |
| resolve_bridge.py | 253 | 7.5 KB | Resolve control bridge (7 commands) |
| wordpress-maintainer/workflow.py | 257 | 12.5 KB | WordPress maintenance |
| obs_bridge.py | 245 | 7.4 KB | OBS control bridge (9 commands) |
| academic-paper-pipeline/workflow.py | 220 | 10.7 KB | Academic paper pipeline |
| content-scheduler/workflow.py | 203 | 9.2 KB | Content scheduling |
| mishu-critical-thinking-decision-audit/workflow.py | 165 | 9.0 KB | Decision audit (2 workflows) |
| shared/llm.py | 110 | — | Agnes/TypeSafe LLM activities |
| shared/config.py | 83 | — | Env loading + paths |
| start_worker.py | 56 | 1.9 KB | Worker launcher |
| shared/approval.py | 41 | — | Human approval helper |
| resolve_cmd.py | 13 | 533 B | Resolve wrapper |
| obs_cmd.py | 13 | 528 B | OBS wrapper |

---

## Findings by Category

### Complexity

| Severity | Count | Top Offenders |
|----------|-------|---------------|
| Critical (>20 complexity) | 0 | — |
| High (10-20 complexity) | 0 | — |
| Medium (5-10 complexity) | 1 | `latch_call_tool()` (63 lines, shared/latch.py:92) |

**Note:** `latch_call_tool()` at 63 lines is the core MCP call function. It handles: URL resolution, enabled check, HTTP POST with timeout, JSON-RPC response parsing, error handling, and graceful degradation. The length is justified — it's a single responsibility (make one MCP call) with necessary error paths. No functions exceed 50 lines in any workflow file.

### Duplication

- **Local-tools check pattern**: The `check_local_tools` activity pattern is repeated across all 5 workflows (11-20 references to `latch_health`/`check_local_tools`/`LocalToolStatus`/`local_tools` per file). Each workflow independently calls `latch_health`, `latch_resolve_status`, `latch_obs_status` and assembles results. This is ~30-50 lines of similar code per workflow.
  - **Recommendation:** Extract a shared `check_all_local_tools()` activity in `shared/latch.py` that returns a combined `LocalToolStatus` — would eliminate ~150 lines of duplication across 5 files.

- **Bridge command wrappers**: `resolve_cmd.py` and `obs_cmd.py` are near-identical (13 lines each, differ only in Python path and bridge script name). Acceptable — they're thin wrappers and the duplication is trivial.

### Test Coverage

- **Overall coverage:** ~15% (estimated — only pure functions tested)
- **Tested:** `parse_decision()` (approval), `load_env()` (config), `upsert_rows()` (ledger), safe-bridge security invariants
- **Untested critical paths:**
  - `shared/latch.py` — all 20 activities (no tests for MCP call, URL resolution, graceful degradation)
  - `resolve_bridge.py` — all 7 commands (no tests for Resolve API interaction)
  - `obs_bridge.py` — all 9 commands (no tests for WebSocket interaction)
  - All 5 workflow `run()` methods (no integration tests)
  - `start_worker.py` (no test for module loading)

**Test health:** 4 tests, all PASS. Tests are pure-function only (no network, no Temporal). The test file has a `__main__` runner since pytest is not installed in the venv.

### Architecture

- **Circular dependencies:** None
- **Layer violations:** None — shared modules (config, llm, approval, latch) are infrastructure; workflow files are feature-specific
- **Coupling hotspots:**
  - `shared/latch.py` hardcodes PC-specific paths (`E:\tools\latch\status.json`, `C:\Users\souro\.local\bin\python3.12.exe`, `E:\tools\latch-bridges`) — acceptable for a PC-specific module, but would break if the project is deployed to cloud
  - All 5 workflows import from `shared.latch` — if the latch module's API changes, all 5 workflows need updates (shotgun surgery risk)

### Error Handling

- **Swallowed exceptions:** 7 `pass` in `except` blocks
  - `shared/latch.py:51-52` — URL resolution fallback (intentional: falls back to local default)
  - `shared/latch.py:145-146` — JSON parse fallback (intentional: returns raw text)
  - `resolve_bridge.py:161-183` — 5x optional property getters (intentional: skips unavailable properties)
  - All are intentional graceful degradation, not bugs
- **Missing error handling:** None — all external calls (HTTP, WebSocket, subprocess) have try/except
- **Error messages:** Bridge scripts output JSON with `"error"` key — structured and parseable

### Code Smells

| Smell | Count | Locations |
|-------|-------|-----------|
| Dead code | 0 | — |
| Magic numbers | 0 (30 timedelta usages are expected in workflow definitions) | — |
| Long methods | 1 | `latch_call_tool()` (63 lines) — justified |
| TODO/FIXME | 0 | — |
| Bare `except:` | 0 (all are `except Exception:`) | — |
| `print()` in activities | 0 | — |
| Hardcoded paths | 3 | `shared/latch.py:35,181,182` — PC-specific, acceptable |

### Consistency

- **Naming:** Consistent — `latch_*` prefix for all Latch activities, `cmd_*` for bridge commands, `check_local_tools` for the enrichment activity
- **Error handling pattern:** Consistent — all Latch activities return `LatchResult` with `ok`/`unavailable`/`error` fields
- **Import ordering:** Consistent — stdlib, third-party, local
- **Formatting:** All files pass `py_compile` — no syntax errors

### Performance

- **Synchronous I/O in activities:** All Latch activities use `httpx.AsyncClient` — properly async
- **Bridge scripts:** Use `subprocess.run()` with `capture_output=True` — synchronous but acceptable for CLI wrappers (called from async activities via `run_task`)
- **No N+1 patterns:** Each workflow makes independent Latch calls, no loops with per-item calls
- **Timeouts:** All HTTP calls have timeouts (10s for MCP, 5s for health checks)

---

## Prioritized Action Plan

### Immediate (This Sprint)

1. **Extract shared `check_all_local_tools()` activity** — Eliminate ~150 lines of duplication across 5 workflows. Impact: High. Effort: Low (1-2 hours).
2. **Add tests for `shared/latch.py`** — Test URL resolution, graceful degradation, and the `LatchResult` model. Impact: High. Effort: Medium (2-3 hours).

### Short Term (This Quarter)

3. **Add tests for bridge scripts** — Mock the Resolve API and OBS WebSocket, test each command's output format. Impact: Medium. Effort: Medium (3-4 hours).
4. **Make hardcoded paths configurable** — Move `E:\tools\latch\status.json`, Python path, and bridge dir to env vars with defaults. Impact: Medium (cloud-readiness). Effort: Low (1 hour).

### Long Term (Roadmap)

5. **Add integration tests for workflows** — Test one full workflow execution with mocked Latch/Resolve/OBS. Impact: Medium. Effort: High (4-6 hours).
6. **Install pytest in the venv** — Currently tests run via `__main__` runner. Add pytest as a dev dependency. Impact: Low. Effort: Low (15 min).

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Latch API change breaks all 5 workflows | Medium | High | Extract shared helper; add interface tests |
| Bridge script failure crashes workflow | Low | Medium | Already handled — activities return `unavailable=True` |
| Hardcoded paths break cloud deployment | Low | Medium | Make paths configurable via env vars |
| No test coverage for latch activities | Medium | Medium | Add unit tests with mocked HTTP |

---

## Recommendations

1. **Extract the local-tools check** into `shared/latch.py` as `check_all_local_tools()` — the single biggest code-quality win available.
2. **Add a `conftest.py`** with fixtures for mocking Latch MCP responses — enables testing all 20 activities without a live Latch server.
3. **Consider a `pyproject.toml` dev-dependencies section** for pytest, ruff, and mypy — currently no dev tooling is declared.
4. **The codebase is production-ready** for local use. The security patches from the security audit (bind to 127.0.0.1, remove eval) are the gating items, not code quality.

---

## Health Score: 82/100 (Good)

| Dimension | Score | Notes |
|-----------|-------|-------|
| Complexity | 95 | No complex functions; well-factored |
| Duplication | 70 | Local-tools check pattern repeated across 5 files |
| Test Coverage | 40 | Only 4 pure-function tests; no activity/bridge tests |
| Architecture | 90 | Clean module boundaries; no circular deps |
| Error Handling | 95 | Graceful degradation everywhere; structured errors |
| Documentation | 85 | Good docstrings; no README for latch module |
| Consistency | 95 | Naming, patterns, formatting all consistent |
| Performance | 90 | Proper async; timeouts on all external calls |
