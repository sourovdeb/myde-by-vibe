# Credentials Index

Consolidated index of service credentials: URL, key name, and description.
Actual secret values are stored in GitHub repo secrets (see `credentials/SECRETS_MAP.md`).
This file intentionally contains **no secret values**.

## Hosting / Hostinger

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| Hostinger MCP | https://mcp.hostinger.com | `HOSTINGER_API_KEY` | Bearer token for Hostinger MCP server (deploys, hosting ops) |
| Hostinger MySQL | — | `HOSTINGER_DB_NAME`, `HOSTINGER_DB_USER`, `HOSTINGER_DB_PASSWORD`, `HOSTINGER_DB_USER_PASSWORD` | MySQL database `u839078121_rUgwv` (191 MB) and user `u839078121_gVGpV` (expires 2026-04-06) for sourovdeb.com; two candidate user passwords recorded (`SrV…` and the 0767… pattern) |

## WordPress (sourovdeb.com)

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| WP REST (App Password "For_Agents") | https://sourovdeb.com/wp-json/wp/v2/ | `WP_APP_PASSWORD` | WP application password for user `sourovdeb` |
| WP REST (App Password, zohomail login) | https://sourovdeb.com/wp-json/wp/v2/ | `WP_ZOHO_APP_PASSWORD` | WP application password for user `sourovdeb@zohomail.com` |
| WP site / REST base | https://sourovdeb.com | `WP_SITE_URL`, `WP_REST_BASE`, `WP_USERNAME` | Site URL, REST base `…/wp-json/wp/v2/`, login `sourovdeb@zohomail.com` |
| WP account password | https://sourovdeb.com/wp-admin | `WP_ACCOUNT_PASSWORD` | WP admin account password |
| Easy MCP AI (Design Publisher) | https://sourovdeb.com/wp-json/easy-mcp-ai/v1/mcp | `WP_EASY_MCP_KEY` | MCP endpoint key for design publishing workflows |
| Deploy gateway | https://www.sourovdeb.com/deploy.php | `WP_DEPLOY_GATEWAY_URL` | Deploy endpoint with key query param |
| REST AI post | https://www.sourovdeb.com/wp-json/sourov/v1/ai-post | `WP_REST_AI_POST_URL` | POST endpoint: create AI-powered design posts |
| REST status | /wp-json/sourov/v1/status | — | GET health check |
| REST templates | /wp-json/sourov/v1/templates | — | GET design templates |
| REST upload-media | /wp-json/sourov/v1/upload-media | — | POST media upload |
| FTP | ftp.sourovdeb.com | `WP_FTP_HOST`, `WP_FTP_USER`, `WP_FTP_PASSWORD` | FTP deploy; docroot /home/u839078121/domains/sourovdeb.com/public_html |
| IndexNow | https://api.indexnow.org | `WP_INDEXNOW_KEY` | Search-engine indexing key |
| MySQL (WP) | — | `WP_DB_NAME`, `WP_DB_USER`, `WP_DB_PASSWORD` | Same Hostinger DB as above |

## Google / YouTube (OAuth client)

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| Google OAuth (project youtube-api-lth) | https://accounts.google.com/o/oauth2/auth | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Web client 394864308567-…; JS origin https://sourovdeb.com |
| Google token endpoint | https://oauth2.googleapis.com/token | — | OAuth token exchange |

## PISTE / Legifrance

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| PISTE OAuth | https://piste.gouv.fr/cb | `PISTE_API_KEY_ID`, `PISTE_API_KEY`, `PISTE_OAUTH_CLIENT_ID`, `PISTE_OAUTH_CREDENTIAL_ID` | PISTE API gateway credentials |
| Legifrance (direct client) | https://api.aife.economie.gouv.fr | `LEGIFRANCE_SECRET_KEY`, `LEGIFRANCE_API_KEY` | Legifrance API keys; fall back to official website if keys fail |
| Legifrance external client | — | `LEGIFRANCE_CLIENT_ID`, `LEGIFRANCE_CLIENT_SECRET` | Confidential client 15739f37-… / secret 5d4ee3fb-… |

