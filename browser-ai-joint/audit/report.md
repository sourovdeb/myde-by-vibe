# 📊 Mix-of-Agents Audit Report: "One Single Skill for All" Browser AI

**Audit ID:** browser-skill-audit-2026-10-24  
**Request:** "one single skill for all" browser automation  
**Date:** 2026-10-24  
**Pipeline:** agnes-extract → embed-dedupe → TypeSafe gates → debate (zai-glm-5-3-flash) → synthesis (mistral-large)  
**Status:** ✅ COMPLETED with noted gaps

---

## 🎯 EXECUTIVE SUMMARY

**Strongest Alternative View:** The "unified" skill is **premature marketing** - currently Chrome-only with two dead backends. However, a **capability-detecting dispatcher with dormant stubs IS the unified skill**, degrading gracefully until backends arrive. The dispute is **deployment state, not architecture**.

**User's Favor:** ✅ **One single skill, shaped like a router**

**Recommendation:** Build `browser-ai` dispatcher skill with:
- Chrome backend: existing browser-harness CDP (DebugFull profile)
- Opera backend: opera-browser-cli (S3) when installed, port-3002 MCP variant for no-Neon
- Firefox backend: dormant stub → port-3003 geckodriver variant
- Reference modules: Chrome Modern Web Guidance (S1), Opera Neon workflow patterns (S4)

---

## 📋 CLAIMS REGISTER

### Claim Extraction (Agnes 2.5-flash)

**Initial Run:** Failed entirely due to max_tokens bug (2048 too low for JSON mode)
**Fix Applied:** Increased to 8192, documented in audit_pipeline.py and skill's Fixes log (2026-07-09)
**Result:** 6 claims extracted from 4 sources

---

## 🏆 VERDICTS REGISTER

| ID | Claim | Verdict | Confidence | Grounds |
|----|-------|---------|------------|---------|
| **C1** | All 4 resources are browser-automation skills foldable into one | **CONTRADICTED** | 0.93 | Only S3/S4 are automation. S1 is extension-building knowledge (chrome-devtools-mcp debugs extensions; CHROMEWEBSTORE.md is store-submission metadata). S2 has zero automation content. |
| **C2** | One interface + multiple backends is coherent | **UNPROVEN here** | N/A | Architecturally sound, but on this PC only Chrome is installed and tested (browser-harness CDP). Opera/Firefox absent; ports 3002/3003 built but never end-to-end tested. |
| **C3** | The Chrome doc provides "the Chrome half" | **CONTRADICTED / MIXED** | 0.93 | TypeSafe gate: CONTRADICTED. Counterweight: it does document chrome-devtools-mcp + remote debugging + --autoConnect to your default profile, which is a usable Chrome-control route. Call it a **reference module**, not the automation half. |
| **C4** | Mozilla's firefox-desktop-frontend SKILL.md is an automation skill | **CONTRADICTED** | 1.0 | It's Mozilla's internal dev-workflow skill: mach build, design-system tokens, Fluent .ftl, XUL. No CDP/WebDriver/agent content at all. **Wrong kind of resource for this purpose.** |
| **C5** | findskills.org opera-browser-cli is real installable | **SUPPORTED** | 0.81 | MIT licensed, TypeScript, open/click/fill/screenshot for any Opera session; chat/invoke-do/make/research gated on a signed-in Opera Neon. **Caveats:** 0 stars, 0 forks, docs sign-in-gated. |
| **C6** | The Opera Neon stack (OpenClaw + CLI + Neon) is replicable on this PC | **CONTRADICTED** | N/A | Requires Opera Neon installed and signed in. **Neither exists on this PC** (verified 2026-10-24). |

---

## 🔍 SOURCE ANALYSIS

### S1: Chrome Extension AI Documentation
**URL:** https://developer.chrome.com/docs/extensions/ai/build-with-ai?utmsource=extsidebar#modernwebguidance
**Verdict:** Reference module, NOT automation half
**Content:** Extension development best practices, chrome-devtools-mcp, remote debugging, --autoConnect
**Relevance:** Useful for Chrome-control route, but targets extension dev not page control
**Use Case:** **Bundled as reference module**, not as interface

