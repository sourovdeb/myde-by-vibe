# Secrets Map (GitHub repo secrets — values never committed)

Set on `sourovdeb/myde-by-vibe` via `gh secret set`. Values are redacted here.

## Service keys
- `HOSTINGER_API_KEY` = 7Z0D…074 (Hostinger MCP bearer)
- `HOSTINGER_DB_NAME` = u839078121_rUgwv
- `HOSTINGER_DB_USER` = u839078121_gVGpV
- `HOSTINGER_DB_PASSWORD` = SrV…zCi7jv
- `WP_APP_PASSWORD` = PX0t…zBca ("For_Agents" application password, user sourovdeb)
- `WP_ZOHO_APP_PASSWORD` = pup5…rzs6 (user sourovdeb@zohomail.com)
- `WP_ACCOUNT_PASSWORD` = i32…C4aC4 (WP admin login)
- `WP_EASY_MCP_KEY` = 5aa…633 (Easy MCP AI endpoint key)
- `WP_DEPLOY_GATEWAY_URL` = https://www.sourovdeb.com/deploy.php?key=0767…net_
- `WP_REST_AI_POST_URL` = https://www.sourovdeb.com/wp-json/sourov/v1/ai-post
- `WP_FTP_HOST` = ftp.sourovdeb.com
- `WP_FTP_USER` = u839078121.sourov
- `WP_FTP_PASSWORD` = 076…net_
- `WP_INDEXNOW_KEY` = 1e7…102
- `WP_DB_NAME` = u839078121_rUgwv
- `WP_DB_USER` = u839078121_gVGpV
- `WP_DB_PASSWORD` = SrV…zCi7jv
- `HOSTINGER_DB_USER_PASSWORD` = 076…net_ (second candidate DB-user password from .secrets.md)
- `WP_SITE_URL` = https://sourovdeb.com
- `WP_REST_BASE` = https://sourovdeb.com/wp-json/wp/v2/
- `WP_USERNAME` = sourovdeb@zohomail.com
- `TEMP_PASSWORD_PATTERN` = 076…vanessaThevenet_ / 076…thevenet_
- `FRANCE_TRAVAIL_APP` = Automation_de_rechereche_demploi
- `GOOGLE_CLIENT_ID` = 394864308567-hr45…googleusercontent.com
- `GOOGLE_CLIENT_SECRET` = GOCSPX-…2Ru (project youtube-api-lth)
- `PISTE_API_KEY_ID` = 918d…941e
- `PISTE_API_KEY` = f31…23d
- `PISTE_OAUTH_CLIENT_ID` = dcb…fee
- `PISTE_OAUTH_CREDENTIAL_ID` = cef…a44
- `PISTE_REDIRECT` = https://piste.gouv.fr/cb
- `LEGIFRANCE_SECRET_KEY` = 189…01f1
- `LEGIFRANCE_API_KEY` = cb9…885c
- `LEGIFRANCE_CLIENT_ID` = 15739f37-…76c
- `LEGIFRANCE_CLIENT_SECRET` = 5d4ee3fb-…4ef
- `FRANCE_TRAVAIL_CLIENT_ID` = PAR_automationderecherech_b55…c7b
- `FRANCE_TRAVAIL_LEGACY_CLIENT_ID` = PAR_automationderecherech_72d…346
- `FRANCE_TRAVAIL_LEGACY_CLIENT_SECRET` = 159…42ca
- `AGNES_API_KEY` = cpk-…clXT (https://apihub.agnes-ai.com/v1)
- `DEVTO_API_KEY` = yxX…GMUE
- `DEVTO_PUBLISHED` = false
- `CORE_API_KEY` = oOD…LQF
- `SKYVERN_API_KEY` = eyJhbGciOiJIUzI1NiIs… (JWT)
- `ZAI_API_KEY` = **not present in uploads** (key hash only: ae5ca0f7c0a88d61)
- `GITHUB_TOKEN` = **not present in uploads** (fingerprint sha256:0ceb5a5457e426ed)
- `OPENCODE_GO_API_KEY` = **not present in uploads** (fingerprint sha256:2b2b5f3075cd75e2)
- `OPENROUTER_API_KEY` = **not present in uploads** (fingerprint sha256:f2aee9ccaf3eb9f7)

## Bulk data secrets
- `CHROME_PASSWORDS_CSV` = gzip+base64 of the 539-row Chrome passwords export (restore: `base64 -d | gunzip`)
- `BOOKMARKS_HTML_PART1` / `BOOKMARKS_HTML_PART2` / `BOOKMARKS_HTML_PART3` = gzip+base64 of the 2026-10-21 bookmarks HTML split into 3 chunks (< 48 KB each); concatenate all three in order, then `base64 -d | gunzip`. Raw HTML is also committed at `data/bookmarks_21_10_2026.html` (contains no secrets).
