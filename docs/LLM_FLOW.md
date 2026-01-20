# Orchestrator + Workers Analysis Pipeline

> Developer-AI 협업 세션을 분석하여 개인화된 리포트를 생성하는 파이프라인

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
│   ║  │ PHASE 1: Data Extraction (parallel)                                     │ ║   │
│   ║  │ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐             │ ║   │
│   ║  │ │ DataAnalyst     │ │ Productivity    │ │ Multitasking    │             │ ║   │
│   ║  │ │ Worker (A)      │ │ Worker (C)      │ │ Analyzer        │             │ ║   │
│   ║  │ └───────┬─────────┘ └───────┬─────────┘ └───────┬─────────┘             │ ║   │
│   ║  │         │                   │                   │                        │ ║   │
│   ║  │         ▼                   ▼                   ▼                        │ ║   │
│   ║  │  StructuredData      ProductivityData    MultitaskingData               │ ║   │
│   ║  └─────────────────────────────────────────────────────────────────────────┘ ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 2: Insight Generation (parallel, Premium+ only)                  │   ║   │
│   ║  │ ┌───────────────┐ ┌───────────────┐ ┌──────────────┐ ┌──────────────┐ │   ║   │
│   ║  │ │ PatternDet.   │ │ AntiPattern   │ │ KnowledgeGap │ │ ContextEff.  │ │   ║   │
│   ║  │ │ Worker        │ │ Spotter       │ │ Worker       │ │ Worker       │ │   ║   │
│   ║  │ └───────┬───────┘ └───────┬───────┘ └──────┬───────┘ └──────┬───────┘ │   ║   │
│   ║  │         │                 │                 │                │         │   ║   │
│   ║  │         └─────────────────┴─────────────────┴────────────────┘         │   ║   │
│   ║  │                                   │                                     │   ║   │
│   ║  │                                   ▼                                     │   ║   │
│   ║  │                            AgentOutputs                                 │   ║   │
│   ║  └───────────────────────────────────────────────────────────────────────┘   ║   │
│   ║                              │                                                ║   │
│   ║  ┌───────────────────────────┴───────────────────────────────────────────┐   ║   │
│   ║  │ PHASE 3: Content Generation                                            │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ ContentWriter                                                    │   │   ║   │
│   ║  │ │ (combines Module A + C + Agent outputs)                         │   │   ║   │
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

### Module C: Productivity Analyst

**목적**: 생산성 지표 및 효율성 분석 추출

> Module A와 병렬로 실행됨 (Phase 1)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    MODULE C: PRODUCTIVITY ANALYST                        │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT                        │                                       │
│  │  - Sessions[]                 │                                       │
│  │  - Metrics                    │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 65536                         │                         │
│  │  Structured Output: ProductivityAnalysisData│                        │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │     GRACEFUL DEGRADATION:                         │
│  │  Productivity    │     If LLM call fails, returns                    │
│  │  AnalysisData    │     defaultProductivityAnalysisData()             │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Module C Output Schema

```
ProductivityAnalysisData
│
├── sessionEfficiency
│   ├── averageTimeToFirstCode: number  (minutes)
│   ├── averageIterationCycles: number
│   └── efficiencyScore: 0-100
│
├── taskCompletionPatterns
│   ├── completionRate: 0-100
│   ├── averageTasksPerSession: number
│   └── commonBlockers: string[]
│
├── focusIndicators
│   ├── deepWorkSessions: number
│   ├── contextSwitchFrequency: number
│   └── multitaskingScore: 0-100
│
└── workPatterns
    ├── peakProductivityHours: string[]
    ├── sessionDurationDistribution: { short, medium, long }
    └── restPatterns: string[]
```

---

### Phase 2: Insight Generation Agents (Premium+)

**목적**: Phase 1 결과를 바탕으로 심층 인사이트 생성

