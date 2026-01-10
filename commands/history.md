---
allowed-tools: Bash(npx tsx:*)
description: View past analysis results
---

View a list of past NoMoreAISlop analysis results.

Run the command:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/test-local.ts history
```

This shows past analyses with:
- Project name
- Analysis date
- Ratings for each category (🟢 Strong, 🟡 Developing, 🔴 Needs Work)

Full reports are saved in `~/.nomoreaislop/analyses/`.
