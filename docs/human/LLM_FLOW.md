# Orchestrator + Workers Analysis Pipeline

> Pipeline that analyzes developer-AI collaboration sessions and generates personalized reports
> Version: 2.4.0 | Last Updated: 2026-02-08

## Overview

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│                        ANALYSIS ORCHESTRATOR PIPELINE                                 │
├──────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                       │
│   Sessions (JSONL)                                                                    │
│        │                                                                              │
│        ▼                                                                              │
│   ┌─────────────┐                                                                     │
│   │   Parse &   │                                                                     │
│   │  Aggregate  │                                                                     │
│   └──────┬──────┘                                                                     │
│          │                                                                            │
│          ▼                                                                            │
│   ╔══════════════════════════════════════════════════════════════════════════════╗   │
│   ║                        ANALYSIS ORCHESTRATOR                                  ║   │
│   ║                                                                               ║   │
│   ║  ┌─────────────────────────────────────────────────────────────────────────┐ ║   │
│   ║  │ PHASE 1: Data Extraction (deterministic, NO LLM)                        │ ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐     │ ║   │
│   ║  │ │ DataExtractor Worker                                             │     │ ║   │
│   ║  │ │ Pure data transformation (no LLM call)                          │     │ ║   │
│   ║  │ └───────────────────────────┬─────────────────────────────────────┘     │ ║   │
│   ║  │                             │                                            │ ║   │
│   ║  │                             ▼                                            │ ║   │
│   ║  │                       Phase1Output                                       │ ║   │
│   ║  │                  (DeveloperUtterances + AIResponses + Metrics)           │ ║   │
│   ║  └─────────────────────────────────────────────────────────────────────────┘ ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 2: Insight Generation (parallel, 5 workers, 5 LLM calls)        │   ║   │
│   ║  │                                                                         │   ║   │
│   ║  │ ┌────────────────┐ ┌────────────────┐ ┌────────────────┐ ┌──────────┐│   ║   │
│   ║  │ │    Thinking    │ │ Communication  │ │    Learning    │ │ Context  ││   ║   │
│   ║  │ │    Quality     │ │   Patterns     │ │    Behavior    │ │Efficiency││   ║   │
│   ║  │ └────────────────┘ └────────────────┘ └────────────────┘ └──────────┘│   ║   │
│   ║  │ ┌────────────────┐                                                    │   ║   │
│   ║  │ │    Session     │                                                    │   ║   │
│   ║  │ │    Outcome     │                                                    │   ║   │
│   ║  │ └────────────────┘                                                    │   ║   │
│   ║  │                                                                         │   ║   │
│   ║  │                                   │                                     │   ║   │
│   ║  │                                   ▼                                     │   ║   │
│   ║  │                            AgentOutputs                                 │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 2.5: Classification (1 LLM call)                             │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ TypeClassifierWorker (free) — type classification               │   │   ║   │
│   ║  │ │ → uses Phase 2 outputs for classification                       │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 3: Content Writer — Narrative Only (1 LLM call)                │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ ContentWriter                                                    │   │   ║   │
│   ║  │ │ Output: NarrativeLLMResponse (personalitySummary,               │   │   ║   │
│   ║  │ │         topFocusAreas — narrative only)                          │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 4: Translator (0-1 LLM call, conditional)                     │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ Translates NarrativeLLMResponse + AgentOutputs insights         │   │   ║   │
│   ║  │ │ (Only for non-English users — ko, ja, zh)                       │   │   ║   │
│   ║  │ │ ⚠️ Translation stored, NOT merged yet (hoisted for later use)   │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ EVALUATION ASSEMBLY + TRANSLATION OVERLAY (deterministic, NO LLM)   │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ 1. assembleEvaluation() — builds English defaults               │   │   ║   │
│   ║  │ │    Merges Phase 2 AgentOutputs (structural) +                   │   │   ║   │
│   ║  │ │           Phase 3 NarrativeLLMResponse (narrative)              │   │   ║   │
│   ║  │ │ 2. mergeTranslatedFields() — overlays translations (if any)     │   │   ║   │
│   ║  │ │    Korean/Japanese/Chinese text fields overlay English base     │   │   ║   │
│   ║  │ │ 3. Add translatedAgentInsights to final evaluation              │   │   ║   │
│   ║  │ │ → VerboseEvaluation fields (localized for non-English users)    │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ╚══════════════════════════════════════════════════════════════════════════════╝   │
│          │                                                                            │
│          ▼                                                                            │
│   ┌─────────────┐                                                                     │
│   │  Content    │                                                                     │
│   │  Gateway    │  ← Tier-based filtering (free/one_time/pro/enterprise)              │
│   └──────┬──────┘                                                                     │
│          │                                                                            │
│          ▼                                                                            │
│   VerboseEvaluation (final)                                                           │
│                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stages

### Stage 0: Session Parsing (Multi-Source)

```
Multi-Source Session Discovery
==============================

Source 1: Claude Code (JSONL)
~/.claude/projects/
├── -Users-dev-projectA/
│   ├── abc123.jsonl    ◀── Claude Code session logs
│   └── def456.jsonl
└── -Users-dev-projectB/
    └── ghi789.jsonl

Source 2: Cursor (SQLite)
~/.cursor/chats/
├── workspace1/
│   ├── chat1.db        ◀── Cursor chat database (better-sqlite3)
│   └── chat2.db
└── workspace2/
    └── chat3.db

Source 3: Cursor Composer (SQLite KV)
~/Library/Application Support/Cursor/User/globalStorage/
└── state.vscdb
    ├── composerData:{composerId}    ◀── Session metadata
    └── bubbleId:{composerId}:{msgId} ◀── Individual messages

         │
         │  multiSourceScanner.collectAllFileMetadata()
         │  → SourceRegistry dispatches to available sources
         ▼

┌─────────────────────────────────────────────────┐
│  SourcedParsedSession                            │
├─────────────────────────────────────────────────┤
│  sessionId: "abc123"                            │
│  projectPath: "/Users/dev/projectA"             │
│  source: "claude-code" | "cursor"                │ ◀── Source type
│        | "cursor-composer"                      │
│  messages: [                                     │
│    { role: "user", content: "Fix the bug..." } │
│    { role: "assistant", toolCalls: [...] }      │
│  ]                                               │
│  stats: { userMessageCount, toolCallCount, ... }│
└─────────────────────────────────────────────────┘

         │
         │  selectOptimalSessions() - select up to 10 sessions
         │  aggregateMetrics()
         ▼

┌─────────────────────────────────────────────────┐
│  SessionMetrics                                  │
├─────────────────────────────────────────────────┤
│  totalTurns: 156                                │
│  avgPromptLength: 342 chars                     │
│  questionFrequency: 0.23 per turn               │
│  modificationRate: 0.31                         │
│  toolUsage: { Read: 89, Edit: 45, Bash: 23 }   │
└─────────────────────────────────────────────────┘
```

---

### Phase 1: Data Extractor

**Purpose**: Extract structured data from raw sessions (deterministic, no LLM)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       PHASE 1: DATA EXTRACTOR                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │  INPUT           │                                                   │
│  │  - Sessions[]    │                                                   │
│  │  - Metrics       │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  DETERMINISTIC EXTRACTION (NO LLM)                               │    │
│  │  - Extract DeveloperUtterances[]                                 │    │
│  │  - Extract AIResponses[]                                         │    │
│  │  - Calculate SessionMetrics                                      │    │
│  │  - Pure data transformation                                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │                                                   │
│  │  Phase1Output    │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Phase 1 Output Schema

```
Phase1Output
│
├── developerUtterances[]
│   ├── id: string (unique ID)
│   ├── text: string (developer message)
│   ├── sessionId: string
│   └── timestamp: string (ISO)
│
├── aiResponses[]
│   ├── id: string
│   ├── text: string (AI response summary)
│   ├── toolCalls: string[] (tools used)
│   └── sessionId: string
│
├── sessionMetrics
│   ├── totalTurns: number
│   ├── avgPromptLength: number
│   └── toolUsage: Record<string, number>
│
├── displayText: string (optional) — LLM-sanitized text for UI display
├── naturalLanguageSegments: [{start, end, text}] (optional) — Extracted natural language portions
└── machineContentRatio: number (optional, 0.0-1.0) — Ratio of machine-generated content
```