> 6개의 전문 에이전트가 병렬로 실행됨. Free tier에서는 스킵됨.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2: 6 WOW AGENTS (PARALLEL)                     │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT (from Phase 1)        │                                       │
│  │  - StructuredAnalysisData    │  ◀── Module A output                 │
│  │  - ProductivityAnalysisData  │  ◀── Module C output                 │
│  │  - MultitaskingAnalysisData  │  ◀── Multitasking output (NEW)       │
│  │  - Sessions[]                │                                       │
│  │  - Metrics                   │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│  ┌────────────┴────────────┬──────────────┬──────────────┐              │
│  ▼                         ▼              ▼              ▼              │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐            │
│ │Pattern     │ │AntiPattern │ │KnowledgeGap│ │ContextEff. │            │
│ │Detective   │ │Spotter     │ │Worker      │ │Worker      │            │
│ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘ └─────┬──────┘            │
│       │              │              │              │                    │
│ ┌─────┴──────────────┴──────────────┴──────────────┘                   │
│ │                                                                       │
│ │  ┌────────────────┐  ┌────────────────┐  (NEW Premium+ Workers)      │
│ │  │ Metacognition  │  │ Temporal       │                              │
│ │  │ Worker         │  │ Analyzer       │                              │
│ │  └───────┬────────┘  └───────┬────────┘                              │
│ │          │                   │                                        │
│ └──────────┴───────────────────┴───────────────────────────────────────┤
│                                   │                                      │
│                                   ▼                                      │
│                          ┌──────────────┐                               │
│                          │ AgentOutputs │                               │
│                          │ (merged)     │                               │
│                          └──────────────┘                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Phase 2 Agent Descriptions

| Agent | 목적 | Output Schema |
|-------|------|---------------|
| **PatternDetective** | 세션 간 반복되는 행동 패턴 탐지 | `PatternDetectiveOutput` |
| **AntiPatternSpotter** | 비효율적 패턴 및 개선 기회 탐지 | `AntiPatternSpotterOutput` |
| **KnowledgeGap** | 지식 격차 및 학습 기회 식별 | `KnowledgeGapOutput` |
| **ContextEfficiency** | 컨텍스트 활용 효율성 분석 | `ContextEfficiencyOutput` |
| **Metacognition** (NEW) | 자기 인식 패턴, 블라인드 스팟 탐지 | `MetacognitionOutput` |
| **TemporalAnalyzer** (NEW) | 시간대별 프롬프트 품질 및 피로도 분석 | `TemporalAnalysisOutput` |

#### Agent Output Schema (AgentOutputs)

```
AgentOutputs
│
├── patternDetective
│   ├── recurringPatterns[]
│   │   ├── patternName: string
│   │   ├── description: string
│   │   ├── frequency: number
│   │   ├── impact: "positive" | "negative" | "neutral"
│   │   └── examples: string[]
│   ├── crossSessionInsights[]
│   └── recommendations[]
│
├── antiPatternSpotter
│   ├── detectedAntiPatterns[]
│   │   ├── antiPatternName: string
│   │   ├── description: string
│   │   ├── frequency: number
│   │   ├── severity: "low" | "medium" | "high"
│   │   └── remediationSuggestion: string
│   ├── rootCauses[]
│   └── prioritizedFixes[]
│
├── knowledgeGap
│   ├── identifiedGaps[]
│   │   ├── topic: string
│   │   ├── evidence: string[]
│   │   ├── severity: "minor" | "moderate" | "significant"
│   │   └── learningResources: string[]
│   ├── strengthAreas[]
│   └── learningPath[]
│
├── contextEfficiency
│   ├── efficiencyMetrics
│   │   ├── contextUtilization: 0-100
│   │   ├── redundancyScore: 0-100
│   │   └── clarityScore: 0-100
│   ├── improvementAreas[]
│   └── bestPracticesSuggestions[]
│
├── metacognition (NEW - Premium+)
│   ├── awarenessInstancesData: string  ← semicolon-separated
│   ├── blindSpotsData: string
│   ├── growthMindsetData: string
│   ├── metacognitiveAwarenessScore: 0-100
│   ├── topInsights: string[3]
│   └── confidenceScore: 0-1
│
├── temporalAnalysis (NEW - Premium+)
│   ├── hourlyPatternsData: string  ← semicolon-separated
│   ├── peakHoursData: string
│   ├── cautionHoursData: string
│   ├── fatiguePatternsData: string
│   ├── qualitativeInsightsData: string
│   ├── topInsights: string[3]
│   └── confidenceScore: 0-1
│
└── multitasking (NEW - Phase 1)
    ├── sessionFocusData: string  ← semicolon-separated
    ├── contextPollutionData: string
    ├── workUnitSeparationData: string
    ├── avgGoalCoherence: 0-100
    ├── avgContextPollutionScore: 0-100
    ├── workUnitSeparationScore: 0-100
    ├── multitaskingEfficiencyScore: 0-100
    ├── topInsights: string[3]
    └── confidenceScore: 0-1
```

