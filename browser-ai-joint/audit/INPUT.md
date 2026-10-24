# Mix-of-Agents Audit Input: "One Single Skill for All" Browser AI

**Audit Request:** Browser automation skill unification  
**Date:** 2026-10-24  
**Pipeline:** agnes-extract → embed-dedupe → TypeSafe gates → debate (zai-glm) → synthesis (mistral-large)  
**Status:** Pipeline completed with noted gaps (debate proponent paper empty)

---

## SOURCE MATERIALS

### S1: Chrome Extension AI Documentation
**URL:** https://developer.chrome.com/docs/extensions/ai/build-with-ai?utmsource=extsidebar#modernwebguidance
**Fetch Date:** 2026-10-24
**Type:** Web page (HTML)
**Status:** Fetched and saved as `S1_chrome-ai-docs.html`

**Purpose:** Official Chrome documentation on building AI-powered extensions
**Content Focus:** Extension development best practices, AI integration patterns
**Relevance Assessment:** Extension-building knowledge, chrome-devtools-mcp debugging, Chrome Web Store submission metadata

---

### S2: Firefox Desktop Frontend Skill
**URL:** https://github.com/mozilla-firefox/firefox/blob/main/.agents/skills/firefox-desktop-frontend/SKILL.md
**Fetch Date:** 2026-10-24
**Type:** Markdown file
**Status:** Fetched and saved as `S2_firefox-desktop-frontend-skill.md`

**Purpose:** Mozilla's internal agent skill
**Content Focus:** Mach build, design-system tokens, Fluent .ftl, XUL
**Relevance Assessment:** Internal Firefox development workflow, NOT browser automation

---

### S3: Opera Browser CLI (findskills.org)
**URL:** https://findskills.org/skills/operasoftware-opera-browser-cli
**Fetch Date:** 2026-10-24
**Type:** Web page (HTML)
**Status:** Fetched and saved as `S3_opera-browser-cli.html`

**Purpose:** Opera browser automation CLI tool
**Content Focus:** MIT licensed, TypeScript, open/click/fill/screenshot for any Opera session
**Relevance Assessment:** Browser automation skill, requires signed-in Opera Neon session
**Caveats:** 0 stars, 0 forks, documentation sign-in gated

---

### S4: Opera Neon AI Workflow Resource
**URL:** https://www.operaneon.com/resource-hub/build-your-first-ai-browser-automation-workflow
**Fetch Date:** 2026-10-24
**Type:** Web page (HTML)
**Status:** Fetched and saved as `S4_operaneon-workflow.html`

**Purpose:** Opera Neon AI workflow patterns
**Content Focus:** Browser automation workflows, patterns, test-first-then-schedule methodology
**Relevance Assessment:** Useful for workflow patterns, requires Opera Neon installed and signed in

---

## CLAIMS FOR VERIFICATION

### C1: All 4 resources are browser-automation skills foldable into one
**Claim Type:** Architectural assessment
**Extracted From:** User request + source analysis
**Expected Verdict:** To be determined by TypeSafe gate

---

### C2: One interface + multiple backends is coherent
**Claim Type:** Design pattern validation
**Extracted From:** User request + architectural analysis
**Context:** On this PC only Chrome is installed and tested (browser-harness CDP). Opera/Firefox absent. Ports 3002/3003 built but never end-to-end tested.
**Expected Verdict:** To be determined by TypeSafe gate

---

### C3: The Chrome doc provides "the Chrome half" for automation
**Claim Type:** Source content assessment
**Extracted From:** S1 analysis
**Context:** Page targets extension development, not page control. However, it does document chrome-devtools-mcp + remote debugging + --autoConnect to default profile.
**Expected Verdict:** To be determined by TypeSafe gate

---

### C4: Mozilla's firefox-desktop-frontend SKILL.md is an automation skill
**Claim Type:** Source content assessment
**Extracted From:** S2 analysis
**Context:** Mozilla's internal dev-workflow skill for mach build, design-system tokens, Fluent .ftl, XUL. No CDP/WebDriver/agent content.
**Expected Verdict:** To be determined by TypeSafe gate

---

### C5: findskills.org opera-browser-cli is real and installable
**Claim Type:** Resource validation
**Extracted From:** S3 analysis
**Context:** MIT licensed, TypeScript, open/click/fill/screenshot for any Opera session; chat/invoke-do/make/research gated on signed-in Opera Neon.
**Caveats:** 0 stars, 0 forks, docs sign-in-gated.
**Expected Verdict:** To be determined by TypeSafe gate

---

### C6: The Opera Neon stack (OpenClaw + CLI + Neon) is replicable on this PC
**Claim Type:** Environment assessment
**Extracted From:** S4 analysis + system check
**Context:** Requires Opera Neon installed and signed in. Neither exists on this PC (verified 2026-10-24).
**Expected Verdict:** To be determined by TypeSafe gate

---

## PIPELINE NOTES

### Extraction Stage (Agnes 2.5-flash)
**Status:** Initial run failed entirely due to max_tokens bug
**Fix Applied:** Increased max_tokens from 2048 to 8192 (2026-07-09 fix logged in audit_pipeline.py)
**Result:** Second run succeeded, extracted 6 claims

### Deduplication Stage (Mistral embed-2312)
**Status:** Completed successfully
**Threshold:** 0.92 cosine similarity
**Result:** No duplicates found among the 6 claims