## France Travail / Emploi Store

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| France Travail API | https://api.francetravail.io | `FRANCE_TRAVAIL_CLIENT_ID`, `FRANCE_TRAVAIL_LEGACY_CLIENT_ID`, `FRANCE_TRAVAIL_LEGACY_CLIENT_SECRET` | App `Automation_de_rechereche_demploi`; current secret also stored in Apps Script / Emploi Store dashboard |
| Referent contact | — | `FRANCE_TRAVAIL_REFERENT` | Advisor email (francetravail.net) |
| France Travail app name | — | `FRANCE_TRAVAIL_APP` | `Automation_de_rechereche_demploi` |

## Agnes AI

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| Agnes AI API Hub | https://apihub.agnes-ai.com/v1 | `AGNES_API_KEY` | API key `cpk-…` for Agnes AI hub |

## dev.to

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| dev.to Articles API | https://dev.to/api/articles | `DEVTO_API_KEY`, `DEVTO_PUBLISHED` | Publishing API key; `DEVTO_PUBLISHED=false` (draft mode) |

## CORE (Academic)

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| CORE API v3 | https://api.core.ac.uk/v3 | `CORE_API_KEY` | Academic paper search API |

## ESCO

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| ESCO API | https://ec.europa.eu/esco/api | — (no key needed) | EU skills/occupations taxonomy |

## Skyvern (browser automation / Hermes MCP)

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| Skyvern API / MCP | https://api.skyvern.com/mcp/ | `SKYVERN_API_KEY` | JWT key used via `x-api-key` header; configure Hermes profiles with `skyvern setup` |

## Hermes (archived auth config)

| Service | URL | Key / Secret name | Description |
|---|---|---|---|
| Z.AI Coding (Global) | https://api.z.ai/api/coding/paas/v4 | `ZAI_API_KEY` (env; **value not present in uploads** — fingerprint sha256:ae5ca0f7c0a88d61 only) | Endpoint `coding-global`, model `glm-5.3` |
| GitHub Copilot API | https://api.githubcopilot.com | `GITHUB_TOKEN` (env; **value not present in uploads** — fingerprint sha256:0ceb5a5457e426ed only) | Credential-pool entry |
| OpenCode GO | https://opencode.ai/zen/go/v1 | `OPENCODE_GO_API_KEY` (env; **value not present in uploads** — fingerprint sha256:2b2b5f3075cd75e2 only) | Credential-pool entry |
| OpenRouter | https://openrouter.ai/api/v1 | `OPENROUTER_API_KEY` (env; **value not present in uploads** — fingerprint sha256:f2aee9ccaf3eb9f7 only) | Credential-pool entry |

## Other notes

- `TEMP_PASSWORD_PATTERN` — reusable personal password pattern (`0767044896vanessaThevenet_` / `0767044896thevenet_`); treat as a credential, rotate everywhere it appears.
- Hermes profile configs: `~/.hermes/profiles/*/config.yaml` (`mcp_servers.skyvern`) — see MCP_TOOLS.md.

## Bulk data (GitHub secrets only — never committed)

| Item | Secret names | Description |
|---|---|---|
| Chrome Passwords export (539 rows) | `CHROME_PASSWORDS_CSV` | gzip+base64 of the full CSV; decompress with `base64 -d \| gunzip` |
| Bookmarks (2026-10-21) | `BOOKMARKS_HTML_PART1`, `BOOKMARKS_HTML_PART2`, `BOOKMARKS_HTML_PART3` | gzip+base64 split into 3 chunks (<48 KB each); concatenate all three, then `base64 -d \| gunzip`. The raw HTML is also committed at `data/bookmarks_21_10_2026.html` (contains no secrets — only base64 favicons). |