---

### Phase 3: Content Writer

**목적**: Module A + Module C + Agent Outputs를 개인화된 내러티브로 변환

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 3: CONTENT WRITER                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT                        │                                       │
│  │  - StructuredAnalysisData     │  ◀── Module A output                 │
│  │  - ProductivityAnalysisData   │  ◀── Module C output                 │
│  │  - AgentOutputs               │  ◀── Phase 2 outputs (Premium+)      │
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
│  │  FROM MODULE C:                                                   │    │
│  │  sessionEfficiency ───────▶ productivitySection                   │    │
│  │  taskCompletionPatterns ──▶ workflowInsights                      │    │
│  │  focusIndicators ─────────▶ focusAnalysis                         │    │
│  │                                                                   │    │
│  │  FROM PHASE 2 AGENTS (Premium+):                                  │    │
│  │  patternDetective ────────▶ crossSessionPatterns                  │    │
│  │  antiPatternSpotter ──────▶ growthOpportunities                   │    │
│  │  knowledgeGap ────────────▶ learningRecommendations               │    │
│  │  contextEfficiency ───────▶ communicationAnalysis                 │    │
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

Module C Output                                     Phase 3 Output
─────────────────                                   ─────────────────

ProductivityAnalysisData                           productivityInsights
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ sessionEfficiency: {  │                           │ efficiencyNarrative: "Your..."   │
│   score: 78           │──────────────────────────▶│ workflowInsights: "You excel..." │
│   avgIterations: 3    │     natural language      │ focusAnalysis: "Deep work..."    │
│ }                     │     transformation        │ productivityTips: [...]          │
│ focusIndicators: {...}│                           └──────────────────────────────────┘
│ workPatterns: {...}   │
└───────────────────────┘

Phase 2 Agent Outputs (Premium+)                   Phase 3 Output
────────────────────────                           ─────────────────

