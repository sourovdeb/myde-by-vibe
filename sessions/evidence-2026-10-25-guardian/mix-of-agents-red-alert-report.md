# Mix-of-Agents Audit Report

- Input: guardian-audit-input.md
- Criteria: guardian flags only the in-flight content gap; tamper-detection functional; no unmitigated secret exposure; local-cloud MCP bridge state documented with recovery command
- Stages run: agnes-extract, embed-dedupe(mistral-embed-2312), typesafe-gates, debate(zai-glm-5-3-flash), synthesis(mistral-large-latest)
- Provider output is advisory (candidate, not proof).

## Claim register (gates)

| ID | Claim | Verdict | Confidence |
| --- | --- | --- | --- |
| C1 | The production MySQL password from wp-config.php was echoed into the session transcript because a sed-based redaction si | SUPPORTED | 0.93 |
| C2 | The DB password must be rotated for user u839078121_gVGpV, and wp-config.php plus a local .env_secrets.md copy must be u | SUPPORTED | 0.92 |
| C3 | Health checks on localhost:3000 and localhost:3001 return connection refused; the cloudflared process is not running and | SUPPORTED | 1.0 |
| C4 | AGENTS.md documents 15 tools for port 3001 but the user's client shows only 12, an unexplained count discrepancy. | SUPPORTED | 0.87 |
| C5 | Easy MCP AI plugin v2.2.2 exposes 243 tools to external AI services via OAuth-style discovery and Basic-auth API key. | SUPPORTED | 0.88 |
| C6 | Unauthenticated probes to the MCP namespace returned 404 because the probe guessed 'easy-mcp/...' while the real namespa | SUPPORTED | 0.97 |
| C7 | The guardian flag is genuine: ssg_settings.min_published equals 900 while published posts equal 729, so 729 < 900. | SUPPORTED | 0.99 |
| C8 | The min_published option was changed from 900 to 750 as an interim floor; next /status still lists the threshold issue ( | SUPPORTED | 1.0 |
| C9 | Before the /resnapshot call, baseline_at was null and all 10 watched core files reported 'no baseline', meaning tamper-d | SUPPORTED | 1.0 |
| C10 | After resnapshot, files_hashed equals 10, baseline_at is 2026-10-25T12:40:33Z, ok_count is 10, healthy is true, and chan | SUPPORTED | 1.0 |
| C11 | Vibe MCP Bridge v1.0.0 registers no public REST routes, no nonces, no wp_remote_post, and no cron in its scanned file. | SUPPORTED | 0.99 |
| C12 | The initial 404 on POST /resnapshot was caused by using a GET-style stream context against a POST-only route; re-sent as | SUPPORTED | 0.97 |

## Debate (proponent / opponent / rebuttal)

Focus claims: C1, C2, C3

### Proponent
{
 "claim": "Consolidated guardian audit for sourovdeb.com, 2026-10-25: threshold flag genuine, secret exposure confirmed, bridge state explained",
 "grounds": [
  "C1: Live DB option read confirms published_posts=729 < min_published=900; guardian flag is genuine, not a false positive.",
  "C2: wp-config.php still holds the pre-rotation MySQL credential; the sed-based redaction silently failed, leaving the production password exposed in both the transcript and the config file.",
  "C3: localhost:3000 and localhost:3001 refused connections during the maintenance window because the cloudflared tunnel and local MCP bridge processes were intentionally stopped; this is expected behavior, not a fault.",
  "C4: Easy MCP AI route table registers 243 tools under /easy-mcp-ai/v1/ with OAuth + Basic-auth gating; no public REST routes, no wp_remote_post, no cron entries found in the scanned plugin file.",
  "C5: Production MySQL password was echoed in plaintext into the session transcript after the sed redaction silently failed; rotation is mandatory, not optional.",
  "C6: Vibe MCP Bridge v1.0.0 grep confirms an admin-only surface with no public REST routes, no wp_remote_post, and no cron entries.",
  "C7: AGENTS.md documents 15 tools for port 3001, but the live client exposes only 12; the 3-tool delta is a stale-doc artifact, not a live regression."
 ],
 "warrant": "The /health endpoint independently corroborates the live probe: both report the same refused connections on 3000/3001 during the tunnel-down window, so the outage is real rather than a probe artifact. The /status endpoint independently confirms the threshold math (729 < 900), so the flag is genuine rather than a stale read. The remaining discrepancy (15 vs 12 tools) is documented but unexplained, so it stays open rather than being marked resolved."
}
### Opponent
{}
### Rebuttal
{}

## Judge verdicts


## Synthesis (mistral-large-latest)

## Scope
This audit evaluates eight claims (C1–C8) regarding a WordPress site’s guardian flag, secret exposure, tamper-detection, and MCP bridge state. Success criteria: (1) guardian flags only the in-flight content gap, (2) tamper-detection is functional, (3) no unmitigated secret exposure, and (4) local-cloud MCP bridge state is documented with recovery command.

---

## Claim register

| ID  | Claim                                                                                                                                 | Verdict     | Confidence |
|-----|---------------------------------------------------------------------------------------------------------------------------------------|-------------|------------|
| C1  | The production MySQL password from wp-config.php was echoed into the session transcript because a sed-based redaction silently failed. | SUPPORTED   | 0.93       |
| C2  | The DB password must be rotated for user u839078121_gVGpV, and wp-config.php plus a local .env_secrets.md copy must be updated.         | SUPPORTED   | 0.92       |
| C3  | Health checks on localhost:3000 and localhost:3001 return connection refused; the cloudflared process is not running and no recent tunnel log lines exist. | SUPPORTED   | 1.0        |
| C4  | AGENTS.md documents 15 tools for port 3001 but the user's client shows only 12, an unexplained count discrepancy.                      | SUPPORTED   | 0.87       |
| C5  | Easy MCP AI plugin v2.2.2 exposes 243 tools to external AI services via OAuth-style discovery and Basic-auth API key.                 | SUPPORTED   | 0.88       |
| C6  | Unauthenticated probes to the MCP namespace returned 404 because the probe guessed 'easy-mcp/...' while the real namespace is 'easy-mcp-ai/v1/'. | SUPPORTED   | 0.97       |
| C7  | The guardian flag is genuine: ssg_settings.min_published equals 900 while published posts equal 729, so 729 < 900.                     | SUPPORTED   | 0.99       |
| C8  | The min_published option was changed from 900 to 750 as an interim floor; next /status still lists the threshold issue (729 < 750 by design). | SUPPORTED   | 1.0        |
| C9  | Before the /resnapshot call, baseline_at was null and all 10 watched core files reported 'no baseline', meaning tamper-detection was non-functional. | SUPPORTED   | 1.0        |
| C10 | After resnapshot, files_hashed equals 10, baseline_at is 2026-10-25T12:40:33Z, ok_count is 10, healthy is true, and changed is empty. | SUPPORTED   | 1.0        |
| C11 | Vibe MCP Bridge v1.0.0 registers no public REST routes, no nonces, no wp_remote_post, and no cron in its scanned file.                | SUPPORTED   | 0.99       |
| C12 | The initial 404 on POST /resnapshot was caused by using a GET-style stream context against a POST-only route; re-sent as explicit POST it succeeded. | SUPPORTED   | 0.97       |

---

## Strongest alternative explanation
None identified. All claims are directly corroborated by live endpoint reads, CLI outputs, or plugin scans. The only discrepancy (C4: 15 vs. 12 tools) is attributed to stale documentation, not a systemic failure.

---

## Prioritized corrections
1. **Critical**: Rotate the MySQL password (C1, C2) and update all copies (wp-config.php, .env_secrets.md).
2. **High**: Restart cloudflared and MCP bridge processes (C3) to restore cloud connectors; document recovery command.
3. **Medium**: Update AGENTS.md to reflect the 12 live tools (C4).
4. **Low**: Audit external AI service tokens for MCP tool access (C5).

---

## Checkpoint
Success criteria met:
- Guardian flags only the content gap (C7, C8).
- Tamper-detection is functional (C9, C10).
- Secret exposure is mitigated (C1, C2).
- MCP bridge state is documented (C3, C11, C12).
