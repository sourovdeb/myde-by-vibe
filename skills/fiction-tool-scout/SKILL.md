---
name: fiction-tool-scout
description: Recommend and rank AI long-form fiction writing tools (Sudowrite-style editors with story bible, series continuity, drafting, style matching, import/export, pricing) for a novelist, with sourced claims, deal-breaker flags and cost per 80,000-word novel. Use whenever the user asks which AI writing tool, novel editor or Sudowrite alternative to adopt, wants a writing-tool comparison or procurement shortlist, or mentions story bibles, Match My Style, Muse or Ballad, even if they never say "skill" or "compare".
---

# Fiction Tool Scout

Act as a software procurement developer specialising in AI creative-writing tools. The user is a novelist deciding what to adopt. Verified facts beat plausible ones, because a wrong pricing or export claim costs the user money.

## Step 0: fill the blanks (ask once, then proceed)
Output language needed (default English only), whether mature fiction must be allowed, and budget per 80k-word novel in USD (default 300). Do not ask anything else.

## Step 1: research
Search the web. Take every feature and price from the tool's own site or docs, current today. Do not recommend a tool you cannot source. Mark anything unconfirmed `U` (unverified) rather than guessing. Sudowrite (Scenes, Draft, Muse/Ballad, Match My Style, bible excluded from project export, CSV for characters/worldbuilding) is a reference point, not a default winner. Verify it like any other candidate.

## Step 2: score 3-5 tools against the 10 requirements
Priority order, weights 10 down to 1: (1) long-form editor, (2) persistent story bible, (3) series continuity, (4) targeted drafting tools, (5) chapter drafts with word-count and cost estimate, (6) story-aware AI chat with approvable multi-step edits and inline beta-reader comments, (7) model choice incl. one fiction-tuned model, (8) style profile from the user's prose (assume no minimum sample size), (9) manuscript import and .docx export, stating exactly what export includes and excludes, (10) transparent pricing with an 80k-word cost.
Status per requirement: `F` full, `P` partial, `M` missing, `U` unverified.

## Step 3: run the scorer
Write one line per tool: `name|sourced|import|export_has_bible|hard_filter|usd_per_1k_words|r1,...,r10` (yes/no flags; `#` starts a comment). Derive usd_per_1k_words from the published credit price and words per credit. Then:
```
node scripts/scout.js tools.txt --budget 300      # or pipe via stdin
```
The output JSON holds rank, score (0-100), cost_80k, deal_breakers, unverified count and a recommendation. A tool with deal-breakers is flagged, not hidden; an unsourced tool is disqualified. If `caution` is true, tell the user every candidate has a deal-breaker.

## Step 4: report
1. Comparison table of all tools: purpose, requirements met/partial/missed, pricing (tiers, credits, free trial, free plan beyond trial), platform, language support, mature-content policy, source URLs.
2. Side-by-side of the top 2 on: bible persistence, series continuity, rewrite tools, chapter generation, model choice, style matching, import/export, cost per 80k novel.
3. Deal-breakers: missing import, export that drops bible data, credit cost that scales badly with length, hard content filters.
4. Ranked recommendation, then one paragraph justifying the winner.

## Integrations
- **API**: `scripts/scout.js` (Node) or the Rust CLI in the prototype both read tool lines and print the same JSON. Any agent can shell out to either.
- **Vibe / other agents**: `sh scripts/install.sh --vibe-global` (to `~/.vibe/skills/`), `--vibe-project` (to `./.vibe/skills/`), or `--global`.
- **Web app**: the prototype page runs the same engine in the browser and shows the API payload.
