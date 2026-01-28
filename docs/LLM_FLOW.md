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
│   ║  │ PHASE 2: Insight Generation (parallel, 5 workers, 5 LLM calls)        │   ║   │
│   ║  │                                                                         │   ║   │
│   ║  │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌──────┐ │   ║   │
│   ║  │ │ Strength   │ │   Trust    │ │  Workflow  │ │ Knowledge  │ │Cntxt │ │   ║   │
│   ║  │ │  Growth    │ │Verification│ │   Habit    │ │    Gap     │ │Effic.│ │   ║   │
│   ║  │ │  (free)    │ │ (premium)  │ │ (premium)  │ │  (free)    │ │(prem)│ │   ║   │
│   ║  │ └────────────┘ └────────────┘ └────────────┘ └────────────┘ └──────┘ │   ║   │
│   ║  │                                   │                                     │   ║   │
│   ║  │                                   ▼                                     │   ║   │
│   ║  │                            AgentOutputs                                 │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 2.5: Type Classification (1 LLM call)                            │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ TypeClassifierWorker (free)                                      │   │   ║   │
│   ║  │ │ Classifies developer type using Phase1 + AgentOutputs           │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 3: Content Generation (1 LLM call)                              │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ ContentWriter                                                    │   │   ║   │
│   ║  │ │ (combines Phase1Output + AgentOutputs into narrative)            │   │   ║   │
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

> 5 workers run in parallel. Some workers are free tier, some require premium.

**IMPORTANT: Context Isolation**
All Phase 2 workers receive ONLY Phase1Output (not raw sessions). This enforces:
- Phase 1 = Pure Extraction (deterministic)
- Phase 2 = Semantic Analysis (on extracted data only)

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
│  │  5 Parallel Workers (LLM-based)                                 │    │
│  │  ┌────────────┐ ┌────────────┐ ┌────────────┐                  │    │
│  │  │ Strength   │ │   Trust    │ │  Workflow  │                  │    │
│  │  │  Growth    │ │Verification│ │   Habit    │                  │    │
│  │  │  (free)    │ │ (premium)  │ │ (premium)  │                  │    │
│  │  └────────────┘ └────────────┘ └────────────┘                  │    │
│  │                                                                  │    │
│  │  ┌────────────┐ ┌────────────┐                                 │    │
│  │  │ Knowledge  │ │  Context   │                                 │    │
│  │  │    Gap     │ │ Efficiency │                                 │    │
│  │  │  (free)    │ │ (premium)  │                                 │    │
│  │  └────────────┘ └────────────┘                                 │    │
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
| **StrengthGrowth** | free | Strengths & growth areas with evidence | `StrengthGrowthOutput` |
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

### Phase 2.5: Type Classification

**Purpose**: Classify developer type using Phase 1 output + Phase 2 agent outputs

> Runs after Phase 2, before Phase 3. Available for all tiers (free).

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2.5: TYPE CLASSIFICATION                       │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT (from Phase 1 + 2)    │                                       │
│  │  - Phase1Output              │  ◀── Extracted data                   │
│  │  - AgentOutputs              │  ◀── All Phase 2 agent results       │
│  │    ├── strengthGrowth        │                                       │
│  │    ├── trustVerification     │                                       │
│  │    ├── workflowHabit         │                                       │
│  │    ├── knowledgeGap          │                                       │
│  │    └── contextEfficiency     │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 4096                          │                         │
│  │  Structured Output: TypeClassifierOutput   │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │                                                   │
│  │  TypeClassifier  │     - Primary type + distribution                 │
│  │  Output          │     - Control level                               │
│  │                  │     - Matrix name + emoji                         │
│  │                  │     - Reasoning & evidence                        │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Type Classification Process

1. **Input Analysis**:
   - Phase1Output: Developer utterances, AI responses, metrics
   - AgentOutputs: Insights from 5 Phase 2 workers

2. **LLM Classification**:
   - Analyzes behavioral patterns and semantic evidence
   - Assigns developer to 5 coding styles × 3 control levels (15 combinations)
   - Provides reasoning with specific evidence citations

3. **Output**:
   - Primary type and distribution (e.g., 42% architect, 25% scientist, ...)
   - Control level (explorer, navigator, cartographer)
   - Combined matrix name (e.g., "Systems Architect", "Curious Scientist")
   - Matrix emoji
   - Confidence score

#### TypeClassifierWorker

```typescript
export class TypeClassifierWorker extends BaseWorker<TypeClassifierOutput> {
  readonly name = 'TypeClassifier';
  readonly phase = 2 as const;  // Runs as Phase 2.5 (after other Phase 2 workers)
  readonly minTier: Tier = 'free';

  canRun(context: WorkerContext): boolean;
  execute(context: WorkerContext): Promise<WorkerResult<TypeClassifierOutput>>;
}
```

