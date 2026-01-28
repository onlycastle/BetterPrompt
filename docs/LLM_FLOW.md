# Orchestrator + Workers Analysis Pipeline

> Pipeline that analyzes developer-AI collaboration sessions and generates personalized reports

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
│   ║  │ PHASE 2: Insight Generation (parallel, 4 workers, 4 LLM calls)        │   ║   │
│   ║  │                                                                         │   ║   │
│   ║  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────────────┐         │   ║   │
│   ║  │ │   Trust    │ │  Workflow  │ │ Knowledge  │ │   Context    │         │   ║   │
│   ║  │ │Verification│ │   Habit    │ │    Gap     │ │  Efficiency  │         │   ║   │
│   ║  │ │ (premium)  │ │ (premium)  │ │  (free)    │ │  (premium)   │         │   ║   │
│   ║  │ └────────────┘ └────────────┘ └────────────┘ └──────────────┘         │   ║   │
│   ║  │                                   │                                     │   ║   │
│   ║  │                                   ▼                                     │   ║   │
│   ║  │                            AgentOutputs                                 │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 2.5: Synthesis → Classification (2 sequential LLM calls)        │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ StrengthGrowthSynthesizer (free) — cross-domain synthesis       │   │   ║   │
│   ║  │ │ → merges result into AgentOutputs                               │   │   ║   │
│   ║  │ │ TypeClassifierWorker (free) — type classification               │   │   ║   │
│   ║  │ │ → uses Phase 2 outputs + synthesized strengths/growth           │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 3: Content Writer — Narrative Only (1 LLM call)                │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ ContentWriter                                                    │   │   ║   │
│   ║  │ │ Output: NarrativeLLMResponse (personalitySummary,               │   │   ║   │
│   ║  │ │         promptPatterns, topFocusAreas — narrative only)          │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 4: Translator (0-1 LLM call, conditional)                     │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ Translates NarrativeLLMResponse + AgentOutputs insights         │   │   ║   │
│   ║  │ │ (Only for non-English users — ko, ja, zh)                       │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ EVALUATION ASSEMBLY (deterministic, NO LLM)                          │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ assembleEvaluation()                                             │   │   ║   │
│   ║  │ │ Merges Phase 2 AgentOutputs (structural) +                      │   │   ║   │
│   ║  │ │        Phase 3 NarrativeLLMResponse (narrative)                 │   │   ║   │
│   ║  │ │ → VerboseEvaluation fields                                      │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ╚══════════════════════════════════════════════════════════════════════════════╝   │
│          │                                                                            │
│          ▼                                                                            │
│   ┌─────────────┐                                                                     │
│   │  Content    │                                                                     │
│   │  Gateway    │  ← Tier-based filtering (free/premium/enterprise)                   │
│   └──────┬──────┘                                                                     │
│          │                                                                            │
│          ▼                                                                            │
│   VerboseEvaluation (final)                                                           │
│                                                                                       │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stages

### Stage 0: Session Parsing

```
~/.claude/projects/
├── -Users-dev-projectA/
│   ├── abc123.jsonl    ◀── Claude Code session logs
│   └── def456.jsonl
└── -Users-dev-projectB/
    └── ghi789.jsonl

         │
         │  SessionParser.parseSessionFile()
         ▼

┌─────────────────────────────────────────────────┐
│  ParsedSession                                   │
├─────────────────────────────────────────────────┤
│  sessionId: "abc123"                            │
│  projectPath: "/Users/dev/projectA"             │
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
└── sessionMetrics
    ├── totalTurns: number
    ├── avgPromptLength: number
    └── toolUsage: Record<string, number>
```

---

### Phase 2: Insight Generation Workers

**Purpose**: Generate deep insights based on Phase 1 results

> 4 workers run in parallel. Some workers are free tier, some require premium.

