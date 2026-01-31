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

---

## Architecture Overview (2026-01-31)

Understanding the full data flow helps identify where contamination can occur.

### Core Files

| File | Role |
|------|------|
| `src/lib/analyzer/workers/data-extractor-worker.ts` | Phase 1 - Raw utterance extraction |
| `src/lib/models/phase1-output.ts` | DeveloperUtterance type definition |
| `src/lib/analyzer/shared/sampling-utils.ts` | Strategic sampling logic |
| `src/lib/models/worker-insights.ts` | Phase 2 worker insights types |
| `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | Pipeline orchestration |
| `src/components/personal/tabs/insights/ExpandableEvidence.tsx` | Frontend rendering |

### Full Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            JSONL Session Logs                               │
│                     (~/.claude/projects/**/*.jsonl)                         │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                      PHASE 1: DataExtractorWorker                           │
│                  (data-extractor-worker.ts:46-730)                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. extractFromSession()        ┌─────────────────────────────────────┐    │
│     • Iterates session messages  │    ParsedMessage                    │    │
│     • role === 'user' → extract  │    {                                 │    │
│     • role === 'assistant' skip  │      role: 'user' | 'assistant'     │    │
│                                  │      content: string                 │    │
│  2. extractDeveloperUtterance() │      timestamp: Date                 │    │
│     • stripSystemTags()         │      toolCalls?: ToolCall[]          │    │
│     • Compute structural meta   │    }                                 │    │
│                                  └─────────────────────────────────────┘    │
│  3. isKnownSystemMetadata()        ◄── Regex fast path (no LLM cost)       │
│     • Skill docs, session context, system instructions                      │
│     • Insight blocks (★ Insight, ─────)                                     │
│     • Error stacks, server logs  → FILTER OUT                               │
│                                                                             │
│  4. filterSystemMetadataWithLLM()  ◄── LLM classification (remaining)      │
│     • < 10 chars: Skip LLM (pass through)                                   │
│     • >= 10 chars: Gemini classification                                    │
│       - "developer" → keep                                                  │
│       - "system" → filter out                                               │
│     • Generate displayText (sanitization)                                   │
│                                                                             │
│  5. strategicSampleUtterances()  ┌────────────────────────────────────┐    │
│     • MAX_UTTERANCES: 250       │    Sampling Strategy                │    │
│     • Bookend: first+last/session│    • Preserve first/last per session│    │
│     • Fill: evenly spaced middle │    • Evenly space remaining         │    │
│                                  └────────────────────────────────────┘    │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Phase1Output                                       │
│                      (phase1-output.ts:35-98)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                          │
│    developerUtterances: DeveloperUtterance[]  ◄── Core data                │
│    aiResponses: AIResponse[]                                                │
│    sessionMetrics: Phase1SessionMetrics                                     │
│  }                                                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│  DeveloperUtterance {                                                       │
│    id: "{sessionId}_{turnIndex}"    ◄── Unique identifier                  │
│    text: string                      ◄── Original text (truncated to 2000) │
│    displayText?: string              ◄── LLM-sanitized display text        │
│    timestamp, sessionId, turnIndex                                          │
│    characterCount, wordCount         ◄── Structural metadata               │
│    hasCodeBlock, hasQuestion                                                │
│    isSessionStart, isContinuation                                           │
│    precedingAIToolCalls, precedingAIHadError  ◄── Context metadata         │
│  }                                                                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌─────────────────────────────────┐   ┌─────────────────────────────────────┐
│   PHASE 2: Insight Workers      │   │   PHASE 3: ContentWriter            │
│   (4 workers in parallel)       │   │   (content-writer.ts:106-151)       │
├─────────────────────────────────┤   ├─────────────────────────────────────┤
│                                 │   │                                     │
│  TrustVerificationWorker        │   │  topUtterances selection:          │
│  WorkflowHabitWorker            │   │  • characterCount > 200             │
│  KnowledgeGapWorker             │   │  • hasCodeBlock priority            │
│  ContextEfficiencyWorker        │   │  • Sort by wordCount                │
│                                 │   │  • Top 20 selected                  │
│  Each Worker outputs:           │   │                                     │
│  ┌───────────────────────────┐  │   │  Used for promptPatterns examples  │
│  │  strengths: [             │  │   │  (Communication Patterns section)  │
│  │    {                      │  │   │                                     │
│  │      title, description,  │  │   └─────────────────────────────────────┘
│  │      evidence: [          │  │
│  │        {                  │◄─┼── References Phase1Output via utteranceId
│  │          utteranceId,     │  │
│  │          quote,           │  │
│  │          context          │  │
│  │        }                  │  │
│  │      ]                    │  │
│  │    }                      │  │
│  │  ]                        │  │
│  │  growthAreas: [...]       │  │
│  └───────────────────────────┘  │
└────────────────┬────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2.8: EvidenceVerifier                              │
│                   (evidence-verifier.ts)                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Verifies relevance of worker-selected evidence                           │
│  • Validates against original utterance via utteranceId                     │
│  • Filters out low-relevance evidence                                       │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       VerboseEvaluation                                     │
│                   (verbose-evaluation.ts)                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  {                                                                          │
│    agentOutputs: {                                                          │
│      trustVerification: { strengths, growthAreas, ... }  ◄── Your Insights │
│      workflowHabit: { ... }                                                 │
│      knowledgeGap: { ... }                                                  │
│      contextEfficiency: { ... }                                             │
│    }                                                                        │
│    promptPatterns: [{ examples: [{quote, analysis}] }]  ◄── Comm. Patterns │
│    utteranceLookup: Map<utteranceId, UtteranceLookupEntry>                  │
│  }                                                                          │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Frontend: ExpandableEvidence                             │
│               (ExpandableEvidence.tsx:70-147)                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Render evidence array                                                   │
│     • isStructuredEvidence() check                                         │
│       - string → legacy (plain quote)                                       │
│       - { utteranceId, quote, context } → structured evidence              │
│                                                                             │
│  2. Lookup original via utteranceLookup                                     │
│     • utteranceId → original text, sessionId, turnIndex, timestamp         │
│                                                                             │
│  3. Expanded detail view                                                    │
│     • isPaid=true: Full original message, metadata                          │
│     • isPaid=false: "Unlock to see full context"                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Detailed Data Flow

#### 1. System Tag Removal (stripSystemTags)
```
Before: "<system-reminder>.....</system-reminder>Fix the bug in auth.ts"
After:  "Fix the bug in auth.ts"
```

Tags removed:
- `<system-reminder>` - Claude Code system reminders
- `<command-name>`, `<command-args>` - Slash commands
- `<task-notification>` - Sisyphus system

#### 1.5. Regex Fast Path (isKnownSystemMetadata)

Before LLM classification, a regex-based fast path filters obvious system metadata without consuming LLM tokens.

**Location**: `data-extractor-worker.ts:540-567`

```typescript
const knownPatterns = [
  // Skill documentation blocks
  /^Base directory for this skill:/i,
  /^This skill is located at:/i,

  // Session continuation summaries
  /^This session is being continued from a previous conversation/i,
  /^Continuing from previous session/i,

  // Claude Code internal instructions
  /^IMPORTANT: this context may or may not be relevant/i,
  /^The following skills are available/i,

  // Plan execution prompts (system-injected by /plan skill)
  /^Implement the following plan:/i,

  // Claude-generated Insight blocks (injected via session context)
  /★ Insight/,
  /`★ Insight/,
  /^─{10,}/,  // Lines starting with long dashes (Insight block borders)

  // Error stacks and tracebacks (pasted debug output, not developer intent)
  /^Error:|^ERROR:|^Exception:|^Traceback \(most recent call last\):/,
  /^\s+at \w+\.\w+\s*\(/m,  // JavaScript/TypeScript stack trace lines

  // Server logs (pasted terminal output, not developer intent)
  /^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD) \/\S+.*\d{3}/m,  // HTTP request logs with status
];
```

**Flow**:
```
Input text
    │
    ▼
isKnownSystemMetadata(text)
    │
    ├─ MATCHES pattern → FILTER OUT (no LLM call)
    │
    └─ NO MATCH → Continue to LLM classification
```

**Pattern Categories** (2026-01-31):

| Category | Patterns | Purpose |
|----------|----------|---------|
| Skill docs | `^Base directory for this skill:`, `^This skill is located at:` | Claude Code skill injections |
| Session context | `^This session is being continued...`, `^Continuing from previous session` | Context restoration summaries |
| System instructions | `^IMPORTANT: this context may or may not be relevant`, `^The following skills are available` | Internal Claude Code instructions |
| Plan prompts | `^Implement the following plan:` | /plan skill injections |
| Insight blocks | `★ Insight`, `` `★ Insight ``, `^─{10,}` | AI-generated educational content |
| Error stacks | `^Error:`, `^ERROR:`, `^Exception:`, `^Traceback`, stack trace lines | Pasted debug output |
| Server logs | HTTP methods with status codes (GET/POST/etc.) | Pasted terminal output |

#### 2. LLM-based Metadata Filtering
```
┌──────────────────────────────────────────────────────────────┐
│  Input: "This session is being continued from a previous..." │
│                                                              │
│  LLM Classification:                                         │
│  {                                                           │
│    classification: "system",    ◄── Classified as system    │
│    confidence: 0.95,                                         │
│    reason: "Session continuation summary"                    │
│  }                                                           │
│                                                              │
│  Result: FILTERED OUT (confidence >= 0.7)                    │
└──────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────────┐
│  Input: "Can you help me debug this login error?"            │
│                                                              │
│  LLM Classification:                                         │
│  {                                                           │
│    classification: "developer",  ◄── Classified as developer│
│    confidence: 0.98,                                         │
│    reason: "Developer asking for debugging help",            │
│    displayText: "Can you help me debug this login error?"    │
│  }                                                           │
│                                                              │
│  Result: KEPT                                                │
└──────────────────────────────────────────────────────────────┘
```

#### 3. displayText Generation (Sanitization)
```
Input:  "Great, login works now. But I got this error:
         ## Error Type Console Error
         ## Error Message No workspace ID set
         at SupabaseStorageManager.getData (lib/supabase-storage.ts:91:15)
         at DashboardOverviewPage.useEffect..."

Output (displayText):
        "Great, login works now. But I got this error:
         [Error: No workspace ID set][Stack trace]"
```

#### 4. Phase 2 Evidence Linking
```
Worker Prompt:
"Select utteranceId from Phase1Output that demonstrates this pattern..."

Worker Output (flattened string):
"Systematic Verification|You consistently verify...|session1_5:let me check:verifying output,session1_8:looks good|75"

Parsed to:
{
  title: "Systematic Verification",
  description: "You consistently verify...",
  evidence: [
    { utteranceId: "session1_5", quote: "let me check", context: "verifying output" },
    { utteranceId: "session1_8", quote: "looks good" }
  ],
  frequency: 75
}
```

### Key Design Principles

1. **Phase Separation**: Phase 1 = pure extraction (no LLM semantic analysis), Phase 2 = semantic analysis
2. **utteranceId Linking**: All evidence can be traced back to original utterance
3. **displayText vs text**: `text` preserves original, `displayText` is sanitized for UI display

---

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

| Priority | Location | File | Issue | Status |
|----------|----------|------|-------|--------|
| **High** | LLM filter failure fallback | `data-extractor-worker.ts:701-710` | All data classified as "developer" on LLM failure | Open |
| ~~**High**~~ **Low** | Incomplete stripSystemTags | `data-extractor-worker.ts:540-567` | Plain-text system messages not detected | ✅ Mitigated (2026-01-31): Added regex patterns for error stacks, server logs, Insight blocks |
| **Medium** | Paraphrased quote verification | `content-writer.ts:filterBySubstringMatch` | Substring match failure → passes | Open |
| **Medium** | Phase 3 LLM direct generation | `content-writer-prompts.ts:429-432` | LLM generates quotes instead of IDs | Open |
| **Low** | Dummy pattern generation | `evaluation-assembler.ts:341-351` | Minimum pattern guarantee | Open |

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

---

## Investigation: LLM_FILTER_MIN_LENGTH Threshold Analysis (2026-01-31)

### Target Session
`/Users/sungmancho/.claude/projects/-Users-sungmancho-projects-alfredworks/7fdbb780-a673-43b1-92f6-1f69c9b729f0.jsonl`

### Analysis Results

```
=== Summary ===
Total utterances: 16
  Empty (system tags only): 0 (0.0%)
  < 100 chars (LLM skip):   8 (50.0%)   ◄── 절반이 LLM 필터 스킵!
  >= 100 chars (LLM filter): 8 (50.0%)

=== Under 100 chars samples (LLM skipped) ===
1. [42자] "Authorized JavaScript origins는 추가 안해도 괜찮아?"
2. [10자] "1,2,3 다했어."
3. [23자] "002를 다시 실행햇더니 이런에러가 나오네"
4. [80자] "Error: Failed to run sql query: ERROR: 42P07: relation "profiles" already exists"
5. [14자] "1번을 실행하면 이렇게나와"
6. [84자] "Error: Failed to run sql query: ERROR: 42501: must be owner of table users 이렇게 나오는데?"
7. [8자] "이건 잘 되었어"
8. [14자] "이전에 실패한 사용자 없어"

=== Length distribution ===
  0            0 (  0.0%)
  1-50         6 ( 37.5%) ██████████████████████████████
  51-99        2 ( 12.5%) ██████████
  100-200      1 (  6.3%) █████
  201-500      1 (  6.3%) █████
  501-1000     2 ( 12.5%) ██████████
  1000+        4 ( 25.0%) ████████████████████
```

### Issues Found

#### Issue 1: displayText not sanitized for short utterances (< 100 chars)

**Location**: `data-extractor-worker.ts:524-528`

```typescript
// Current behavior (problematic)
for (const utterance of shortUtterances) {
  if (!utterance.displayText) {
    utterance.displayText = utterance.text;  // ⚠️ 원본 그대로 복사!
  }
}
```

**Impact**:
- Short utterances containing error messages (80-99 chars) bypass sanitization
- Example: `"Error: Failed to run sql query: ERROR: 42P07..."` (80 chars)
- Error messages appear verbatim in Communication Patterns examples

#### Issue 2: LLM_FILTER_MIN_LENGTH threshold too high (100 chars)

**Location**: `data-extractor-worker.ts:57`

```typescript
private static readonly LLM_FILTER_MIN_LENGTH = 100;
```

**Impact**:
- Over 50% of utterances completely bypass LLM filtering
- Error messages, CLI output pass through without sanitization

### Solutions

#### Option A: 짧은 utterances에도 displayText sanitization 적용

```typescript
// data-extractor-worker.ts:524-528
for (const utterance of shortUtterances) {
  if (!utterance.displayText) {
    // Apply basic sanitization even for short utterances
    utterance.displayText = this.sanitizeShortUtterance(utterance.text);
  }
}

private sanitizeShortUtterance(text: string): string {
  // Replace error patterns with [Error: brief]
  if (/^Error:/i.test(text)) {
    const colonIndex = text.indexOf(':', 6);  // Skip "Error:"
    const brief = colonIndex > 0 ? text.slice(7, Math.min(colonIndex, 50)) : text.slice(7, 50);
    return `[Error: ${brief.trim()}]`;
  }
  return text;
}
```

#### Option B: LLM_FILTER_MIN_LENGTH 낮추기 ✅ APPLIED

```typescript
// BEFORE
private static readonly LLM_FILTER_MIN_LENGTH = 100;

// AFTER (2026-01-31)
private static readonly LLM_FILTER_MIN_LENGTH = 10;
```

**Trade-off**: More LLM calls = slightly higher cost, but nearly all utterances receive displayText sanitization

#### Option C: Regex-based sanitization for error patterns only

Apply regex-based sanitization during topUtterances selection in ContentWriter:

```typescript
// content-writer.ts:123
.map(u => ({
  id: u.id,
  text: sanitizeForDisplay(u.displayText || u.text).slice(0, 1500),
  wordCount: u.wordCount
}))

function sanitizeForDisplay(text: string): string {
  // Error messages
  text = text.replace(/Error:\s*[^\n]+/g, '[Error message]');
  // Stack traces
  text = text.replace(/at \w+\.\w+\s*\([^)]+\)/g, '[stack trace]');
  return text;
}
```

### Analysis Script

```bash
npx tsx scripts/analyze-utterance-lengths.ts <jsonl-path>
```

---

## Enhancement: Error Stack & Server Log Filtering (2026-01-31)

### Problem

Analysis of long utterances (1000+ chars) revealed that a significant portion were:
- **ERROR_STACK**: Pasted error messages and stack traces
- **SERVER_LOG**: Pasted HTTP request logs from terminal

These are **debug outputs pasted by developers**, not expressions of developer intent. Including them pollutes the analysis.

### Analysis Results

```
=== 1000자 이상 Utterances ===
Total: 4