---

### Phase 3: Content Writer

**Purpose**: Transform Phase1Output + AgentOutputs into personalized narrative

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: CONTENT WRITER                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT                        │                                       │
│  │  - Phase1Output               │  ◀── Phase 1 output                  │
│  │  - AgentOutputs               │  ◀── Phase 2 outputs (Premium+)      │
│  │  - Sessions[] (for language)  │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TRANSFORMATION RULES                                            │    │
│  │                                                                   │    │
│  │  FROM PHASE 1:                                                    │    │
│  │  developerUtterances ─────▶ dimensionInsights[].evidence[]       │    │
│  │  aiResponses ─────────────▶ interaction patterns                 │    │
│  │  sessionMetrics ──────────▶ quantitative metrics                 │    │
│  │                                                                   │    │
│  │  FROM PHASE 2 AGENTS (Premium+):                                  │    │
│  │  strengthGrowth ──────────▶ strengths + growth areas             │    │
│  │  trustVerification ───────▶ anti-patterns + verification         │    │
│  │  workflowHabit ───────────▶ planning + critical thinking         │    │
│  │  knowledgeGap ────────────▶ learningRecommendations               │    │
│  │  contextEfficiency ───────▶ communicationAnalysis                 │    │
│  │                                                                   │    │
│  │  TONE: "Your habit of saying 'let me think'..."                  │    │
│  │    NOT: "You demonstrate good planning behaviors..."             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  MULTI-LANGUAGE SUPPORT                                          │    │
│  │                                                                   │    │
│  │  Supported: 'en', 'ko', 'ja', 'zh'                               │    │
│  │                                                                   │    │
│  │  Language Reminders (non-English only):                          │    │
│  │  ├── languageHeader: Write ALL output in target language         │    │
│  │  ├── languagePatternReminder: Translate pattern descriptions     │    │
│  │  ├── languageDimensionReminder: Translate dimension insights     │    │
│  │  ├── languageAgentInsightsReminder: Translate agent insights     │    │
│  │  └── languageFinalReminder: Final language compliance check      │    │
│  │                                                                   │    │
│  │  Technical Terms (kept in English):                              │    │
│  │    AI, IDE, debugging, Git, commit, token, API, etc.             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 65536                         │                         │
│  │  Structured Output: VerboseLLMResponse     │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  POST-PROCESSING                                                 │    │
│  │  1. Parse flattened strings → nested arrays                     │    │
│  │  2. Attach evidence quotes using clusterId matching             │    │
│  │  3. Apply semantic fallback if clusterId not found              │    │
│  │  4. Truncate strings to max lengths                             │    │
│  │  5. Ensure minimum data for each dimension                      │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │                                                   │
│  │  VerboseLLM      │                                                   │
│  │  Response        │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Data Transformation Flow

```
Phase1Output                                        Phase 3 Output
─────────────────                                   ─────────────────

developerUtterances[]                               dimensionInsights[]
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ id: "..."             │                           │ dimension: "aiCollaboration"     │
│ text: "..."           │───┐                       │ dimensionDisplayName: "AI..."    │
│ sessionId: "..."      │   │ extract               │ strengths: [                     │
│ timestamp: "..."      │   │ patterns              │   { title, description,          │
└───────────────────────┘   │                       │     evidence: ["quote1", ...] }  │
                            ├──────────────────────▶│ ]                                │
┌───────────────────────┐   │                       │ growthAreas: [...]               │
│ text: "..."           │───┘                       │                                  │
└───────────────────────┘                           └──────────────────────────────────┘

AgentOutputs                                        Phase 3 Output
────────────────────────                           ─────────────────

AgentOutputs                                       agentInsights
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ strengthGrowth: {}    │                           │ strengths: "Your systematic..."  │
│ trustVerification: {} │──────────────────────────▶│ growthAreas: "Consider..."       │
│ workflowHabit: {}     │     aggregate & narrate   │ learningRecommendations: [...]   │
│ knowledgeGap: {}      │     + translate (if i18n) │ antiPatterns: [...]              │
│ contextEfficiency: {} │                           │                                  │
└───────────────────────┘                           └──────────────────────────────────┘

⚠️ TRANSLATION NOTE (non-English output):
Agent insights from Phase 2 are generated in English.
When output language is non-English (ko, ja, zh):
- languageAgentInsightsReminder instructs LLM to translate agent findings
- Pattern names and recommendations are translated to target language
- Technical terms (AI, Git, commit, etc.) remain in English
```

