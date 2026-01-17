# Three-Stage LLM Pipeline

> Developer-AI 협업 세션을 분석하여 개인화된 리포트를 생성하는 파이프라인

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Analysis Pipeline                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                  │
│   Sessions (JSONL)                                                               │
│        │                                                                         │
│        ▼                                                                         │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐   │
│   │   Parse &   │────▶│  Module A:  │────▶│  Module B:  │────▶│  Stage 2:   │   │
│   │  Aggregate  │     │Data Analyst │     │ Personality │     │Content Writer│   │
│   └─────────────┘     └─────────────┘     │   Analyst   │     └─────────────┘   │
│                              │            └──────┬──────┘            │           │
│                              │                   │ (graceful         ▼           │
│                              │                   │  fallback)  ┌─────────────┐   │
│                              │                   │             │  Content    │   │
│                              │                   │             │  Gateway    │   │
│                              │                   │             └─────────────┘   │
│                              ▼                   ▼                   │           │
│                     StructuredData      PersonalityProfile    VerboseEvaluation  │
│                     (intermediate)       (intermediate)           (final)        │
│                                                                                  │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Stages

### Stage 0: Session Parsing

```
~/.claude/projects/
├── -Users-dev-projectA/
│   ├── abc123.jsonl    ◀── Claude Code 세션 로그
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
         │  selectOptimalSessions() - 최대 30개 선정
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

### Module A: Data Analyst

**목적**: 정확한 행동 데이터 추출 (내러티브 없음)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       MODULE A: DATA ANALYST                             │
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
│  │  SYSTEM PROMPT                                                   │    │
│  │  ┌─────────────────────────────────────────────────────────┐    │    │
│  │  │  <expert_knowledge>                                      │    │    │
│  │  │    <research_insights>                                   │    │    │
│  │  │      - Skill Atrophy (VCP Research)                     │    │    │
│  │  │      - Passive Consumption Warning (Anthropic)          │    │    │
│  │  │      - ... 10 curated insights                          │    │    │
│  │  │    </research_insights>                                  │    │    │
│  │  │    <behavioral_signals>                                  │    │    │
│  │  │      - aiCollaboration: strength/growth keywords        │    │    │
│  │  │      - contextEngineering: WRITE/SELECT/COMPRESS        │    │    │
│  │  │      - ... 6 dimensions                                 │    │    │
│  │  │    </behavioral_signals>                                 │    │    │
│  │  │  </expert_knowledge>                                     │    │    │
│  │  └─────────────────────────────────────────────────────────┘    │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │                                                              │
│           ▼                                                              │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 65536                         │                         │
│  │  Structured Output: StructuredAnalysisData │                         │
│  └────────────────────────────────────────────┘                         │
│           │                                                              │
│           ▼                                                              │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │                                                   │
│  │  Structured      │                                                   │
│  │  AnalysisData    │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Module A Output Schema

```
StructuredAnalysisData
│
├── typeAnalysis
│   ├── primaryType: "architect" | "scientist" | "collaborator" | "speedrunner" | "craftsman"
│   ├── controlLevel: "vibe-coder" | "developing" | "ai-master"
│   ├── distribution: { architect: 30, scientist: 25, ... }  ← sum = 100
│   └── reasoning: "Based on planning behavior..."
│
├── extractedQuotes[15-50]
│   ├── quote: "Let me think about this before we start..."
│   ├── sessionDate: "2025-01-15"
│   ├── dimension: "aiCollaboration"
│   ├── signal: "strength" | "growth"
│   ├── behavioralMarker: "Strategic planning"
│   ├── confidence: 0.92
│   ├── clusterId: "aiCollaboration_s_1"  ← NEW: for evidence linking
│   │
│   │   FLATTENED CONTEXT (Gemini nesting limit workaround):
│   ├── contextSituationType: "complex_decision" | "debugging" | "feature_building" | ...
│   ├── contextTrigger: "uncertainty" | "previous_failure" | "time_pressure" | ...
│   ├── contextOutcome: "successful" | "partially_successful" | "unsuccessful" | "unknown"
│   │
│   │   FLATTENED INSIGHT:
│   ├── insightRootCause: "Developer wanted to verify before proceeding"
│   ├── insightImplication: "Shows careful verification habit"
│   └── insightGrowthSignal: "deliberate" | "reactive" | "habitual"
│
├── detectedPatterns[3-10]
│   ├── patternId: "verification-loop"
│   ├── patternType: "communication_style" | "problem_solving" | "ai_interaction" | ...
│   ├── frequency: 12
│   ├── examples: ["Wait, let me check...", ...]
│   └── significance: "Consistent output validation"
│
├── dimensionSignals[6]  ← exactly 6, one per dimension
│   ├── dimension: "aiCollaboration"
│   ├── strengthSignals: ["Good context setting", "Clear instructions"]
│   ├── growthSignals: ["Could ask more questions"]
│   ├── strengthClusterThemes: ["aiCollaboration_s_1:Strategic Planning", ...]  ← NEW
│   └── growthClusterThemes: ["aiCollaboration_g_1:Question Frequency", ...]     ← NEW
│
├── personalizedPriorities  ← NEW (FLATTENED for Gemini)
│   ├── priority1Dimension: "aiCollaboration"
│   ├── priority1FocusArea: "Strategic task decomposition"
│   ├── priority1Rationale: "Shows potential but inconsistent..."
│   ├── priority1ExpectedImpact: "Faster iteration cycles"
│   ├── priority1Score: 85
│   ├── priority1ClusterIds: "aiCollaboration_g_1,aiCollaboration_g_2"
│   ├── priority2...  (same structure)
│   ├── priority3...  (same structure)
│   └── selectionRationale: "Based on frequency and impact..."
│
├── detectedAntiPatterns[]  ← NEW (Premium)
│   ├── patternId: "sunk-cost-loop"
│   ├── patternType: "sunk_cost_loop" | "emotional_escalation" | "blind_retry" | ...
│   ├── frequency: 3
│   ├── examples: ["Let me try again...", ...]
│   ├── severity: "mild" | "moderate" | "significant"
│   └── triggerContext: "After repeated failures..."
│
├── criticalThinkingMoments[]  ← NEW (Premium)
│   ├── moment: "Wait, let me verify this output..."
│   ├── type: "verification_request" | "output_validation" | "assumption_questioning" | ...
│   ├── result: "Caught a bug before deployment"
│   ├── dimension: "aiCollaboration"
│   └── confidence: 0.91
│
├── planningBehaviors[]  ← NEW (Premium, FLATTENED)
│   ├── behavior: "Uses /plan before complex features"
│   ├── behaviorType: "slash_plan_usage" | "structure_first" | "task_decomposition" | ...
│   ├── frequency: "often" | "sometimes" | "rarely" | "always"
│   ├── examples: "feature1;feature2;feature3"  ← semicolon-separated (flattened)
│   ├── effectiveness: "high" | "medium" | "low"
│   ├── planContentSummary: "Detailed 5-step implementation plan..."
│   ├── planHasDecomposition: true
│   └── planStepsCount: 5
│
└── analysisMetadata
    ├── totalQuotesAnalyzed: 47
    ├── coverageScores: [{ dimension, score }]
    └── confidenceScore: 0.88
