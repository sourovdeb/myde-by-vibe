---
name: sourov-typesafe-diagnostics
description: Diagnose Sourov's Living Map and website failures using TypeSafe for evidence assessment. Preserve WordPress, URLs, and credentials. Use Choice questions for hypothesis fitting, test usefulness, patch fit, and contract alignment.
version: 1.0.0
metadata:
  author: Sourov Deb
  date: 2026-10-27
  source: E:\knowledge\New Good Stuff from chatgpt\SOUROV_TYPESAFE_DIAGNOSTIC_INSTRUCTIONS.md
  companion: typesafe-ai
  tags: [typesafe, diagnostics, debugging, wordpress, design, evidence]
---

# Sourov Design Diagnostics

Diagnose before changing code. Repair the demonstrated mechanism. Retest the failing interaction. Preserve the design contract. Report evidence, not assurances.

## Workflow

```
FAILURE
   ↓
BROWSER OBSERVATIONS
   ↓
CODE CHECKS
   ↓
TYPESAFE ASSESSMENT (when useful)
   ↓
AGENT DIAGNOSIS
   ↓
BRANCH PATCH
   ↓
SAME-CASE RETEST
   ↓
REGRESSION TESTS
   ↓
EVIDENCE REPORT
   ↓
DEPLOYMENT APPROVAL
```

Never collapse these stages. A classification is not diagnosis. A diagnosis is not repair. A patch is not deployment.

## Execution Boundaries

| Surface | Allowed during diagnosis | Not authorized |
|---|---|---|
| Sites prototype | Inspect; patch a branch; test | Publish without deployment approval |
| Production WordPress | Compare public rendering and routes | Theme activation; content edits |
| Hostinger | Read configured metadata when needed | DNS, cache, security, or cron changes |
| TypeSafe | Assess sanitized evidence when authorized | Upload secrets; approve writes |
| Local workspace | Save evidence and reversible patches | Overwrite unrelated user changes |

## TypeSafe Preflight

1. Reuse the installed `typesafe-ai` skill.
2. Check `TYPESAFE_API_KEY` through the runtime. Check presence without printing values.
3. Keep TypeSafe outside the website, browser bundles, and WordPress.
4. Never upload the repository wholesale. Exclude cookies and authorization headers.

| Condition | Required behaviour |
|---|---|
| Key missing | Mark `TYPESAFE_UNAVAILABLE`; continue code checks |
| SDK missing | Mark blocker; do not auto-install |
| API authentication fails | Stop API calls; preserve diagnostics |
| Provider reports quota exhaustion | Stop calls; no automatic purchase |
| Timeout or rate limit | Apply one bounded retry policy |
| Response is malformed | Reject it; never manufacture answers |

## TypeSafe Question Pack

Use `Choice` questions. Every question permits abstention. Do not invent assessment scores.

### Diagnose Phase

**hypothesis_fit:** Evaluate `state.hypothesis` against `state.observations` and `state.counterevidence`.
- `supported`: Observations distinguish this mechanism. Confirmation still requires a test.
- `contradicted`: Observations contradict the proposed mechanism. Revise the hypothesis.
- `insufficient_evidence`: Observations cannot distinguish the mechanism.

**test_usefulness:** Evaluate `state.candidate_test` against `state.hypothesis`.
- `discriminating`: Outcomes would distinguish the hypothesis from competing explanations.
- `nondiscriminating`: The test only repeats symptoms.
- `insufficient_evidence`: The test lacks required context.

### Review Phase

**patch_fit:** Compare `state.patch` with `state.hypothesis`.
- `addresses_mechanism`: The diff addresses the mechanism. Execution tests still govern acceptance.
- `misses_mechanism`: The diff changes another concern.
- `insufficient_evidence`: The patch lacks required context.

**contract_alignment:** Compare `state.patch` with `state.contract`.
- `aligned`: The change preserves the contract. Not deployment authorization.
- `conflicts`: The change contradicts the contract. Resolve conflicts.
- `insufficient_evidence`: Required contract evidence is missing.

## Answer Handling

