---
allowed-tools: Bash(npx tsx:*)
description: Analyze current Claude Code session for AI collaboration quality
---

Analyze the current Claude Code session for AI collaboration quality.

Run the NoMoreAISlop analysis tool to evaluate the developer's collaboration skills:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/test-local.ts analyze
```

This will:
1. Parse session logs from ~/.claude/projects/
2. Display session statistics (messages, characters, estimated tokens)
3. Show cost estimate for LLM analysis
4. After user confirmation, run LLM-powered evaluation
5. Generate a detailed report with:
   - **AI Coding Style Type** (Architect, Scientist, Collaborator, Speedrunner, Craftsman)
   - **6 Deep Dimensions** (AI Collaboration, Context Engineering, Tool Mastery, etc.)
   - Personalized recommendations

**Options:**
- Add `--quick` flag for fast pattern-based analysis (no LLM, free)
- Add `--dry-run` to see cost estimate without running analysis
- Add `--yes` to skip cost confirmation

Display the full report output to the user.
