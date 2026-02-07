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
| `data-extractor-worker.ts` | Phase 1 - Utterance extraction + filtering + naturalLanguageSegments |
| `phase1-output.ts` | Phase 1 - Schema definitions (NaturalLanguageSegment) |
| `worker-insights.ts` | Phase 2 - Evidence parsing (utteranceId required) |
| `content-writer.ts` | Phase 3 - utteranceId-based verification |
| `content-writer-prompts.ts` | Phase 3 - LLM prompt for structured examples |
| `evaluation-assembler.ts` | sanitizePromptPatterns + utteranceLookup + transformationAudit |
| `verbose-evaluation.ts` | TransformationAuditEntry schema |
| `ExpandableEvidence.tsx` | UI - Integrity badges display |

### Key Concepts

- **utteranceId**: `{sessionId}_{turnIndex}` (e.g., "7fdbb780_5") - **Required in Phase 2 evidence**
- **examples**: Structured `[{utteranceId, analysis}]` array (legacy `examplesData` pipe-delimited fallback in assembler)
- **displayText**: LLM-sanitized text for UI display
- **text**: Original raw text (may contain errors, stack traces)
- **naturalLanguageSegments**: Array of `{start, end, text}` marking developer natural language (immutable)
- **transformationAudit**: Audit trail recording original→displayText transformations with integrity status

---

## Change Log

| Date | Issue | Solution | Files Modified |
|------|-------|----------|----------------|
| 2026-02-01 | **Data Integrity: UI badges** (P1) | Added integrity badges (✓/◐/⚠) showing verbatim/summarized/mismatch status | `ExpandableEvidence.tsx`, `ExpandableEvidence.module.css` |
| 2026-02-01 | **Data Integrity: Audit trail** (P1) | Added `TransformationAuditEntry` schema + `buildTransformationAudit()` function | `verbose-evaluation.ts`, `evaluation-assembler.ts` |
| 2026-02-01 | **Data Integrity: naturalLanguageSegments** (P0) | Mark developer natural language segments as immutable (vs machine content) | `phase1-output.ts`, `data-extractor-worker.ts` |
| 2026-02-01 | **Data Integrity: Tiered validation** (P0) | Length-based compression thresholds: <50=80%, 50-200=50%, 200+=30% | `data-extractor-worker.ts` |
| 2026-02-01 | **LLM corrupting displayText** (P0) | Added explicit prohibition in LLM prompt + compression ratio validation (reject if `< 10 chars` or `ratio < 0.3 && original < 200`) | `data-extractor-worker.ts` |
| 2026-02-01 | **4 workers missing isNoteworthy filter** (P1) | Added `isNoteworthy !== false && wordCount >= 8` filter to preparePhase1ForPrompt() | `trust-verification-worker.ts`, `workflow-habit-worker.ts`, `knowledge-gap-worker.ts`, `context-efficiency-worker.ts` |
| 2026-02-01 | **CommunicationPatterns bypassing EvidenceVerifier** (P2) | Added `communicationPatterns` to verification scope | `evidence-verifier.ts`, `agent-outputs.ts`, `worker-insights.ts`, `verbose-evaluation.ts`, `WorkerInsightsSection.tsx` |
| 2026-02-01 | **quote.length > 0 too permissive** (P2) | Changed minimum quote length from 1 to 15 characters | `worker-insights.ts` |
| 2026-02-01 | **Assembly quality gate** (P3) | Added quality filter to utteranceLookup building in resolvePatternQuotes() | `evaluation-assembler.ts` |
| 2026-01-31 | **Phase 2 evidence-based topUtterances** | Extract utteranceIds from Phase 2 evidence via `extractEvidenceUtteranceIds()`, use for topUtterances filtering | `content-writer.ts` |
| 2026-01-31 | **utteranceId enforcement** | utteranceId required in Phase 2 evidence, ID-based verification only | `worker-insights.ts`, `content-writer.ts`, 4 worker prompts |
| 2026-01-31 | Empty Communication Patterns examples | LLM prompt table format + explicit examples rules | `content-writer-prompts.ts` |
| 2026-01-31 | topUtterances length bias | Removed `characterCount > 200` filter, use `displayText` | `content-writer.ts` |
| 2026-02-01 | **Removed regex pre-filtering** | Deleted `isKnownSystemMetadata()`, rely solely on LLM classification with enhanced CLI patterns | `data-extractor-worker.ts` |
| ~~2026-01-31~~ | ~~Single-char utterances (".", "ㅇ")~~ | ~~Added `length <= 1` check in `isKnownSystemMetadata()`~~ | ~~Removed~~ |
| ~~2026-01-31~~ | ~~Error stacks in examples~~ | ~~Added regex patterns for `^Error:`, stack traces~~ | ~~Removed~~ |
| ~~2026-01-31~~ | ~~Server logs in examples~~ | ~~Added regex patterns for HTTP request logs~~ | ~~Removed~~ |
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
| ~~High~~ | ~~LLM corrupting displayText~~ | ~~"1번을 실행하면" → "1"~~ | **Resolved** (tiered compression validation + audit trail) |
| ~~Medium~~ | ~~4 workers missing filter~~ | ~~Short utterances sent to LLM, selected as evidence~~ | **Resolved** (isNoteworthy filter) |
| ~~Medium~~ | ~~Paraphrased quotes~~ | ~~Substring match failure → passes through~~ | **Resolved** (utteranceId enforcement) |
| ~~Medium~~ | ~~CommunicationPatterns bypass~~ | ~~Examples skip EvidenceVerifier~~ | **Resolved** (added to verification scope) |
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
6. ✅ All workers must filter by `isNoteworthy !== false && wordCount >= 8`
7. ✅ Validate displayText compression ratio (reject if over-compressed)
8. ✅ Minimum quote length = 15 characters (not just > 0)
9. ✅ EvidenceVerifier must cover ALL worker domains including CommunicationPatterns
10. ✅ Use tiered compression thresholds based on text length (<50=80%, 50-200=50%, 200+=30%)
11. ✅ Extract naturalLanguageSegments to mark immutable developer text
12. ✅ Generate transformationAudit for every displayText transformation
13. ✅ Display integrity badges in UI (verbatim/summarized/mismatch)

