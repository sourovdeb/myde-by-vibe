# Session 2026-11-06 - sourovdeb.com forensic audit (Vibe, WordPress MCP)

Scope: full forensic QC - site health, error log, cron, all internal links,
index status (Google/Bing), new law/policy landscape, keep-alive research.
Read-only except this commit. Sources: WP MCP (site-health-review skill flow),
live URL fetches (all sitemap URLs), web/news search, this repo, doclib libraries.

## Site Health (WP 7.1.4, PHP 8.3.36, LiteSpeed, MariaDB 11.8.9)

- 0 critical, 23 good, 3 recommended (same three as Oct 25):
  1. Remove 2 inactive plugins (Hostinger Smart Auto Updates duplicate copy; Sourov Map Control).
  2. Remove 7 inactive themes.
  3. Enable persistent object cache - host reports Redis available.
- IMPROVED vs Oct 25: page cache now detected (LiteSpeed Cache 7.9.3 active, x-litespeed-cache + etag), median server response 9 ms (was 102 ms). WP core 7.1.4 and Site Kit 1.191.0 current. Opcode cache healthy (97.5% hit).
- 1 pending plugin update: Easy MCP AI 2.2.2 -> 2.4.0. wp_update_plugin is OFF for this MCP connection (Easy MCP AI > Settings > Advanced > Disabled tools), so apply in wp-admin > Updates. Update the connector from wp-admin, not from inside an MCP session it powers.

## Error log (error_log_sourovdeb_com, 646 KB)

- NEW, flooding: "PHP Warning: Constant WP_DEBUG already defined in wp-config.php on line 33" on most requests today (03:30-05:25 UTC window). Line moved 33 -> 36 at ~04:44 UTC today, so wp-config.php was edited today and still carries the duplicate define. This is the exact "PHP warning appears" rollback trigger in the Operations Handoff. Fix: delete the second WP_DEBUG define in wp-config.php; then truncate the log.
- STALE (no recurrence since Oct 22): wp_rank_math_redirections queries (last Oct 15), "Commands out of sync" MySQL shutdown-cron errors (last Oct 22), cron could_not_set on sourov_visibility_submit_indexnow / action_scheduler_run_queue (last Oct 17). Treat as apparently resolved; re-grep at next review before closing.

## Cron and publishing

- DISABLE_WP_CRON true (Hostinger system cron). 42 events, 0 overdue, 0 malformed timestamps. Scheduled publishing works: 5 future posts queued (Bratislava Nov 6, Vienna Nov 10, Ljubljana Nov 13, Padua Nov 17, Florence/Rome Nov 20).
- URGENT CARRIED DEADLINE: WordPress purges the ~507 trashed ELT365 duplicates around Nov 18, 2026. W1 redirects must exist before the purge or the manifest mapping is lost permanently. 12 days remain at time of writing.

## Internal link check - full crawl (301 URLs, all live fetches)

- ALL 53 pages (incl. home) from wp-sitemap-posts-page-1.xml: load (200).
- ALL 22 category archives: load.
- ALL 225 posts in wp-sitemap-posts-post-1.xml: load, including emoji-slug and percent-encoded URLs.
- 15 of 81 tag archives sampled (first/middle/last): all load.
- llms.txt (200), sitemap.xml (200, points to wp-sitemap.xml), robots.txt (updated 2026-10-16, sitemap pointer correct).
- Crawl methodology note: 54 parallel requests triggered host rate-limiting ("Too many requests"); sequential pacing works. Keep future audits sequential.
- BROKEN LINKS FOUND:
  - Backup menu "Header Nav BACKUP 2026-08-05" (53 items, no theme location assigned): 7 dead targets - /orwell-all-art-performance-reading-studio/, /?page_id=3838, /?page_id=3787, /anna-karenina-reading-studio-2/, /dostoevsky-gentle-creature-book-reading-lab/, /dostoevsky-gentle-creature-audiobook-guide/, /?page_id=6833 (Particle Field lives at /particle-field/). Not user-facing; delete the backup menu or fix its links.
  - Still-404 stale indexed URLs (carried from Oct 25): /category/personal-life-blogs/, /category/photography-video-tutorials-travel-tips/, /silkypix-review-tutorial/, /learn_ai/, /media/. /privacy-policy-2/ now 404s (Oct 25 it served duplicate content) - the duplicate is gone but there is no 301 to /privacy-policy/.
- QC note: two Open Teacher Training unit pages are near-stubs vs their siblings: M03-U01 (976 chars) and M09-U02 (1057 chars); siblings run 16k chars.

## SERIOUS DEFECT: sitemap coverage collapse

- WordPress: 728 published posts. Posts sitemap: 225 URLs. ~503 published posts are missing.
- Confirmed missing: all 30 most recent posts (100 Days in Europe parts 1-19, all DxO PhotoLab tutorials, Aug 2026 lesson series, recent essays). Zero travel or photography URLs in the sitemap.
- The missing posts load fine and are canonical, unique, long-form - exactly what W4 of INDEXING_RECOVERY_PLAN.md says the sitemap must contain ("only canonical, indexable URLs").
- Cause: sourov-index-hygiene v1.2.0 "sitemap trimmed" logic (W2) over-excludes - likely category- or date-based. This starves new content of sitemap-driven discovery; Google is not an IndexNow participant, so the sitemap is the main fresh-content signal. Some posts are indexed anyway (third-party index serves Geneva Part 1, Photography 03/04), but coverage of everything since ~Oct 15 is at risk.
- Fix first: audit the exclusion rules in sourov-index-hygiene, re-include all published canonical posts, reping IndexNow, resubmit sitemap in GSC/Bing. If any exclusion is intentional, document it in the plan.

