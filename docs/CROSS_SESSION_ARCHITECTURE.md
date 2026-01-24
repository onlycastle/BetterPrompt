# Cross-Session Anti-Pattern Detection: Architecture Overview

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPER SESSION CORPUS                      │
│                    (20-30 Claude sessions)                       │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ Format & Structure
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│            SESSION FORMATTING & PREPARATION                      │
│  - Extract user/assistant messages                              │
│  - Tag with session IDs                                         │
│  - Preserve multi-language text                                 │
│  - Max 1500 chars per session                                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌─────────────────────────┐   ┌─────────────────────────┐
    │  Formatted Sessions     │   │  Module A Analysis      │
    │  (sessionsFormatted)    │   │  (moduleAOutput)        │
    └───────────┬─────────────┘   └──────────┬──────────────┘
                │                            │
                └────────────┬───────────────┘
                             │
                             │ Combine into User Prompt
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│              CROSS-SESSION ANTI-PATTERN PROMPT                   │
│                                                                   │
│  System Prompt:                                                  │
│  - Persona: Software engineering coach                          │
│  - Task: Identify 2+ session patterns                           │
│  - Anti-patterns: 5 types (CRITICAL/WARNING/INFO)               │
│  - Rules: Session traceability, quote evidence, etc.            │
│                                                                   │
│  User Prompt:                                                    │
│  - Session count parameter                                       │
│  - Formatted session data                                        │
│  - Module A structured analysis                                  │
│  - Language localization (en/ko/ja/zh)                          │
│                                                                   │
│  Output Schema:                                                  │
│  - criticalAntiPatterns (2+ sessions)                           │
│  - warningAntiPatterns (2+ sessions)                            │
│  - infoAntiPatterns (2+ sessions)                               │
│  - isolatedIncidents (single sessions)                          │
│  - topInsights (exactly 3 Problem/Try/Keep)                    │
│  - Scoring metrics (patternDensity, consistency)               │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               │ Gemini API Call
                               │ (Structured Output)
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GEMINI 3 FLASH ANALYSIS                       │
│                                                                   │
│  - Analyzes 20-30 sessions for recurring patterns               │
│  - Minimum 2 sessions per pattern (prevents false positives)    │
│  - Extracts direct quotes with session IDs                      │
│  - Computes pattern density & consistency scores                │
│  - Identifies behavioral strengths & weaknesses                 │
│  - Generates actionable Problem/Try/Keep insights               │
│  - Handles multi-language input, preserves original quotes      │
│  - Returns structured JSON (no hallucination)                   │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       ANALYSIS OUTPUT                             │
│                                                                   │
│  Anti-Patterns Detected (2+ Sessions):                          │
│  ├─ CRITICAL                                                     │
│  │  ├─ blind_approval (Sessions: X, Y, Z)                       │
│  │  └─ sunk_cost_loop (Sessions: A, B, C)                       │
│  ├─ WARNING                                                      │
│  │  ├─ passive_acceptance (Sessions: P, Q, R)                   │
│  │  └─ blind_retry (Sessions: D, E, F)                          │
│  └─ INFO                                                         │
│     └─ delegation_without_review (Sessions: M, N, O)            │
│                                                                   │
│  Isolated Incidents (Single Session):                           │
│  └─ [Single-session occurrences, not alarming]                  │
│                                                                   │
│  Scoring:                                                        │
│  ├─ Pattern Density: 0-100 (higher = more patterns)            │
│  └─ Consistency: 0-1 (higher = more confidence)                 │
│                                                                   │
│  Top Insights: (Exactly 3)                                       │
│  ├─ Index 0: PROBLEM - Highest priority anti-pattern           │
│  ├─ Index 1: TRY - Specific actionable intervention             │
│  └─ Index 2: KEEP or PROBLEM - Strength or secondary issue     │
│                                                                   │
│  Cross-Session Evidence:                                        │
│  ├─ sessionCrossReferences: Multiple quotes tracking pattern    │
│  └─ strengthsAcrossSessions: Positive recurring patterns        │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DEVELOPER FEEDBACK                             │
│                                                                   │
│  What the Developer Learns:                                     │
│  1. "You have a blind_approval pattern across 4 sessions"      │
│     (AWARENESS - What they didn't know about themselves)        │
│                                                                   │
│  2. "Before approving major changes, ask one clarifying         │
│     question about implications"                                │
│     (ACTIONABLE - Specific behavior to change)                  │
│                                                                   │
│  3. "You show excellent systematic error analysis in sessions  │
│     2, 5, 9 - apply that same rigor to decisions"              │
│     (REINFORCEMENT - Build on existing strengths)               │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow: Detailed

### Step 1: Session Collection & Formatting

```
Raw Session Data (JSON or JSONL)
    ├─ Session 1: ["user": "fix this bug", "assistant": "...code..."]
    ├─ Session 2: ["user": "approve design", "assistant": "..."]
    ├─ ...
    └─ Session 30: ["user": "test this", "assistant": "..."]
           │
           │ formatSessionsForAnalysis()
           ▼
    Formatted Sessions (tagged with IDs)
    ├─ SESSION_1: "user: fix this bug (truncated to 1500 chars)"
    ├─ SESSION_2: "user: approve design..."
    ├─ ...
    └─ SESSION_30: "user: test this..."
```

### Step 2: Module A Analysis Preparation

```
Raw Session Data
    │
    │ Module A (Data Analyst)
    │ Extracts:
    │ - User questions
    │ - AI suggestions
    │ - Developer responses
    │ - Errors encountered
    │
    ▼
Module A Output (JSON)
{
  repeatedQuestions: [...],
  conversationPatterns: [...],
  aiSuggestions: [...],
  errorFrequency: {...},
  ...
}
```

### Step 3: Prompt Construction

```
System Prompt (Fixed)
├─ Persona: Software engineering coach
├─ Task: Identify 2+ session patterns
├─ Anti-patterns: 5 types with full definitions
├─ Rules: Evidence requirements, session traceability
└─ Format: Structured JSON output

+

User Prompt (Dynamic)
├─ sessionCount: "30 Claude coding sessions"
├─ Formatted Sessions: Actual session data
├─ Module A Output: Structured analysis
└─ Language: "Generate insights in English"

=

Complete Prompt (Ready for API)
```

### Step 4: Gemini Analysis

```
Gemini API Call
├─ Model: gemini-3-flash-preview
├─ Mode: Structured Output (JSON Schema)
├─ maxOutputTokens: 12,288
├─ temperature: 1.0 (default)
└─ Parsing: ResponseJsonSchema validation

Process:
1. Read system prompt (understands role & task)
2. Analyze formatted sessions for patterns
3. Apply 2+ session minimum threshold
4. Extract direct quotes with session IDs
5. Compute confidence scores
6. Generate Problem/Try/Keep insights
7. Validate output against schema
8. Return structured JSON

Output: CrossSessionAntiPatternOutput (typed)
```

## Pattern Detection Logic

### Cross-Session Validation

```
PATTERN DETECTION ALGORITHM:

For each potential anti-pattern:
  1. Find all occurrences across all sessions
  2. Count: How many different sessions contain this pattern?
  3. Validate:
     - If count >= 2: PATTERN (goes to criticalAntiPatterns, etc.)
     - If count == 1: INCIDENT (goes to isolatedIncidents)
  4. Track: Collect session IDs where pattern appears
  5. Extract: Quote from one session as evidence
  6. Score: Calculate frequency (High if 3+, Moderate if 2)
  7. Return: Structured entry with all metadata
```

### Scoring Calculation

```
Pattern Density (0-100):
  - Count total anti-patterns detected
  - Weight by severity (CRITICAL > WARNING > INFO)
  - Normalize to 0-100 scale
  - Result indicates behavioral pattern concentration

Cross-Session Consistency (0-1):
  - Measure how consistently pattern appears
  - Across how many sessions?
  - How similar are the instances?
  - Result indicates confidence in pattern's reality
```

### Evidence Extraction

```
Each finding includes:
┌─────────────────────────────────────────┐
│ Pattern Name                             │
├─────────────────────────────────────────┤
│ Severity (CRITICAL/WARNING/INFO)        │
├─────────────────────────────────────────┤
│ Sessions Count (minimum 2)               │
├─────────────────────────────────────────┤
│ Session IDs (e.g., session_3, session_7 │
├─────────────────────────────────────────┤
│ Frequency (High/Moderate)                │
├─────────────────────────────────────────┤
│ Evidence: Direct quote in original lang │
│ e.g., 'looks good, ship it'            │
└─────────────────────────────────────────┘
```

## Anti-Pattern Hierarchy

```
                    ANTI-PATTERNS
                          │
                ┌─────────┼─────────┐
                │         │         │
            CRITICAL   WARNING      INFO
            (Risk++)   (Risk+)    (Risk)
                │         │         │
        ┌───────┴───────┬───────┬──────┐
        │               │       │      │
    blind_      sunk_cost   passive  blind_    delegation_
  approval       loop       acceptance retry   without_review
        │
    Major changes  Failing approaches  Accepting  Commands   AI output
    without        with many retry     first      repeated  shipped
    understanding  attempts           suggestion  unchanged without test
                                      without
                                      evaluation
```

## Multi-Language Support Architecture

```
MULTI-LANGUAGE FLOW:

Input Sessions (Any Language)
├─ English: "looks good, ship it"
├─ Korean: "좋아 보여, 배포해도 될까?"
├─ Japanese: "良さそうです、デプロイしましょう"
└─ Chinese: "看起来不错，我们可以部署吗?"
        │
        │ Pattern Detection (Semantic Level)
        │ - Analyzes MEANING, not keywords
        │ - "approval" concept recognized in any language
        │ - Behavioral patterns language-agnostic
        │
        ▼
Quote Preservation (Original Language)
├─ English: 'looks good, ship it'
├─ Korean: '좋아 보여, 배포해도 될까?'
├─ Japanese: '良さそうです、デプロイしましょう'
└─ Chinese: '看起来不错，我们可以部署吗?'
        │
        │ Output Localization (Optional)
        │ Language parameter: en, ko, ja, zh
        │
        ▼
Output Insights
├─ English analysis with original quotes
├─ Korean analysis with original quotes
├─ Japanese analysis with original quotes
└─ Chinese analysis with original quotes

KEY PRINCIPLE:
- Detect patterns by MEANING (language-independent)
- Preserve quotes in ORIGINAL language (for developer recognition)
- Generate insights in TARGET language (for localization)
- Keep anti-pattern names in ENGLISH (consistent terminology)
```

## File Dependencies

```
cross-session-anti-pattern-prompts.ts
├─ Imports:
│  ├─ SupportedLanguage (from content-writer-prompts)
│  ├─ NO_HEDGING_DIRECTIVE (from verbose-prompts)
│  └─ TypeScript types
│
├─ Exports:
│  ├─ CROSS_SESSION_ANTI_PATTERN_SYSTEM_PROMPT (string)
│  ├─ buildCrossSessionAntiPatternUserPrompt() (function)
│  ├─ CrossSessionAntiPatternInput (interface)
│  ├─ CrossSessionAntiPatternOutput (interface)
│  └─ CrossSessionAntiPatternPrompts (object)
│
└─ Used By:
   ├─ (Future) CrossSessionAntiPatternWorker
   ├─ GeminiClient.generateStructured()
   └─ Analysis orchestrator
```

## Integration Points

### With Existing Workers

```
EXISTING ARCHITECTURE:
Session Data
    ├─ ModuleADataAnalystWorker
    │  └─ Extracts structured behavioral data
    │
    ├─ AntiPatternSpotterWorker (single session)
    │  └─ Detects patterns within one session
    │
    ├─ PatternDetectiveWorker
    │  └─ Finds repeated questions & conversation styles
    │
    └─ KnowledgeGapAnalyzerWorker
       └─ Identifies learning gaps

NEW ADDITION:
    ├─ CrossSessionAntiPatternWorker
    │  └─ Detects behavioral patterns across 2+ sessions
    │     (Complements single-session workers)
    │
    └─ Content Writer
       └─ Synthesizes all insights into narrative
```

### Output Integration

```
All worker outputs combine in orchestrator:

CrossSessionAntiPatternOutput {
  criticalAntiPatterns: string;
  warningAntiPatterns: string;
  infoAntiPatterns: string;
  topInsights: string[];
  patternDensity: number;
  crossSessionConsistency: number;
  recommendedInterventions: string[];
  sessionCrossReferences: string;
  strengthsAcrossSessions: string;
}
    │
    │ Parsed and structured
    │
    ▼
Report Data
    ├─ Behavioral anti-patterns section
    ├─ Risk assessment (pattern density score)
    ├─ Confidence metrics
    ├─ Actionable recommendations
    └─ Behavioral strengths
```

## Performance Characteristics

```
COMPUTATIONAL REQUIREMENTS:

Input:
├─ Sessions: 20-30 typical
├─ Session size: 1500 chars max each
├─ Total tokens: ~8,000-10,000 input tokens
└─ Module A output: ~2,000-3,000 tokens

Processing:
├─ Model: Gemini 3 Flash
├─ Temperature: 1.0
├─ Max output: 12,288 tokens
└─ Expected output: ~8,000-10,000 tokens

Latency:
├─ API call: ~3-5 seconds (Gemini 3 Flash)
├─ Parsing: <100ms
├─ Total: ~3-6 seconds per analysis
└─ Throughput: ~600 analyses/hour (single process)

Cost:
├─ Input tokens: $0.0375/million
├─ Output tokens: $0.15/million
├─ Per analysis: ~$0.0015-$0.0020
└─ 1000 analyses: ~$1.50-$2.00

Storage:
├─ Output JSON: ~5-10 KB per analysis
├─ Compressed (gzip): ~1-2 KB
└─ 10,000 analyses: ~50-100 MB
```

## Error Handling

```
Validation Points:

1. Session Format
   └─ Missing session IDs → Error
   └─ Empty sessions → Warning

2. Pattern Validation
   └─ Pattern appears <2 sessions → Move to isolatedIncidents
   └─ Session IDs missing → Error
   └─ Quote not from claimed session → Error

3. Output Validation
   └─ topInsights != 3 items → Error
   └─ Pattern entries missing required fields → Error
   └─ Consistency score outside 0-1 range → Error

4. Multi-Language
   └─ Quote in wrong language → Warning
   └─ Untranslatable content → Preserve as-is
   └─ Mixed language quotes → Acceptable (preserve exactly)

Error Recovery:
├─ Schema validation failure → Reject output, retry
├─ Timeout → Exponential backoff
├─ Invalid JSON → Parse error + detailed logging
└─ Partial success → Report what succeeded, what failed
```

---

This architecture ensures:
- **Reliability**: Schema validation, error handling, retry logic
- **Performance**: Optimized for 20-30 session corpus
- **Accuracy**: 2+ session threshold prevents false positives
- **Usability**: Multi-language support, structured outputs
- **Scalability**: Fits into existing worker orchestration pattern