---

### Phase 2: Insight Generation Workers

**Purpose**: Generate deep insights based on Phase 1 results (capability-based approach)

> 5 workers run in parallel. Each outputs capability-specific strengths/growthAreas directly.

**IMPORTANT: Context Isolation**
All Phase 2 workers receive ONLY Phase1Output (not raw sessions). This enforces:
- Phase 1 = Pure Extraction (deterministic)
- Phase 2 = Semantic Analysis (on extracted data only)

**Worker Input Filtering**
All 5 workers apply identical quality filters on utterances:
```typescript
// Filter applied before LLM analysis
utterances.filter(u => u.isNoteworthy !== false && u.wordCount >= 8)
```
- `isNoteworthy !== false`: Excludes utterances explicitly marked as not noteworthy
- `wordCount >= 8`: Excludes very short utterances lacking analytical value

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: 5 WORKERS (PARALLEL)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT (from Phase 1)        │                                       │
│  │  - Phase1Output              │  ◀── DataExtractor output             │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│  ┌────────────┴───────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  5 Parallel Workers (LLM-based, capability-focused)            │    │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────┐│    │
│  │  │   Thinking   │ │Communication │ │   Learning   │ │Context ││    │
│  │  │   Quality    │ │  Patterns    │ │   Behavior   │ │Efficien││    │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────┘│    │
│  │  ┌──────────────┐                                              │    │
│  │  │   Session    │                                              │    │
│  │  │   Outcome    │                                              │    │
│  │  └──────────────┘                                              │    │
│  │                                                                  │    │
│  └──────────────────────────────────┬──────────────────────────────┘    │
│                                      │                                   │
│                                      ▼                                   │
│                             ┌──────────────┐                            │
│                             │ AgentOutputs │                            │
│                             │ (merged)     │                            │
│                             └──────────────┘                            │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Phase 2 Worker Descriptions

| Worker | Question | Output Schema |
|--------|----------|---------------|
| **ThinkingQuality** | How intentionally and critically does this developer work? | `ThinkingQualityOutput` |
| **CommunicationPatterns** | How does this developer communicate with AI? What are their signature patterns? | `CommunicationPatternsOutput` |
| **LearningBehavior** | How much does this developer try to learn? Do they repeat the same mistakes? | `LearningBehaviorOutput` |
| **ContextEfficiency** | How effectively does this developer manage tokens and context? | `ContextEfficiencyOutput` |
| **SessionOutcome** | How successful are this developer's AI collaboration sessions? | `SessionOutcomeOutput` |

#### Agent Output Schema (AgentOutputs)

```
AgentOutputs
│
├── thinkingQuality: ThinkingQualityOutput | null  (planning, critical thinking)
├── communicationPatterns: CommunicationPatternsOutput | null  (communication patterns, signature quotes)
├── learningBehavior: LearningBehaviorOutput | null  (knowledge gaps, repeated mistakes)
├── contextEfficiency: ContextEfficiencyOutput | null  (token usage, context management)
├── sessionOutcome: SessionOutcomeOutput | null  (goals, friction, success rates)
└── typeClassifier: TypeClassifierOutput | null  (added at Phase 2.5)
```

---

### Phase 2.5: Classification

**Purpose**: Classify developer type based on Phase 2 insights

> Runs after Phase 2, before Phase 3. Available for all tiers (free).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2.5: CLASSIFICATION (1 LLM call)                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT (from Phase 1 + 2)    │                                       │
│  │  - Phase1Output              │  ◀── Utterances for evidence          │
│  │  - AgentOutputs              │  ◀── Phase 2 worker results           │
│  │    ├── thinkingQuality       │                                       │
│  │    ├── learningBehavior      │                                       │
│  │    └── contextEfficiency     │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  TypeClassifierWorker (free)               │ ◀── 1 LLM call         │
│  │  Uses Phase 2 outputs for classification    │                         │
│  │  Output: TypeClassifierOutput               │                         │
│  │  → Primary type, control level, matrix      │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │ AgentOutputs     │  (now includes typeClassifier)                     │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### TypeClassifierWorker

- Receives AgentOutputs from Phase 2
- Analyzes behavioral patterns + semantic evidence
- Assigns developer to 5 coding styles × 3 control levels (15 combinations)
- Output: Primary type, distribution, control level, matrix name/emoji, confidence

```typescript
export class TypeClassifierWorker extends BaseWorker<TypeClassifierOutput> {
  readonly name = 'TypeClassifier';
  readonly phase = 2 as const;  // Registered as Phase 2.5
  readonly minTier: Tier = 'free';
  // canRun: requires agentOutputs from Phase 2
}
```

---

### Phase 3: Content Writer (Narrative Only)

**Purpose**: Generate narrative-only content (personalitySummary, topFocusAreas) from Phase 2 analysis

> Phase 3 now generates ONLY narrative content. All structural/quantitative data
> (dimensionInsights, type classification, antiPatterns, criticalThinking, planning,
> actionablePractices) is assembled deterministically by the EvaluationAssembler
> from Phase 2 AgentOutputs — no LLM involvement.

```
┌─────────────────────────────────────────────────────────────────────────┐
│               PHASE 3: CONTENT WRITER (NARRATIVE ONLY)                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT                        │                                       │
│  │  - AgentOutputs summary       │  ◀── Phase 2 outputs (summarized     │
│  │    (via phase3-summarizer)    │      by summarizeAgentOutputsForPhase3)│
│  │  - sessionCount               │  ◀── Phase 1 metrics                 │
│  │  - Top 20 utterances          │  ◀── Phase 1 (richest utterances)    │
│  │  - knowledgeResources[]       │  ◀── Phase 2.75 (optional)           │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  NARRATIVE SCOPE (Phase 3 generates ONLY these)                  │    │
│  │                                                                   │    │
│  │  personalitySummary ─────▶ From Phase 2.5 TypeClassifier        │    │
│  │  │                           reasoning (≤3000ch, NOT generated  │    │
│  │  │                           here — Phase 3 only truncates)     │    │
│  │  topFocusAreas ──────────▶ Top 3 personalized priorities         │    │
│  │                                                                   │    │
│  │  NOTE: personalitySummary sourced from Phase 2.5 TypeClassifier │    │
│  │  reasoning. promptPatterns from Phase 2 ThinkingQuality worker │    │
│  │  (communicationPatterns field) — Phase 3 only used as fallback  │    │
│  │                                                                   │    │
│  │  MOVED TO EvaluationAssembler (deterministic, no LLM):           │    │
│  │  ✗ dimensionInsights[] ── from LearningBehavior                  │    │
│  │  ✗ primaryType/control ── from TypeClassifier                    │    │
│  │  ✗ antiPatternsAnalysis ─ from ThinkingQuality                   │    │
│  │  ✗ criticalThinking ───── from ThinkingQuality                   │    │
│  │  ✗ planningAnalysis ───── from ThinkingQuality                   │    │
│  │  ✗ actionablePractices ── from ThinkingQuality                   │    │
│  │                                                                   │    │
│  │  TONE: "Your habit of saying 'let me think'..."                  │    │
│  │    NOT: "You demonstrate good planning behaviors..."             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 65536                         │                         │
│  │  Structured Output: NarrativeLLMResponse   │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  POST-PROCESSING (narrative-specific)                             │    │
│  │  1. Verify prompt pattern examples are developer utterances      │    │
│  │  2. Truncate personalitySummary to max 3000 chars                │    │
│  │  3. Sanitize prompt patterns (structured examples, enforce min 3) │    │
│  │  4. Validate topFocusAreas (structured actions object)            │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │                                                   │
│  │  NarrativeLLM    │                                                   │
│  │  Response        │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Data Transformation Flow (Two Paths)

```
═══════════════════════════════════════════════════════════════════════════
PATH 1: Phase 2 AgentOutputs → EvaluationAssembler → Structural Fields
        (deterministic, NO LLM)
═══════════════════════════════════════════════════════════════════════════

AgentOutputs                                        VerboseEvaluation (structural)
────────────────────────                            ──────────────────────────────

