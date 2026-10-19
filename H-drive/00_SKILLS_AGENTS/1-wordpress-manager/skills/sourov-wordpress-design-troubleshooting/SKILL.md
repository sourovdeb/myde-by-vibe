---
name: sourov-wordpress-design-troubleshooting
description: Audit, design, and troubleshoot Sourov Deb's WordPress site with an accessible mind-map homepage, safe evidence collection, and production-preserving handoffs. Use for sourovdeb.com design changes, theme audits, layout problems, route regressions, or publishing troubleshooting; do not use for unrelated WordPress sites or autonomous deployment.
---

# Sourov WordPress design and troubleshooting

Use this skill for preparation and review work on `https://sourovdeb.com/` and its `www` variant. Keep production unchanged until the user explicitly authorizes the named operation. Theme approval is separate and the accepted phrase is `DEPLOY THE REVIEWED THEME`.

## Credential boundary
Read credentials from `C:\Users\souro\wordpress-publishing.env` only inside local authenticated tooling. Expected names are `WP_SITE`, `WP_USERNAME`, `WP_APP_PASSWORD`, `FTP_HOST`, `FTP_USER`, `FTP_PASSWORD`, and `DEPLOY_KEY`. Never print values, place them in URLs, embed them in theme files, commit them, or include environment files in archives. Prefer encrypted Hostinger access; never use plaintext FTP. Public checks must work without credentials.

## Evidence-first workflow

1. Read applicable `AGENTS.md` and any requested skill. Treat live state as evidence, not assumption.
2. Discover the canonical hostname by checking both hostnames and canonical tags. Record status, redirects, TLS, WordPress version, PHP version, active theme, plugins, cache headers, and sitemap/robots owners.
3. Prove the active theme through authenticated REST and the expected Hostinger path. Inspect archive contents before choosing a source; `sourov-theme-a` and any `SOUROV~3.ZIP` copy are rollback-only unless inspection proves otherwise.
4. Snapshot before editing: full active theme with timestamps, homepage HTML, REST JSON, loaded assets, file listing, hashes, and extraction test. Keep database state and file recovery coverage explicit; a theme ZIP is not a database backup.
5. Work in a timestamped isolated copy with a pristine version-control commit. Trace every homepage block to its template, hook, query, or asset before changing it.
6. Validate changed files, routes, metadata, assets, security boundaries, and responsive behavior. Report `PASS`, `FAIL`, or `NOT_TESTED`; do not infer browser or audience results from static code.
7. Package source and repaired ZIPs plus an audit, change manifest, validation report, rollback procedure, state, URL ledger, hashes, and screenshot evidence when a browser exists. Stop before deployment unless the exact approval gate is satisfied.

A browser always exists on this PC: the `browser-harness` skill drives Sourov's real Chrome (navigate with `new_tab(url)`, extract with `js(...)`, capture with `capture_screenshot(path)`). If Chrome is not running, launch it detached with `powershell.exe -Command "Start-Process 'C:\Program Files\Google\Chrome\Application\chrome.exe'"` — never `chrome.exe &` from Git Bash. Screenshots fail on `chrome://` pages; use them for sourovdeb.com routes and rendered layouts.

## Design contract

Make the homepage a calm, readable mind map. Use six linked topics: Sourov, Writing, Teaching, Research, Media, Tools. Use visible SVG connectors, large readable labels, no automatic motion, and a simple linear fallback. Each topic must remain a normal link without JavaScript. Spatial rearrangement is optional and must be explicitly enabled.

Design for a mixed audience that includes young students, people with attention difficulties, and older adults without assigning preferences by diagnosis. Keep body text at least 17px (18px is preferred), labels at least 12px, node text at least 18px, navigation at least 14px, and serif headings within `clamp(40px, 6vw, 64px)`. Use the palette `#E7E7E4`, `#F4F4F1`, `#B8B8B3`, `#202020`, `#171717`, `#164CFF`, and `#444444`.

Provide a simple-list view, clear labels, 44px-or-larger controls, visible focus, reduced-motion behavior, and no horizontal overflow. Dragging must never be the only way to operate the map: provide single-pointer move controls and keyboard arrows. Separate click from drag with a movement threshold. Persist positions only in localStorage, clamp nodes within the canvas, and provide reset. Avoid autoplay, decorative movement, pastel low-contrast text, rounded card clutter, and hidden interactions.

Homepage content should contain six recent posts and six pillars. Keep full categories, search, pagination, canonical URLs, post IDs, taxonomy, metadata hooks, structured data, and content intact; move dense archives to their archive/search surfaces.

## Troubleshooting priorities

Treat availability and publishing as higher priority than visual polish. For a route, inspect the actual response class and body: retained articles should be 200 with content; intentional removals can be 404/410; moved content needs a verified equivalent 301/308; an invented path should remain 404. Never send every 404 home, return a 200 error page, open protected routes, or alter redirects, DNS, robots, sitemaps, categories, or verification records as a theme fix.

For layout defects, measure document overflow rather than guessing. Check desktop and mobile widths 360, 390, 768, 1024, 1366, and 1920px. Check focus, keyboard, pointer, touch, reduced motion, no-JavaScript navigation, console errors, mixed content, canonical tags, search, category archives, pagination, and representative posts. Use an isolated browser fixture only as a supplement; WordPress runtime testing is still required.

## Reporting

State the outcome first. Include evidence inspected, root cause, exact changed files and hashes, tests performed, unresolved gaps, rollback timing, and deployment decision. Distinguish observed, inferred, and unknown facts. Mention when a skill or browser limitation affected the result. Never claim screenshots, restoration, deployment, user testing, monitoring, indexing, or AI visibility that was not actually performed.

For evidence standards and audience decisions, read [references/audience-and-evidence.md](references/audience-and-evidence.md). For the operational handoff and deliverable checklist, read [references/operations-checklist.md](references/operations-checklist.md).
