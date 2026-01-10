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
1. Parse the current session's conversation log from ~/.claude/projects/
2. Send the conversation to Claude for evaluation
3. Generate a detailed report with ratings for:
   - **Planning**: How well requirements are structured and communicated
   - **Critical Thinking**: How effectively AI suggestions are evaluated
   - **Code Understanding**: How well existing code patterns are leveraged
4. Save the analysis to ~/.nomoreaislop/analyses/

Display the full report output to the user.