thinkingQuality
┌────────────────────────┐     severity mapping     antiPatternsAnalysis
│ verificationAntiPatterns│───────────────────────▶{ detected[], summary, score }
│ planningHabits[]       │─────────────────────────▶planningAnalysis
│ criticalThinkingMoments│─────────────────────────▶criticalThinkingAnalysis
│ communicationPatterns[]│───────────────────────▶promptPatterns (assembled)
└────────────────────────┘

learningBehavior
┌────────────────────────┐     group by topic       dimensionInsights[]
│ repeatedMistakePatterns│─────────────────────────▶┌──────────────────────────────┐
│ knowledgeGaps[]        │                          │ dimension: "aiCollaboration" │
│ learningProgress[]     │                          │ strengths: [...]             │
└────────────────────────┘                          │ growthAreas: [...]           │
                                                    └──────────────────────────────┘

typeClassifier
┌────────────────────────┐     direct mapping       primaryType, controlLevel,
│ primaryType            │─────────────────────────▶distribution, controlScore
│ controlLevel           │
│ distribution           │
└────────────────────────┘


═══════════════════════════════════════════════════════════════════════════
PATH 2: Phase 3 NarrativeLLMResponse → Direct Copy → Narrative Fields
        (LLM-generated)
═══════════════════════════════════════════════════════════════════════════

NarrativeLLMResponse                                VerboseEvaluation (narrative)
─────────────────────                               ─────────────────────────────

┌────────────────────────┐     truncate/copy        personalitySummary
│ personalitySummary     │─────────────────────────▶(from Phase 2.5 TypeClassifier
│ (from TypeClassifier)  │                          reasoning, truncated ≤3000ch)
│ topFocusAreas          │─────────────────────────▶topFocusAreas
│   (top 3 priorities)  │                          (with parsed actions)
│                        │
│ promptPatterns[]       │ (FALLBACK ONLY - Phase 2 communicationPatterns preferred)
└────────────────────────┘


⚠️ TRANSLATION NOTE (non-English output):
Phase 3 always generates in English. Translation is Phase 4 (Translator).
Phase 4 receives NarrativeLLMResponse + AgentOutputs:
- NarrativeLLMResponse text fields are translated (personalitySummary, patterns, etc.)
- AgentOutputs insights are translated as translatedAgentInsights
- Technical terms (AI, Git, commit, etc.) remain in English

⚠️ CRITICAL: Translation Merge Timing
Translation is applied AFTER assembleEvaluation(), not before:
┌─────────────────────────────────────────────────────────────────────┐
│ WRONG (causes translation loss):                                     │
│   Phase 4 → merge translations → assembleEvaluation() (overwrites!) │
│                                                                      │
│ CORRECT (preserves translations):                                    │
│   Phase 4 → store translatorData → assembleEvaluation() (English)  │
│           → mergeTranslatedFields() (overlay Korean on English)     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### Phase 4: Translator (Conditional)

**Purpose**: Translate Phase 3 narrative + Phase 2 agent insights into user's detected language

> Runs only when non-English language is detected (5% character threshold). Skipped for English users.

**IMPORTANT: Translation Merge Timing**
Phase 4 produces translations but does NOT merge them immediately. The `translatorData` is hoisted
and stored for later use. Merging happens AFTER `assembleEvaluation()` to prevent translations
from being overwritten by English defaults.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 4: TRANSLATOR (CONDITIONAL)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────────────┐                               │
│  │  LANGUAGE DETECTION                   │                               │
│  │  (from developer utterances)          │                               │
│  │                                        │                               │
│  │  detectPrimaryLanguage():              │                               │
│  │  - Counts non-ASCII characters         │                               │
│  │  - 5% threshold for non-English        │                               │
│  │  - Supports: ko, ja, zh                │                               │
│  └────────────────┬─────────────────────┘                               │
│                   │                                                      │
│      ┌────────────┴────────────┐                                        │
│      ▼                         ▼                                        │
│  ┌────────┐              ┌──────────────┐                               │
│  │ English│              │ Non-English  │                               │
│  │ → SKIP │              │ → TRANSLATE  │                               │
│  └────────┘              └──────┬───────┘                               │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  LLM CALL                                                         │   │
│  │  Model: gemini-3-flash-preview                                   │   │
│  │  Temperature: 1.0                                                 │   │
│  │  Input: NarrativeLLMResponse (English) + AgentOutputs            │   │
│  │  Output: TranslatorOutput (translated text fields only)          │   │
│  │                                                                   │   │
│  │  NOTE: Translator receives AgentOutputs to produce                │   │
│  │  translatedAgentInsights (Phase 2 worker summaries in target     │   │
│  │  language). NarrativeLLMResponse text fields are also translated. │   │
│  │                                                                   │   │
│  │  Formatting Preservation: Translator preserves both \n\n          │   │
│  │  (paragraph breaks) and single \n (soft breaks) exactly as they  │   │
│  │  appear in the English personalitySummary. Corner bracket quote   │   │
│  │  markers (「...」) are also preserved.                              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  ⚠️ HOISTED STORAGE (DO NOT MERGE YET)                            │   │
│  │  translatorData = translatorResult.data                           │   │
│  │  → Translation stored but NOT applied here                        │   │
│  │  → Merge happens AFTER assembleEvaluation() to avoid overwrite   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### TranslatorStage

```typescript
export class TranslatorStage {
  // Only runs if language is non-English
  shouldRun(language: string): boolean {
    return language !== 'en';
  }

  translate(
    englishResponse: NarrativeLLMResponse,
    targetLanguage: SupportedLanguage,
    agentOutputs: AgentOutputs
  ): Promise<TranslatorResult>;
}
```

#### Why Translation is Hoisted (Not Merged Immediately)

Previously, translations were merged right after Phase 4:
```
① Translator runs → produces Korean translations ✅
② mergeTranslatedFields() → Korean applied to contentResult.data ✅
③ assembleEvaluation() → REBUILDS fields from English agentOutputs 🔴
   → Korean translations OVERWRITTEN with English defaults!
```

Now, translations are applied AFTER assembly:
```
① Translator runs → produces Korean translations ✅
② translatorData = result (STORED, not merged) ✅
③ assembleEvaluation() → builds English defaults from agentOutputs ✅
④ mergeTranslatedFields(assembledData, translatorData) → Korean OVERLAYS English ✅
   → Korean translations preserved!
```

---

### Evaluation Assembly + Translation Overlay (Post-Phase 4, Deterministic)

**Purpose**: Deterministically merge Phase 2 AgentOutputs (structural) + Phase 3 NarrativeLLMResponse (narrative) into VerboseEvaluation fields, then overlay translations for non-English users

