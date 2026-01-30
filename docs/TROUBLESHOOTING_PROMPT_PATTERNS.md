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

---

## Investigation History (2026-01-30)

### Problem Persisted After Initial Fix

After removing the fallback logic in `evaluation-assembler.ts`, the problem **continued**. Examples still showed analysis text instead of user utterances:

```
"고충실도 에러 보고 100% 기술적 실패 발생 시 PostgreSQL 에러 코드와 전체 stack trace를 포함한 고충실도 에러 보고를 일관되게 제공합니다. Evidence › [Error: relation profiles already exists]..."
```

### Hypotheses Investigated

#### Hypothesis 1: Fallback Logic (FIXED)
- **Status**: ✅ Fixed in previous session
- **Change**: Removed fallback to `pattern.examples` in `sanitizePromptPatterns()`
- **Result**: Problem persisted → not the root cause

#### Hypothesis 2: ContentWriter Sends Raw `text` Instead of `displayText`
- **Location**: `content-writer.ts:123`
- **Finding**: ContentWriter sends `u.text` (raw, includes error logs, stack traces) to LLM
- **Expected**: Should send `u.displayText` (sanitized, error logs summarized as `[Error: ...]`)
- **Impact**: LLM sees cluttered text, may generate analysis text instead of using utteranceId

```typescript
// Current (problematic)
.map(u => ({ id: u.id, text: u.text.slice(0, 1500), wordCount: u.wordCount }))

// Should be
.map(u => ({ id: u.id, text: (u.displayText || u.text).slice(0, 1500), wordCount: u.wordCount }))
```

#### Hypothesis 3: LLM Outputs Analysis Text as Quote
- **Location**: ContentWriter LLM output → `examplesData` field
- **Finding**: LLM may output `"분석 텍스트...|analysis"` instead of `"utteranceId|analysis"`
- **parseExamplesData behavior**:
  - If `firstPart` has spaces or no `_`: `utteranceId = ''`
  - Should result in empty examples (filtered by `sanitizePromptPatterns`)
- **Question**: Why are contaminated quotes still appearing?

#### Hypothesis 4: Translator Format Mismatch
- **Location**: `translator-prompts.ts:112`
- **Finding**: ContentWriter outputs `"utteranceId|analysis"`, Translator expects `"originalQuote|translatedAnalysis"`
- **Impact**: None on quote field - Orchestrator only replaces `analysis` field, not `quote`
- **Conclusion**: ❌ Not the cause

#### Hypothesis 5: displayText Itself is Contaminated
- **Location**: `data-extractor-worker.ts:505-515`
- **Possibility**: DataExtractor LLM generates analysis text as `displayText`
- **Status**: Needs investigation

### Data Flow Analysis

```
Phase 1 (DataExtractor):
  developerUtterances[] with {id, text, displayText}
  - displayText: LLM sanitized (error logs → [Error: ...])

Phase 3 (ContentWriter):
  content-writer.ts:123
  topUtterances.map(u => ({
    id: u.id,
    text: u.text.slice(0, 1500),  ← 🔴 Uses raw text, not displayText!
    wordCount: u.wordCount
  }))
  ↓
  LLM generates examplesData = "utteranceId|analysis;..."

EvaluationAssembler:
  evaluation-assembler.ts:196
  utteranceLookup.set(u.id, u.displayText || u.text)  ← Uses displayText
  ↓
  utteranceLookup.get(utteranceId) → returns quote

Phase 4 (Translator) - non-English users only:
  Orchestrator merges: ep.examples[j].analysis = parts[1]  ← Only replaces analysis

UI (PromptPatternsClean.tsx):
  <blockquote>"{ex.quote}"</blockquote>  ← Shows quote field
  <p>{ex.analysis}</p>
```

### Files Examined

| File | Purpose | Finding |
|------|---------|---------|
| `content-writer.ts:123` | topUtterances generation | Uses `u.text` not `u.displayText` |
| `content-writer-prompts.ts:336-337` | LLM instructions | Says "use ID" but LLM may ignore |
| `evaluation-assembler.ts:186-281` | sanitizePromptPatterns | Correctly uses ID-based matching, no fallback |
| `verbose-evaluation.ts:175-188` | parseExamplesData | Correctly filters non-ID patterns |
| `translator-prompts.ts:112` | Translator format | Format mismatch but doesn't affect quote |
| `analysis-orchestrator.ts:853-861` | Merge translated | Only replaces analysis, not quote |
| `PromptPatternsClean.tsx:78` | UI display | Shows `ex.quote` directly |

### Recommended Fix

1. **ContentWriter displayText usage** (`content-writer.ts:123`):
   ```typescript
   text: (u.displayText || u.text).slice(0, 1500)
   ```

2. **Strengthen LLM prompt** (`content-writer-prompts.ts:336-337`):
   ```
   - CRITICAL: In examplesData, reference utterances ONLY by their exact ID
   - DO NOT copy, paraphrase, or include any quote text in examplesData
   - Valid: "7fdbb780_5|analysis"
   - INVALID: "Let me check this...|analysis"
   ```

### Debug Commands

```bash
# Enable debug logging for prompt patterns
DEBUG_PROMPT_PATTERNS=true npx tsx scripts/debug-specific-session.ts

# Check specific session
# Path: /Users/sungmancho/.claude/projects/-Users-sungmancho-projects-alfredworks/7fdbb780-a673-43b1-92f6-1f69c9b729f0.jsonl
```

### Open Questions

1. If `parseExamplesData` correctly filters non-ID patterns, why do contaminated quotes still appear?
2. Is `displayText` itself being set to analysis text by DataExtractor LLM?
3. Are there cached/old analysis results in the database being displayed?
