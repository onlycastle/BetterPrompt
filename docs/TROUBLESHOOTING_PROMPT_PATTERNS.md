# Troubleshooting: Communication Patterns

## Problem Summary

Communication Patterns section displays incorrect content (AI responses, system messages, empty examples) instead of unique developer utterances.

---

## Architecture Quick Reference

```
JSONL → Phase 1 (DataExtractor) → Phase 2 (Workers) → Phase 3 (ContentWriter) → UI
              ↓                          ↓                    ↓
        developerUtterances        agentOutputs         promptPatterns
        (id, text, displayText)    (Your Insights)      (Comm. Patterns)
                                        ↓
                              evidence with utteranceId
                              (REQUIRED for verification)
```

### Phase 2 → Phase 3 Data Flow (utteranceId)

```
Phase 2 Workers (Analysis)
├── Macro-level analysis of developerUtterances
├── Pattern discovery (strengths, growthAreas, antiPatterns)
└── Evidence with **required utteranceId**
    Format: "utteranceId:quote[:context]"

Phase 3 ContentWriter (Verification)
├── extractEvidenceUtteranceIds() → Extract utteranceIds from Phase 2 evidence
├── topUtterances = Phase 2 evidence-based filtering (NOT first 20)
├── Lookup original text by utteranceId
└── Replace quote with original (prevent LLM paraphrase)
```

> ⚠️ **Important**: Only utteranceIds that Phase 2 workers used for analysis are passed to Phase 3 topUtterances.
> This ensures Communication Patterns examples semantically match the actual analysis content.

### Key Files

| File | Role |
|------|------|
| `data-extractor-worker.ts` | Phase 1 - Utterance extraction + filtering |
| `worker-insights.ts` | Phase 2 - Evidence parsing (utteranceId required) |
| `content-writer.ts` | Phase 3 - utteranceId-based verification |
| `content-writer-prompts.ts` | Phase 3 - LLM prompt for examplesData |
| `evaluation-assembler.ts` | sanitizePromptPatterns + utteranceLookup |

### Key Concepts

- **utteranceId**: `{sessionId}_{turnIndex}` (e.g., "7fdbb780_5") - **Required in Phase 2 evidence**
- **examplesData**: `"utteranceId|analysis;utteranceId|analysis;..."`
- **displayText**: LLM-sanitized text for UI display
- **text**: Original raw text (may contain errors, stack traces)

---

## Change Log

| Date | Issue | Solution | Files Modified |
|------|-------|----------|----------------|
| 2026-01-31 | **Phase 2 evidence-based topUtterances** | Extract utteranceIds from Phase 2 evidence via `extractEvidenceUtteranceIds()`, use for topUtterances filtering | `content-writer.ts` |
| 2026-01-31 | **utteranceId enforcement** | utteranceId required in Phase 2 evidence, ID-based verification only | `worker-insights.ts`, `content-writer.ts`, 4 worker prompts |
| 2026-01-31 | Empty Communication Patterns examples | LLM prompt table format + explicit examplesData rules | `content-writer-prompts.ts` |
| 2026-01-31 | topUtterances length bias | Removed `characterCount > 200` filter, use `displayText` | `content-writer.ts` |
| 2026-01-31 | Single-char utterances (".", "ㅇ") | Added `length <= 1` check in `isKnownSystemMetadata()` | `data-extractor-worker.ts` |
| 2026-01-31 | Error stacks in examples | Added regex patterns for `^Error:`, stack traces | `data-extractor-worker.ts` |
| 2026-01-31 | Server logs in examples | Added regex patterns for HTTP request logs | `data-extractor-worker.ts` |
| 2026-01-31 | LLM threshold too high | Changed `LLM_FILTER_MIN_LENGTH`: 100 → 10 | `data-extractor-worker.ts` |
| 2026-01-30 | AI responses in examples | Added fallback verification in `sanitizePromptPatterns()` | `evaluation-assembler.ts` |

---

## TODO

