# MCP Tools — All In One Place

Single reference for every MCP server / tooling endpoint in use, with auth method and where the key lives.

| MCP / Tool | URL | Auth | Key secret | What it does |
|---|---|---|---|---|
| Hostinger MCP | https://mcp.hostinger.com | `Authorization: Bearer <key>` | `HOSTINGER_API_KEY` | Deploy static sites / folders to hosted domains ("Deploy this folder to mysite.com" → `hostinger · hosting_deployStaticWebsite`), hosting ops |
| WordPress Easy MCP AI (Design Publisher) | https://sourovdeb.com/wp-json/easy-mcp-ai/v1/mcp | Bearer / key | `WP_EASY_MCP_KEY` | Design publishing workflows; Site Guardian monitoring (e.g. `published_posts_below_threshold`) |
| Skyvern MCP (Hermes profiles) | https://api.skyvern.com/mcp/ | `x-api-key: <jwt>` | `SKYVERN_API_KEY` | Browser automation agent; configure via `skyvern setup hermes` or `mcp_servers.skyvern` in `~/.hermes/profiles/*/config.yaml`; verify with `mcp test skyvern` |
| Z.AI Coding endpoint (Hermes) | https://api.z.ai/api/coding/paas/v4 | API key | `ZAI_API_KEY` | Global coding plan endpoint, model `glm-5.3` |
| GitHub Copilot API (Hermes pool) | https://api.githubcopilot.com | API key | `GITHUB_TOKEN` | Copilot coding completions via credential pool |
| OpenCode GO (Hermes pool) | https://opencode.ai/zen/go/v1 | API key | `OPENCODE_GO_API_KEY` | OpenCode Zen GO coding endpoint |
| OpenRouter (Hermes pool) | https://openrouter.ai/api/v1 | API key | `OPENROUTER_API_KEY` | Multi-model LLM router |

## WordPress custom REST endpoints (MCP-adjacent)

| Endpoint | Method | Description |
|---|---|---|
| /wp-json/sourov/v1/ai-post | POST | Create AI-powered design posts (`title`, `content`, `status: draft`, `design_type`, `categories`, `tags`) |
| /wp-json/sourov/v1/status | GET | Health check |
| /wp-json/sourov/v1/templates | GET | Get design templates |
| /wp-json/sourov/v1/upload-media | POST | Upload media files |
| /wp-json/easy-mcp-ai/v1/mcp | MCP | Design Publisher MCP endpoint |

## Non-MCP APIs (for completeness)

| API | URL | Key secret |
|---|---|---|
| PISTE / Legifrance | https://piste.gouv.fr/cb, https://api.aife.economie.gouv.fr | `PISTE_*`, `LEGIFRANCE_*` |
| France Travail | https://api.francetravail.io | `FRANCE_TRAVAIL_*` |
| Agnes AI Hub | https://apihub.agnes-ai.com/v1 | `AGNES_API_KEY` |
| dev.to | https://dev.to/api/articles | `DEVTO_API_KEY` |
| CORE | https://api.core.ac.uk/v3 | `CORE_API_KEY` |
| ESCO | https://ec.europa.eu/esco/api | (no key) |
| IndexNow | https://api.indexnow.org | `WP_INDEXNOW_KEY` |
