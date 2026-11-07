# Forensic Site Audit - sourovdeb.com

Date: 2026-11-07 (Indian/Reunion, UTC+4). Auditor: Vibe (Mistral) via WordPress MCP (read-only bridge) and public HTTP checks.
Method: full-content link extraction from all 58 pages and all 1,366 posts (WP REST, edit context, raw columns), all 4 navigation menus, classification against the complete published inventory, live HTTP verification of every suspect URL against the site's 404 signature ("Page not found - That path is missing").
Scope limits: Bing SERP blocked automated access, so Bing's index count is unverified. Google index counts come from the Oct 16, 2026 Search Console export recorded in INDEXING_RECOVERY_PLAN.md, not from a live GSC read (the GSC provider in Easy MCP AI is not connected). Media files other than one PDF could not be content-verified (binary). Theme-template links outside the DB (widgets, footer code) were not crawled.

## 1. Bottom line

The site is up, healthy (0 critical Site Health items), running the PHP build that patches the October 2026 PHP2Shell critical flaws (8.3.36), and its public navigation and category structure are intact. Two things need action this week: (a) 7 confirmed broken links on published pages (4 dead travel posts, 3 links to private posts), and (b) the W1 question in INDEXING_RECOVERY_PLAN.md is now moot in its original form: the trash is already empty (0 posts in trash on Nov 7, vs 551 on Oct 19), and it is unverified whether the 301 redirect map for the 507 deleted ELT365 duplicates was created before the permanent purge. That verification is the single highest-priority open item for indexing recovery.

## 2. Platform state (evidence: WP MCP, Nov 7, 2026)

- WordPress 7.1.4, PHP 8.3.36 (64-bit), Linux, memory_limit 1536M, curl 8.22.0.
- Site Health: 23 good, 3 recommended, 0 critical. Recommended: remove 1 inactive-plugin update backlog (Easy MCP AI 2.2.2, update to 2.4.0 pending), remove inactive themes (7 of 9), enable a persistent object cache.
- Error log (error_log ini, 165 KB, last write Nov 7 05:32 UTC): 395 of 395 returned lines are the same warning: "Constant WP_DEBUG already defined in wp-config.php on line 36". This is a duplicated define in wp-config.php, and it means debug constants are being set twice. Fix: delete the duplicate define (keep one). No fatal PHP errors in the returned window.
- WP-Cron: DISABLE_WP_CRON is set (cron_disabled: true), 41 scheduled events, 0 overdue, 0 malformed. LiteSpeed Cache (7.9.3) handles triggering. Scheduled publishing is working (4 posts in future status).
- Plugins active: LiteSpeed Cache 7.9.3, Site Kit by Google 1.191.0, Bing Webmaster Url Submission 1.0.13, Easy MCP AI 2.2.2 (update 2.4.0 available), plus 8 Sourov custom plugins and the Vibe MCP Bridge 1.2.0. Inactive: Hostinger Smart Auto Updates, Sourov Map Control. Must-use: 7 (Header Particle Field, Library Motion, Living Cube Swap, Sudoku x2, Technical Visibility Monitor, Clear Start).
- Themes: active "Sourov Living Map Repair" 1.5.1-refine.1; 8 installed, 7 inactive.
- Site identity: site_icon = 0 and site_logo = null (no favicon or logo set; affects branded appearance in search results, browser tabs, and app icons).
- Menus: 4 menus exist; none is assigned to a theme location (locations all empty; the theme presumably hardcodes its navigation). "Header Nav 2" (9 items) and "Footer Nav" (13 items) pass all link checks. "Header Nav BACKUP 2026-08-05" contains 3 dead links to trashed pages. "Sourov Topics 2026" is empty.

## 3. Full internal link audit (Nov 7, 2026)

Coverage: 58 pages + 1,366 posts (782 publish, 630 draft, 8 private, 4 future) + 4 menus. 2,040 unique hrefs extracted (1,441 external, 225 anchors/mailto, internal classified below).

Results:
- All 18 category archive URLs used in content: live and correct (verified by fetch, titles match).
- robots.txt (updated 2026-10-16): correct, allows search and AI-search crawlers, declares sitemap. wp-sitemap.xml index live with 4 child sitemaps (posts, pages, categories, tags).
- Homepage: loads, title "Sourov DEB - Learn, Teach, Understand".
- Media spot check: read-for-meaning-workbook-v1-1.pdf loads with correct content. The 4 DxO .mp4 files return binary (content not verifiable through this tool; no 404 signature).

### 3.1 Confirmed broken links on published pages (public visitors get 404)

