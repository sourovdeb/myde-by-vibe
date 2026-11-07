# Website Keep-Alive Checklist - sourovdeb.com

Created: 2026-11-07 after the forensic site audit (sessions/2026-11-07-forensic-site-audit.md). This is the standing maintenance SOP plus the law and policy watch list. Run the recurring items at their stated cadence and date-stamp every note in this repo.

## Daily (2 minutes, mostly automatic)

- Site up check: https://sourovdeb.com/ returns 200 and the homepage title loads. Use tools/site_linkcheck.php in sentinel mode.
- LiteSpeed cron: DISABLE_WP_CRON is on by design; LiteSpeed Cache triggers cron. Confirm no overdue events accumulate (0 overdue as of Nov 7, 2026).
- New publishing: the Bing Webmaster Url Submission plugin pushes URLs on publish; no manual ping needed.

## Weekly (15 minutes)

- Error log scan: read the last 50 lines. Any repeated new pattern (not the known WP_DEBUG duplicate) gets a session note. As of Nov 7, 2026: 395 of 395 lines are the WP_DEBUG duplicate warning; fix is removing the duplicate define in wp-config.php, then re-check that the log stays quiet.
- Updates: apply pending plugin updates (currently Easy MCP AI 2.2.2 to 2.4.0) and verify the PHP version is still at or above the PHP2Shell-patched line (8.3.36 as of Nov 7, 2026). Keep auto-updates on; do not pin below 8.3.36.
- Backups: confirm Hostinger backup ran and copy one off-site (3 locations total: host, off-site, local). A backup that has never been restore-tested is not a backup; test a restore quarterly.
- Site Health: 0 critical items expected (3 recommended as of Nov 7: plugin update, inactive themes, object cache).
- Internal links: run tools/site_linkcheck.php over the current published inventory; new 404s get fixed or redirected the same week.

## Monthly (30 minutes)

- Search Console (once the GSC provider in Easy MCP AI is connected): record indexed, not-indexed, impressions, clicks in the metrics file. Investigate any drop over 15% week-over-week.
- Sitemap: fetch https://sourovdeb.com/sitemap_index.xml or wp-sitemap.xml, confirm it loads and the child sitemaps open. robots.txt last-reviewed date should stay recent (2026-10-16 as of now).
- Draft hygiene: 630 drafts exist. Do not publish any old draft from the affected families (Open Teacher Training, history-in-40-stories, FML, rigorous-review, critical-thinking, browser-games, five-minute-english-lab) without repairing ?page_id=36xx links first. Full hazard list: data/broken-links-2026-11-07.csv.
- Trash: check trash counts before WordPress auto-purges (roughly 30 days after deletion). Never let a bulk deletion happen without the redirect map existing first; this is the lesson from the ELT365 dedup (see INDEXING_RECOVERY_PLAN.md W1 and the Nov 7 audit, section 4).
- Menu check: run the link checker over Header Nav 2 and Footer Nav; delete or fix the stale backup menu.

## Quarterly (1 hour)

- Restore test: restore the site (or at least the database) to a scratch environment from the off-site backup.
- Theme/plugin audit: delete inactive themes (7 inactive as of Nov 7, 2026) and inactive plugins; every installed item is attack surface (PHP2Shell proved runtime-level risk is real).
- SSL: check certificate expiry; Let's Encrypt renews on ~90-day cycles; confirm renewal succeeded after each cycle.
- Accessibility: if any paid service, shop, or booking goes live, the European Accessibility Act applies in France (up to 7,500 EUR per breach); publish an accessibility statement and run a WCAG 2.1 AA check before launching the paid feature.
- Hostname: curl -I https://www.sourovdeb.com/ should return a 301 to the bare domain. If it returns 200, add the redirect at server level.
- Core Web Vitals: one PageSpeed Insights run on homepage and heaviest post template.

## Law and policy watch (check on the first of each month)

- Google Search Central changelog and spam policy page: last wave of changes was Apr to Oct 2026 (back-button hijacking now a spam violation, June 2026 spam update, site reputation abuse update in August, FAQ rich results retired in May, October documentation updates). No new spam update found after August 2026 as of Nov 7.
- PHP security releases: subscribe to the PHP Foundation feed; PHP2Shell (CVE-2026-109619, Oct 21, 2026) showed the danger of lagging. Each PHP branch gets about 4 years of support.
- EU AI Act: enforcement active since Aug 2, 2026. If AI-generated content is offered as a service, transparency duties may apply. Reassess when monetization starts.
- Digital Markets Act: EU order on Google under appeal (Sep 29, 2026). Outcome may change how search traffic arrives; watch Bing and alternative engines.
- Bing Webmaster Tools: still not verified (Bing SERP blocks automated access). Once set up, use IndexNow (plan W5) for instant URL submission.

## Incident rules (from the audit)

- If the error log shows a new repeated pattern: session note first, then fix, then verify quiet for 24 hours.
- If a page or post must be deleted: create the 301 redirect before deleting, never after. Deleting without a redirect map cost the ELT365 dedup its slug mapping source.
- If the connector bridge returns 401/502 (seen Nov 7 under load): retry once, then use the read-only bridge; check whether the pending Easy MCP AI update fixes it before reporting a host problem.
- If Site Health shows a critical item: fix within 24 hours; critical items are security or availability.

## Standing open items (from 2026-11-07 audit)

1. Verify the 507-redirect map for the deleted ELT365 duplicates (highest priority; see audit section 4).
2. Fix 7 public broken links (audit section 3.1).
3. Remove duplicate WP_DEBUG define.
4. Update Easy MCP AI to 2.4.0.
5. Connect the GSC provider and start recording metrics.
6. Set site icon (favicon) and logo.
7. Delete stale backup menu and empty topics menu.
8. Delete 7 inactive themes and 2 inactive plugins.
9. Check www 301 behavior with curl -I.
10. Repair draft ?page_id=36xx links before any draft from the affected families is published.
