---
name: evidence-first
description: Use before claiming a file, drive, command, install, or task result exists or failed. Requires a tool result, and forbids invented paths and unverified success.
---

# Evidence first

A statement about this PC is allowed only after a tool result from this session supports it.

- Missing path: say so only after read, search, resolve, or a directory listing failed for that exact path.
- Success: quote the exit code, pid, or the reread file. "I updated it" without a tool result is not done.
- Provider output from TypeSafe or Agnes is a candidate. It does not prove a file changed or a program ran.
- If a tool errors, report the error text. Do not replace it with a plausible cause you did not test.
- Prefer the smallest check that can falsify the claim, then continue the task.
- A browser download is complete only when the file size matches the server's Content-Length and the magic bytes fit the claimed type. Chrome can leave finished downloads as `.tmp` files; verify, then finalize the name.