By Type:
  ERROR_STACK: 2 (50%)
  SERVER_LOG: 1 (25%)
  KOREAN_TEXT: 1 (25%)
```

### Solution: Regex Fast Path Patterns

Added patterns to `isKnownSystemMetadata()` in `data-extractor-worker.ts:561-566`:

```typescript
// Error stacks and tracebacks (pasted debug output, not developer intent)
/^Error:|^ERROR:|^Exception:|^Traceback \(most recent call last\):/,
/^\s+at \w+\.\w+\s*\(/m,  // JavaScript/TypeScript stack trace lines

// Server logs (pasted terminal output, not developer intent)
/^(GET|POST|PUT|DELETE|PATCH|OPTIONS|HEAD) \/\S+.*\d{3}/m,  // HTTP request logs with status
```

### Pattern Details

| Pattern | Matches | Example |
|---------|---------|---------|
| `^Error:\|^ERROR:\|^Exception:` | JS/TS error messages | `Error: Cannot find module 'foo'` |
| `^Traceback \(most recent call last\):` | Python stack traces | `Traceback (most recent call last):` |
| `^\s+at \w+\.\w+\s*\(` | JS stack trace lines | `    at Module._compile (node:internal/modules/cjs/loader:1254:14)` |
| `^(GET\|POST\|...) \/\S+.*\d{3}` | HTTP request logs | `GET /api/users 200 15ms` |

### Trade-offs

**Filtered**:
- `"Error: relation profiles already exists"` - Pure error message
- `"GET /api/auth/callback 302 2.5ms"` - Server log

**Preserved** (developer intent present):
- `"이 에러가 나오네: Error: ..."` - Developer context before error
- `"POST 요청이 안되는데 왜 그럴까?"` - Question about POST (not a log)

The patterns are anchored (`^`) to only match when the text **starts with** the pattern, preserving messages where developers add context before pasting errors.

### Related Changes

1. **LLM_FILTER_MIN_LENGTH**: 100 → 10 (same session)
2. **Insight block patterns**: Added `★ Insight`, `` `★ Insight ``, `^─{10,}` (same session)