> No LLM call — pure data transformation. Runs after Phase 4 (Translation) in the orchestrator.
> Implemented in `evaluation-assembler.ts` as `assembleEvaluation()` + `mergeTranslatedFields()`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│       EVALUATION ASSEMBLY + TRANSLATION OVERLAY (deterministic)         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ════════════════════════════════════════════════════════════════════   │
│  STEP 1: assembleEvaluation() — Build English Defaults                  │
│  ════════════════════════════════════════════════════════════════════   │
│                                                                          │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐    │
│  │  INPUT A                      │  │  INPUT B                      │    │
│  │  AgentOutputs                 │  │  NarrativeLLMResponse         │    │
│  │  (Phase 2 + 2.5 structural)  │  │  (Phase 3 narrative, ENGLISH) │    │
│  │  ├── thinkingQuality         │  │  ├── personalitySummary       │    │
│  │  ├── learningBehavior        │  │  ├── promptPatterns[]         │    │
│  │  ├── contextEfficiency       │  │  └── topFocusAreas            │    │
│  │  └── typeClassifier          │  │                                │    │
│  │                               │  └──────────────┬───────────────┘    │
│  │                               │                  │                    │
│  └──────────────┬───────────────┘                  │                    │
│                 │                                   │                    │
│                 └─────────────┬─────────────────────┘                    │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ASSEMBLY RULES (no LLM)                                         │    │
│  │                                                                   │    │
│  │  FROM AgentOutputs (deterministic):                              │    │
│  │  thinkingQuality.verificationAntiPatterns[]                      │    │
│  │    → antiPatternsAnalysis (severity mapping, evidence)           │    │
│  │  thinkingQuality.planningHabits[]                                │    │
│  │    → planningAnalysis (maturity level assessment)                │    │
│  │  thinkingQuality.criticalThinkingMoments[]                       │    │
│  │    → criticalThinkingAnalysis (score calculation)                │    │
│  │  thinkingQuality.communicationPatterns[]                         │    │
│  │    → promptPatterns (assembled)                                  │    │
│  │  learningBehavior.knowledgeGaps[]                                │    │
│  │    → dimensionInsights[] (grouped by topics)                     │    │
│  │  typeClassifier                                                   │    │
│  │    → primaryType, controlLevel, distribution, controlScore       │    │
│  │                                                                   │    │
│  │  FROM NarrativeLLMResponse (direct copy):                        │    │
│  │  personalitySummary → personalitySummary (truncate ≤3000)        │    │
│  │  promptPatterns[]   → promptPatterns[] (parse, enforce min 3)    │    │
│  │  topFocusAreas      → topFocusAreas (structured actions)          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│                               ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  assembledData (ENGLISH defaults)                                 │   │
│  │  - dimensionInsights: English titles/descriptions                │   │
│  │  - antiPatternsAnalysis: English displayName/description         │   │
│  │  - criticalThinkingAnalysis: English highlights                  │   │
│  │  - planningAnalysis: English strengths                           │   │
│  │  - actionablePractices: English feedback/tips                    │   │
│  │  - personalitySummary: English narrative                         │   │
│  │  - promptPatterns: English patterns                              │   │
│  │  - topFocusAreas: English priorities                             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                               │                                          │
│  ════════════════════════════════════════════════════════════════════   │
│  STEP 2: mergeTranslatedFields() — Overlay Translations (if any)       │
│  ════════════════════════════════════════════════════════════════════   │
│                               │                                          │
│  ┌────────────────────────────┴────────────────────────────────────┐    │
│  │  CONDITION: if (translatorData) — only for non-English users     │    │
│  │                                                                   │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │  TranslatorOutput (Korean/Japanese/Chinese)                 │  │    │
│  │  │  - personalitySummary: 한글 summary                          │  │    │
│  │  │  - antiPatternsAnalysis.detected[]: 한글 displayName/desc    │  │    │
│  │  │  - criticalThinkingAnalysis: 한글 highlights                  │  │    │
│  │  │  - planningAnalysis: 한글 strengths                           │  │    │
│  │  │  - actionablePractices: 한글 feedback/tips                    │  │    │
│  │  │  - promptPatterns[]: 한글 patternName/description/tip        │  │    │
│  │  │  - topFocusAreas: 한글 title/narrative/expectedImpact        │  │    │
│  │  │  - translatedAgentInsights: 한글 Phase 2 worker summaries    │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  │                              │                                    │    │
│  │                              ▼                                    │    │
│  │  ┌────────────────────────────────────────────────────────────┐  │    │
│  │  │  MERGE RULES (overlay, not replace)                         │  │    │
│  │  │  - Text fields: translated text REPLACES English            │  │    │
│  │  │  - Structure: preserved from assembledData                  │  │    │
│  │  │  - IDs/numbers: preserved from assembledData                │  │    │
│  │  │  - Technical terms: kept in English (AI, Git, API, etc.)    │  │    │
│  │  │  - Developer quotes: kept original (not translated)         │  │    │
│  │  └────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│  ════════════════════════════════════════════════════════════════════   │
│  STEP 3: Build Final Evaluation Object                                  │
│  ════════════════════════════════════════════════════════════════════   │
│                               │                                          │
│                               ▼                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  VerboseEvaluation                                                │   │
│  │  {                                                                │   │
│  │    ...assembledData,           // now localized (if translated)  │   │
│  │    agentOutputs,               // raw Phase 2 data               │   │
│  │    translatedAgentInsights?,   // Phase 2 summaries (translated) │   │
│  │    knowledgeResources?,        // Phase 2.75 matches             │   │
│  │    pipelineTokenUsage,         // cost tracking                  │   │
│  │    analysisMetadata,           // confidence, data quality       │   │
│  │  }                                                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Translation Merge — Field Mapping

| Source (TranslatorOutput) | Target (assembledData) | Merge Strategy |
|---------------------------|------------------------|----------------|
| `personalitySummary` | `personalitySummary` | Direct overlay |
| `antiPatternsAnalysis.detected[]` | `antiPatternsAnalysis.detected[]` | Match by `antiPatternType` |
| `criticalThinkingAnalysis.strengths[]` | `criticalThinkingAnalysis.strengths[]` | Match by index |
| `planningAnalysis.strengths[]` | `planningAnalysis.strengths[]` | Match by index |
| `actionablePractices.practiced[]` | `actionablePractices.practiced[]` | Match by `patternId` |
| `actionablePractices.opportunities[]` | `actionablePractices.opportunities[]` | Match by `patternId` |
| `promptPatterns[]` | `promptPatterns[]` | Match by index |
| `topFocusAreas.areas[]` | `topFocusAreas.areas[]` | Match by `rank` |
| `translatedAgentInsights` | `evaluation.translatedAgentInsights` | Direct propagation |

#### Assembly Mapping Table

| Source (Phase 2 AgentOutputs) | Target (VerboseEvaluation) | Transformation |
|-------------------------------|---------------------------|----------------|
| `thinkingQuality.verificationAntiPatterns[]` | `antiPatternsAnalysis.detected[]` | Severity mapping (critical/significant→significant), evidence extraction |
| `thinkingQuality.planningHabits[]` | `planningAnalysis` | Assess `planningMaturityLevel` (reactive→expert), split by effectiveness |
| `thinkingQuality.criticalThinkingMoments[]` | `criticalThinkingAnalysis` | Convert to highlights, calculate `overallScore` from type variety |
| `thinkingQuality.communicationPatterns[]` | `promptPatterns[]` (assembled) | Map to prompt patterns with evidence |
| `learningBehavior.knowledgeGaps[]` | `dimensionInsights[]` | Group by topic, map to dimension buckets |
| `typeClassifier` | `primaryType`, `controlLevel`, `distribution`, `controlScore` | Direct field copy |

| Source (Phase 3 Narrative) | Target (VerboseEvaluation) | Transformation |
|---------------------------|---------------------------|----------------|
| `personalitySummary` | `personalitySummary` | Truncate to ≤3000 chars |
| `topFocusAreas` | `topFocusAreas` | Structured `actions: {start, stop, continue}` (legacy `actionsData` fallback) |
| `promptPatterns[]` | `promptPatterns[]` | **FALLBACK ONLY** - Phase 2 `communicationPatterns` preferred |

---

### Content Gateway: Tier-based Filtering

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          CONTENT GATEWAY                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│     VerboseEvaluation (Full)                                            │
│            │                                                             │
│            ▼                                                             │
│     ┌──────────────┐                                                    │
│     │ filter(tier) │                                                    │
│     └──────┬───────┘                                                    │
│            │                                                             │
│     ┌──────┴────────────────────────────────────────────┐               │
│     ▼                                                   ▼               │
│  ┌──────┐               ┌──────────┬──────┬────────────┐                │
│  │ FREE │               │ ONE_TIME │ PRO  │ ENTERPRISE │                │
│  └──┬───┘               └────────┴───────┴──────┬──────┘                │
│     │                                           │                        │
│     ▼                                           ▼                        │
│  (limited)                                 (full access)                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  TIER ACCESS MATRIX (4-tier system)                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Content                     Free     One-time   Pro    Enterprise      │
│  ─────────────────────────────────────────────────────────────────      │
│  Type Result                  ✓          ✓        ✓          ✓          │
│  (primaryType, controlLevel)                                             │
│                                                                          │
│  Personality Summary          ✓          ✓        ✓          ✓          │
│                                                                          │
│  Dimensions 1-2               ✓          ✓        ✓          ✓          │
│  (full detail)               full       full     full       full        │
│                                                                          │
│  Dimensions 3-6              empty       ✓        ✓          ✓          │
│  (locked for free)                      full     full       full        │
│                                                                          │
│  Prompt Patterns              ✗          ✓        ✓          ✓          │
│  (3-6 patterns)                                                          │
│                                                                          │
│  Top Focus Areas              ✗          ✓        ✓          ✓          │
│  (personalized priorities)                                               │
│                                                                          │
│  Agent Insights             teaser       ✓        ✓          ✓          │
│  (from Phase 2 Workers)                                                  │
│                                                                          │
│  Advanced Analytics           ✗          ✓        ✓          ✓          │
│  - toolUsageDeepDive                                                     │
│  - tokenEfficiency                                                       │
│  - comparativeInsights                                                   │
│  - sessionTrends                                                         │
│                                                                          │
│  ─────────────────────────────────────────────────────────────────      │
│  Tier Descriptions:                                                      │
│  - FREE: 3 analyses/month, limited content                              │
│  - ONE_TIME: 1-credit purchase, unlimited analyses, full content        │
│  - PRO: Subscription, unlimited analyses, full content + tracking       │
│  - ENTERPRISE: Full content + team management + custom KB               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Report UI Data Flow (Continuous Scroll)

