# Indexing Recovery Plan - sourovdeb.com

Plan owner: Sourov Deb. Basis: Google Search Console export (Oct 16, 2026), live WordPress inventory (Oct 22, 2026), `elt365-dedup-manifest.md` in this repo (Oct 19, 2026), and current published rules of Google, Bing, and Yandex. No schedule is attached; workstreams run in dependency order and end when their completion conditions hold.

## 1. Why this plan exists

Google indexed more of the site while showing it less. Indexed pages rose from 1,365 to 2,325 between July 24 and October 16, 2026, but impressions fell 73 percent over the same period (first-week average 223/day, last-week 60/day). Of 4,015 known pages, 1,690 (42.1 percent) are not indexed. The site's own history contains the cause: a sync pipeline produced an average of 9.3 copies per ELT365 lesson topic on days 152-212, and 426 posts were published in a single month. Google's 2026 spam enforcement targets exactly this pattern, and its "crawled - currently not indexed" verdict covers 587 pages.

## 2. Verified current state

### Google Search Console (export Oct 16, 2026)

- Indexed: 2,325. Not indexed: 1,690 (42.1 percent).
- Impressions: 223/day average (Jul 24-30) falling to 60/day (Oct 10-16). Peak day 404 (Jul 30).
- Website-caused exclusions (1,012 total): noindex 448, page with redirect 422, not found 78, alternate canonical 56, server error 3, robots.txt blocked 3, forbidden 1, duplicate without user canonical 1.
- Google-system exclusions (678 total): crawled - currently not indexed 587, discovered - currently not indexed 88, duplicate with Google-chosen canonical 3.
- The Oct 7 snapshot in the document library shows the noindex and redirect validations marked Failed. A validation was attempted and failed; the causes are on the site, not transient.

### WordPress (live counts, Oct 22, 2026)

- 728 published posts, 583 drafts, 550 posts in trash, 51 published pages, 153 pages in trash, 6 private pages.
- The dedup manifest records 729 published after the Oct 19 cleanup; live count now shows 728. The one-post difference is unexplained and unverified.
- Publishing history by month (published posts): July 426, August 192, June 60, October 22, May 24, April 4.
- Oct 19 dedup (this repo, elt365-dedup-manifest.md): 507 duplicate ELT365 posts moved to trash, 36 junk drafts deleted, 61 canonicals kept. Trash is recoverable until roughly Nov 18, 2026, after which WordPress purges those URLs permanently.
- Live pipeline defect: four drafts with the identical title "Teaching English from the edge of the map (and why it's an advantage)" were created on Oct 22, 2026, while the published version has existed since Oct 15. The duplication problem is not fixed at the source.
- 47 published posts carry no tags.
- One intentional EN/FR pair exists (micro-entreprise guide, category 1192).
- Largest categories: English Lessons 246 posts, teacher training 198, grammar 151, vocabulary 140, professional English 49. The travel series splits 15 posts across five per-country categories.

### Engine rules that govern this plan

Google:
- Scaled content abuse means many pages made primarily to manipulate rankings rather than help users, whether written by AI, humans, or both. It was the most-enforced policy of 2026 (three spam updates: March, June, August), and the June and August updates were confirmed to aim at content-level violations rather than link spam. Source: developers.google.com/search/docs/essentials/spam-policies (updated Aug 28, 2026).
- Since May 2026 the spam policies also name attempts to manipulate generative AI responses in Search as spam.
- AI Overviews and AI Mode now carry more prominent links to sources (announced Oct 15, 2026), so clean indexed pages can earn AI-era visibility too.

Bing:
- Bing search and Copilot share one crawling, indexing, and ranking foundation. Pages outside the Bing index are invisible to Copilot citations (AI Performance report, in Bing Webmaster Tools since Feb 2026).
- Bing allocates crawl capacity by site health: duplicate and low-value URLs (crawl waste) directly limit indexing. Penalties include suppressed grounding visibility.
- IndexNow pings participating engines on every add, update, or delete, including redirects and 404/410. Submission never guarantees indexing. Participants (Oct 2026): Bing, Yandex, Seznam, Naver, Yep, Internet Archive, Amazon. Google is not a participant.

Yandex:
- IndexNow participant with a limited reindex-request quota. Operationally degraded after the October 2026 data-centre strikes, and its audience is mostly Russian-speaking. Value for this site is near zero beyond the shared IndexNow ping.

## 3. Goal

All five conditions must hold simultaneously. No dates are attached.

1. Website-caused exclusions in Search Console at zero: every remaining noindex documented as intentional, redirects resolved, 404s mapped.
2. Not indexed below 15 percent of known pages.
3. Impressions recovered to a 150/day average or higher over a sustained seven-day window.
4. Bing Webmaster Tools shows an indexed-page count above zero and the first Copilot citations recorded.
5. The publishing pipeline is idempotent: a dry run of tools/wp_dedupe_elt365.py finds zero duplicates, and no duplicate-titled drafts accumulate.

## 4. Workstreams (dependency order)

### W1. Trash resolution and redirect map (blocking prerequisite)

What: Export all 550 trash-post and 153 trash-page URLs. For each of the 507 deduped ELT365 duplicates, map to its canonical keeper (the manifest lists the IDs and the 61 canonicals). Implement 301 redirects from every trashed URL to its canonical; return 410 only where no equivalent exists. Only then clear the trash.

