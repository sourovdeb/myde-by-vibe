---
name: sourov-wp-maintenance
description: Troubleshoot and maintain sourovdeb.com. Use for faults and maintenance. Do not redesign the site. Do not publish test content. Read references/site-contract.md first.
version: 1.0.0
metadata:
  author: Sourov Deb
  date: 2026-10-27
  source: E:\knowledge\New Good Stuff from chatgpt\SKILL.md
  tags: [wordpress, maintenance, sourovdeb, troubleshooting, devops]
---

# Sourov WordPress Maintenance

## When to Use

Maintain `https://sourovdeb.com`. Use for faults and maintenance. Do not redesign the site. Do not publish test content.

Read `references/site-contract.md`. Load other references on demand. Historical findings require fresh checks.

## Procedure

### 1. Discover Access

Use the connected WordPress tools. Confirm the site before writes. Discover hosting tools when required. Descriptions can reference missing tools. Use the discovered schemas only. Respect credentials and capability checks. Do not request secrets in chat.

### 2. Scan

Collect Site Health and diagnostics. Inspect versions, plugins, themes, cron. Read error timestamps before diagnosing. Check indexing and cache evidence. Compare relevant posts with history.

```text
wp_get_site_health(include_async=true, include_info=true)
wp_get_easy_mcp_diagnostics(rerun=true)
wp_list_plugin_updates()
wp_list_plugins()
wp_list_themes()
wp_list_cron_events(limit=50)
wp_get_error_log(lines=70)
wp_get_site_settings()
```

Test homepage, sitemap, robots, REST. Test the affected URL itself. Distinguish tool failures from outages. Record untested checks as UNKNOWN.

### 3. Select One Repair

Reproduce the reported fault. Read `references/troubleshooting.md`. Separate symptoms, causes, and guesses. Choose the smallest justified change. Preserve content and URL identity. Reuse existing components before adding.

### 4. Establish Recovery

Respect the user's backup requirement. Verify files and database coverage. Record backup timestamp and location. Test restoration on protected staging. Disable staging emails and cross-posting. Prevent staging indexing and public access. Preserve evidence before changing anything.

An export is not verification. A post snapshot lacks files. Missing recovery blocks production writes. Continue diagnosis and patch preparation.

### 5. Execute Within Authorization

Use this session's maintenance authorization. Avoid repeating approvals within scope. Do not expand it silently. Authorization expires with this task.

- Apply one repair per pass.
- Read back the changed object.
- After ambiguous writes, inspect before retrying.
- Stop after two failed repair attempts.
- Escalate only the blocked branch.
- Never perform blanket cleanup.
- Never disable the MCP connector.

### 6. Verify

Repeat the original failure test. Check the homepage and affected URL. Recheck MCP access and Site Health. Check logs for new timestamps. Compare content, slugs, and counts. Test map controls when affected. Rollback regressions using the saved state. Do not claim unobserved recovery.

## Pitfalls

- Historical errors do not establish recurrence.
- A passing API is not rendering.
- No detected cache is not downtime.
- A suffix does not prove duplication.
- Index exclusions can be intentional.
- Prepared patches are not deployed fixes.
- Do not change credentials or DNS.
- Do not add n8n or schedulers.
- Do not add maintenance plugins.

## Verification

Report CHECKED, FIXED, PREPARED, BLOCKED. List evidence for every repair. Keep unknowns separate from failures. Never claim installation without read-back.

## References

- `references/site-contract.md`: scope and preservation
- `references/troubleshooting.md`: faults and repair routes
- `references/sources.md`: documentation and provenance
- `references/access-handoff.md`: missing access and recovery
- `evidence/audit-2026-10-07.md`: session findings
- `repairs/post-1141.patch.json`: exact repair preconditions
- `repairs/post-1141.before.json`: one-post recovery snapshot
- `repairs/post-1141.candidate.html`: proposed content
