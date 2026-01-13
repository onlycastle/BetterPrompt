---
allowed-tools: Bash(npx tsx:*)
description: Analyze a specific session by ID
---

Analyze a specific Claude Code session by its ID.

The user should provide a session ID. If they haven't, ask them to run `/noslop:sessions` first to see available sessions.

Run the analysis with the provided session ID:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/test-local.ts analyze <SESSION_ID>
```

Replace `<SESSION_ID>` with the actual session UUID provided by the user.

Example:
```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/test-local.ts analyze e0c35da6-6274-44c3-85c0-736d3d4d900f
```

This will show session statistics, cost estimate, and after confirmation, run LLM analysis.

**Options:**
- Add `--quick` for pattern-based analysis only (no LLM)
- Add `--dry-run` to see cost without running
- Add `--yes` to skip confirmation

Display the full analysis report to the user.
