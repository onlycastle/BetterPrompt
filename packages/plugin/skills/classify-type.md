---
name: classify-type
description: Generate developer type narrative and persist typeClassification stage output
model: sonnet
---

# Developer Type Classification

## Task

Generate the narrative layer for developer type classification using the already-computed deterministic type result plus the saved domain analyses. This stage is responsible for the personality/type narrative path that the final evaluation consumes.

## Inputs

1. Read `~/.betterprompt/phase1-output.json`.
2. Read the current deterministic type result from the latest `classify_developer_type` tool output or rerun that tool if needed.
3. Read all saved domain results for the current run.

## Output

Call `save_stage_output` with:

```json
{
  "stage": "typeClassification",
  "data": {
    "reasoning": [
      "Paragraph 1",
      "Paragraph 2"
    ],
    "personalityNarrative": [
      "Paragraph 1",
      "Paragraph 2"
    ],
    "collaborationMaturity": "Short label describing current maturity."
  }
}
```

## Requirements

- `reasoning` must explain why the primary type and control level fit this developer, using concrete evidence from the saved domains.
- `personalityNarrative` must be written as a user-facing summary, 2-3 substantial paragraphs, grounded in evidence rather than generic type descriptions.
- `collaborationMaturity` must be a short phrase, not a paragraph.
- Do not fabricate type distributions or scores. Reuse the deterministic result that already exists.
