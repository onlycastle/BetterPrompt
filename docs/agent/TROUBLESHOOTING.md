# Troubleshooting (Agent Reference)

## Analysis Pipeline

Analysis runs locally via the Claude Code plugin (`packages/plugin/`). Finished results sync to the server via `POST /api/analysis/sync`. The server no longer runs its own analysis pipeline.

## Key Files

| File | Role |
|------|------|
| `src/lib/models/phase1-output.ts` | Phase 1 schema (NaturalLanguageSegment) |
| `src/lib/models/agent-outputs.ts` | AgentOutputs type + `aggregateWorkerInsights()` |
| `src/lib/models/worker-insights.ts` | Evidence parsing (utteranceId required), `WORKER_DOMAIN_CONFIGS` |
| `src/lib/models/verbose-evaluation.ts` | Evaluation data model + legacy pipe-delimited parsers |

## Key Concepts

- **utteranceId**: `{sessionId}_{turnIndex}` (e.g., `7fdbb780_5`) — required in Phase 2 evidence
- **displayText**: LLM-sanitized text for UI display
- **naturalLanguageSegments**: `[{start, end, text}]` marking immutable developer natural language

## UI Integrity Badges

| Status | Icon | Meaning | CSS Class |
|--------|------|---------|-----------|
| `verbatim` | check | Quote matches original exactly | `integrityVerbatim` (green) |
| `summarized` | half-circle | Machine content summarized | `integritySummarized` (amber) |
| `mismatch` | warning | Unexpected deviation | `integrityMismatch` (red) |
| `unknown` | — | No audit data (legacy) | (hidden) |

Display component: `ExpandableEvidence.tsx` with `ExpandableEvidence.module.css`.