AgentOutputs                                       agentInsights
┌───────────────────────┐                           ┌──────────────────────────────────┐
│ patternDetective: {}  │                           │ patternInsights: "Across your..."│
│ antiPatternSpotter: {}│──────────────────────────▶│ antiPatternFeedback: "We noted.."│
│ knowledgeGap: {}      │     aggregate & narrate   │ learningRecommendations: [...]   │
│ contextEfficiency: {} │                           │ efficiencyOpportunities: [...]   │
└───────────────────────┘                           └──────────────────────────────────┘
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
│  Productivity Insights           ✗          ✓           ✓               │
│  (from Module C)                                                         │
│                                                                          │
│  Agent Insights                  ✗          ✓           ✓               │
│  (from Phase 2 Agents)                                                   │
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
  ║     PHASE 1: DATA EXTRACTION (Module A + C + Multitasking)        ║
  ╠═══════════════════════════════════════════════════════════════════╣
  ║                                                                    ║
  ║  ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐║
  ║  │  MODULE A: DATA   │ │  MODULE C: PROD.  │ │  MULTITASKING     │║
  ║  │  ANALYST          │ │  ANALYST          │ │  ANALYZER (NEW)   │║
  ║  ├───────────────────┤ ├───────────────────┤ ├───────────────────┤║
  ║  │ Model: gemini-3   │ │ Model: gemini-3   │ │ Model: gemini-3   │║
  ║  │ Temp: 1.0         │ │ Temp: 1.0         │ │ Temp: 1.0         │║
  ║  │                   │ │                   │ │                   │║
  ║  │ OUTPUT:           │ │ OUTPUT:           │ │ OUTPUT:           │║
  ║  │ - quotes (15-50)  │ │ - efficiency      │ │ - sessionFocus    │║
  ║  │ - patterns (3-10) │ │ - completion      │ │ - pollution       │║
  ║  │ - 6 dim signals   │ │ - focus           │ │ - workUnits       │║
  ║  │ - type            │ │ - workPatterns    │ │ - strategy        │║
  ║  └─────────┬─────────┘ └─────────┬─────────┘ └─────────┬─────────┘║
  ║            │                     │                     │          ║
  ║            └─────────────────────┼─────────────────────┘          ║
  ║                                  ▼                                 ║
  ║    StructuredData + ProductivityData + MultitaskingData           ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [4] Pass Phase 1 outputs to Phase 2 (Premium+ only)
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║         PHASE 2: INSIGHT GENERATION (6 WOW AGENTS, Premium+)      ║
  ║                                                                    ║
  ║   [6 parallel agents, skipped for Free tier]                       ║
  ║                                                                    ║
  ║   INPUT:  StructuredData + ProductivityData + MultitaskingData     ║
  ║   OUTPUT: AgentOutputs (merged)                                    ║
  ║           - PatternDetectiveWorker → recurring patterns            ║
  ║           - AntiPatternSpotterWorker → inefficient patterns        ║
  ║           - KnowledgeGapWorker → knowledge gaps                    ║
  ║           - ContextEfficiencyWorker → context utilization          ║
  ║           - MetacognitionWorker → self-awareness patterns (NEW)    ║
  ║           - TemporalAnalyzerWorker → time-based quality (NEW)      ║
  ║                                                                    ║
  ║   GRACEFUL DEGRADATION: Individual agents can fail independently  ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [5] Pass all outputs to Phase 3
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                   PHASE 3: CONTENT WRITER                         ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 65536           ║
  ║                                                                    ║
  ║   INPUT:  StructuredAnalysisData + ProductivityAnalysisData         ║
  ║           + AgentOutputs + Sessions                                ║
  ║   OUTPUT: VerboseLLMResponse                                       ║
  ║           - Personality summary (300-1500 chars)                   ║
  ║           - 6 dimension insights (with evidence)                   ║
  ║           - 3-6 prompt patterns                                    ║
  ║           - Top focus areas (personalized)                         ║
  ║           - Productivity insights (from Module C)                  ║
  ║           - Agent insights (from Phase 2, Premium+)                ║
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
│  Orchestrator Pipeline (Current - Gemini 3 Flash)                        │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  PHASE 1 (Parallel): Module A + Module C                  │           │
│  │  Module A: Input: ~15K tokens    Output: ~8K tokens      │           │
│  │  Module C: Input: ~10K tokens    Output: ~3K tokens      │           │
│  │                                                           │           │
│  │  PHASE 2 (Parallel, Premium+): 4 Wow Agents              │           │
│  │  ~4K tokens per agent, ~16K total (Premium only)         │           │
│  │                                                           │           │
│  │  PHASE 3: Content Writer                                  │           │
│  │  Input: ~12K tokens    Output: ~6K tokens                │           │
│  │                                                           │           │
│  │  Total Cost (Free):    ~$0.04 per analysis               │           │
│  │  Total Cost (Premium): ~$0.07 per analysis               │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Result: Orchestrator + Workers provides BEST VALUE                     │
│  - Gemini 3 Flash: Pro-level intelligence at Flash pricing              │
│  - 1M token context window for comprehensive analysis                   │
│  - Parallel execution speeds up Phase 1 and Phase 2                     │
│  - Graceful degradation: individual workers can fail independently      │
│  - Tier-based Phase 2 skipping saves cost for Free users                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

### Pipeline Orchestration

| Component | File | Description |
|-----------|------|-------------|
| Analysis Orchestrator | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | 3-phase 파이프라인 조율, Worker 등록/실행 |
| Orchestrator Types | `src/lib/analyzer/orchestrator/types.ts` | WorkerResult, WorkerContext, Phase 타입 |
| Verbose Analyzer | `src/lib/analyzer/verbose-analyzer.ts` | Entry point, Worker 등록, 문자열 sanitization |
| Content Gateway | `src/lib/analyzer/content-gateway.ts` | 티어별 콘텐츠 필터링 (free/premium/enterprise) |

### Phase 1: Data Extraction Workers