The report UI renders all sections in a continuous scroll layout with `FloatingProgressDots` navigation (no tabs). Sections: Growth → Activity → Thinking → Communication → Learning → Context.

### Section Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                          FIXED HEADER (Always Visible)                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│  TypeResultMinimal          ← Phase 2.5 TypeClassifier           ✅ FREE       │
│  PersonalitySummary         ← Phase 3 ContentWriter              ✅ FREE       │
│  DataQualityBadge           ← Phase 1 DataExtractor              ✅ FREE       │
└─────────────────────────────────────────────────────────────────────────────────┘

#### PersonalitySummary Rendering

```
personalitySummary (string)
    │
    ├── Split by \n\n → paragraphs (<p> tags)
    │   └── Legacy fallback: single paragraph >800ch → splitIntoBalancedParagraphs()
    │
    └── Within each paragraph:
        ├── Split by \n → soft break segments (<br /> + spacer)
        ├── Parse 「...」 quotes → <span className="quote">
        └── Parse **bold** → <strong className="emphasis">

Key files:
- src/utils/textFormatting.tsx (FormattedPersonalityText, renderParagraphWithSoftBreaks)
- src/components/personal/tabs/type-result/PersonalitySummaryClean.tsx
```

┌─────────────────────────────────────────────────────────────────────────────────┐
│  Continuous Scroll: [Growth] [Activity] [Thinking] [Communication]             │
│                     [Learning] [Context]   + FloatingProgressDots nav          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SECTION: Growth (Progress & Benchmarks)                   ✅ FREE             │
│  ├── Data source: Phase 2 worker data (aggregated) + /api/benchmarks/personal │
│  ├── useGrowthData hook for percentile benchmarks                              │
│  ├── Components: GrowthSummaryBanner, ProgressSection, PercentileGauge        │
│  └── Professional insights render inline within GrowthCard                     │
│                                                                                 │
│  SECTION: Activity (Contribution Graph)                    ✅ FREE             │
│  ├── Data source: ActivitySessionInfo (CLI scanner, NOT LLM pipeline)          │
│  │   ├── totalInputTokens (from assistant message usage in JSONL)             │
│  │   └── totalOutputTokens (from assistant message usage in JSONL)            │
│  ├── Contribution graph (GitHub-style heatmap, 7 rows × N columns)            │
│  │   └── Color intensity: percentile-based daily token usage (p25/p50/p75)    │
│  │       Fallback: session-count thresholds for legacy data without tokens    │
│  ├── Stats row: total sessions, active days, total tokens                     │
│  ├── Tooltip: session count + token count per day                             │
│  └── Detail panel: per-project sessions, duration, token usage                │
│                                                                                │
│  NOTE: Activity section data does NOT flow through the LLM pipeline.          │
│  It uses the CLI Activity Scanner (deterministic metadata extraction).        │
│                                                                                 │
│  SECTION: Thinking Quality                                                     │
│  ├── ThinkingQualityWorker.strengths[]         ← Phase 2      ✅ FREE          │
│  └── ThinkingQualityWorker.growthAreas[]       ← Phase 2                        │
│      ├── title, description, evidence, severity               ✅ FREE          │
│      └── recommendation                                        🔒 PAID          │
│                                                                                 │
│  SECTION: Communication                                                        │
│  ├── CommunicationPatternsWorker.strengths[]   ← Phase 2      ✅ FREE          │
│  ├── CommunicationPatternsWorker.growthAreas[] ← Phase 2                        │
│  │   ├── title, description, evidence, severity               ✅ FREE          │
│  │   └── recommendation                                        🔒 PAID          │
│  └── Signature quotes + communication pattern tips             ✅ FREE*        │
│                                                                                 │
│  SECTION: Learning Behavior                                                    │
│  ├── LearningBehaviorWorker.strengths[]        ← Phase 2      ✅ FREE          │
│  └── LearningBehaviorWorker.growthAreas[]      ← Phase 2                        │
│      ├── title, description, evidence, severity               ✅ FREE          │
│      └── recommendation                                        🔒 PAID          │
│                                                                                 │
│  SECTION: Context Efficiency                                                   │
│  ├── ContextEfficiencyWorker.strengths[]       ← Phase 2      ✅ FREE          │
│  └── ContextEfficiencyWorker.growthAreas[]     ← Phase 2                        │
│      ├── title, description, evidence, severity               ✅ FREE          │
│      └── recommendation                                        🔒 PAID          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────┐
│  SIDEBAR: ResourceSidebar                                                       │
│  └── knowledgeResources[]  ← Phase 2.75 KnowledgeResourceMatcher               │
│      ├── FREE:  1 item per dimension                                           │
│      └── PAID:  All items                                                       │
└─────────────────────────────────────────────────────────────────────────────────┘
```

* Communication Pattern tips are NOT filtered by ContentGateway (always free)

### Communication Patterns Transformation

```
ThinkingQualityWorker.communicationPatterns[]
                ↓
        evaluation-assembler.ts (line 135-136)
                ↓
        result.promptPatterns[]
                ↓
        TabbedReportContainer.tsx
                ↓
        transformCommunicationPatterns()
                ↓