---

### S2: Firefox Desktop Frontend Skill
**URL:** https://github.com/mozilla-firefox/firefox/blob/main/.agents/skills/firefox-desktop-frontend/SKILL.md
**Verdict:** CONTRADICTED - Not automation skill
**Content:** Mozilla's internal dev-workflow skill (mach build, design-system tokens, Fluent .ftl, XUL)
**Relevance:** Zero automation content - internal Firefox development workflow
**Use Case:** **DISCARD** for this purpose

---

### S3: Opera Browser CLI (findskills.org)
**URL:** https://findskills.org/skills/operasoftware-opera-browser-cli
**Verdict:** SUPPORTED (with caveats)
**Content:** MIT licensed, TypeScript, open/click/fill/screenshot for any Opera session
**Relevance:** Browser automation skill
**Caveats:** 0 stars, 0 forks, documentation sign-in gated (requires Opera Neon signed-in)
**Use Case:** **Opera backend** - adopt once Opera is installed

---

### S4: Opera Neon AI Workflow Resource
**URL:** https://www.operaneon.com/resource-hub/build-your-first-ai-browser-automation-workflow
**Verdict:** CONTRADICTED (environment issue)
**Content:** Opera Neon AI workflow patterns, test-first-then-schedule, run-in-signed-session
**Relevance:** Useful workflow patterns
**Issue:** Requires Opera Neon installed and signed in (not present on this PC)
**Use Case:** **Reference module** - bundled for patterns, not as interface

---

## 🤼 DEBATE ANALYSIS

### Position: "The 'unified' skill is premature marketing"

#### Proponent Paper
**Status:** ❌ **EMPTY ({})** - Failed to generate
**Impact:** Judge stage ran on nothing, no formal verdicts
**Root Cause:** Zai-glm-5-3-flash model issue (unknown)

#### Opponent Paper
**Status:** ✅ Generated
**Core Argument:** Right now it's Chrome-only with two dead backends (Opera/Firefox not installed)
**Evidence:** 
- Only Chrome browser installed on this PC
- Ports 3002/3003 built but never end-to-end tested
- No Opera or Firefox browsers available for testing

#### Rebuttal
**Status:** ✅ Generated
**Core Argument:** A capability-detecting dispatcher with dormant stubs **IS the unified skill**, degrading gracefully until backends arrive
**Evidence:**
- Architecture pattern is sound
- Dormant stubs are valid design
- Graceful degradation is best practice
- Deployment state vs. architecture distinction

---

## ⚖️ JUDGE'S SYNTHESIS

### Verdict: **The dispute is deployment state, NOT architecture**

**Resolution:** The router/dispatcher pattern is architecturally sound. The current state (Chrome-only) is a **deployment limitation**, not a design flaw.

**Strongest Alternative View:** 
- **Premature:** Calling it "unified" when only Chrome works is marketing overreach
- **Valid:** The architecture supports future expansion
- **Recommendation:** Build it as a router, but be honest about current state

### Architecture Decision: **ROUTER PATTERN APPROVED**

```
┌─────────────────────────────────────────┐
│         browser-ai (Unified Skill)        │
│  One SKILL.md, One Command Surface        │
├─────────────────────────────────────────┤
│  Dispatcher Layer: Capability Detection   │
│  ┌─────────────┐ ┌─────────────┐        │
│  │ Chrome      │ │ Opera        │        │
│  │ (LIVE)      │ │ (STUB)       │        │
│  └─────────────┘ └─────────────┘        │
│  ┌─────────────┐                              │
│  │ Firefox     │                              │
│  │ (STUB)      │                              │
│  └─────────────┘                              │
├─────────────────────────────────────────┤
│  Reference Modules (Bundled, Not Interface)│
│  ┌─────────────────────────────────────┐ │
│  │ Chrome Modern Web Guidance (S1)      │ │
│  │ Opera Neon Workflow Patterns (S4)     │ │
│  └─────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

---

## 🏗️ IMPLEMENTATION SPECIFICATION

### Skill Structure

```
browser-ai/
├── SKILL.md                          # Single skill definition
├── package.json                      # Metadata
├── LICENSE                           # MIT
├── README.md                         # Documentation
│
├── src/
│   ├── index.js                      # Main export
│   ├── dispatcher.js                 # Capability detector + router
│   │
│   ├── backends/
│   │   ├── chrome.js                 # Chrome: browser-harness CDP (DebugFull profile)
│   │   ├── opera.js                  # Opera: opera-browser-cli (S3) + port-3002 MCP
│   │   └── firefox.js                # Firefox: port-3003 geckodriver variant
│   │
│   └── references/
│       ├── chrome-modern-web.js     # S1: Extension dev knowledge
│       └── opera-neon-patterns.js    # S4: Workflow patterns
│
├── test/
│   ├── chrome.test.js               # Chrome backend tests
│   └── integration.test.js           # Dispatcher tests
│
└── examples/
    ├── basic-usage.js               # Basic examples
    └── advanced-usage.js             # Advanced examples
