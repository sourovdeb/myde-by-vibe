---
name: mix-of-agents-audit
description: Audit a deliverable, argument, plan, or draft through a multi-provider pipeline - TypeSafe (jev-latest) verification gates, Agnes 2.5 flash bulk claim extraction, Mistral models for self-debate (zai-glm-5-3-flash), synthesis (mistral-large-latest), and embedding dedupe (mistral-embed-2312). Use for evidence audits, contested claims, pre-publication review, or stress-testing a plan when the user wants the mix-of-agents treatment.
---

# Mix-of-Agents Audit

Run a claim-level evidence audit through multiple providers, each doing what it
is best at. The pipeline embodies `self-debate` (Toulmin position papers,
rebuttal, neutral judge) and `sourov-rigorous-analysis` (claim/evidence/finding
register with SUPPORTED / CONTRADICTED / MIXED / UNPROVEN verdicts).

## When to load

- The user asks to audit, verify, stress-test, or debate a document, plan,
  argument, or deliverable.
- Pre-publication or pre-deployment review of consequential text.
- NOT for trivial checks (file existence, arithmetic) - use direct tools.

## Pipeline

Run the support script (stdlib only; Python 3.12 via `py -V:Astral/CPython3.12.13`):

```
py -V:Astral/CPython3.12.13 C:\Users\souro\.vibe\skills\skills\mix-of-agents-audit\audit_pipeline.py INPUT_FILE ^
  --criteria "what a good result means here" -o report.md
```

Stages (each stage is skipped gracefully when its key is missing; the report
records which stages ran):

1. **Extract** (Agnes `agnes-2.5-flash`): pull testable claims with quotes.
2. **Dedupe** (Mistral `mistral-embed-2312`): cosine-similarity merge of
   repeated claims (threshold 0.92).
3. **Gate** (TypeSafe `jev-latest`, `/v1/systemone` choice): per-claim verdict
   SUPPORTED / CONTRADICTED / UNPROVEN / UNKNOWN against the supplied text
   only, with probabilities.
4. **Debate** (Mistral `zai-glm-5-3-flash`, reasoning): steelman proponent and
   opponent Toulmin papers on the disputed claims, then a rebuttal round.
   Grounds labeled DOCUMENTED / RECOLLECTION-ONLY / INFERRED.
5. **Judge** (TypeSafe choice): verdict per top disputed argument -
   SURVIVED / CONCEDED / UNRESOLVED, scored only against the declared
   criteria. Factual disputes exit the debate as UNRESOLVED, never settled
   by rhetoric.
6. **Synthesize** (Mistral `mistral-large-latest`): final Markdown report -
   scope statement, claim/evidence/finding register, strongest alternative
   explanation, prioritized corrections, checkpoint.

Optional extras: `--code-review` adds a `codestral-2508` pass for code inputs;
`--embed-model codestral-embed-2505` switches the dedupe embedding.

## Hard rules

- Provider output is a CANDIDATE, never proof. The report says which stages
  actually ran; a skipped stage is reported, not papered over.
- Never print, log, or copy API key values. Keys come from env vars:
  `TYPESAFE_API_KEY`, `AGNES_API_KEY`, `MISTRAL_API_KEY` (loaded from
  `~/.vibe/.env`; check by name and length only).
- The pipeline is read-only on the input; it writes only the report and
  checkpoint files you name.
- Do not settle factual questions inside the debate: route them to source
  verification or mark UNRESOLVED.
- If a provider fails, the script degrades and says so; do not retry in a
  loop. One targeted retry per stage is built in.

## Verified endpoints (2026-10-24)

See `references/providers.md` for the request shapes, all verified live this
date. Re-verify before relying on them after provider changes.