| Answer | Agent action |
|---|---|
| `supported` | Run the discriminating test |
| `contradicted` | Revise the hypothesis |
| `insufficient_evidence` | Collect the missing observation |
| `discriminating` | Check capability and execute test |
| `nondiscriminating` | Design a distinguishing test |
| `addresses_mechanism` | Run original reproduction and regressions |
| `misses_mechanism` | Reject or revise the patch |
| `aligned` | Continue verification; never auto-publish |
| `conflicts` | Resolve the contract conflict |

## Falsifiable Hypotheses

| Symptom | Candidate mechanism | Distinguishing check |
|---|---|---|
| Arrange does nothing | Script failed to initialize | Inspect asset and handler registration |
| Drag never starts | Overlay receives pointer events | Hit-test the exact handle location |
| Drag opens a page | Card shares navigation/drag handlers | Trace handle and anchor events |
| Wrong node moves | Pointer ownership changes mid-drag | Trace pointer ID and node ID |
| Touch fails | Gesture cancellation or mouse-only code | Trace touch pointer/cancel events |
| Page will not scroll | Page-wide gesture suppression | Start scrolling outside every handle |
| Node jumps | Coordinates use incompatible spaces | Compare pointer, board, transform values |
| Node disappears | Saved positions exceed usable bounds | Reproduce resize with captured storage |
| Labels clip | Height, nowrap, or grid constraints | Inspect computed sizing at failure width |
| Saved layout vanishes | Storage fails or schema differs | Observe write/read result and exception |

## Acceptance Tests

Test widths: 320, 390, 430, 639, 640, 768, 1023, 1024, 1440, 1600, 1920, 2560

| Test | Observable pass condition |
|---|---|
| Browse click | Correct destination opens |
| Arrange toggle | Handles and editing controls appear |
| Arrange anchor | Link behaviour matches frozen contract |
| Drag handle | Only selected node moves |
| Drag release | URL remains unchanged |
| Six-pixel threshold | Pointer jitter does not move nodes |
| Cross-node drag | Source node retains ownership |
| Pointer cancel | Drag-start position returns |
| Escape / Cancel | Arrange-entry snapshot returns |
| Save and reload | Saved geometry returns |
| Keyboard | Documented increments and focus work |
| Phone List | Navigation works without dragging |
| Touch scrolling | Scroll works outside handles |
| Long category names | Text wraps without clipping |
| Edge updates | Endpoints follow nodes |
| Storage unavailable | Links work; saving failure is reported |
| JavaScript unavailable | Content and route links remain usable |

Treat unrun tests as `NOT_RUN`. Never mark them passed.

## Evidence Schema

```text
evidence/<case-id>/
  CONTRACT.md
  baseline.json
  observations.json
  hypothesis.md
  typesafe-input.redacted.json
  typesafe-output.json
  patch.diff
  tests.json
  captures/
  RESULT.md
```

## Result Labels

| Label | Meaning |
|---|---|
| `NOT_REPRODUCED` | Complaint remains unresolved |
| `DIAGNOSED` | Mechanism has supporting observations |
| `PATCHED_UNVERIFIED` | Source changed; acceptance incomplete |
| `VERIFIED_LOCAL` | Local target passed recorded tests |
| `VERIFIED_STAGING` | Staging target passed recorded tests |
| `AWAITING_DEPLOYMENT_APPROVAL` | Publication remains unauthorized |
| `DEPLOYED_UNVERIFIED` | Publication attempted; read-back incomplete |
| `VERIFIED_DEPLOYMENT` | Published target passed read-back tests |
| `BLOCKED` | Named capability or requirement missing |

## Completion Report Format

```text
TARGET:
SOURCE REVISION:
DEPLOYED REVISION:
FAILURE REPRODUCED:
OBSERVED MECHANISM:
TYPESAFE STATUS:
TYPESAFE ASSESSMENTS:
CHANGED FILES:
ORIGINAL CASE RETEST:
REGRESSIONS:
BROWSERS AND INPUTS:
UNTESTED:
PUBLICATION STATUS:
PRODUCTION CHANGES:
ROLLBACK:
EVIDENCE PATHS:
REMAINING BLOCKER:
```