---

### Phase 4: Translator (Conditional)

**Purpose**: Translate Phase 3 output into user's detected language

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
│  │  Input: VerboseLLMResponse (English)                              │   │
│  │  Output: TranslatorOutput (translated text fields only)          │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                 │                                        │
│                                 ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  MERGE STRATEGY                                                   │   │
│  │  - English response = source of truth for structure               │   │
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

  execute(input: VerboseLLMResponse, language: string): Promise<TranslatorOutput>;
}
```

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
  ║         PHASE 2: INSIGHT GENERATION (5 workers, 5 LLM calls)      ║
  ║                                                                    ║
  ║   [5 parallel workers, tier requirements vary per worker]          ║
  ║                                                                    ║
  ║   INPUT:  Phase1Output (ONLY - no raw sessions)                   ║
  ║   OUTPUT: AgentOutputs (merged)                                    ║
  ║           - StrengthGrowthWorker → strengths/growth (free)        ║
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
  ║      PHASE 2.5: TYPE CLASSIFICATION (1 LLM call)                 ║
  ║                                                                    ║
  ║   [TypeClassifierWorker - runs after Phase 2, before Phase 3]     ║
  ║                                                                    ║
  ║   INPUT:  Phase1Output + AgentOutputs                             ║
  ║   OUTPUT: TypeClassifierOutput                                     ║
  ║           - primaryType + distribution                             ║
  ║           - controlLevel + controlScore                            ║
  ║           - matrixName + matrixEmoji                               ║
  ║           - confidenceScore + reasoning                            ║
  ║                                                                    ║
  ║   NO FALLBACK: If type classification fails, error is thrown      ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [5] Pass all outputs to Phase 3
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                   PHASE 3: CONTENT WRITER (1 LLM call)           ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 65536           ║
  ║                                                                    ║
  ║   INPUT:  Phase1Output + AgentOutputs + Sessions                  ║
  ║   OUTPUT: VerboseLLMResponse                                       ║
  ║           - Personality summary (300-1500 chars)                   ║
  ║           - 6 dimension insights (with evidence)                   ║
  ║           - 3-6 prompt patterns                                    ║
  ║           - Top focus areas (personalized)                         ║
  ║           - Agent insights (from Phase 2, Premium+)                ║
  ║                                                                    ║
  ║   LANGUAGE: Supports 'en', 'ko', 'ja', 'zh'                        ║
  ║             Non-English: Agent insights translated via prompt      ║
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
  ║   INPUT:  VerboseLLMResponse (English)                            ║
  ║   OUTPUT: TranslatorOutput (translated text fields only)          ║
  ║                                                                    ║
  ║   MERGE: English structure preserved, text fields overlaid        ║
  ║   KEPT IN ENGLISH: IDs, numbers, technical terms                  ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [7] Post-processing: evidence linking, flattening
                       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  POST-PROCESSING                                                  │
  │  - Parse flattened strings → nested arrays                       │
  │  - Link evidence using clusterId (semantic fallback)             │
  │  - Truncate strings to max lengths                               │
  │  - Ensure minimums for each dimension                            │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [8] Add metadata
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  VerboseEvaluation (Full)                                        │
  │  - sessionId, analyzedAt, sessionsAnalyzed                       │
  │  - ... all VerboseLLMResponse fields                             │
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
│  │  PHASE 2 (Parallel): 5 Workers (tier-gated)              │           │
│  │  ~4K tokens per worker, ~20K total (all workers)         │           │
│  │  Free tier runs: StrengthGrowth, KnowledgeGap (2 LLM)    │           │
│  │  Premium runs: all 5 workers (5 LLM calls)               │           │
│  │                                                           │           │
│  │  PHASE 2.5: TypeClassifier (1 LLM call)                  │           │
│  │  Input: ~4K tokens    Output: ~1K tokens                 │           │
│  │                                                           │           │
│  │  PHASE 3: ContentWriter (1 LLM call)                      │           │
│  │  Input: ~12K tokens    Output: ~6K tokens                │           │
│  │                                                           │           │
│  │  PHASE 4: Translator (0-1 LLM call, conditional)         │           │
│  │  Only runs for non-English users (ko, ja, zh)            │           │
│  │  Input: ~8K tokens    Output: ~6K tokens                 │           │
│  │                                                           │           │
│  │  Total LLM Calls:                                         │           │
│  │  - Free (English):     4 calls (2+1+1+0)                 │           │
│  │  - Free (non-English): 5 calls (2+1+1+1)                 │           │
│  │  - Premium (English):  7 calls (5+1+1+0)                 │           │
│  │  - Premium (non-EN):   8 calls (5+1+1+1)                 │           │
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
| Analysis Orchestrator | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | Pipeline coordination (Phase 1→2→2.5→3), Worker registration/execution |
| Orchestrator Types | `src/lib/analyzer/orchestrator/types.ts` | WorkerResult, WorkerContext, Phase types |
| Verbose Analyzer | `src/lib/analyzer/verbose-analyzer.ts` | Entry point, registers all workers (1 Phase 1, 5 Phase 2, 1 Phase 2.5) |
| Content Gateway | `src/lib/analyzer/content-gateway.ts` | Tier-based content filtering (free/premium/enterprise) |

### Phase 1: Data Extraction Worker (1 worker, deterministic)

| Component | File | Description |
|-----------|------|-------------|
| Base Worker | `src/lib/analyzer/workers/base-worker.ts` | BaseWorker abstract class, runWorkerSafely |
| Data Extractor Worker | `src/lib/analyzer/workers/data-extractor-worker.ts` | Phase 1 - deterministic extraction (no LLM) |
| Phase 1 Output Schema | `src/lib/models/phase1-output.ts` | Phase1Output Zod schema |

### Phase 2: Insight Generation Workers (5 workers, 5 LLM calls)

| Component | File | Tier | Description |
|-----------|------|------|-------------|
| Strength Growth | `src/lib/analyzer/workers/strength-growth-worker.ts` | free | Strengths & growth areas |
| Trust Verification | `src/lib/analyzer/workers/trust-verification-worker.ts` | premium | Anti-patterns & verification |
| Workflow Habit | `src/lib/analyzer/workers/workflow-habit-worker.ts` | premium | Planning, critical thinking |
| Knowledge Gap | `src/lib/analyzer/workers/knowledge-gap-worker.ts` | free | Knowledge gaps & learning |
| Context Efficiency | `src/lib/analyzer/workers/context-efficiency-worker.ts` | premium | Token inefficiency |
| Agent Outputs Schema | `src/lib/models/agent-outputs.ts` | — | AgentOutputs Zod schemas |
| Strength Growth Schema | `src/lib/models/strength-growth-data.ts` | — | StrengthGrowthOutput |
| Trust Verification Schema | `src/lib/models/trust-verification-data.ts` | — | TrustVerificationOutput |
| Workflow Habit Schema | `src/lib/models/workflow-habit-data.ts` | — | WorkflowHabitOutput |
| Knowledge Gap Schema | (reuses existing) | — | KnowledgeGapOutput |
| Context Efficiency Schema | (reuses existing) | — | ContextEfficiencyOutput |

### Phase 2.5: Type Classification (1 worker, 1 LLM call)

| Component | File | Tier | Description |
|-----------|------|------|-------------|
| TypeClassifier Worker | `src/lib/analyzer/workers/type-classifier-worker.ts` | free | Type classification + synthesis |
| Type Detector | `src/lib/analyzer/type-detector.ts` | — | Pattern-based type detection utilities |
| Coding Style Types | `src/lib/models/coding-style.ts` | — | 5×3 matrix types (15 combinations) |
| AI Control Dimension | `src/lib/analyzer/dimensions/ai-control.ts` | — | Control level calculation |

### Calculators (Pure Deterministic - No LLM)

| Component | File | Description |
|-----------|------|-------------|
| Temporal Calculator | `src/lib/analyzer/calculators/temporal-calculator.ts` | Pure functions for temporal metrics (heatmaps, session patterns, engagement signals) |
| Phrase Pattern Calculator | `src/lib/analyzer/calculators/phrase-pattern-calculator.ts` | N-gram phrase pattern detection using Levenshtein clustering |
| Temporal Metrics Schema | `src/lib/models/temporal-metrics.ts` | Zod schemas for deterministic temporal metrics |

### Phase 3: Content Writer (1 LLM call)

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/content-writer.ts` | ContentWriterStage class, narrative transformation, evidence linking |
| Prompts (PTCF) | `src/lib/analyzer/stages/content-writer-prompts.ts` | System/user prompt builders, i18n language reminders (ko/ja/zh) |
| Output Schema | `src/lib/models/verbose-evaluation.ts` | VerboseLLMResponse, VerboseEvaluation schema |

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
├── Phase 2 (5 workers):
│   ├── StrengthGrowthWorker (free)
│   ├── TrustVerificationWorker (premium)
│   ├── WorkflowHabitWorker (premium)
│   ├── KnowledgeGapWorker (free)
│   └── ContextEfficiencyWorker (premium)
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
