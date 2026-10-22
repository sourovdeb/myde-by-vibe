# Recovery metrics - sourovdeb.com

Pattern: one row per review point, same four core numbers as the plan (W6). Keep entries append-only.

## Review point 2026-10-22 (afternoon, UTC)

- Source: GSC export Oct 16, 2026 (baseline in INDEXING_RECOVERY_PLAN.md); live WP inventory Oct 22, 2026 via WP MCP.
- Indexed: 2,325 (baseline). Not indexed: 1,690 (42.1%). Impressions: 60/day avg (Oct 10-16). Clicks: not exported this round.
- Live counts: 728 published posts, 583 drafts, ~550 trash (recoverable until ~Nov 18), 51 published pages.
- Plugin state: sourov-index-hygiene v1.1.1 (noindex for thin tags/paged/author/format archives, sitemap trimmed, 301s from trashed ELT365 duplicates), sourov-content-redirects v1.0.0, sourov-library-redirect v1.0.0 — all active. W1/W2 code paths in place; GSC revalidation still pending.

### Actions taken 2026-10-22

1. Junk tags deleted via WP API: tag 914 ("what", 2 posts) and tag 1121 ("85.59B", 2 posts). Posts unaffected; other tag assignments retained.
2. Verified live front-end: all section pages, legal pages, Open Teacher Training sub-pages, llms.txt, robots.txt, wp-sitemap.xml return 200; robots.txt allows search + AI crawlers, blocks SEO scrapers.
3. PHP confirmed 8.3.35 on Hostinger (Oct 22). The 21 Oct 2026 critical PHP vulnerabilities require the patched build - confirm with Hostinger that 8.3.35 is the 21 Oct security release before closing this item.

### New defects found 2026-10-22 (fix in wp-admin / Hostinger)

1. Easy MCP AI connector began returning HTTP 502 on every WP REST call at ~18:10 UTC on Oct 22, mid-scan. The site itself stayed up (LiteSpeed, deploy gateway online). Unverified causes: connector service outage, or the wp_rank_math_redirections REST query error below turning fatal. Re-test before the next session.
2. Error log: "Table u839078121_rUgwv.wp_rank_math_redirections doesn't exist" queried from a closure on REST API requests (first seen Oct 15). Rank Math is uninstalled; some active code still queries its table on every REST call. Find and remove that code (check sourov-index-hygiene and easy-mcp-ai Rank Math integration).
3. Recurring WP-cron errors: "cron event list could not be saved" (could_not_set) on sourov_visibility_submit_indexnow and action_scheduler_run_queue (Oct 16-17), plus recurring "Commands out of sync" MySQL errors on shutdown cron spawns (Aug 22, Oct 18, Oct 20). Concurrency defect in cron handling; raise with Hostinger or audit the IndexNow cron code in sourov-index-hygiene.
4. Pending updates (wp-admin -> Updates, no API route exposed): AI 1.3.0->1.4.0, Akismet 5.7->5.7.2, Easy MCP AI 2.0.0->2.2.2 (update last), Site Kit 1.188.0->1.190.0, WP LinkedIn Auto Publish 8.27->8.28. Also remove 2 inactive plugins (ai, ai-provider-for-google) and 7 inactive themes.
5. Site icon (favicon) is unset (site_icon=0) - missing branding in SERPs. Set in Appearance -> Customize -> Site Identity.
6. Site settings: timezone empty (set Indian/Reunion), default_comment_status "open" while privacy policy states comments are closed - new posts may open comments, contradicting the policy.
7. ~47 published posts carry no tags (W3 item); scan aborted by the connector outage, count unverified this round.

### Open items (carry to next review)

- W1/W2 verification: spot-check 20 trashed URLs return 301 to canonicals; trigger GSC revalidation of noindex/redirect/404 classes.
- W3 consolidation of 587 crawled-not-indexed pages; tag the untagged posts.
- W4 pipeline idempotency: re-run tools/wp_dedupe_elt365.py dry run after any sync.
- W5: confirm Bing indexed count > 0 and first AI Performance report numbers.
- Next GSC export will not be comparable to Oct 16 baseline (dedup landed Oct 19); record it as a new baseline.