```

---

### Module B: Personality Analyst

**목적**: 행동 데이터로부터 성격 프로필 추출 (사용자에게 직접 노출되지 않음)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MODULE B: PERSONALITY ANALYST                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT                        │                                       │
│  │  - Sessions[]                 │                                       │
│  │  - StructuredAnalysisData     │  ◀── Module A output                 │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  MINIMUM DATA CHECK                                              │    │
│  │  - ≥5 extracted quotes                                          │    │
│  │  - ≥1 detected pattern                                          │    │
│  │  - typeAnalysis present                                         │    │
│  │                                                                   │    │
│  │  If insufficient → return defaultPersonalityProfile()           │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 65536                         │                         │
│  │  Structured Output: PersonalityProfile     │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │     GRACEFUL DEGRADATION:                         │
│  │  Personality     │     If LLM call fails, returns                    │
│  │  Profile         │     defaultPersonalityProfile()                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

> ⚠️ **IMPORTANT**: Module B 데이터는 사용자에게 직접 노출되지 않습니다.
> Stage 2 (Content Writer)에서 자연스러운 문장으로 변환됩니다.

#### Module B Output Schema

```
PersonalityProfile
│
├── dimensions  ← MBTI 4-axis analysis (internal framework)
│   │
│   ├── ei  ← Extraversion/Introversion (communication style)
│   │   ├── score: 0-100 (0=Extraverted, 100=Introverted)
│   │   ├── signalsData: "type:evidence:confidence;..."  ← FLATTENED
│   │   └── insight: "Prefers detailed context over brief prompts"
│   │
│   ├── sn  ← Sensing/Intuition (information processing)
│   │   ├── score: 0-100 (0=Sensing, 100=Intuition)
│   │   ├── signalsData: "..."
│   │   └── insight: "Focuses on big-picture patterns"
│   │
│   ├── tf  ← Thinking/Feeling (decision making)
│   │   ├── score: 0-100 (0=Thinking, 100=Feeling)
│   │   ├── signalsData: "..."
│   │   └── insight: "Logic-driven with some user empathy"
│   │
│   └── jp  ← Judging/Perceiving (work structure)
│       ├── score: 0-100 (0=Judging, 100=Perceiving)
│       ├── signalsData: "..."
│       └── insight: "Structured approach with flexibility"
│
├── yongsin: "용신 - What's missing/needed"
│   └── Example: "Verification before committing changes"
│
├── gisin: "기신 - What's excessive"
│   └── Example: "Over-reliance on AI suggestions"
│
├── gyeokguk: "격국 - Overall pattern type"
│   └── Example: "Pragmatic Builder"
│
├── sangsaeng: []  ← 상생 - Synergistic skill combinations
│   └── Example: ["Planning + Execution", "Context + Delegation"]
│
├── sanggeuk: []  ← 상극 - Conflicting skill combinations
│   └── Example: ["Speed vs Quality tension"]
│
└── overallConfidence: 0.0-1.0
```

**사주 (Four Pillars) Framework Mapping:**

| 사주 용어 | 영문 | 목적 |
|----------|------|------|
| 용신 (用神) | yongsin | 부족한 것, 필요한 것 |
| 기신 (忌神) | gisin | 과한 것, 줄여야 할 것 |
| 격국 (格局) | gyeokguk | 전체 패턴 유형 |
| 상생 (相生) | sangsaeng | 시너지 조합 |
| 상극 (相剋) | sanggeuk | 충돌 조합 |

---

### Stage 2: Content Writer

**목적**: Module A + Module B 데이터를 개인화된 내러티브로 변환

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONTENT WRITER STAGE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT                        │                                       │
│  │  - StructuredAnalysisData     │  ◀── Module A output                 │
│  │  - PersonalityProfile         │  ◀── Module B output                 │
│  │  - Sessions[] (for language)  │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TRANSFORMATION RULES                                            │    │
│  │                                                                   │    │
│  │  FROM MODULE A:                                                   │    │
│  │  extractedQuotes ─────────▶ dimensionInsights[].evidence[]       │    │
│  │  detectedPatterns ────────▶ promptPatterns[]                     │    │
│  │  dimensionSignals ────────▶ themed strength clusters             │    │
│  │  typeAnalysis ────────────▶ (passed through unchanged)           │    │
│  │  personalizedPriorities ──▶ topFocusAreas[]                      │    │
│  │                                                                   │    │
│  │  FROM MODULE B:                                                   │    │
│  │  dimensions (MBTI) ───────▶ personalityInsights (natural lang)   │    │
│  │  yongsin/gisin ───────────▶ growth narrative                     │    │
│  │  sangsaeng/sanggeuk ──────▶ strength/conflict insights           │    │
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
Module A Output                                     Stage 2 Output
─────────────────                                   ─────────────────

extractedQuotes[]                                   dimensionInsights[]
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ quote: "..."          │                           │ dimension: "aiCollaboration"     │
│ dimension: "ai..."    │───┐                       │ dimensionDisplayName: "AI..."    │
│ signal: strength      │   │ group by              │ strengths: [                     │
│ clusterId: "ai_s_1"   │   │ clusterId             │   {                              │
│ confidence: 0.9       │   │                       │     clusterId: "ai_s_1"          │
└───────────────────────┘   │                       │     title: "Strategic Delegation"│
                            ├──────────────────────▶│     description: "Your habit..." │
┌───────────────────────┐   │                       │     evidence: ["quote1", ...]    │
│ quote: "..."          │───┘                       │   }                              │
│ clusterId: "ai_s_1"   │                           │ ]                                │
└───────────────────────┘                           │ growthAreas: [...]               │
                                                    └──────────────────────────────────┘

detectedPatterns[]                                  promptPatterns[]
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ patternType:          │                           │ patternName: "The Thoughtful..." │
│  "verification"       │                           │ description: "Before diving..."  │
│ frequency: 12         │──────────────────────────▶│ frequency: "frequent"            │
│ examples: [...]       │     humanize              │ examplesData: "quote|analysis;.."│
│ significance: ...     │                           │ effectiveness: "high"            │
└───────────────────────┘                           │ tip: "Consider..."               │
                                                    └──────────────────────────────────┘

personalizedPriorities                              topFocusAreas
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ priority1Dimension    │                           │ areas: [                         │
│ priority1FocusArea    │──────────────────────────▶│   { rank: 1, dimension,          │
│ priority1Rationale    │     transform             │     title, narrative,            │
│ priority1Score        │                           │     expectedImpact, actions }    │
│ ...                   │                           │ ]                                │
└───────────────────────┘                           │ summary: "..."                   │
                                                    └──────────────────────────────────┘

Module B Output                                     Stage 2 Output
─────────────────                                   ─────────────────

PersonalityProfile                                  personalityInsights
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ dimensions: {         │                           │ coreObservation: "You tend to..."│
│   ei: { score, ... }  │──────────────────────────▶│ strengthConnection: "This helps."│
│   sn: { score, ... }  │     natural language      │ growthOpportunity: "Consider..." │
│   tf: { score, ... }  │     transformation        │ dailyLifeConnection: "Like when."│
│   jp: { score, ... }  │                           └──────────────────────────────────┘
│ }                     │
│ yongsin: "..."        │     (NO labels/scores exposed to user)
│ gisin: "..."          │
└───────────────────────┘
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
│  Top Focus Areas                 ✗          ✓           ✓               │  ← NEW
│  (personalized priorities)                                               │
│                                                                          │
│  Personality Insights            ✗          ✓           ✓               │  ← NEW
│  (from Module B)                                                         │
│                                                                          │
│  Anti-Patterns Analysis          ✗          ✓           ✓               │  ← NEW
│  (growth-framed feedback)                                                │
│                                                                          │
│  Critical Thinking Analysis      ✗          ✓           ✓               │  ← NEW
│  (verification moments)                                                  │
│                                                                          │
│  Planning Analysis               ✗          ✓           ✓               │  ← NEW
│  (/plan usage, maturity)                                                 │
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

Module A에 주입되는 전문가 지식 구조:

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
           │ [2] Select optimal sessions (max 30)
           │     Aggregate metrics
           ▼
  ┌─────────────────┐     ┌─────────────────┐
  │ ParsedSession[] │     │ SessionMetrics  │
  │ (selected)      │     │                 │
  └────────┬────────┘     └────────┬────────┘
           │                       │
           └───────────┬───────────┘
                       │
                       │ [3] Inject expert knowledge
                       ▼
           ┌───────────────────────┐
           │  Expert Knowledge     │
           │  Context (XML)        │
           └───────────┬───────────┘
                       │
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                    MODULE A: DATA ANALYST                         ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 65536           ║
  ║                                                                    ║
  ║   INPUT:  Sessions + Metrics + Knowledge Context                   ║
  ║   OUTPUT: StructuredAnalysisData                                   ║
  ║           - 15-50 extracted quotes (with clusterId)                ║
  ║           - 3-10 detected patterns                                 ║
  ║           - 6 dimension signals (with cluster themes)              ║
  ║           - Type classification                                    ║
  ║           - Personalized priorities (top 3)                        ║
  ║           - Anti-patterns, critical thinking, planning (Premium)   ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [4] Pass to Module B for personality extraction
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                  MODULE B: PERSONALITY ANALYST                    ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 65536           ║
  ║                                                                    ║
  ║   INPUT:  Sessions + StructuredAnalysisData                        ║
  ║   OUTPUT: PersonalityProfile                                       ║
  ║           - MBTI 4-axis analysis (E/I, S/N, T/F, J/P)             ║
  ║           - 사주: yongsin, gisin, gyeokguk, sangsaeng, sanggeuk    ║
  ║                                                                    ║
  ║   GRACEFUL DEGRADATION: If fails → defaultPersonalityProfile()    ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [5] Pass both outputs to Stage 2
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                   STAGE 2: CONTENT WRITER                         ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 65536           ║
  ║                                                                    ║
  ║   INPUT:  StructuredAnalysisData + PersonalityProfile + Sessions   ║
  ║   OUTPUT: VerboseLLMResponse                                       ║
  ║           - Personality summary (300-1500 chars)                   ║
  ║           - 6 dimension insights (with evidence)                   ║
  ║           - 3-6 prompt patterns                                    ║
  ║           - Top focus areas (personalized)                         ║
  ║           - Personality insights (natural language)                ║
  ║           - Premium: anti-patterns, critical thinking, planning    ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [6] Post-processing: evidence linking, flattening
                       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  POST-PROCESSING                                                  │
  │  - Parse flattened strings → nested arrays                       │
  │  - Link evidence using clusterId (semantic fallback)             │
  │  - Truncate strings to max lengths                               │
  │  - Ensure minimums for each dimension                            │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [7] Add metadata
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  VerboseEvaluation (Full)                                        │
  │  - sessionId, analyzedAt, sessionsAnalyzed                       │
  │  - ... all VerboseLLMResponse fields                             │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [8] Apply tier-based filtering
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  ContentGateway.filter(evaluation, tier)                         │
  │                                                                   │
  │  tier = 'free'       → Limited dimensions, no patterns          │
  │  tier = 'premium'    → All dimensions + patterns + premium       │
  │  tier = 'enterprise' → Everything + advanced analytics          │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [9] Save & serve
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
│  Three-Stage (Current - Gemini 3 Flash)                                  │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Module A: Gemini 3 Flash                                 │           │
│  │  Input: ~15K tokens    Output: ~8K tokens                │           │
│  │                                                           │           │
│  │  Module B: Gemini 3 Flash                                 │           │
│  │  Input: ~20K tokens    Output: ~2K tokens                │           │
│  │                                                           │           │
│  │  Stage 2: Gemini 3 Flash                                  │           │
│  │  Input: ~12K tokens    Output: ~6K tokens                │           │
│  │                                                           │           │
│  │  Total Cost: ~$0.06 per analysis                         │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Result: Three-stage with Gemini provides BEST VALUE                    │
│  - Gemini 3 Flash: Pro-level intelligence at Flash pricing              │
│  - 1M token context window for comprehensive analysis                   │
│  - Unified model simplifies pipeline                                    │
│  - Module B adds personality depth with minimal cost                    │
│  - Graceful degradation prevents failures                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Pipeline Orchestration

| Component | File | Description |
|-----------|------|-------------|
| Orchestrator | `src/lib/analyzer/verbose-analyzer.ts` | Three-stage 파이프라인 조율, 문자열 sanitization |
| Content Gateway | `src/lib/analyzer/content-gateway.ts` | 티어별 콘텐츠 필터링 (free/premium/enterprise) |

### Module A: Data Analyst

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/data-analyst.ts` | DataAnalystStage 클래스, Gemini 호출 |
| Prompts (PTCF) | `src/lib/analyzer/stages/data-analyst-prompts.ts` | 시스템/유저 프롬프트 빌더 |
| Output Schema | `src/lib/models/analysis-data.ts` | StructuredAnalysisData Zod 스키마 |