┌───────────────────────────────────────────────────────┐
│  effectiveness: highly_effective | effective         │
│  → CommunicationStrength (merged with Tab 1 Strengths)│
├───────────────────────────────────────────────────────┤
│  effectiveness: could_improve                         │
│  → CommunicationGrowth (merged with Tab 1 GrowthAreas)│
└───────────────────────────────────────────────────────┘
```

### Tier Policy Summary

| Content | FREE | PAID |
|---------|------|------|
| Type Result | ✅ | ✅ |
| Personality Summary | ✅ | ✅ |
| Domain Scores | ✅ | ✅ |
| Strengths (all) | ✅ | ✅ |
| Growth Area Diagnosis (title, description, evidence) | ✅ | ✅ |
| Growth Area Recommendation | ❌ | ✅ |
| Knowledge Resources (1 per dimension) | ✅ | ✅ |
| Knowledge Resources (all) | ❌ | ✅ |
| Utterance Lookup (View Original) | ❌ | ✅ |

Philosophy: **"Diagnosis Free, Prescription Paid"**

### Key Files

| Component | File |
|-----------|------|
| Tab Container | `src/components/personal/tabs/containers/TabbedReportContainer.tsx` |
| Worker Section | `src/components/personal/tabs/insights/WorkerInsightsSection.tsx` |
| Pattern Transformer | `src/lib/transformers/prompt-pattern-transformer.ts` |
| Tier Policy | `src/lib/analyzer/content-gateway.ts` (TIER_POLICY) |

---

## Knowledge Context Injection (Dynamic Prompt System)

Expert knowledge structure is dynamically injected into Phase 2 workers via the **Knowledge Mapping System** (`knowledge-mapping.ts`):

**Worker → Dimension Mapping:**
| Worker | Applicable Dimensions |
|--------|----------------------|
| ThinkingQuality | aiCollaboration, toolMastery, aiControl |
| LearningBehavior | skillResilience |
| ContextEfficiency | contextEngineering |

**Dynamic Prompt Injection Flow:**
```
┌─────────────────────────────────────────────────────────────────────────┐
│  Worker starts → getInsightsForWorker("ThinkingQuality")               │
│                                                                         │
│  1. Lookup dimensions: ['aiCollaboration', 'toolMastery', 'aiControl'] │
│  2. Filter INITIAL_INSIGHTS by applicableDimensions                    │
│  3. Sort by priority (higher first)                                    │
│  4. Limit to MAX_INSIGHTS_PER_WORKER (5)                              │
│  5. formatInsightsForPrompt() → PROFESSIONAL KNOWLEDGE section        │
│                                                                         │
│  Result: Worker receives domain-specific insights in system prompt     │
└─────────────────────────────────────────────────────────────────────────┘
```

Expert knowledge structure injected into Phase 2 workers via prompts:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       EXPERT KNOWLEDGE CONTEXT                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  RESEARCH INSIGHTS (from INITIAL_INSIGHTS)                         │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  Skill Atrophy Self-Diagnosis                                │  │  │
│  │  │  Source: VCP Research (arXiv:2601.02410)                    │  │  │
│  │  │  Key: Heavy AI reliance → skill decay                       │  │  │
│  │  │  Signals: Can't start without AI, can't explain code        │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ┌─────────────────────────────────────────────────────────────┐  │  │
│  │  │  Passive Consumption Warning                                 │  │  │
│  │  │  Source: Anthropic                                          │  │  │
│  │  │  Key: Accept-all patterns indicate dependency               │  │  │
│  │  └─────────────────────────────────────────────────────────────┘  │  │
│  │                                                                     │  │
│  │  ... (10 total insights, priority-sorted)                         │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  BEHAVIORAL SIGNALS (from DIMENSION_KEYWORDS)                      │  │
│  │                                                                     │  │
│  │  Dimension: aiCollaboration                                        │  │
│  │  ├── Strength Signals                                              │  │
│  │  │   ├── Keywords: TodoWrite, Task delegation, parallel agents    │  │
│  │  │   └── Look for: structured planning, verification              │  │
│  │  └── Growth Signals                                                │  │
│  │      ├── Keywords: No task breakdown, single long session         │  │
│  │      └── Look for: missing verification, no planning              │  │
│  │                                                                     │  │
│  │  Dimension: contextEngineering                                     │  │
│  │  ├── Strength Signals                                              │  │
│  │  │   └── Keywords: WRITE, SELECT, COMPRESS, ISOLATE patterns      │  │
│  │  └── Growth Signals                                                │  │
│  │      └── Keywords: Vague prompts, no file references              │  │
│  │                                                                     │  │
│  │  ... (6 total dimensions)                                          │  │
│  └───────────────────────────────────────────────────────────────────┘  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Complete Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         END-TO-END FLOW                                  │
└─────────────────────────────────────────────────────────────────────────┘

  ~/.claude/projects/**/*.jsonl
           │
           │ [1] Parse JSONL files
           ▼
  ┌─────────────────┐
  │ ParsedSession[] │
  └────────┬────────┘
           │
           │ [2] Select optimal sessions (max 10)
           │     Aggregate metrics
           ▼
  ┌─────────────────┐     ┌─────────────────┐
  │ ParsedSession[] │     │ SessionMetrics  │
  │ (selected)      │     │                 │
  └────────┬────────┘     └────────┬────────┘
           │                       │
           └───────────┬───────────┘
                       │
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║     PHASE 1: DATA EXTRACTION (1 worker, deterministic)            ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                    ║
  ║  ┌─────────────────────────────┐                                  ║
  ║  │  DataExtractor Worker       │                                  ║
  ║  ├─────────────────────────────┤                                  ║
  ║  │ NO LLM CALL (deterministic) │                                  ║
  ║  │                             │                                  ║
  ║  │ OUTPUT:                     │                                  ║
  ║  │ - developerUtterances[]     │                                  ║
  ║  │ - aiResponses[]             │                                  ║
  ║  │ - sessionMetrics            │                                  ║
  ║  └─────────────┬───────────────┘                                  ║
  ║                │                                                   ║
  ║                ▼                                                   ║
  ║              Phase1Output                                          ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [3] Pass Phase1Output to Phase 2 (Premium+ only)
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║         PHASE 2: INSIGHT GENERATION (5 workers, 5 LLM calls)      ║
  ║                                                                    ║
  ║   [5 parallel workers]                                             ║
  ║                                                                    ║
  ║   INPUT:  Phase1Output (ONLY - no raw sessions)                   ║
  ║   OUTPUT: AgentOutputs (merged)                                    ║
  ║           - ThinkingQualityWorker → planning, critical thinking   ║
  ║           - CommunicationPatternsWorker → patterns, quotes        ║
  ║           - LearningBehaviorWorker → knowledge gaps, mistakes     ║
  ║           - ContextEfficiencyWorker → token usage                 ║
  ║           - SessionOutcomeWorker → goals, friction, success rates ║
  ║                                                                    ║
  ║   NO FALLBACK POLICY: Worker failures propagate as errors         ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [4] Pass agent outputs to Phase 2.5
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║         PHASE 2.5: CLASSIFICATION (1 LLM call)                     ║
  ║                                                                    ║
  ║   TypeClassifierWorker (free)                                      ║
  ║   INPUT:  AgentOutputs from Phase 2                                ║
  ║   OUTPUT: TypeClassifierOutput                                     ║
  ║           - primaryType + distribution                             ║
  ║           - controlLevel + controlScore                            ║
  ║           - matrixName + matrixEmoji                               ║
  ║           - confidenceScore + reasoning                            ║
  ║                                                                    ║
  ║   NO FALLBACK: If worker fails, error is thrown                    ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [5] Pass summarized outputs to Phase 3
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║         PHASE 3: CONTENT WRITER — NARRATIVE ONLY (1 LLM call)    ║
  ║                                                                    ║
  ║   Model: gemini-3-flash-preview  Temp: 1.0  Tokens: 65536         ║
  ║                                                                    ║
  ║   INPUT:  AgentOutputs summary (via phase3-summarizer)            ║
  ║           + sessionCount + top 20 utterances                      ║
  ║           + knowledgeResources (optional)                         ║
  ║   OUTPUT: NarrativeLLMResponse (narrative only)                   ║
  ║           - personalitySummary (from Phase 2.5 TypeClassifier     ║
  ║             reasoning — Phase 3 only truncates to ≤3000 chars)   ║
  ║           - topFocusAreas (top 3 priorities, optional)            ║
  ║   NOTE: personalitySummary sourced from Phase 2.5 TypeClassifier ║
  ║         reasoning. promptPatterns from Phase 2 ThinkingQuality   ║
  ║         communicationPatterns (Phase 3 is fallback only)          ║
  ║                                                                    ║
  ║   LANGUAGE: Always generates in English                           ║
  ║             Translation is Phase 4 (Translator)                   ║
  ║                                                                    ║
  ║   NO FALLBACK: If content generation fails, error is thrown       ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [6] Language detection
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║            PHASE 4: TRANSLATOR (0-1 LLM call, conditional)        ║
  ║                                                                    ║
  ║   CONDITION: Runs only if non-English detected (5% threshold)    ║
  ║                                                                    ║
  ║   INPUT:  NarrativeLLMResponse (English) + AgentOutputs          ║
  ║   OUTPUT: TranslatorOutput (translated text fields only)          ║
  ║           + translatedAgentInsights (Phase 2 summaries)           ║
  ║                                                                    ║
  ║   ⚠️ HOISTED: translatorData stored, NOT merged here              ║
  ║   REASON: Must merge AFTER assembleEvaluation() to avoid         ║
  ║           English defaults overwriting translations               ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [7] Deterministic assembly + translation overlay
                       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  EVALUATION ASSEMBLY + TRANSLATION OVERLAY (deterministic)        │
  │                                                                   │
  │  STEP 1: assembleEvaluation()                                    │
  │    agentOutputs + narrativeResult + phase1Output                 │
  │    → assembledData (ENGLISH defaults)                            │
  │    Phase 2 AgentOutputs → structural fields:                     │
  │    - dimensionInsights, type classification, antiPatterns         │
  │    - criticalThinking, planning, actionablePractices             │
  │    Phase 3 NarrativeLLMResponse → narrative fields:              │
  │    - personalitySummary, promptPatterns, topFocusAreas           │
  │                                                                   │
  │  STEP 2: mergeTranslatedFields() (if translatorData exists)      │
  │    translatorData → overlay Korean/Japanese/Chinese text         │
  │    - Text fields: translated text REPLACES English               │
  │    - Structure/IDs/numbers: preserved from assembledData         │
  │    - Technical terms: kept in English (AI, Git, API, etc.)       │
  │                                                                   │
  │  STEP 3: Propagate translatedAgentInsights                       │
  │    → Add to final evaluation for frontend hybrid fallback        │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [8] Add metadata + confidence
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  VerboseEvaluation (Full)                                        │
  │  - sessionId, analyzedAt, sessionsAnalyzed                       │
  │  - ...assembledData (structural + narrative, LOCALIZED)          │
  │  - agentOutputs (raw Phase 2 data, always English)               │
  │  - translatedAgentInsights? (for frontend hybrid fallback)       │
  │  - analysisMetadata (confidence, data quality)                   │
  │  - pipelineTokenUsage                                             │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [9] Apply tier-based filtering
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  ContentGateway.filter(evaluation, tier)                         │
  │                                                                   │
  │  tier = 'free'       → Limited dimensions, no patterns          │
  │  tier = 'one_time'   → Full access (1-credit purchase)          │
  │  tier = 'pro'        → Full access (subscription)               │
  │  tier = 'enterprise' → Full access + team features              │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [10] Save & serve
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  saveAnalysisLocally()                                           │
  │  → ~/.noslop/analyses/{analysisId}.json                         │
  │                                                                   │
  │  React SPA                                                        │
  │  → http://localhost:5173/analysis?local={analysisId}             │
  └─────────────────────────────────────────────────────────────────┘
```

