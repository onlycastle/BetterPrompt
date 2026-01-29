# Troubleshooting: Communication Patterns Showing Non-User Content

## Problem Summary

Communication Patterns analysis was displaying **non-user content** (AI responses or system messages) in the examples section.

### Symptoms
- 3 different JSONL files analyzed showed identical examples in Communication Patterns
- Examples contained hydration error messages (system/AI content) instead of user input
- All patterns showed the same contaminated examples

### Expected Behavior
- Each pattern should show **unique developer utterances** as examples
- Examples should contain only content the user actually typed

## Root Cause

### Data Flow
```
LLM Output (Phase 3)
  └─> promptPatterns[].examplesData: "utteranceId|analysis;..."  (v3 format)
  └─> promptPatterns[].examples: [{quote, analysis}]              (fallback)
        │
        ▼
sanitizePromptPatterns() in evaluation-assembler.ts
  └─> parseExamplesData() → utteranceId-based lookup
        │
        ├─ Success: quote from utteranceLookup ✅
        │
        └─ Failure (resolvedExamples.length === 0):
             └─> pattern.examples used ← 🔴 AI responses included
```

### Root Cause Details

1. **Unverified fallback in `sanitizePromptPatterns`**:
   ```typescript
   // BEFORE (buggy)
   const examples = resolvedExamples.length > 0
     ? resolvedExamples
     : (pattern.examples || []);  // ❌ No verification
   ```

2. **Broken verification chain**:
   - Phase 2 workers → `verifyPhase2WorkerExamples` ✅ (verified)
   - Phase 3 promptPatterns → **no verification** ❌

## Solution

### Files Modified

| File | Changes |
|------|---------|
| `src/lib/analyzer/stages/evaluation-assembler.ts` | Added quote verification utilities and fallback verification |

### Key Changes

1. **Added verification utilities** to `evaluation-assembler.ts`:
   - `normalizeText()` - Text normalization for comparison
   - `quotesMatch()` - Flexible quote matching with truncation handling
   - `matchesCorpus()` - Corpus matching
   - `isValidDeveloperQuote()` - Filters quotes by corpus matching

2. **Modified `sanitizePromptPatterns`** to verify fallback examples:
   ```typescript
   // AFTER (fixed)
   if (resolvedExamples.length > 0) {
     examples = resolvedExamples;  // Already verified via utteranceId
   } else if (pattern.examples && devTexts.length > 0) {
     // Fallback WITH verification
     examples = pattern.examples.filter((ex: any) => {
       return isValidDeveloperQuote(ex.quote, devTexts, aiTexts);
     });
   }
   ```

3. **Added debug logging** (controlled by `DEBUG_PROMPT_PATTERNS=true`)

## Debugging

### Enable Debug Logging

```bash
DEBUG_PROMPT_PATTERNS=true npx tsx scripts/debug-analysis.ts
```

### Log Output Format

```
[EvalAssembler] Pattern 1: Context-Rich Requests
[EvalAssembler]   examplesData: session_abc123_0|Shows clear context...
[EvalAssembler]   parsedExamples: 2 items
[EvalAssembler]   resolvedExamples: 2 items
[EvalAssembler]   → Using resolved examples (2 items)

[EvalAssembler] Pattern 2: Iterative Refinement
[EvalAssembler]   examplesData: EMPTY...
[EvalAssembler]   parsedExamples: 0 items
[EvalAssembler]   resolvedExamples: 0 items
[EvalAssembler]   ⚠️ FALLBACK: Using LLM examples with verification
[EvalAssembler]   Filtered AI response: "I'll help you with that. First, let me..."
[EvalAssembler]   Verification: kept=1, filtered=2 (original=3)
```

## Contamination Entry Points

| Priority | Location | File | Issue |
|----------|----------|------|-------|
| **High** | LLM filter failure fallback | `data-extractor-worker.ts:701-710` | All data classified as "developer" on LLM failure |
| **High** | Incomplete stripSystemTags | `data-extractor-worker.ts:529-555` | Plain-text system messages not detected |
| **Medium** | Paraphrased quote verification | `content-writer.ts:filterBySubstringMatch` | Substring match failure → passes |
| **Medium** | Phase 3 LLM direct generation | `content-writer-prompts.ts:429-432` | LLM generates quotes instead of IDs |
| **Low** | Dummy pattern generation | `evaluation-assembler.ts:341-351` | Minimum pattern guarantee |

## Prevention

1. **Always verify fallback data**: When primary resolution fails, don't trust LLM-generated content
2. **Use utteranceId references**: Phase 3 LLM should output IDs, not raw quotes
3. **Build verification corpora**: Always have developer/AI text corpora for verification
4. **Test with multiple files**: Ensure each analysis produces unique examples