| Broken URL | Linked from | Evidence |
|---|---|---|
| /padua-bologna-ravenna-cinque-terre-days-40-46/ | Page 2613 /my-daily-journal/journal-europe-travel/ (published) | live fetch returns 404 signature; no such post in inventory |
| /florence-rome-italy-days-47-51/ | same page (2 occurrences) | 404 confirmed |
| /vienna-salzburg-graz-austria-days-30-36/ | same page | 404 confirmed |
| /ljubljana-slovenia-days-37-39/ | same page | 404 confirmed |
| /how-to-create-micro-entreprise-english-teacher-france-step-by-step-2026/ | Page 2616 journal-creator-life, post 3236 teaching-english-edge-of-the-map (both published) | target post 2811 is private; live fetch returns 404 |
| /comment-creer-micro-entreprise-prof-anglais-etape-par-etape/ | Page 2616, post 151 top-job-contacts (published) | target post 2809 is private; live fetch returns 404 |
| /wordpress-remote-control-publishing-automation-tools/ | Page 2614 journal-photo-software (published) | target post is private; live fetch returns 404 |

Fix options: restore the targets to publish, or edit the three pages to point at live equivalents, or add redirects. The two micro-entreprise guides are the intentional EN/FR pair named in INDEXING_RECOVERY_PLAN.md W3; deciding publish vs redirect is a content decision, not an automation one.

### 3.2 Backup menu dead links (low priority, not visitor-facing)

Menu "Header Nav BACKUP 2026-08-05" (id 5) links to ?page_id=3838, ?page_id=3787, ?page_id=6833. Those three pages are currently in trash (verified Nov 7). Either delete the backup menu or restore the pages deliberately.

### 3.3 Draft-content hazards (not public today, will break on publish)

About 100 hrefs inside 630 draft posts point to deleted page IDs in the 3640-3760 range (?page_id=3640, 3660 x26, 3672 x17, 3675 x13, 3682 x13, and roughly 60 more). Affected draft families: old Open Teacher Training drafts, history-in-40-stories, FML series, rigorous-review series, critical-thinking series, browser-games, five-minute-english-lab. None of these drafts can be published without link repair. Full list: data/broken-links-2026-11-07.csv (column scope=draft).

### 3.4 Cosmetic

36 links to "https://sourovdeb.com" without trailing slash (from LLFE posts) and a few /#library anchors. Harmless; normalize opportunistically.

## 4. Index and search visibility

- Third-party web index (Brave, Nov 7): sourovdeb.com pages are indexed and ranking for their titles (ELT365 day posts, tag archives, ELT Masterclass, pronunciation lessons). Sample verified via search; this proves crawlability and indexability of current content, not Google's own index state.
- Google: no live GSC read was possible. The GSC data provider exists in Easy MCP AI ("Google Search Console", wp-admin: Easy MCP AI > Tools > External data) but is not connected. Enabling it gives this MCP direct indexed/not-indexed, impressions, and URL-inspection data. Last known state (Oct 16 export, from INDEXING_RECOVERY_PLAN.md): 2,325 indexed, 1,690 not indexed, impressions down 73% since July.
- Bing: bing.com SERP blocks automated access, so no live count. The Bing Webmaster Url Submission plugin is active (it pushes URLs to Bing on publish). IndexNow enablement (plan W5) remains open.
- W1 status change (important): trash held 551 posts on Oct 19 (dedup manifest) and ~550 on Oct 22 (plan). On Nov 7 the post trash is empty (0; pages trash holds 3). The permanent purge happened before the ~Nov 18 WP auto-purge, and the MCP audit log shows no bulk post-deletion through MCP tools after Oct 22, so the purge was done by another actor (wp-admin, WP-CLI, or a site plugin). Whether the 301 redirect map from the 507 duplicate URLs to their 61 canonicals was created first is UNVERIFIED, and the slug mapping source (the trashed posts) is gone. Verification now requires: (1) export the redirect rules from the active redirect owners (Sourov Index Hygiene, Sourov Library Redirect, or Rank Math redirections if present) and confirm 507 mappings exist, and/or (2) pull the next GSC export and check whether the "page with redirect" and "not found" classes are falling or whether the deleted URLs now hard-404. If no redirect map exists, the practical remedy is to reconstruct mappings from search-engine caches of the deleted URLs and add redirects, accepting some loss.
- Hostname: WP home/siteurl is https://sourovdeb.com (non-www). The www hostname also serves the site's homepage content (Nov 7 fetch). Whether www 301-redirects to the bare domain was not determinable through the available fetch tool; check with curl -I https://www.sourovdeb.com/ and, if it returns 200 rather than 301, add the redirect at the server/LiteSpeed level to protect canonicalization.

## 5. New laws, policies, and news since the Oct 22 plan