---

## Cost Analysis

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COST ANALYSIS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Orchestrator Pipeline (Current - Gemini 3 Flash)                        │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  PHASE 1: DataExtractor (deterministic, no LLM cost)     │           │
│  │                                                           │           │
│  │  PHASE 2 (Parallel): 5 Workers                            │           │
│  │  ~4K tokens per worker, ~20K total (all workers)         │           │
│  │  All workers run: ThinkingQuality, CommunicationPatterns,│           │
│  │  LearningBehavior, ContextEfficiency, SessionOutcome     │           │
│  │  (5 LLM calls)                                          │           │
│  │                                                           │           │
│  │  PHASE 2.5: TypeClassifier (1 LLM call)                  │           │
│  │  Input: ~4K tokens    Output: ~1K tokens                 │           │
│  │                                                           │           │
│  │  PHASE 3: ContentWriter — narrative only (1 LLM call)     │           │
│  │  Input: ~8K tokens     Output: ~4K tokens                │           │
│  │  (reduced scope: personalitySummary, promptPatterns,      │           │
│  │   topFocusAreas only — structural data via assembler)     │           │
│  │                                                           │           │
│  │  PHASE 4: Translator (0-1 LLM call, conditional)         │           │
│  │  Only runs for non-English users (ko, ja, zh)            │           │
│  │  Input: ~8K tokens    Output: ~6K tokens                 │           │
│  │                                                           │           │
│  │  Total LLM Calls:                                         │           │
│  │  - English:     11 calls (1+5+1+1+1+1+1+0)               │           │
│  │  - Non-English: 12 calls (1+5+1+1+1+1+1+1)              │           │
│  │                                                           │           │
│  │  Total Cost: ~$0.04-0.05 per analysis                    │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Key Benefits:                                                           │
│  - Gemini 3 Flash: Pro-level intelligence at Flash pricing              │
│  - 1M token context window for comprehensive analysis                   │
│  - Parallel execution speeds up Phase 2                                 │
│  - NO FALLBACK POLICY: Worker failures propagate to identify issues     │
│  - Tier-based worker filtering reduces cost for Free users              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Pipeline Orchestration

| Component | File | Description |
|-----------|------|-------------|
| Analysis Orchestrator | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | Pipeline coordination (Phase 1→2→2.5→3→4→Assembly→TranslationOverlay), Worker registration/execution, `mergeTranslatedFields()` |
| Orchestrator Types | `src/lib/analyzer/orchestrator/types.ts` | WorkerResult, WorkerContext, Phase types |
| Verbose Analyzer | `src/lib/analyzer/verbose-analyzer.ts` | Entry point, registers all workers (1 Phase 1, 5 Phase 2, 1 Phase 2.5) |
| Content Gateway | `src/lib/analyzer/content-gateway.ts` | Tier-based content filtering (free/premium) |

### Phase 1: Data Extraction Worker (1 worker, deterministic)

| Component | File | Description |
|-----------|------|-------------|
| Base Worker | `src/lib/analyzer/workers/base-worker.ts` | BaseWorker abstract class, runWorkerSafely |
| Data Extractor Worker | `src/lib/analyzer/workers/data-extractor-worker.ts` | Phase 1 - deterministic extraction (no LLM) |
| Phase 1 Output Schema | `src/lib/models/phase1-output.ts` | Phase1Output Zod schema |

### Phase 2: Insight Generation Workers (5 workers, 5 LLM calls)

| Component | File | Description |
|-----------|------|-------------|
| Thinking Quality | `src/lib/analyzer/workers/thinking-quality-worker.ts` | Planning, critical thinking |
| Communication Patterns | `src/lib/analyzer/workers/communication-patterns-worker.ts` | Communication patterns, signature quotes |
| Learning Behavior | `src/lib/analyzer/workers/learning-behavior-worker.ts` | Knowledge gaps & repeated mistakes |
| Context Efficiency | `src/lib/analyzer/workers/context-efficiency-worker.ts` | Token inefficiency |
| Session Outcome | `src/lib/analyzer/workers/session-outcome-worker.ts` | Goals, friction, success rates |
| Agent Outputs Schema | `src/lib/models/agent-outputs.ts` | AgentOutputs Zod schemas |
| Thinking Quality Schema | `src/lib/models/thinking-quality-data.ts` | ThinkingQualityOutput |
| Communication Patterns Schema | `src/lib/models/communication-patterns-data.ts` | CommunicationPatternsOutput |
| Learning Behavior Schema | `src/lib/models/learning-behavior-data.ts` | LearningBehaviorOutput |
| Context Efficiency Schema | (reuses existing) | ContextEfficiencyOutput |
| Session Outcome Schema | `src/lib/models/session-outcome-data.ts` | SessionOutcomeOutput |
| Thinking Quality Prompts | `src/lib/analyzer/workers/prompts/thinking-quality-prompts.ts` | PTCF prompts for thinking analysis |
| Communication Patterns Prompts | `src/lib/analyzer/workers/prompts/communication-patterns-prompts.ts` | PTCF prompts for communication analysis |
| Learning Behavior Prompts | `src/lib/analyzer/workers/prompts/learning-behavior-prompts.ts` | PTCF prompts for learning analysis |
| Context Efficiency Prompts | `src/lib/analyzer/workers/prompts/context-efficiency-prompts.ts` | PTCF prompts for context analysis |
| Session Outcome Prompts | `src/lib/analyzer/workers/prompts/session-outcome-prompts.ts` | PTCF prompts for session outcome analysis |
| Knowledge Mapping | `src/lib/analyzer/workers/prompts/knowledge-mapping.ts` | Dynamic prompt injection (dimension→insight mapping) |

### Phase 2.5: Classification (1 worker, 1 LLM call)

| Component | File | Tier | Description |
|-----------|------|------|-------------|
| TypeClassifier Worker | `src/lib/analyzer/workers/type-classifier-worker.ts` | free | Type classification |
| TypeClassifier Prompts | `src/lib/analyzer/workers/prompts/type-classifier-prompts.ts` | — | PTCF prompts for type classification |
| Type Detector | `src/lib/analyzer/type-detector.ts` | — | Pattern-based type detection utilities |
| Coding Style Types | `src/lib/models/coding-style.ts` | — | 5×3 matrix types (15 combinations) |
| AI Control Dimension | `src/lib/analyzer/dimensions/ai-control.ts` | — | Control level calculation |

### Calculators (Pure Deterministic - No LLM)

