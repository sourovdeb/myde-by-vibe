# Skills Audit & Consolidation — 2026-10-28

**Method:** pi = planner/verifier · Agnes (agnes-2.5-flash) = clustering worker · TypeSafe (jev-1.14.0)
= overlap verifier. Full audit trail in `sessions/skills-audit-evidence/`.

## Inventory (before)

| Tree | SKILL.md count | Role |
|---|---|---|
| C:\Users\souro\.vibe\skills\skills | 108 | primary home (jev router roster source) |
| E:\apps\agent-skills | 117 | Mishu originals + ai_agent_skills pack |
| E:\ONE-STOP-SHOP\.pi\agent\skills | 11 | pi agent copies |
| H:\00_SKILLS_AGENTS | 526 | multi-profile library (mostly archive copies) |
| E:\jev-skill-router\skills | 1 | router's own skill |
| **Total** | **763** | |

Live audit scope: 246 skills (vibe + apps + pi + the 9 H: skills pi actually declares).

## Process

1. **Inventory** — scripted walk of all trees, name/description/size extracted (CSV in evidence).
2. **Agnes clustering** (2 calls; 1st truncated by Agnes reasoning burn at 16k tokens — documented
   gotcha — 2nd call continued from remaining roster) → 62 clusters.
3. **TypeSafe verification** — provider_router.py `decision` OVERLAP/PARTIAL/DISTINCT per risky
   cluster. Initial run silently fell back to Agnes (`base_url_not_approved`: script expects
   `https://api.typesafe.ai` WITHOUT `/v1`; env had `/v1`). Corrected → real TypeSafe verdicts:
   - 7 × OVERLAP (conf 0.75–0.97): systematic-debugging→debug-cycle, cost-aware-provider-router→
     mishu-provider-capability-router, humanizer→mishu-humanizer, audiobook pair→mishu-audiobook-…,
     scene-draft→mishu-scene-planner-drafter (0.47, low but top choice), mishu-rigorous-analysis→
     sourov-rigorous-analysis, empathic-listening-psychology→empathetic-listening.
   - 1 × **PARTIAL (0.36): hermes-resolve-workflows vs sourov-studio-launcher — NOT merged**
     (Agnes proposed it; TypeSafe + planner review rejected; both kept).
4. **Execution** — dry run first, then: 72 skill dirs moved to `_consolidated-2026-10-28/` archives
   inside their own trees (nothing deleted), 1 newer-content sync (mishu-skill-architect, backup
   saved), archived SKILL.md renamed to `SKILL.archived.md` so agents stop discovering them.

## Result (after)

| Tree | Before | After | Archived |
|---|---|---|---|
| vibe | 108 | **108** (untouched — router roster stable) | 0 |
| apps | 117 | **57** | 60 |
| pi | 11 | **0** (all were duplicates; pi now loads from vibe/apps) | 11 |
| H: (live copies touched) | 9 declared | cost-aware live pack **kept** (operational script); 1 dup archived | 1 |

Net: **73 duplicate/overlapping skill instances consolidated, zero deletions** — every original is
recoverable from its `_consolidated-2026-10-28` archive. Canonical skill files carry a dated
`## Consolidated 2026-10-28` note naming the merged sibling and its archive path.

## Deliberately NOT merged (kept separate on review)

- hermes-resolve-workflows vs sourov-studio-launcher (TypeSafe PARTIAL — launcher-builder vs
  workflow-contract are different jobs).
- WordPress trio: sourov-wp-maintenance (faults) / mishu-wordpress-operations (content ops) /
  sourov-wordpress-design-troubleshooting (design) — complementary by design.
- cost-aware-provider-router live H: copy retained as the operational script pack
  (scripts/provider_router.py is the working TypeSafe channel); its profile_assets duplicate was
  archived.

## Gotchas recorded (also added to the skills involved)

1. Agnes 2.5 flash burns large token budgets on hidden reasoning (52k tokens reasoning vs 6k
   content on this task): set max_tokens ≥16000 for clustering-scale asks, and expect truncation —
   plan a continuation call with only the remaining items.
2. provider_router.py BASES allowlist: TypeSafe base URL must be `https://api.typesafe.ai`
   (no `/v1`) or it fails `base_url_not_approved` and SILENTLY falls back to Agnes — always check
   `provider`/`attempts` in the response JSON, not just the choice.
3. Same-name cross-tree duplicates are verified by content hash, not by models — deterministic
   where possible.

## Evidence

- `skills-audit-evidence/skills-inventory-2026-10-28.csv` — full 763-skill inventory
- `skills-audit-evidence/clusters-final.json` — 62 Agnes clusters (merged from both calls)
- `skills-audit-evidence/ts-results.json` — TypeSafe verdicts (real provider runs)
- `skills-audit-evidence/consolidation-manifest-final.txt` — every action taken