- PHP2Shell (CVE-2026-109619 and a second flaw), Oct 21, 2026: unauthenticated RCE in the PHP runtime; CISA and NSA advisories; sites worldwide taken offline. Fixed in PHP 8.3.36 (also 8.2.35, 8.4.27, 8.5.12). This site runs 8.3.36, so it is on the patched build (verified Nov 7). Keep Hostinger PHP auto-updates enabled; do not pin below the patched line.
- EU AI Act: enforcement powers (including fines) active since Aug 2, 2026. For this site the relevant duties are transparency if AI-generated content is offered as a service; no direct obligation identified for a free content site today.
- Digital Markets Act: the EU ordered Google to share data with rival search engines and open Android to AI rivals; Google appealed Sep 29, 2026. Watch outcome: it may diversify search traffic sources beyond Google.
- Google policy changes (dated): back-button hijacking explicitly a spam violation (announced Apr 13, 2026, enforcement from Jun 15, 2026); June 2026 spam update (content-level); site reputation abuse policy update (Aug 2026); FAQ rich results retired (May 2026); October 2026 documentation updates (URL structure guidance, content controls, UGC Fresh Data Program, Indexing API quota); AI Mode now shows more prominent source links (Oct 15, 2026), which rewards clean indexed canonical pages. No new spam update found after August 2026 in Nov 7 searches.
- European Accessibility Act (applies since Jun 28, 2025; France transposition): penalties up to 7,500 EUR per breach (5th-class offence, DGCCRF enforcement). Direct scope is services and e-commerce; a free teacher-training content site is not clearly in scope, but if paid services or a shop are added, an accessibility statement and WCAG 2.1 AA audit become advisable. Track when the site starts selling anything.
- Keep-alive practice (2026 guidance, multiple sources): backups in three locations with restore tests, SSL expiry watch (Let's Encrypt ~90-day cycles), PHP supported ~4 years per branch, database cleanup (drafts, spam), Core Web Vitals checks. The site already has: LiteSpeed cache, daily-ish cron hygiene, 0 overdue events.

## 6. Prioritized actions

1. Today, this week (owner: Sourov, wp-admin): verify the 507-redirect map (Section 4, W1 status change). This gates the entire indexing recovery plan.
2. Fix the 7 public broken links (Section 3.1). Decide publish vs redirect for the EN/FR micro-entreprise pair.
3. Remove the duplicate WP_DEBUG define (wp-config.php line 36 area) to stop the log spam; then confirm the log stays quiet.
4. Update Easy MCP AI 2.2.2 to 2.4.0 (pending update; the connector bridge showed 401/502 responses under load on Nov 7, which may be fixed by the update, and an outdated bridge is also a mild security exposure).
5. Connect the GSC provider in Easy MCP AI, then record the four W6 metrics (indexed, not-indexed, impressions, clicks) in the metrics file.
6. Set site icon (favicon) and logo in wp-admin (branding in search results).
7. Delete the stale "Header Nav BACKUP 2026-08-05" menu or restore its 3 trashed pages deliberately; delete the empty "Sourov Topics 2026" menu.
8. Delete unused themes (7) and the 2 inactive plugins.
9. Check www canonicalization with curl -I; add a 301 to the bare domain if missing.
10. Before publishing any old draft (Open Teacher Training, history, FML, rigorous-review, critical-thinking families), repair the ?page_id=36xx links (Section 3.3, full list in the CSV).
11. Ongoing: follow sessions/2026-11-07-keepalive-checklist.md.

## 7. Open unknowns

- Bing index count (blocked to automated access; needs Bing Webmaster Tools, plan W5).
- Live Google index/impression numbers (needs GSC connection).
- Whether the 507-redirect map exists (Section 4).
- www redirect behavior (needs curl -I).
- DxO .mp4 files: presence not content-verified.

## 8. Sources

- Live WordPress state via Easy MCP AI REST bridge (read-only token), Nov 7, 2026: Site Health, error log, cron, plugins, themes, menus, pages, posts (all 1,366), site settings, audit log, trash counts, disabled-tools list.
- Live HTTP fetches via open_url, Nov 7, 2026: homepage, 404 signature page, 4 dead travel URLs, 3 private-target URLs, 18 category archives, robots.txt, wp-sitemap.xml, www variant, workbook PDF.
- INDEXING_RECOVERY_PLAN.md and elt365-dedup-manifest.md, this repository (Oct 16-22, 2026 data).
- Sourov Living Map Operations Handoff (rev 2, 2026-09-19), user document library (Website related files).
- News and policy: thehackernews.com PHP2Shell patched versions (Oct 2026); CISA alert (Oct 21, 2026); CERT-EU advisory 2026-018; PHP Foundation release note (Oct 21, 2026); AFP Google AI Mode links (Oct 15, 2026); AFP EU AI Act enforcement (Aug 1-2, 2026); AFP Google DMA appeal (Sep 29, 2026); Google Search Central spam policies and documentation updates (Apr/May/Jun/Aug/Oct 2026); EAA France penalty summaries (odeet.fr, levelaccess.com, imacservices.fr); website maintenance guidance 2026 (bluehost.com, gravitatedesign.com, cloudpicked.com, alphonsolabs.com, walkupdigital.com, howdytech.io).