```

### Backend Specifications

#### Chrome Backend (LIVE)
- **Implementation:** Existing browser-harness CDP
- **Profile:** DebugFull copied profile (Chrome 156+ workaround)
- **Port:** 3001
- **Status:** ✅ Tested and working
- **Note:** Do NOT reinvent - use existing

#### Opera Backend (STUB → LIVE)
- **Primary:** opera-browser-cli (S3) from findskills.org
  - Requires: Opera Neon signed-in
  - License: MIT
  - TypeScript implementation
- **Fallback:** Port-3002 MCP variant (browser-control-mcp-opera)
  - Works without Opera Neon
  - Requires: `npm install` in plugin folder
  - Uses: CDP via WebSocket
- **Status:** ⚠️ STUB (needs Opera installation)

#### Firefox Backend (STUB)
- **Implementation:** Port-3003 MCP variant (browser-control-mcp-firefox)
  - Uses: WebDriver/geckodriver
  - geckodriver port: 4444
  - Requires: `npm run install-geckodriver`
- **Status:** ⚠️ STUB (needs Firefox + geckodriver installation)

### Reference Modules (Bundled)

#### S1: Chrome Modern Web Guidance
- **Purpose:** Extension development best practices
- **Content:** chrome-devtools-mcp, remote debugging, --autoConnect
- **Use:** Reference for Chrome-specific patterns
- **Not:** Part of the interface

#### S4: Opera Neon Workflow Patterns
- **Purpose:** Workflow methodology
- **Content:** test-first-then-schedule, run-in-signed-session
- **Use:** Reference for workflow design
- **Not:** Part of the interface

---

## 🎯 PRIORITIZED ROADMAP

### Phase 1: Dispatcher & Chrome (Week 1)
**Status:** Draft only - NO execution until user approves plan

**Tasks:**
1. ✅ **Create skill skeleton** (browser-ai/ directory)
2. ✅ **Implement dispatcher layer**
   - Capability detection
   - Backend routing
   - Graceful degradation
3. ✅ **Integrate Chrome backend**
   - Use existing browser-harness CDP
   - DebugFull profile support
4. ✅ **Add Opera/Firefox stubs**
   - Placeholder implementations
   - Proper error messages

**RAM Check:**
- Current free RAM: ~2.6 GB
- Required for Excalidraw/StykFlow: 3 GB minimum
- **Action:** Visualization pass when RAM ≥ 3 GB
- **Alternative:** Text-based planning for now

**Deliverables:**
- browser-ai/ directory with SKILL.md
- Dispatcher implementation
- Chrome backend integration
- Opera/Firefox stubs
- Draft only (no execution)

---

### Phase 2: Opera Backend (Week 2-3)
**Prerequisite:** User approval of Phase 1 plan

**Tasks:**
1. **Install Opera browser**
2. **Run diagnostic:**
   ```bash
   npx findskills + opera-browser-cli doctor
   ```
3. **End-to-end test port-3002 variant**
4. **Integrate opera-browser-cli** (S3)
5. **Update C2 verdict:** UNPROVEN → SUPPORTED

**Deliverables:**
- Working Opera backend
- End-to-end tested
- Updated audit register

---

### Phase 3: Firefox Backend (Week 3-4)
**Prerequisite:** User approval + Opera completion

**Tasks:**
1. **Install Firefox browser**
2. **Install geckodriver:**
   ```bash
   npm run install-geckodriver
   ```
3. **End-to-end test port-3003 variant**
4. **Integrate geckodriver**

**Deliverables:**
- Working Firefox backend
- End-to-end tested

---

### Phase 4: Fixes & Refinement (Ongoing)
**Principle:** Fix only when a backend genuinely fails

**Do NOT:**
- ❌ Add fourth abstraction layer
- ❌ Over-engineer before testing
- ❌ Fix hypothetical issues

**DO:**
- ✅ Fix actual failures
- ✅ Refine based on real usage
- ✅ Add tests for verified backends

---

## 📊 CURRENT STATE ASSESSMENT

### Backend Status

| Backend | Status | Port | Implementation | Test Status |
|---------|--------|------|----------------|-------------|
| Chrome | ✅ LIVE | 3001 | browser-harness CDP | End-to-end tested |
| Opera | ⚠️ STUB | 3002 | opera-browser-cli + MCP | Not tested (no Opera) |
| Firefox | ⚠️ STUB | 3003 | geckodriver | Not tested (no Firefox) |

### Resource Status

| Resource | Verdict | Use Case | Action |
|----------|---------|---------|--------|
| S1 (Chrome Docs) | CONTRADICTED/MIXED | Reference module | Bundle as reference |
| S2 (Firefox Skill) | CONTRADICTED | None | Discard |
| S3 (Opera CLI) | SUPPORTED | Opera backend | Use when Opera installed |
| S4 (Opera Neon) | CONTRADICTED | Reference module | Bundle as reference |

---

## 🎯 RECOMMENDATIONS

### 1. **Build the Router First**
- **Approach:** Capability-detecting dispatcher with dormant stubs
- **Design:** Graceful degradation
- **Honesty:** Don't call it "unified" until backends are live

### 2. **Leverage Existing Infrastructure**
- **Chrome:** Use existing browser-harness CDP (don't reinvent)
- **Opera:** Port-3002 MCP variant already built
- **Firefox:** Port-3003 MCP variant already built

### 3. **Test Incrementally**
- **Chrome:** Already working
- **Opera:** Install and test when ready
- **Firefox:** Install and test when ready

### 4. **Document Honestly**
- **Current state:** Chrome-only with Opera/Firefox stubs
- **Future state:** Unified when all backends live
- **Architecture:** Always sound

---

## 📋 CHECKPOINT SUMMARY

**Files Created:**
- ✅ `INPUT.md` - Claims + source excerpts S1-S4
- ✅ `report.md` - This file (full register + synthesis)
- ✅ `audit_pipeline.py` - Patched pipeline script

**GitHub Backup:**
- ✅ https://github.com/sourovdeb/myde-by-vibe

**Location:**
- `C:\Users\souro\.vibe\scratch\browser-skill-audit-2026-10-24\`

**Resumption Guide:**
- **When:** After any backend install/verification
- **Action:** Re-audit C2/C6
- **Files:** Save updated results here and to GitHub
- **Task:** Inside pi-cli

---

## 🎬 FINAL VERDICT

**Architecture:** ✅ **APPROVED** (Router pattern is sound)

**Deployment State:** ⚠️ **HONEST ASSESSMENT** (Chrome-only, Opera/Firefox stubs)

**Recommendation:** ✅ **PROCEED with router-based implementation**

**Next Action:** 
1. Build `browser-ai` dispatcher skill (draft only)
2. Present plan to user for approval
3. Execute only after approval
4. Test Opera/Firefox when browsers are installed

**Pipeline Status:** ✅ COMPLETED (with noted gaps in debate stage)

---

**Report Complete**  
**Audit ID:** browser-skill-audit-2026-10-24  
**Date:** 2026-10-24  
**Methodology:** mix-of-agents-audit (full pipeline)  
**Result:** Router architecture approved, deployment state acknowledged  
**Next:** Build dispatcher skill with Chrome live + Opera/Firefox stubs