**IMPORTANT: Context Isolation**
All Phase 2 workers receive ONLY Phase1Output (not raw sessions). This enforces:
- Phase 1 = Pure Extraction (deterministic)
- Phase 2 = Semantic Analysis (on extracted data only)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: 4 WORKERS (PARALLEL)                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT (from Phase 1)        │                                       │
│  │  - Phase1Output              │  ◀── DataExtractor output             │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│  ┌────────────┴───────────────────────────────────────────────────┐    │
│  │                                                                  │    │
│  │  4 Parallel Workers (LLM-based)                                 │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐  │    │
│  │  │   Trust    │ │  Workflow  │ │ Knowledge  │ │  Context   │  │    │
│  │  │Verification│ │   Habit    │ │    Gap     │ │ Efficiency │  │    │
│  │  │ (premium)  │ │ (premium)  │ │  (free)    │ │ (premium)  │  │    │
│  │  └────────────┘ └────────────┘ └────────────┘ └────────────┘  │    │
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

| Worker | Tier | Purpose | Output Schema |
|--------|------|---------|---------------|
| **TrustVerification** | premium | Anti-patterns & trust verification behavior | `TrustVerificationOutput` |
| **WorkflowHabit** | premium | Planning, critical thinking, multitasking | `WorkflowHabitOutput` |
| **KnowledgeGap** | free | Knowledge gaps & learning suggestions | `KnowledgeGapOutput` |
| **ContextEfficiency** | premium | Token inefficiency patterns | `ContextEfficiencyOutput` |

#### Agent Output Schema (AgentOutputs)

```
AgentOutputs
│
├── strengthGrowth: StrengthGrowthOutput | null
├── trustVerification: TrustVerificationOutput | null
├── workflowHabit: WorkflowHabitOutput | null
├── knowledgeGap: KnowledgeGapOutput | null
├── contextEfficiency: ContextEfficiencyOutput | null
└── typeClassifier: TypeClassifierOutput | null  (added at Phase 2.5)
```

---

### Phase 2.5: Synthesis → Classification

**Purpose**: Synthesize cross-domain insights, then classify developer type

> Runs sequentially after Phase 2, before Phase 3. Both workers available for all tiers (free).

```
┌─────────────────────────────────────────────────────────────────────────┐
│              PHASE 2.5: SYNTHESIS → CLASSIFICATION (SEQUENTIAL)          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT (from Phase 1 + 2)    │                                       │
│  │  - Phase1Output              │  ◀── Utterances for evidence          │
│  │  - AgentOutputs              │  ◀── Phase 2 worker results           │
│  │    ├── trustVerification     │                                       │
│  │    ├── workflowHabit         │                                       │
│  │    ├── knowledgeGap          │                                       │
│  │    └── contextEfficiency     │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  STEP 1: StrengthGrowthSynthesizer (free) │ ◀── 1 LLM call         │
│  │  Cross-domain strengths/growth synthesis    │                         │
│  │  Output: StrengthGrowthOutput               │                         │
│  │  → Merged into AgentOutputs                 │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  STEP 2: TypeClassifierWorker (free)       │ ◀── 1 LLM call         │
│  │  Uses Phase 2 + Synthesizer outputs         │                         │
│  │  Output: TypeClassifierOutput               │                         │
│  │  → Primary type, control level, matrix      │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │ AgentOutputs     │  (now includes strengthGrowth + typeClassifier)    │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Phase 2.5 Sequential Process

1. **StrengthGrowthSynthesizer** (Step 1):
   - Receives structured summaries from 4 Phase 2 workers
   - Receives Phase 1 utterances for evidence quote selection
   - Detects cross-domain patterns (e.g., blind_retry + no_planning → reactive)
   - Minimum 2/5-7 strengths and 2/5-7 growth areas must be cross-domain
   - Output merged into AgentOutputs before TypeClassifier runs

2. **TypeClassifierWorker** (Step 2):
   - Receives AgentOutputs (now including synthesized strengthGrowth)
   - Analyzes behavioral patterns + semantic evidence
   - Assigns developer to 5 coding styles × 3 control levels (15 combinations)
   - Output: Primary type, distribution, control level, matrix name/emoji, confidence

#### Workers

```typescript
// Step 1: Synthesizer
export class StrengthGrowthWorker extends BaseWorker<StrengthGrowthOutput> {
  readonly name = 'StrengthGrowth';
  readonly phase = 2 as const;  // Registered as Phase 2.5
  readonly minTier: Tier = 'free';
  // canRun: requires agentOutputs + phase1Output
}

