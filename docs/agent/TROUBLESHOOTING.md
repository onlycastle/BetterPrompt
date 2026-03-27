# Troubleshooting (Agent Reference)

## Analysis Pipeline

Analysis runs locally via the Claude Code plugin (`packages/plugin/`). Finished results sync to the server via `POST /api/analysis/sync`. The server no longer runs its own analysis pipeline.

## Plugin Setup (bp-setup)

The `bp-setup` wizard includes an MCP Readiness Gate that retries `get_user_prefs` up to 3 times (0s, 3s, 5s backoff) before proceeding. This handles the delay between plugin install/`/reload-plugins` and the MCP server becoming available. If all 3 attempts fail, the wizard exits with a reinstall suggestion. If the gate passes but `scan_sessions` fails in Step 2, setup continues (non-critical) — project selection in Step 3 will retry or offer defaults.

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