---

## 3-Layer Defense Strategy (Evidence Quality)

> ⚠️ **Implemented 2026-02-01**: Multi-layer defense to prevent low-quality evidence in UI
>
> 📌 **See also**: [Data Integrity Architecture](#data-integrity-architecture-developer-natural-language-preservation) for the enhanced 4-layer defense with audit trail.

### The Problem

Free user analysis showed 3 critical issues:
1. **Analysis-Evidence mismatch**: "미니멀리스트 개발자 피드백" showing evidence "1", "이건 잘 되었어"
2. **Same utterance repeated**: Same quotes appear across multiple sections
3. **Too short utterances**: Short phrases used as valid evidence

Root cause: LLM over-summarizing developer text (e.g., "1번을 실행하면 이렇게 나와" → "1")

### Solution: 3-Layer Defense

```
Layer 1 (LLM Prompt)          Layer 2 (Validation)         Layer 3 (Filtering)
┌─────────────────────┐       ┌─────────────────────┐       ┌─────────────────────┐
│ Explicit prohibition│       │ Compression ratio   │       │ isNoteworthy filter │
│ against summarizing │  →    │ check: reject if    │  →    │ + quote.length >= 15│
│ developer's words   │       │ ratio < 0.3 or < 10 │       │ + assembly gate     │
└─────────────────────┘       └─────────────────────┘       └─────────────────────┘
```

### Layer Details

| Layer | File | Check |
|-------|------|-------|
| 1. LLM Prompt | `data-extractor-worker.ts` | `CRITICAL RULE: Never Summarize Developer's Natural Language` |
| 2. displayText Validation | `data-extractor-worker.ts` | **Tiered**: <50=80%, 50-200=50%, 200+=30% (via `validateDisplayTextCompression()`) |
| 3a. Worker Filter | 4 workers | `isNoteworthy !== false && wordCount >= 8` in `preparePhase1ForPrompt()` |
| 3b. Quote Length | `worker-insights.ts` | `quote.length >= 15` (was > 0) |
| 3c. Assembly Gate | `evaluation-assembler.ts` | `wordCount < 8 || isNoteworthy === false` → skip |

### Worker Consistency

Previously, only CommunicationPatterns had the isNoteworthy filter. Now all 5 workers use consistent filtering:

| Worker | isNoteworthy Filter | Status |
|--------|---------------------|--------|
| TrustVerification | `isNoteworthy !== false && wordCount >= 8` | ✅ Added |
| WorkflowHabit | `isNoteworthy !== false && wordCount >= 8` | ✅ Added |
| KnowledgeGap | `isNoteworthy !== false && wordCount >= 8` | ✅ Added |
| ContextEfficiency | `isNoteworthy !== false && wordCount >= 8` | ✅ Added |
| CommunicationPatterns | `isNoteworthy !== false && wordCount >= 8` | ✅ Already had |

---

## Data Integrity Architecture (Developer Natural Language Preservation)

> ⚠️ **Implemented 2026-02-01**: Developer natural language must be preserved 100% verbatim, like academic references.

### Core Principle

| Protected (Immutable) | Transformable |
|----------------------|---------------|
| Developer-typed natural language | System tags, error logs, stack traces |
| "이 함수가 왜 null을 리턴하는지 모르겠어" | `Error: Connection timeout` → `[Error: timeout]` |
| Decisions, questions, feedback | Code blocks, CLI output |

### 4-Layer Defense Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ Layer 1: LLM Prompt (Prevention)                                            │
│ - Explicit prohibition against summarizing developer's natural language     │
│ - LENGTH-BASED RULES in prompt                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│ Layer 2: Tiered Compression Validation (Detection)                          │
│ - Short (<50 chars): 80% preservation required                              │
│ - Medium (50-200): 50% preservation required                                │
│ - Long (200+): 30% preservation required                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│ Layer 3: naturalLanguageSegments (Marking)                                  │
│ - Extract and mark developer natural language segments                      │
│ - Segments are immutable throughout the pipeline                            │
├─────────────────────────────────────────────────────────────────────────────┤
│ Layer 4: Transformation Audit Trail (Verification)                          │
│ - Record every original→displayText transformation                          │
│ - Calculate integrity status (verbatim/summarized/mismatch)                 │
│ - Display badges in UI for transparency                                     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Tiered Compression Validation

```typescript
// data-extractor-worker.ts: validateDisplayTextCompression()
if (originalLength < 50) {
  // Short text: 80% must be preserved
  if (compressionRatio < 0.8) return { valid: false, reason: 'short_text_over_compressed' };
} else if (originalLength < 200) {
  // Medium text: 50% must be preserved
  if (compressionRatio < 0.5) return { valid: false, reason: 'medium_text_over_compressed' };
} else {
  // Long text (machine content): 30% threshold (existing)
  if (compressionRatio < 0.3) return { valid: false, reason: 'long_text_over_compressed' };
}
```

### naturalLanguageSegments Schema

```typescript
// phase1-output.ts
export const NaturalLanguageSegmentSchema = z.object({
  start: z.number().int().min(0),  // Start index in original text
  end: z.number().int().min(0),    // End index in original text
  text: z.string(),                 // The immutable segment
});

// In DeveloperUtteranceSchema:
naturalLanguageSegments: z.array(NaturalLanguageSegmentSchema).optional(),
```

### Transformation Audit Schema

```typescript
// verbose-evaluation.ts
export const TransformationAuditEntrySchema = z.object({
  utteranceId: z.string(),
  originalText: z.string(),
  displayText: z.string(),
  transformationType: z.enum([
    'none', 'system_tag_removed', 'error_summarized',
    'stack_trace_summarized', 'code_block_summarized', 'truncated', 'mixed',
  ]),
  isVerbatim: z.boolean(),           // displayText === originalText
  compressionRatio: z.number(),      // displayText.length / originalText.length
  validationPassed: z.boolean(),     // Passed tiered validation
  validationReason: z.string(),      // 'passed', 'short_text_over_compressed', etc.
  transformedSegments: z.array(z.object({
    original: z.string(),
    transformed: z.string(),
    reason: z.string(),
  })).optional(),
});
```

### UI Integrity Badges

| Status | Icon | Meaning | CSS Class |
|--------|------|---------|-----------|
| `verbatim` | ✓ | Quote matches original exactly | `integrityVerbatim` (green) |
| `summarized` | ◐ | Machine content summarized | `integritySummarized` (amber) |
| `mismatch` | ⚠ | Unexpected deviation | `integrityMismatch` (red) |
| `unknown` | - | No audit data (legacy) | (hidden) |

### Implementation Files

| File | Changes |
|------|---------|
| `phase1-output.ts` | Added `NaturalLanguageSegmentSchema`, `naturalLanguageSegments` field |
| `data-extractor-worker.ts` | Added `validateDisplayTextCompression()`, `extractNaturalLanguageSegments()` |
| `verbose-evaluation.ts` | Added `TransformationAuditEntrySchema`, `transformationAudit` field |
| `evaluation-assembler.ts` | Added `buildTransformationAudit()`, `detectTransformationType()` |
| `ExpandableEvidence.tsx` | Added integrity badge display with tooltips |
| `ExpandableEvidence.module.css` | Added badge styles (colors, hover effects) |

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
| CommunicationPatterns | `patterns[].examples[].utteranceId`, `strengths[].evidence[].utteranceId`, `growthAreas[].evidence[].utteranceId` |

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