// Step 2: Classifier
export class TypeClassifierWorker extends BaseWorker<TypeClassifierOutput> {
  readonly name = 'TypeClassifier';
  readonly phase = 2 as const;  // Registered as Phase 2.5
  readonly minTier: Tier = 'free';
  // canRun: requires agentOutputs (including synthesized strengthGrowth)
}
```

---

### Phase 3: Content Writer (Narrative Only)

**Purpose**: Generate narrative-only content (personalitySummary, promptPatterns, topFocusAreas) from Phase 2 analysis

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
│  │  personalitySummary ─────▶ Hyper-personalized summary (≤3000ch) │    │
│  │  promptPatterns[] ───────▶ 5-12 detected prompt patterns         │    │
│  │  topFocusAreas ──────────▶ Top 3 personalized priorities         │    │
│  │                                                                   │    │
│  │  MOVED TO EvaluationAssembler (deterministic, no LLM):           │    │
│  │  ✗ dimensionInsights[] ── from StrengthGrowth                    │    │
│  │  ✗ primaryType/control ── from TypeClassifier                    │    │
│  │  ✗ antiPatternsAnalysis ─ from TrustVerification                 │    │
│  │  ✗ criticalThinking ───── from WorkflowHabit                     │    │
│  │  ✗ planningAnalysis ───── from WorkflowHabit                     │    │
│  │  ✗ actionablePractices ── from TrustVerification                 │    │
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
│  │  3. Sanitize prompt patterns (parse examplesData, enforce min 3) │    │
│  │  4. Parse topFocusAreas (actionsData → nested format)            │    │
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

strengthGrowth
┌────────────────────────┐     group by dimension   dimensionInsights[]
│ strengths[]            │─────────────────────────▶┌──────────────────────────────┐
│ growthAreas[]          │                          │ dimension: "aiCollaboration" │
│ (each has .dimension)  │                          │ strengths: [...]             │
└────────────────────────┘                          │ growthAreas: [...]           │
                                                    └──────────────────────────────┘

typeClassifier
┌────────────────────────┐     direct mapping       primaryType, controlLevel,
│ primaryType            │─────────────────────────▶distribution, controlScore
│ controlLevel           │
│ distribution           │
└────────────────────────┘

trustVerification
┌────────────────────────┐     severity mapping     antiPatternsAnalysis
│ antiPatterns[]         │─────────────────────────▶{ detected[], summary, score }
│ actionablePatternData  │─────────────────────────▶actionablePractices
└────────────────────────┘                          { practiced[], opportunities[] }

workflowHabit
┌────────────────────────┐     score calculation    criticalThinkingAnalysis
│ criticalThinkingMoments│─────────────────────────▶{ strengths[], score }
│ planningHabits[]       │─────────────────────────▶planningAnalysis
└────────────────────────┘     maturity assessment  { strengths[], maturityLevel }


═══════════════════════════════════════════════════════════════════════════
PATH 2: Phase 3 NarrativeLLMResponse → Direct Copy → Narrative Fields
        (LLM-generated)
═══════════════════════════════════════════════════════════════════════════

NarrativeLLMResponse                                VerboseEvaluation (narrative)
─────────────────────                               ─────────────────────────────

┌────────────────────────┐     direct copy          personalitySummary
│ personalitySummary     │─────────────────────────▶(≤3000 chars, personalized)
│                        │
│ promptPatterns[]       │─────────────────────────▶promptPatterns[]
│   (5-12 patterns)     │                          (with parsed examples)
│                        │
│ topFocusAreas          │─────────────────────────▶topFocusAreas
│   (top 3 priorities)  │                          (with parsed actions)
└────────────────────────┘


⚠️ TRANSLATION NOTE (non-English output):
Phase 3 always generates in English. Translation is Phase 4 (Translator).
Phase 4 receives NarrativeLLMResponse + AgentOutputs:
- NarrativeLLMResponse text fields are translated (personalitySummary, patterns, etc.)
- AgentOutputs insights are translated as translatedAgentInsights
- Technical terms (AI, Git, commit, etc.) remain in English
```

---

### Phase 4: Translator (Conditional)

**Purpose**: Translate Phase 3 narrative + Phase 2 agent insights into user's detected language

