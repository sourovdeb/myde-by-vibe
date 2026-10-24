# Firefox Desktop Frontend Skill

**Source:** https://github.com/mozilla-firefox/firefox/blob/main/.agents/skills/firefox-desktop-frontend/SKILL.md  
**Fetch Date:** 2026-10-24  
**Type:** Markdown file  
**Verdict:** CONTRADICTED - Mozilla's internal dev-workflow skill, NOT automation

---

## Skill: firefox-desktop-frontend

**Purpose:** Mozilla's internal Firefox development workflow automation

**Description:** 
This skill automates Mozilla's internal Firefox desktop frontend development workflow. It handles build system operations, design system tokens, localization files (Fluent .ftl), and XUL UI definitions.

**Target Audience:** Mozilla Firefox developers (internal use)

---

## Capabilities

### Build System
- **mach build** - Build Firefox from source
- **Build configuration** - Manage build options
- **Dependency management** - Handle build dependencies

### Design System
- **Token management** - CSS design tokens
- **Theme generation** - Theme system automation
- **Design system updates** - Keep design system in sync

### Localization
- **Fluent .ftl files** - Localization file management
- **Translation updates** - Localization string updates
- **Locale generation** - Generate locale files

### XUL UI
- **XUL definitions** - UI definition management
- **XUL validation** - Validate XUL files
- **UI component generation** - Generate UI components

---

## Content Analysis

**Automation Content:** ❌ NONE
- No CDP (Chrome DevTools Protocol) support
- No WebDriver support
- No browser agent content
- No page control automation

**Content Type:** Internal development workflow
- Mach build system operations
- Design system management
- Localization file handling
- XUL UI development

---

## Verdict

**CONTRADICTED** (Confidence: 1.0)

**Reason:** This is Mozilla's internal dev-workflow skill for Firefox development. It contains **zero automation content** relevant to browser control, CDP, WebDriver, or agent-based automation. It's the **wrong kind of resource** for a unified browser automation skill.

**Recommendation:** DISCARD for this purpose. This skill is only useful if you're editing Firefox's source tree.

---

**Source:** Mozilla Firefox Repository  
**Path:** `.agents/skills/firefox-desktop-frontend/SKILL.md`  
**Fetched:** 2026-10-24
