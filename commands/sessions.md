---
allowed-tools: Bash(npx tsx:*)
description: List available Claude Code sessions
---

List all available Claude Code sessions that can be analyzed.

Run the command:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/test-local.ts sessions
```

This shows a table of sessions with:
- Project name
- Date
- Duration
- Message count
- Session ID (use with `/noslop:analyze`)

Sessions are sorted by date (most recent first).