| Component | File | Description |
|-----------|------|-------------|
| Temporal Calculator | `src/lib/analyzer/calculators/temporal-calculator.ts` | Pure functions for temporal metrics (heatmaps, session patterns, engagement signals) |
| Phrase Pattern Calculator | `src/lib/analyzer/calculators/phrase-pattern-calculator.ts` | N-gram phrase pattern detection using Levenshtein clustering |
| Temporal Metrics Schema | `src/lib/models/temporal-metrics.ts` | Zod schemas for deterministic temporal metrics |

### Phase 3: Content Writer — Narrative Only (1 LLM call)

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/content-writer.ts` | ContentWriterStage class, narrative-only generation (personalitySummary, promptPatterns, topFocusAreas) |
| Phase 3 Summarizer | `src/lib/analyzer/stages/phase3-summarizer.ts` | Summarizes AgentOutputs into structured text for Phase 3 prompt (~15-20K chars vs 50-100K from JSON) |
| Prompts (PTCF) | `src/lib/analyzer/stages/content-writer-prompts.ts` | System/user prompt builders (always English; translation is Phase 4) |
| Narrative Schema | `src/lib/models/verbose-evaluation.ts` | `NarrativeLLMResponseSchema` (personalitySummary, promptPatterns, topFocusAreas) |

### Phase 4: Translator — Conditional Translation (0-1 LLM call)

| Component | File | Description |
|-----------|------|-------------|
| Translator Stage | `src/lib/analyzer/stages/translator.ts` | TranslatorStage class, conditional translation for non-English users |
| Translator Prompts | `src/lib/analyzer/stages/translator-prompts.ts` | System/user prompt builders for Korean/Japanese/Chinese translation |
| Translator Schema | `src/lib/models/translator-output.ts` | `TranslatorOutput` Zod schema (translated text fields + translatedAgentInsights) |
| Language Detection | `src/lib/analyzer/stages/content-writer-prompts.ts` | `detectPrimaryLanguage()` — 5% threshold for non-ASCII characters |

### Evaluation Assembly + Translation Overlay (deterministic, no LLM)

| Component | File | Description |
|-----------|------|-------------|
| Evaluation Assembler | `src/lib/analyzer/stages/evaluation-assembler.ts` | `assembleEvaluation()` — merges Phase 2 structural data + Phase 3 narrative into VerboseEvaluation fields (English defaults) |
| Evidence Verifier | `src/lib/analyzer/stages/evidence-verifier.ts` | Validates utteranceId references; supports domains: thinkingQuality, learningBehavior, contextEfficiency |
| Translation Merge | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | `mergeTranslatedFields()` — overlays translations onto assembled data (called AFTER assembleEvaluation) |
| Translator Output Schema | `src/lib/models/translator-output.ts` | `TranslatorOutput` schema (translated text fields + translatedAgentInsights) |
| Output Schema | `src/lib/models/verbose-evaluation.ts` | `VerboseEvaluation` schema (full evaluation including assembled fields + metadata + translatedAgentInsights) |

### Session Parsing (Stage 0) — Multi-Source

| Component | File | Description |
|-----------|------|-------------|
| Multi-Source Scanner | `packages/cli/src/lib/scanner/index.ts` | Unified scanner for all sources (Claude Code + Cursor + Cursor Composer) |
| Claude Code Source | `packages/cli/src/lib/scanner/sources/claude-code.ts` | JSONL session source (~/.claude/projects/) |
| Cursor Source | `packages/cli/src/lib/scanner/sources/cursor.ts` | SQLite session source (~/.cursor/chats/) |
| Cursor Composer Source | `packages/cli/src/lib/scanner/sources/cursor-composer.ts` | SQLite KV source (globalStorage/state.vscdb) |
| Cursor Paths | `packages/cli/src/lib/scanner/sources/cursor-paths.ts` | Cross-platform Cursor directory resolution |
| SQLite Loader | `packages/cli/src/lib/scanner/sources/sqlite-loader.ts` | Shared better-sqlite3 dynamic import |
| Tool Mapping | `packages/cli/src/lib/scanner/tool-mapping.ts` | Cross-source tool name normalization |
| JSONL Reader | `src/lib/parser/jsonl-reader.ts` | JSONL parsing, path encoding/decoding |
| Session Selector | `src/lib/parser/session-selector.ts` | Duration-based optimal session selection (max 10) |
| Session Formatter | `src/lib/analyzer/shared/session-formatter.ts` | Session data formatting (shared by Workers) |
| Session Types | `src/lib/models/session.ts` | JSONLLine, SessionMetadata types, SessionSourceType |
| Domain Types | `src/lib/domain/models/analysis.ts` | ParsedSession, SessionMetrics types |

### Activity Scanner & Contribution Graph (deterministic, no LLM)

| Component | File | Description |
|-----------|------|-------------|
| Activity Scanner | `packages/cli/src/activity-scanner.ts` | Metadata extraction for ALL recent sessions (30 days) — tokens, duration, messages |
| Activity Scanner Helpers | `packages/cli/src/activity-scanner.ts` | `stripSystemReminders()`, `truncateAtWordBoundary()` |
| Activity Section | `src/components/personal/tabs/activity/ActivitySection.tsx` | Contribution graph with token-based percentile coloring |
| Session Summary Schema | `src/lib/models/session-summary-data.ts` | Zod schemas for Phase 1.5 LLM session summaries |
| Frontend Type | `src/types/verbose.ts` | `ActivitySessionInfo` TypeScript interface |
| Zod Schema | `src/lib/models/verbose-evaluation.ts` | `activitySessions` field in VerboseEvaluation |

### Knowledge Context

| Component | File | Description |
|-----------|------|-------------|
| Context Builder | `src/lib/analyzer/verbose-knowledge-context.ts` | XML-formatted expert knowledge builder |
| Research Insights | `src/lib/domain/models/knowledge.ts` | INITIAL_INSIGHTS expert insight definitions |
| Behavioral Signals | `src/lib/analyzer/dimension-keywords.ts` | DIMENSION_KEYWORDS behavioral signal mapping |

### API Client

| Component | File | Description |
|-----------|------|-------------|
| Gemini Client | `src/lib/analyzer/clients/gemini-client.ts` | @google/genai SDK wrapper, structured output support |

---

## Configuration

```
OrchestratorConfig (src/lib/analyzer/orchestrator/types.ts)
│
├── geminiApiKey: string              ← Required for all phases
├── model: 'gemini-3-flash-preview'   ← Used by all workers
├── temperature: 1.0                  ← Gemini default (do not lower)
├── maxOutputTokens: 65536
├── maxRetries: 2                     ← Per-worker retry count
└── verbose: false                    ← Log worker progress

VerboseAnalyzerConfig (src/lib/analyzer/verbose-analyzer.ts)
│
├── pipeline
│   ├── mode: 'single' | 'two-stage'  ← default: 'two-stage' (runs orchestrator)
│   │
│   ├── stage1 (Phase 1: Data Extractor config)
│   │   └── (deterministic, no LLM config needed)
│   │
│   └── stage2 (Phase 3: Content Writer config)
│       ├── model: 'gemini-3-flash-preview'
│       ├── temperature: 1.0
│       └── maxOutputTokens: 65536
│
└── tier: 'free' | 'one_time' | 'pro' | 'enterprise'  ← default: 'pro'

Worker Registration (src/lib/analyzer/verbose-analyzer.ts):
│
├── Phase 1 (1 worker):
│   └── DataExtractorWorker (deterministic, no LLM)
│
├── Phase 2 (5 workers, parallel):
│   ├── ThinkingQualityWorker (planning, critical thinking)
│   ├── CommunicationPatternsWorker (communication patterns, signature quotes)
│   ├── LearningBehaviorWorker (knowledge gaps, repeated mistakes)
│   ├── ContextEfficiencyWorker (token inefficiency)
│   └── SessionOutcomeWorker (goals, friction, success rates)
│
└── Phase 2.5 (1 worker):
    └── TypeClassifierWorker (free)

Environment Variables:
└── GOOGLE_GEMINI_API_KEY  ← Required for orchestrator pipeline

Error Handling (No Fallback Policy):
├── All errors are thrown immediately, never silently hidden
├── Workers throw errors instead of returning empty data
├── Orchestrator uses Promise.all() to fail fast
└── Frontend shows clear error states, not fake/empty results
```