### Gate Stage (TypeSafe jev-latest)
**Status:** Completed with verdicts
**Model:** jev-latest via /v1/systemone
**Result:** See verdicts table below

### Debate Stage (Zai-glm-5-3-flash)
**Status:** Completed with gap
**Issue:** Proponent paper came back empty ({})
**Result:** Only opponent + rebuttal exist; judge stage ran on nothing (no verdicts generated)

### Synthesis Stage (Mistral-large-latest)
**Status:** Completed
**Input:** Claims + partial debate + gate verdicts
**Output:** Full register + synthesis + strongest alternative view

---

## VERDICTS REGISTER

| ID | Claim | Verdict | Confidence | Grounds |
|----|-------|---------|------------|---------|
| C1 | All 4 resources are browser-automation skills foldable into one | CONTRADICTED | 0.93 | Only S3/S4 are automation. S1 is extension-building knowledge. S2 has zero automation content. |
| C2 | One interface + multiple backends is coherent | UNPROVEN here | N/A | Architecturally sound, but on this PC only Chrome is installed and tested. Opera/Firefox absent; ports 3002/3003 built but never end-to-end tested. |
| C3 | The Chrome doc provides "the Chrome half" | CONTRADICTED / MIXED | 0.93 | TypeSafe gate: CONTRADICTED. Counterweight: it documents chrome-devtools-mcp + remote debugging + --autoConnect, which is a usable Chrome-control route. Reference module, not automation half. |
| C4 | Mozilla's firefox-desktop-frontend SKILL.md is an automation skill | CONTRADICTED | 1.0 | It's Mozilla's internal dev-workflow skill (mach build, design-system tokens, Fluent .ftl, XUL). No CDP/WebDriver/agent content. Wrong kind of resource. |
| C5 | findskills.org opera-browser-cli is real installable | SUPPORTED | 0.81 | MIT, TypeScript, open/click/fill/screenshot for any Opera session; chat/invoke-do/make/research gated on signed-in Opera Neon. Caveats: 0 stars, 0 forks, docs sign-in-gated. |
| C6 | The Opera Neon stack is replicable on this PC | CONTRADICTED | N/A | Requires Opera Neon installed and signed in. Neither exists here (verified 2026-10-24). |

---

## SYNTHESIS: Strongest Alternative View

**Premise:** The "unified" skill is premature marketing.

**Argument:** Right now it's Chrome-only with two dead backends (Opera/Firefox not installed).

**Counter-Argument:** A capability-detecting dispatcher with dormant stubs IS the unified skill, degrading gracefully until backends arrive.

**Resolution:** The dispute is deployment state, NOT architecture. The architecture (router/dispatcher pattern) is sound.

---

## RECOMMENDATION (User's Favor)

**Structure:** One single skill, shaped like a router

```
browser-ai/ (one SKILL.md, one command surface)
├── Dispatcher layer: capability-detect which backends exist
│   ├── Chrome: existing browser-harness CDP (DebugFull profile) - KEEP, don't reinvent
│   ├── Opera: adopt opera-browser-cli (S3) once Opera is installed
│   │       ports 3002 MCP variant covers the no-Neon path
│   └── Firefox: dormant stub → built port-3003 geckodriver variant
│
└── Reference modules (bundled, not interface)
    ├── Chrome Modern Web Guidance / extension-dev skill (S1)
    └── Opera Neon workflow patterns (S4: test-first-then-schedule, run-in-signed-session)
```

---

## PRIORITIZED NEXT STEPS

1. **Build the browser-ai dispatcher skill** with Chrome live + Opera/Firefox stubs
   - Draft only - NO execution until user has seen the plan
   - RAM check: ~2.6 GB free, under 3 GB gate for Excalidraw/StykFlow
   - Do visualization pass when RAM allows

2. **Install Opera**, run `npx findskills + opera-browser-cli doctor`
   - End-to-end test the port-3002 variant
   - Converts C2 from UNPROVEN to SUPPORTED

3. **If Firefox is wanted**, install it and end-to-end test port-3003 (same pattern)

4. **Fix only when a backend genuinely fails**; don't add a fourth abstraction layer

---

## CHECKPOINT FILES

**Location:** `C:\Users\souro\.vibe\scratch\browser-skill-audit-2026-10-24\`

| File | Purpose |
|------|---------|
| INPUT.md | This file - Claims + source excerpts S1-S4 |
| S1_chrome-ai-docs.html | Fetched Chrome documentation |
| S2_firefox-desktop-frontend-skill.md | Fetched Firefox skill |
| S3_opera-browser-cli.html | Fetched Opera CLI page |
| S4_operaneon-workflow.html | Fetched Opera Neon resource |
| report.md | Full register + synthesis |
| audit_pipeline.py | Patched pipeline script |

**GitHub Backup:** https://github.com/sourovdeb/myde-by-vibe

---

## RESUMPTION GUIDE

**When:** After any backend install/verification
**Action:** Re-audit C2/C6
**Files:** Save updated results here and to GitHub repo
**Task:** Inside pi-cli

---

**Audit Input Complete**  
**Date:** 2026-10-24  
**Pipeline:** mix-of-agents-audit (with noted gaps)  
**Next:** Build dispatcher skill with Chrome live + stubs