### Module B: Personality Analyst

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/personality-analyst.ts` | PersonalityAnalystStage 클래스, Gemini 호출 |
| Prompts (PTCF) | `src/lib/analyzer/stages/personality-analyst-prompts.ts` | MBTI/사주 분석 프롬프트 빌더 |
| Output Schema | `src/lib/models/personality.ts` | PersonalityProfile Zod 스키마 |

### Stage 2: Content Writer

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/content-writer.ts` | ContentWriterStage 클래스, 내러티브 변환, evidence linking |
| Prompts (PTCF) | `src/lib/analyzer/stages/content-writer-prompts.ts` | 시스템/유저 프롬프트 빌더 |
| Output Schema | `src/lib/models/verbose-evaluation.ts` | VerboseLLMResponse, VerboseEvaluation 스키마 |

### Session Parsing (Stage 0)

| Component | File | Description |
|-----------|------|-------------|
| JSONL Reader | `src/lib/parser/jsonl-reader.ts` | JSONL 파싱, 경로 인코딩/디코딩 |
| Session Selector | `src/lib/parser/session-selector.ts` | Duration-based 최적 세션 선정 (max 30) |
| Session Formatter | `src/lib/analyzer/shared/session-formatter.ts` | 세션 데이터 포맷팅 (Module A/B 공유) |
| Session Types | `src/lib/models/session.ts` | JSONLLine, SessionMetadata 타입 |
| Domain Types | `src/lib/domain/models/analysis.ts` | ParsedSession, SessionMetrics 타입 |

