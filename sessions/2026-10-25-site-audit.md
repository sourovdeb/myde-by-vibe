# Session 2026-10-25 - sourovdeb.com forensic audit (Vibe, WordPress MCP)

Scope: site health, error log, cron, links, index status, new search-engine
policies, website-keep-alive research. All checks read-only. Sources: WP MCP
(site-health-review skill flow), live URL fetches, web/news search, this repo.

## Site Health (WP 7.1.3, PHP 8.3.35, LiteSpeed, MariaDB 11.8.9)

- 0 critical, 23 good, 3 recommended:
  1. Remove 7 inactive themes (only Twenty Twenty-Five + active theme should stay).
  2. Enable persistent object cache (host supports Redis).
  3. Page cache not detected; median response 102 ms so low urgency, but LiteSpeed Cache would help.
- All 16 active plugins and WP core up to date (Oct 22 pending updates cleared).
- Search engine visibility enabled; HTTPS active; dotorg communication OK.

## Error log (last ~100 lines)

- Jul 5: repeated PHP fatal "Cannot redeclare sourov_enforce_pillars()" (mu-plugin sourov-automation.php vs plugins/sourov-ai-controller.php). Old; verify both files are gone/renamed.
- STILL OPEN from Oct 22 review: "Table wp_rank_math_redirections doesn't exist" on REST calls (Oct 15) - remove the leftover Rank Math query.
- STILL OPEN: WP-cron "could_not_set" errors (action_scheduler_run_queue, sourov_visibility_submit_indexnow) and recurring "Commands out of sync" MySQL errors on shutdown cron (Aug 22, Oct 18, Oct 20, Oct 22).
- New: googlesitekit_email_reporting_cleanup invalid_schedule (Jul 30); Easy MCP AI missing tool classes (Oct 22) - plugin known-broken classes, low impact.

## Internal link check (34 URLs, live fetch)

- All header/footer menu links, homepage section pages, Open Teacher Training pages, legal pages, blog, contact, sitemap, particle-field, sample post: load (HTTP 200).
- Custom 404 page renders correctly for a bogus path.
- Sitemap.xml and wp-sitemap.xml index (posts/pages/categories/tags) both resolve; robots.txt (updated 2026-10-16) allows Googlebot/Bingbot/AI-search bots, blocks wp-admin/xmlrpc/search, sitemap pointer = wp-sitemap.xml.
- Cosmetic: three menu/footer links land on empty "Coming soon" category archives (category/blog/, dxo/, learn_ai/).

## Index status (third-party index; Google/Bing SERP fetches blocked automated access)

- Site is indexed and serving results in at least one engine index.
- STALE INDEXED 404s confirmed live (fetch today):
  - /category/personal-life-blogs/ -> 404
  - /category/photography-video-tutorials-travel-tips/ -> 404
  - /silkypix-review-tutorial/ -> 404
  - /privacy-policy-2/ -> duplicate privacy page (serves content, duplicate URL)
- Action: add 301s via sourov-content-redirects / Index Hygiene, then GSC removal + revalidation. Not fixed in this read-only session.

## New search-engine law/policy landscape (Oct 2026)

- Google updated its Site Reputation Policy (Aug 28, 2026) - relevant if third-party content is hosted on the domain.
- Google crawl-budget change 2026: conservative default crawl capacity, shared across all Google crawlers - large sites must avoid crawl waste (supports the index-hygiene trimming already in place).
- Google AI Mode will show more links higher in AI results (Oct 15, 2026) - good for content sites.
- EU (DMA) ordered Google to share search data and open Android to rival AI search engines (Jul 16, 2026); Swiss probe into search choice removal (Jul 14, 2026). Watch for new search-choice screens in EU.
- Security context: government and corporate sites went dark after AI tools exposed critical flaws (Oct 21, 2026) - update discipline matters more than ever.

## Keep-alive / maintenance (what this site needs)

Already in place: auto-updates (Hostinger managed), Akismet, backups implied by Hostinger, robots/sitemap hygiene plugins, Site Kit monitoring, email reports enabled (last sent Aug 1 - check why none since).
To add/check monthly: SSL expiry, domain + hosting renewal dates, database backup restore test, error-log review, GSC/Bing Webmaster coverage check (Bing URL Submission plugin present), scheduled-post pipeline (8 future posts queued through Nov 20 - working), plugin update cadence.

## Security

- Public repo sourovdeb/myde-by-vibe scanned: no hardcoded credentials (env vars only). Verified for README.md, tools/wp_dedupe_elt365.py, no .env, no Hostinger key hits.
- Work Library (doclib://01a159a2-771f-76fc-a8c1-732a5702f4d5) contains plaintext credentials documents (WordPress application password, Hostinger API key, DB password). Do not commit; rotate if ever exposed.

## Carried forward (unchanged since Oct 22)

- site_icon (favicon) still unset (site_icon=0).
- Timezone setting still empty (set Indian/Reunion).
- default_comment_status still "open" while privacy policy says comments closed.
- GSC revalidation of 301/noindex/404 classes still pending; next GSC export = new baseline.