## Index status

- Third-party search index serves sourovdeb.com results (homepage, ELT Masterclass, individual posts, tag archives) - site is indexed and retrievable.
- Direct Google/Bing SERP fetches remain blocked to automated access; GSC/Bing Webmaster counts NOT ASSESSABLE from this session.
- Google Search Console integration exists but is OFF: wp-admin > Easy MCP AI > Tools > External data > Google Search Console. Enable it so future audits pull real coverage numbers (indexed, impressions, sitemaps, URL inspection). Site Kit reports Search Console property https://sourovdeb.com/ connected.
- Bing: Url Submission plugin 1.0.13 active; IndexNow cron hook present (sourov_visibility_submit_indexnow). Bing indexed count > 0 (W5) still unverified.
- Site Kit email reports: enabled, deliverability "all-sent", but LAST SENT 2026-08-01 - three months silent. Suspect the googlesitekit_email_reporting_cleanup invalid_schedule error (Jul 30). Reconnect Site Kit (user status shows not authenticated for the MCP user) and verify the next monthly report arrives.

## New law/policy landscape (since last audit)

- EU AI Act Article 50 transparency obligations apply since 2 Aug 2026 (Cooley; artificialintelligenceact.eu): AI chatbots must disclose they are machines; synthetic content must carry machine-readable marking (grace until 2 Dec 2026 for systems on market before 2 Aug); deepfakes labelled. If Sourov Agent serves AI chat to visitors, add a clear "you are talking to an AI" disclosure. Fines up to EUR 15M / 3% turnover.
- GDPR/consent: GA4 runs on the site with Consent Mode enabled but no consent banner / CMP (WP Consent API not detected). CNIL treats analytics cookies as requiring consent. Either add a CMP or accept the measured risk; EU digital-rights groups are pushing to abolish cookie banners (AFP, Sep 10, 2026), but the law has not changed yet.
- Google AI Mode now surfaces more source links higher in AI answers (AFP, Oct 15, 2026) - indexed, canonical pages earn AI-era visibility; another reason the sitemap defect matters.
- Meta delayed its news-scraping business terms after outcry (AP, Nov 2, 2026) - scraping/grounding landscape still moving; keep robots.txt policy (training crawlers currently allowed) under periodic review.
- Google spam policies (updated Aug 28, 2026) unchanged in substance since the last audit: scaled content abuse remains the most-enforced policy; manipulating AI responses is spam. The W3 consolidation path is still the compliance route.

## Keep-alive / maintenance (2026 consensus, applied to this site)

Already in place: Hostinger managed auto-updates (mu-plugin), LiteSpeed page cache (new), Site Kit monitoring, IndexNow submissions, working scheduled-post pipeline, robots/sitemap hygiene plugins.
Add/verify: Redis persistent object cache (host supports it; Site Health recommendation), monthly GSC + Bing Webmaster coverage export into recovery-metrics.md, monthly error-log review + rotation (the WP_DEBUG warning will bloat the 646 KB log fast), quarterly backup restore test, SSL/domain renewal calendar check, trash-purge guard (W1) before Nov 18.
Industry cadence for a one-owner site (WPDeveloper, Belov, Seganiko 2026 guides): daily uptime check; weekly updates after staging test + broken-link audit; monthly core update, DB optimization, CWV/SEO health; quarterly plugin audit and content refresh on top pages.

## Security

- Work Library (doclib://01a159a2-771f-76fc-a8c1-732a5702f4d5) still holds plaintext credentials (WP application password, Hostinger API key, DB password). Never commit; rotate if ever exposed.
- Default comment status still "open" while the privacy policy says comments are closed (carried since Oct 22).
- User registration closed; debug output off (the WP_DEBUG warning is a define-duplication artifact, not debug output being on).

## Carried forward (unchanged since Oct 22/25)

- site_icon (favicon) still unset - missing branding in SERPs.
- Timezone still +00:00 in site settings (set Indian/Reunion, UTC+4).
- default_comment_status "open" vs privacy policy.
- GSC revalidation of 301/noindex/404 classes still pending; recovery-metrics.md needs a new GSC export baseline (not obtainable this session - GSC integration off).

## Priority actions (ordered)

1. BEFORE NOV 18: implement W1 redirects for the ~507 trashed ELT365 URLs (mapping in elt365-dedup-manifest.md), then let trash purge. Otherwise the redirect map is lost.
2. Fix the sitemap coverage defect in sourov-index-hygiene v1.2.0 (re-include the ~503 published posts), resubmit sitemap, reping IndexNow.
3. Remove the duplicate WP_DEBUG define in wp-config.php (introduced today), truncate the error log.
4. wp-admin > Updates: Easy MCP AI 2.2.2 -> 2.4.0; delete the 2 inactive plugins and 7 inactive themes.
5. Delete or repair the "Header Nav BACKUP 2026-08-05" menu (7 dead links).
6. Add 301s for the stale-404 URLs listed above; GSC removal + revalidation.
7. Enable the GSC provider in Easy MCP AI and reconnect Site Kit; confirm email reports resume; record the next GSC export as the new baseline in recovery-metrics.md.
8. Add Redis object cache; set timezone Indian/Reunion; set site icon; align comment status with the privacy policy.
9. If Sourov Agent is an AI chatbot, add the Article 50 disclosure.
