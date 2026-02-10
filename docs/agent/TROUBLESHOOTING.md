# Troubleshooting (Agent Reference)

## Pipeline Quick Reference

`JSONL → Phase 1 (DataExtractor) → Phase 1.1 (DeterministicScorer) → Phase 1.2 (DeterministicTypeMapper) → Phase 1.5 (SessionSummarizer) → Phase 2 (Workers) → Phase 2.5 (TypeClassifier) → Phase 2.75 (KnowledgeResourceMatcher) → Phase 2.8 (EvidenceVerifier) → Phase 3 (ContentWriter) → Phase 4 (Translator) → Assembly → ContentGateway → UI`

## Key Files

| File | Role |
|------|------|
| `src/lib/analyzer/workers/data-extractor-worker.ts` | Phase 1 utterance extraction + filtering + naturalLanguageSegments |
| `src/lib/models/phase1-output.ts` | Phase 1 schema (NaturalLanguageSegment) |
| `src/lib/models/agent-outputs.ts` | AgentOutputs type + `aggregateWorkerInsights()` |
| `src/lib/models/worker-insights.ts` | Evidence parsing (utteranceId required), `WORKER_DOMAIN_CONFIGS` |
| `src/lib/analyzer/stages/content-writer.ts` | Phase 3 utteranceId-based verification |
| `src/lib/analyzer/stages/content-writer-prompts.ts` | Phase 3 LLM prompts + `detectPrimaryLanguage()` |
| `src/lib/analyzer/stages/evaluation-assembler.ts` | `assembleEvaluation()` + `sanitizePromptPatterns()` + `buildTransformationAudit()` |
| `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | Pipeline coordination + `mergeTranslatedFields()` |
| `src/lib/analyzer/stages/evidence-verifier.ts` | Validates utteranceId references |

## Key Concepts

- **utteranceId**: `{sessionId}_{turnIndex}` (e.g., `7fdbb780_5`) — required in Phase 2 evidence
- **examples**: Structured `[{utteranceId, analysis}]` array in LLM schemas (legacy `examplesData` pipe-delimited fallback in assembler)
- **displayText**: LLM-sanitized text for UI display
- **naturalLanguageSegments**: `[{start, end, text}]` marking immutable developer natural language
- **transformationAudit**: Audit trail for original → displayText transformations

## Open Contamination Entry Points

| Priority | Location | Issue | Mitigation |
|----------|----------|-------|------------|
| High | LLM filter failure | All data classified as "developer" on LLM failure | Prompt enforcement + compression validation |
| Low | Regex patterns | New system metadata patterns may emerge | Monitor and update patterns |
| Low | Missing utteranceId | Phase 2 LLM outputs evidence without utteranceId | Prompt enforcement + parsing fallbacks |

## Prevention Checklist

1. Always verify fallback data against developer corpus
2. Use utteranceId references, not raw quotes
3. Build verification corpora (devTexts, aiTexts)
4. Connect Phase 2 evidence utteranceIds to Phase 3 topUtterances
5. All workers must filter by `isNoteworthy !== false && wordCount >= 8`
6. Validate displayText compression ratio (tiered: <50=80%, 50-200=50%, 200+=30%)
7. Minimum quote length = 15 characters
8. EvidenceVerifier must cover ALL worker domains including CommunicationPatterns
9. Extract naturalLanguageSegments to mark immutable developer text
10. Generate transformationAudit for every displayText transformation
11. Display integrity badges in UI (verbatim/summarized/mismatch)

## 3-Layer Defense (Evidence Quality)

| Layer | Location | Check |
|-------|----------|-------|
| 1. LLM Prompt | `data-extractor-worker.ts` | Explicit prohibition against summarizing developer's natural language |
| 2. Compression Validation | `data-extractor-worker.ts` | Tiered thresholds via `validateDisplayTextCompression()`: short<50=80%, medium<200=50%, long=30% |
| 3a. Worker Filter | All 5 Phase 2 workers | `isNoteworthy !== false && wordCount >= 8` in `preparePhase1ForPrompt()` |
| 3b. Quote Length | `worker-insights.ts` | `quote.length >= 15` |
| 3c. Assembly Gate | `evaluation-assembler.ts` | `wordCount < 8 or isNoteworthy === false` → skip |

## Worker Aggregation Checklist

> WARNING: When adding or modifying Phase 2 Workers, ALL of these must be updated:

1. Worker output schema in `src/lib/models/` (e.g., `communication-patterns-data.ts`)
2. `AgentOutputs` type in `agent-outputs.ts` (add worker output field)
3. `aggregateWorkerInsights()` function in `agent-outputs.ts` (add domain processing block)
4. `AggregatedWorkerInsights` type in `worker-insights.ts` (add domain field)
5. `WORKER_DOMAIN_CONFIGS` in `worker-insights.ts` (add UI config)

Bug History: `CommunicationPatterns` worker was missing from `aggregateWorkerInsights()`, causing Communication tab to not display.

## Translation Merge Warning

> WARNING: Translation must be applied AFTER `assembleEvaluation()`, not before.

Wrong: `Phase 4 → merge translations → assembleEvaluation()` (overwrites translations with English defaults)

Correct: `Phase 4 → store translatorData → assembleEvaluation()` (English) → `mergeTranslatedFields()` (overlay translations)

See `analysis-orchestrator.ts` for implementation.

## Debug Commands

```bash
DEBUG_PROMPT_PATTERNS=true npx tsx scripts/debug-analysis.ts       # Enable debug logging
npx tsx scripts/analyze-utterance-lengths.ts <jsonl-path>          # Analyze utterance lengths
```

## UI Integrity Badges

| Status | Icon | Meaning | CSS Class |
|--------|------|---------|-----------|
| `verbatim` | check | Quote matches original exactly | `integrityVerbatim` (green) |
| `summarized` | half-circle | Machine content summarized | `integritySummarized` (amber) |
| `mismatch` | warning | Unexpected deviation | `integrityMismatch` (red) |
| `unknown` | — | No audit data (legacy) | (hidden) |

Display component: `ExpandableEvidence.tsx` with `ExpandableEvidence.module.css`.

## Gemini Schema Nesting Limit

Gemini API has a maximum nesting depth of 4 levels for `responseJsonSchema`. Only `object` ({}) counts toward depth; `array` ([]) does NOT count.

Error symptom: `"A schema in GenerationConfig in the request exceeds the maximum allowed nesting depth"`

Guidelines:
- `z.array(z.object({...}))` is safe — arrays don't add nesting
- Avoid deep `z.object({ nested: z.object({...}) })` chains beyond 4 levels
- All LLM schemas use structured JSON — no pipe/semicolon-delimited fields remain
- Nesting depth tested for `NarrativeLLMResponseSchema` and `TranslatorOutputSchema`