> Runs only when non-English language is detected (5% character threshold). Skipped for English users.

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
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  MERGE STRATEGY                                                   │   │
│  │  - English NarrativeLLMResponse = source of truth for structure   │   │
│  │  - Only text fields overlaid from translation                     │   │
│  │  - Numeric fields, IDs remain from English                        │   │
│  │  - Technical terms preserved: AI, Git, API, IDE, etc.             │   │
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

---

### Evaluation Assembly (Post-Phase 4, Deterministic)

**Purpose**: Deterministically merge Phase 2 AgentOutputs (structural) + Phase 3 NarrativeLLMResponse (narrative) into VerboseEvaluation fields

> No LLM call — pure data transformation. Runs after Phase 4 (Translation) in the orchestrator.
> Implemented in `evaluation-assembler.ts` as `assembleEvaluation()`.

```
┌─────────────────────────────────────────────────────────────────────────┐
│              EVALUATION ASSEMBLY (deterministic, NO LLM)                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐  ┌──────────────────────────────┐    │
│  │  INPUT A                      │  │  INPUT B                      │    │
│  │  AgentOutputs                 │  │  NarrativeLLMResponse         │    │
│  │  (Phase 2 + 2.5 structural)  │  │  (Phase 3 narrative, possibly │    │
│  │  ├── strengthGrowth          │  │   translated by Phase 4)      │    │
│  │  ├── typeClassifier          │  │  ├── personalitySummary       │    │
│  │  ├── trustVerification       │  │  ├── promptPatterns[]         │    │
│  │  ├── workflowHabit           │  │  └── topFocusAreas            │    │
│  │  ├── knowledgeGap            │  │                                │    │
│  │  └── contextEfficiency       │  └──────────────┬───────────────┘    │
│  └──────────────┬───────────────┘                  │                    │
│                 │                                   │                    │
│                 └─────────────┬─────────────────────┘                    │
│                               │                                          │
│                               ▼                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  ASSEMBLY RULES (no LLM)                                         │    │
│  │                                                                   │    │
│  │  FROM AgentOutputs (deterministic):                              │    │
│  │  strengthGrowth.strengths/growthAreas                            │    │
│  │    → dimensionInsights[] (grouped by 6 dimensions)               │    │
│  │  typeClassifier                                                   │    │
│  │    → primaryType, controlLevel, distribution, controlScore       │    │
│  │  trustVerification.antiPatterns[]                                 │    │
│  │    → antiPatternsAnalysis (severity mapping, evidence)           │    │
│  │  trustVerification.actionablePatternMatchesData                  │    │
│  │    → actionablePractices (parse semicolon-separated data)        │    │
│  │  workflowHabit.criticalThinkingMoments[]                        │    │
│  │    → criticalThinkingAnalysis (score calculation)                │    │
│  │  workflowHabit.planningHabits[]                                  │    │
│  │    → planningAnalysis (maturity level assessment)                │    │
│  │                                                                   │    │
│  │  FROM NarrativeLLMResponse (direct copy):                        │    │
│  │  personalitySummary → personalitySummary (truncate ≤3000)        │    │
│  │  promptPatterns[]   → promptPatterns[] (parse, enforce min 3)    │    │
│  │  topFocusAreas      → topFocusAreas (parse actionsData)          │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│                               │                                          │
│                               ▼                                          │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │                                                   │
│  │  Record<string,  │  (spread into VerboseEvaluation                   │
│  │   unknown>       │   with metadata in orchestrator)                  │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Assembly Mapping Table

| Source (Phase 2 AgentOutputs) | Target (VerboseEvaluation) | Transformation |
|-------------------------------|---------------------------|----------------|
| `strengthGrowth.strengths[]` + `.growthAreas[]` | `dimensionInsights[]` | Group by `.dimension` into 6 dimension buckets, map evidence |
| `typeClassifier` | `primaryType`, `controlLevel`, `distribution`, `controlScore` | Direct field copy |
| `trustVerification.antiPatterns[]` | `antiPatternsAnalysis.detected[]` | Severity mapping (critical/significant→significant), evidence extraction |
| `trustVerification.actionablePatternMatchesData` | `actionablePractices` | Parse semicolon-separated entries into `practiced[]`/`opportunities[]` |
| `workflowHabit.criticalThinkingMoments[]` | `criticalThinkingAnalysis` | Convert to highlights, calculate `overallScore` from type variety |
| `workflowHabit.planningHabits[]` | `planningAnalysis` | Assess `planningMaturityLevel` (reactive→expert), split by effectiveness |

| Source (Phase 3 Narrative) | Target (VerboseEvaluation) | Transformation |
|---------------------------|---------------------------|----------------|
| `personalitySummary` | `personalitySummary` | Truncate to ≤3000 chars |
| `promptPatterns[]` | `promptPatterns[]` | Parse `examplesData`, enforce minimum 3 patterns |
| `topFocusAreas` | `topFocusAreas` | Parse `actionsData` → nested `{start, stop, continue}` |

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
│     ┌──────┴──────┬────────────────┐                                   │
│     ▼             ▼                ▼                                    │
│  ┌──────┐    ┌─────────┐    ┌────────────┐                             │
│  │ FREE │    │ PREMIUM │    │ ENTERPRISE │                             │
│  └──┬───┘    └────┬────┘    └─────┬──────┘                             │
│     │             │               │                                     │
│     ▼             ▼               ▼                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│  TIER ACCESS MATRIX                                                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Content                        Free      Premium    Enterprise         │
│  ───────────────────────────────────────────────────────────────        │
│  Type Result                     ✓          ✓           ✓               │
│  (primaryType, controlLevel)                                             │
│                                                                          │
│  Personality Summary             ✓          ✓           ✓               │
│                                                                          │
│  Dimensions 1-2                  ✓          ✓           ✓               │
│  (full detail)                  full       full        full             │
│                                                                          │
│  Dimensions 3-6                 empty       ✓           ✓               │
│  (locked for free)                         full        full             │
│                                                                          │
│  Prompt Patterns                 ✗          ✓           ✓               │
│  (3-6 patterns)                                                          │
│                                                                          │
│  Top Focus Areas                 ✗          ✓           ✓               │
│  (personalized priorities)                                               │
│                                                                          │
│  Agent Insights                  ✗          ✓           ✓               │
│  (from Phase 2 Workers)                                                  │
│                                                                          │
│  Advanced Analytics              ✗          ✗           ✓               │
│  - toolUsageDeepDive                                                     │
│  - tokenEfficiency                                                       │
│  - comparativeInsights                                                   │
│  - sessionTrends                                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Knowledge Context Injection

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
  ║         PHASE 2: INSIGHT GENERATION (4 workers, 4 LLM calls)      ║
  ║                                                                    ║
  ║   [4 parallel workers, tier requirements vary per worker]          ║
  ║                                                                    ║
  ║   INPUT:  Phase1Output (ONLY - no raw sessions)                   ║
  ║   OUTPUT: AgentOutputs (merged, excluding strengthGrowth)          ║
  ║           - TrustVerificationWorker → anti-patterns (premium)     ║
  ║           - WorkflowHabitWorker → planning/thinking (premium)     ║
  ║           - KnowledgeGapWorker → knowledge gaps (free)            ║
  ║           - ContextEfficiencyWorker → context usage (premium)     ║
  ║                                                                    ║
  ║   NO FALLBACK POLICY: Worker failures propagate as errors         ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [4] Pass agent outputs to Phase 2.5
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║   PHASE 2.5: SYNTHESIS → CLASSIFICATION (2 sequential LLM calls) ║
  ║                                                                    ║
  ║   STEP 1: StrengthGrowthSynthesizer (free)                       ║
  ║   INPUT:  Phase2 AgentOutputs + Phase1Output (utterances)         ║
  ║   OUTPUT: StrengthGrowthOutput → merged into AgentOutputs         ║
  ║                                                                    ║
  ║   STEP 2: TypeClassifierWorker (free)                             ║
  ║   INPUT:  AgentOutputs (now includes strengthGrowth)              ║
  ║   OUTPUT: TypeClassifierOutput                                     ║
  ║           - primaryType + distribution                             ║
  ║           - controlLevel + controlScore                            ║
  ║           - matrixName + matrixEmoji                               ║
  ║           - confidenceScore + reasoning                            ║
  ║                                                                    ║
  ║   NO FALLBACK: If either worker fails, error is thrown            ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [5] Pass summarized outputs to Phase 3
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║         PHASE 3: CONTENT WRITER — NARRATIVE ONLY (1 LLM call)    ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 65536           ║
  ║                                                                    ║
  ║   INPUT:  AgentOutputs summary (via phase3-summarizer)            ║
  ║           + sessionCount + top 20 utterances                      ║
  ║           + knowledgeResources (optional)                         ║
  ║   OUTPUT: NarrativeLLMResponse (narrative only)                   ║
  ║           - personalitySummary (≤3000 chars)                      ║
  ║           - promptPatterns[] (5-12 patterns)                      ║
  ║           - topFocusAreas (top 3 priorities, optional)            ║
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
  ║   MERGE: English structure preserved, text fields overlaid        ║
  ║   KEPT IN ENGLISH: IDs, numbers, technical terms                  ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [7] Deterministic assembly
                       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  EVALUATION ASSEMBLY (deterministic, NO LLM)                      │
  │  assembleEvaluation(agentOutputs, narrativeResult, phase1Output)  │
  │                                                                   │
  │  Phase 2 AgentOutputs → structural fields:                       │
  │  - dimensionInsights, type classification, antiPatterns           │
  │  - criticalThinking, planning, actionablePractices               │
  │                                                                   │
  │  Phase 3 NarrativeLLMResponse → narrative fields:                │
  │  - personalitySummary, promptPatterns, topFocusAreas             │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [8] Add metadata + confidence
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  VerboseEvaluation (Full)                                        │
  │  - sessionId, analyzedAt, sessionsAnalyzed                       │
  │  - ...assembledData (structural + narrative)                     │
  │  - agentOutputs (raw Phase 2 data)                               │
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
  │  tier = 'premium'    → All dimensions + patterns + premium       │
  │  tier = 'enterprise' → Everything + advanced analytics          │
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

## Cost Comparison

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        COST ANALYSIS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Single-Stage (Legacy - Claude Sonnet)                                   │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Sonnet only                                              │           │
│  │  Input: ~15K tokens    Output: ~6K tokens                │           │
│  │  Cost: ~$0.13 per analysis                               │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Orchestrator Pipeline (Current - Gemini 3 Flash)                        │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  PHASE 1: DataExtractor (deterministic, no LLM cost)     │           │
│  │                                                           │           │
│  │  PHASE 2 (Parallel): 4 Workers (tier-gated)              │           │
│  │  ~4K tokens per worker, ~16K total (all workers)         │           │
│  │  Free tier runs: KnowledgeGap (1 LLM)                     │           │
│  │  Premium runs: all 4 workers (4 LLM calls)               │           │
│  │                                                           │           │
│  │  PHASE 2.5 (Sequential): Synthesizer + TypeClassifier     │           │
│  │  Synthesizer: ~8K input, ~4K output (1 LLM call)        │           │
│  │  TypeClassifier: ~4K input, ~1K output (1 LLM call)     │           │
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
│  │  - Free (English):     4 calls (1+2+1+0)                 │           │
│  │  - Free (non-English): 5 calls (1+2+1+1)                 │           │
│  │  - Premium (English):  7 calls (4+2+1+0)                 │           │
│  │  - Premium (non-EN):   8 calls (4+2+1+1)                 │           │
│  │                                                           │           │
│  │  Total Cost (Free):    ~$0.03-0.04 per analysis          │           │
│  │  Total Cost (Premium): ~$0.08-0.10 per analysis          │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Result: Orchestrator + Workers provides BEST VALUE                     │
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
| Analysis Orchestrator | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | Pipeline coordination (Phase 1→2→2.5→3→4→Assembly), Worker registration/execution |
| Orchestrator Types | `src/lib/analyzer/orchestrator/types.ts` | WorkerResult, WorkerContext, Phase types |
| Verbose Analyzer | `src/lib/analyzer/verbose-analyzer.ts` | Entry point, registers all workers (1 Phase 1, 4 Phase 2, 2 Phase 2.5) |
| Content Gateway | `src/lib/analyzer/content-gateway.ts` | Tier-based content filtering (free/premium/enterprise) |

### Phase 1: Data Extraction Worker (1 worker, deterministic)

| Component | File | Description |
|-----------|------|-------------|
| Base Worker | `src/lib/analyzer/workers/base-worker.ts` | BaseWorker abstract class, runWorkerSafely |
| Data Extractor Worker | `src/lib/analyzer/workers/data-extractor-worker.ts` | Phase 1 - deterministic extraction (no LLM) |
| Phase 1 Output Schema | `src/lib/models/phase1-output.ts` | Phase1Output Zod schema |

### Phase 2: Insight Generation Workers (4 workers, 4 LLM calls)

| Component | File | Tier | Description |
|-----------|------|------|-------------|
| Trust Verification | `src/lib/analyzer/workers/trust-verification-worker.ts` | premium | Anti-patterns & verification |
| Workflow Habit | `src/lib/analyzer/workers/workflow-habit-worker.ts` | premium | Planning, critical thinking |
| Knowledge Gap | `src/lib/analyzer/workers/knowledge-gap-worker.ts` | free | Knowledge gaps & learning |
| Context Efficiency | `src/lib/analyzer/workers/context-efficiency-worker.ts` | premium | Token inefficiency |
| Agent Outputs Schema | `src/lib/models/agent-outputs.ts` | — | AgentOutputs Zod schemas |
| Trust Verification Schema | `src/lib/models/trust-verification-data.ts` | — | TrustVerificationOutput |
| Workflow Habit Schema | `src/lib/models/workflow-habit-data.ts` | — | WorkflowHabitOutput |
| Knowledge Gap Schema | (reuses existing) | — | KnowledgeGapOutput |
| Context Efficiency Schema | (reuses existing) | — | ContextEfficiencyOutput |

### Phase 2.5: Synthesis → Classification (2 workers, 2 sequential LLM calls)

| Component | File | Tier | Description |
|-----------|------|------|-------------|
| Strength Growth Synthesizer | `src/lib/analyzer/workers/strength-growth-worker.ts` | free | Cross-domain strengths/growth synthesis |
| TypeClassifier Worker | `src/lib/analyzer/workers/type-classifier-worker.ts` | free | Type classification + synthesis |
| Strength Growth Schema | `src/lib/models/strength-growth-data.ts` | — | StrengthGrowthOutput |
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

### Evaluation Assembly (deterministic, no LLM)

| Component | File | Description |
|-----------|------|-------------|
| Evaluation Assembler | `src/lib/analyzer/stages/evaluation-assembler.ts` | `assembleEvaluation()` — merges Phase 2 structural data + Phase 3 narrative into VerboseEvaluation fields |
| Output Schema | `src/lib/models/verbose-evaluation.ts` | `VerboseEvaluation` schema (full evaluation including assembled fields + metadata) |

### Session Parsing (Stage 0)

| Component | File | Description |
|-----------|------|-------------|
| JSONL Reader | `src/lib/parser/jsonl-reader.ts` | JSONL parsing, path encoding/decoding |
| Session Selector | `src/lib/parser/session-selector.ts` | Duration-based optimal session selection (max 10) |
| Session Formatter | `src/lib/analyzer/shared/session-formatter.ts` | Session data formatting (shared by Workers) |
| Session Types | `src/lib/models/session.ts` | JSONLLine, SessionMetadata types |
| Domain Types | `src/lib/domain/models/analysis.ts` | ParsedSession, SessionMetrics types |

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
└── tier: 'free' | 'premium' | 'enterprise'  ← default: 'enterprise'

Worker Registration (src/lib/analyzer/verbose-analyzer.ts):
│
├── Phase 1 (1 worker):
│   └── DataExtractorWorker (deterministic, no LLM)
│
├── Phase 2 (4 workers, parallel):
│   ├── TrustVerificationWorker (premium)
│   ├── WorkflowHabitWorker (premium)
│   ├── KnowledgeGapWorker (free)
│   └── ContextEfficiencyWorker (premium)
│
└── Phase 2.5 (2 workers, sequential):
    ├── StrengthGrowthWorker/Synthesizer (free)
    └── TypeClassifierWorker (free)

Environment Variables:
└── GOOGLE_GEMINI_API_KEY  ← Required for orchestrator pipeline

Error Handling (No Fallback Policy):
├── All errors are thrown immediately, never silently hidden
├── Workers throw errors instead of returning empty data
├── Orchestrator uses Promise.all() to fail fast
└── Frontend shows clear error states, not fake/empty results
```