| Priority | Task | Context |
|----------|------|---------|
| ~~Medium~~ | ~~topUtterances diversity sampling~~ | **Resolved** - Fixed via Phase 2 evidence-based selection |

---

## Contamination Entry Points

| Priority | Location | Issue | Status |
|----------|----------|-------|--------|
| High | LLM filter failure | All data classified as "developer" on LLM failure | Open |
| ~~Medium~~ | ~~Paraphrased quotes~~ | ~~Substring match failure → passes through~~ | **Resolved** (utteranceId enforcement) |
| Low | Regex patterns | New system metadata patterns may emerge | Ongoing |
| Low | Missing utteranceId | Phase 2 LLM outputs evidence without utteranceId | Mitigated (prompts + parsing) |

---

## Debug Commands

```bash
# Enable debug logging
DEBUG_PROMPT_PATTERNS=true npx tsx scripts/debug-analysis.ts

# Analyze utterance lengths
npx tsx scripts/analyze-utterance-lengths.ts <jsonl-path>
```

---

## Prevention Checklist

1. ✅ Always verify fallback data against developer corpus
2. ✅ Use utteranceId references, not raw quotes
3. ✅ Build verification corpora (devTexts, aiTexts)
4. ✅ Test with multiple JSONL files for unique examples
5. ✅ Connect Phase 2 evidence utteranceIds to Phase 3 topUtterances

---

## Critical Design Principle: Phase 2 Evidence Consistency

> ⚠️ **Utterances identified by Phase 2 must be used throughout the pipeline.**

### Problem Background

In the previous implementation, there was a disconnect between Phase 2 workers' evidence and Phase 3 ContentWriter's topUtterances:

```
Phase 2: "This utterance is evidence for 'structured thinking' pattern" (utteranceId: abc_5)
    ↓ (disconnect)
Phase 3: topUtterances = phase1.slice(0, 20)  ← abc_5 might not be included!
    ↓
Result: "structured thinking" pattern gets unrelated examples
```

### Solution

`extractEvidenceUtteranceIds()` extracts all utteranceIds from Phase 2 workers' evidence to construct topUtterances:

```typescript
// content-writer.ts
const evidenceIds = extractEvidenceUtteranceIds(agentOutputs);
const topUtterances = phase1Output.developerUtterances
  .filter(u => evidenceIds.has(u.id))  // Only Phase 2-used utterances!
  .map(...);
```

### Extraction Targets (Phase 2 Evidence Sources)

| Worker | Evidence Location |
|--------|-------------------|
| TrustVerification | `antiPatterns[].examples[].utteranceId` |
| WorkflowHabit | `criticalThinkingMoments[].utteranceId`, `planningHabits[].examples[].utteranceId` |
| StrengthGrowth | `strengths[].evidence[].utteranceId`, `growthAreas[].evidence[].utteranceId` |
| KnowledgeGap | `strengths[].evidence[].utteranceId`, `growthAreas[].evidence[].utteranceId` |
| ContextEfficiency | `strengths[].evidence[].utteranceId`, `growthAreas[].evidence[].utteranceId` |

### Implementation Notes

1. **Type mismatch warning**: `PlanningHabit.examples` is typed as `string[]` in the schema, but after `verifyPhase2WorkerExamples()` mutation at runtime it becomes `{ utteranceId, quote }[]`. Runtime type guards are required:
   ```typescript
   for (const ex of (ph.examples || []) as unknown[]) {
     if (typeof ex === 'object' && ex !== null && 'utteranceId' in ex) {
       const exObj = ex as { utteranceId?: unknown };
       if (typeof exObj.utteranceId === 'string') {
         ids.add(exObj.utteranceId);
       }
     }
   }
   ```

2. **No Fallback Policy**: If Phase 2 evidence is empty, throw an error instead of falling back to first 20 utterances. This follows the project's "No Fallback Policy" - errors must surface rather than be hidden with default data.

3. **Consistency verification**: Ensure Phase 3 promptPatterns examples semantically match Phase 2 analysis content.