Why: The Oct 19 dedup placed 507 URLs in trash. Those URLs now surface as the 422 "page with redirect" and 78 "not found" classes in Search Console. Both Google and Bing treat unresolved redirect and 404 chains as crawl waste, and Bing states crawl waste directly limits indexing. Hard constraint: WordPress purges trash roughly 30 days after Oct 19. The redirects must exist before that purge, or the mapping source is lost permanently.

Done when: spot checks of 20 trashed URLs return 301 to live canonicals; Search Console revalidation of the redirect and 404 classes trends them toward zero.

### W2. noindex diagnosis

What: Export the 448 noindex URLs from Search Console. Classify each: SEO-plugin setting (Yoast or RankMath toggle), theme archive or attachment pages, or accidental. Keep noindex only where intentional (for example search results, media attachments) and write the kept classes down. Remove accidental causes. Revalidate.

Why: 448 pages is the largest single exclusion class, and the previous validation attempt failed. Until the URL list is inspected, the cause is unknown; guessing is not permitted by this plan.

Done when: revalidation completes and the noindex class contains only documented, intentional exclusions.

### W3. Consolidation of thin and overlapping content

What: Audit the 587 crawled-not-indexed URLs. Merge overlapping lesson families into one strong page per topic and 301 the merged-away pages. Priority targets by size: grammar (151 posts), vocabulary (140), teacher training lessons (198). Cross-check titles that appear in more than one category (for example "Hedging Language") and confirm single-canonical status. Give the 47 untagged published posts tags or fold them into merged pages. For the EN/FR micro-entreprise pair, use proper hreflang annotations rather than leaving them as unlinked duplicates.

Why: "Crawled - currently not indexed" is Google's judgment that these pages are not worth indexing. The site's own history (9.3 copies per topic, 426 posts in one month) is the documented cause, and the 2026 spam updates targeted precisely this pattern. Consolidation converts a quantity signal into a quality signal.

Done when: each topic has exactly one live canonical page; a wp_dedupe_elt365.py dry run reports zero duplicates; the crawled-not-indexed class falls under 200 and continues shrinking.

### W4. Publishing rules (permanent constraints)

What: Adopt as standing rules, enforced in every pipeline:
- One to two published pages per day maximum, human-reviewed before publish.
- Idempotency check before every create: search by title and slug, and reuse existing post IDs. The four identical drafts created Oct 22 prove the pipeline still lacks this.
- Personal experience, named authorship, and checked sources on every page.
- One parent category per series; no per-variant category splits like the five per-country travel categories.
- Sitemap contains only canonical, indexable URLs.

Why: Each rule maps to a documented failure: 9.3 copies per topic, 426 posts in July, duplicate drafts reappearing within three days of the dedup, and a sitemap described as "all known pages" including non-canonical URLs.

Done when: the constraints are encoded in the sync pipeline (pre-create search, per-day publish cap) and a re-run of the pipeline produces no duplicates.

### W5. Bing and IndexNow enablement

What: Enable IndexNow on WordPress (SEO plugin support or a free IndexNow plugin). Set up Bing Webmaster Tools, import from Search Console, submit the sitemap. Record the AI Performance report numbers alongside the Google metrics.

Why: Bing's index feeds Copilot grounding and citations, a second discovery channel that costs one plugin. IndexNow covers Bing and Yandex with the same ping. It does not replace Google work: Google is not an IndexNow participant, and no engine guarantees indexing on submission.

Done when: the IndexNow key file is live, the sitemap is accepted, and Bing reports an indexed-page count above zero.

### W6. Measurement loop

What: Maintain a metrics file in this repo (same pattern as the dedup manifest) recording four numbers at every review point: indexed pages, not-indexed pages, impressions average, clicks. Revalidate Search Console issues as each fix lands. Re-run wp_dedupe_elt365.py in dry-run mode after any bulk import. After every announced Google spam update, re-audit the affected classes.

Why: The decline ran for roughly twelve weeks before anyone analyzed it. Indexed count is a vanity number here: it rose while visibility fell. Impressions and per-class exclusion counts are the honest signals.

Done when: the metrics file exists, and the numbers move toward the goal conditions in section 3.

## 5. Do-not list

Google: no bulk page production aimed at rankings, in any form; no near-identical topic or region variants (doorway pattern); no attempts to influence AI Overviews (named spam since May 2026).

Bing: no unnecessary URL changes; no duplicate or non-canonical URLs in the sitemap; never treat IndexNow submission as an indexing guarantee.

Yandex: no reindex-request spam; no session-ID or duplicate GET-parameter URLs; no effort beyond the shared IndexNow ping.

## 6. Known unknowns

- The 448 noindex URLs have not been listed yet; their cause is unverified until W2 runs.
- The one-post difference between the manifest (729) and the live count (728) is unexplained.
- The Search Console export predates the Oct 19 dedup, so the next export is not comparable to the Oct 16 baseline; expect movement.
- Yandex's operational state may change; re-check before any Yandex-specific decision.

## 7. Sources

- Google Search Console export (Chart.csv, Critical issues.csv, Metadata.csv), Oct 16, 2026, user upload; Oct 7 snapshot in the document library.
- Live WordPress inventory via WP API, Oct 22, 2026.
- elt365-dedup-manifest.md and tools/wp_dedupe_elt365.py, this repository, Oct 19, 2026.
- Google spam policies: https://developers.google.com/search/docs/essentials/spam-policies (updated Aug 28, 2026).
- Bing Webmaster Guidelines and IndexNow: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a, https://www.indexnow.org.
- Yandex Webmaster documentation: https://yandex.com/support/webmaster/en/.
- News: AFP Oct 15, 2026 (Google AI link visibility), AP Oct 22, 2026 (Yandex data-centre strikes).