### Knowledge Context

| Component | File | Description |
|-----------|------|-------------|
| Context Builder | `src/lib/analyzer/verbose-knowledge-context.ts` | XML 형태의 전문가 지식 빌더 |
| Research Insights | `src/lib/domain/models/knowledge.ts` | INITIAL_INSIGHTS 전문가 인사이트 정의 |
| Behavioral Signals | `src/lib/analyzer/dimension-keywords.ts` | DIMENSION_KEYWORDS 행동 시그널 매핑 |

### API Client

| Component | File | Description |
|-----------|------|-------------|
| Gemini Client | `src/lib/analyzer/clients/gemini-client.ts` | @google/genai SDK 래퍼, structured output 지원 |

---

## Configuration

```
VerboseAnalyzerConfig
│
├── pipeline
│   ├── mode: 'single' | 'two-stage'  ← default: 'two-stage' (runs 3 stages)
│   │
│   ├── stage1 (Module A: Data Analyst - Gemini 3 Flash)
│   │   ├── model: 'gemini-3-flash-preview'
│   │   ├── temperature: 1.0  ← Gemini default (do not lower)
│   │   └── maxOutputTokens: 65536
│   │
│   ├── moduleB (Personality Analyst - Gemini 3 Flash)  ← NEW
│   │   ├── model: 'gemini-3-flash-preview'
│   │   ├── temperature: 1.0  ← Gemini default (do not lower)
│   │   └── maxOutputTokens: 65536
│   │
│   └── stage2 (Content Writer - Gemini 3 Flash)
│       ├── model: 'gemini-3-flash-preview'
│       ├── temperature: 1.0  ← Gemini default (do not lower)
│       └── maxOutputTokens: 65536
│
├── tier: 'free' | 'premium' | 'enterprise'  ← default: 'enterprise'
│
└── fallbackToLegacy: true  ← three-stage 실패시 Claude single로 폴백

Environment Variables:
├── GOOGLE_GEMINI_API_KEY  ← Required for three-stage pipeline
└── ANTHROPIC_API_KEY      ← Required for fallback/legacy mode

Graceful Degradation:
├── Module B fails → uses defaultPersonalityProfile()
└── Three-stage fails + fallbackToLegacy: true → uses Claude single-stage
```