| Component | File | Description |
|-----------|------|-------------|
| Base Worker | `src/lib/analyzer/workers/base-worker.ts` | BaseWorker 추상 클래스, runWorkerSafely |
| Data Analyst Worker | `src/lib/analyzer/workers/data-analyst-worker.ts` | Module A - 행동 데이터 추출 |
| Productivity Worker | `src/lib/analyzer/workers/productivity-analyst-worker.ts` | Module C - 생산성 지표 추출 |
| **Multitasking Worker** | `src/lib/analyzer/workers/multitasking-analyzer-worker.ts` | 멀티세션 작업 패턴 분석 (NEW) |
| Module A Stage | `src/lib/analyzer/stages/data-analyst.ts` | DataAnalystStage 클래스, Gemini 호출 |
| Module A Prompts | `src/lib/analyzer/stages/data-analyst-prompts.ts` | 시스템/유저 프롬프트 빌더 |
| Module A Schema | `src/lib/models/analysis-data.ts` | StructuredAnalysisData Zod 스키마 |
| Module C Schema | `src/lib/models/productivity-data.ts` | ProductivityAnalysisData Zod 스키마 |
| **Multitasking Schema** | `src/lib/models/multitasking-data.ts` | MultitaskingAnalysisData Zod 스키마 (NEW) |

### Phase 2: Insight Generation Workers (Premium+)

| Component | File | Description |
|-----------|------|-------------|
| Pattern Detective | `src/lib/analyzer/workers/pattern-detective-worker.ts` | 세션 간 반복 패턴 탐지 |
| Anti-Pattern Spotter | `src/lib/analyzer/workers/anti-pattern-spotter-worker.ts` | 비효율적 패턴 탐지 |
| Knowledge Gap | `src/lib/analyzer/workers/knowledge-gap-worker.ts` | 지식 격차 식별 |
| Context Efficiency | `src/lib/analyzer/workers/context-efficiency-worker.ts` | 컨텍스트 활용 분석 |
| **Metacognition Worker** | `src/lib/analyzer/workers/metacognition-worker.ts` | 자기 인식 패턴, 블라인드 스팟 탐지 (NEW) |
| **Temporal Analyzer** | `src/lib/analyzer/workers/temporal-analyzer-worker.ts` | 시간대별 품질 및 피로도 분석 (NEW) |
| Agent Outputs Schema | `src/lib/models/agent-outputs.ts` | AgentOutputs, 7 agent output Zod 스키마 |
| **Metacognition Schema** | `src/lib/models/metacognition-data.ts` | MetacognitionOutput Zod 스키마 (NEW) |
| **Temporal Schema** | `src/lib/models/temporal-data.ts` | TemporalAnalysisOutput Zod 스키마 (NEW) |
| **Risk Signal Schema** | `src/lib/models/risk-signal.ts` | RiskSignal Zod 스키마 (NEW) |

### Phase 3: Content Writer

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
| Session Formatter | `src/lib/analyzer/shared/session-formatter.ts` | 세션 데이터 포맷팅 (Worker 공유) |
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
OrchestratorConfig (src/lib/analyzer/orchestrator/types.ts)
│
├── geminiApiKey: string              ← Required for all phases
├── model: 'gemini-3-flash-preview'   ← Used by all workers
├── temperature: 1.0                  ← Gemini default (do not lower)
├── maxOutputTokens: 65536
├── maxRetries: 2                     ← Per-worker retry count
├── continueOnWorkerFailure: true     ← Continue if individual worker fails
└── verbose: false                    ← Log worker progress

VerboseAnalyzerConfig (src/lib/analyzer/verbose-analyzer.ts)
│
├── pipeline
│   ├── mode: 'single' | 'two-stage'  ← default: 'two-stage' (runs orchestrator)
│   │
│   ├── stage1 (Module A: Data Analyst config)
│   │   ├── model: 'gemini-3-flash-preview'
│   │   ├── temperature: 1.0
│   │   └── maxOutputTokens: 65536
│   │
│   └── stage2 (Phase 3: Content Writer config)
│       ├── model: 'gemini-3-flash-preview'
│       ├── temperature: 1.0
│       └── maxOutputTokens: 65536
│
├── tier: 'free' | 'premium' | 'enterprise'  ← default: 'enterprise'
│
└── fallbackToLegacy: true  ← Orchestrator 실패시 Claude single로 폴백

Environment Variables:
├── GOOGLE_GEMINI_API_KEY  ← Required for orchestrator pipeline
└── ANTHROPIC_API_KEY      ← Required for fallback/legacy mode

Graceful Degradation:
├── Phase 1 worker fails → uses default data (createDefaultStructuredAnalysisData)
├── Phase 2 worker fails → continues without that agent's output
├── Phase 2 skipped for Free tier → AgentOutputs = empty
└── Orchestrator fails + fallbackToLegacy: true → uses Claude single-stage
```
