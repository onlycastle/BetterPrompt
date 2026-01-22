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
│   ║  │ PHASE 2.5: Type Synthesis (Agent-Informed Classification Refinement)  │   ║   │
│   ║  │ ┌─────────────────────────────────────────────────────────────────┐   │   ║   │
│   ║  │ │ TypeSynthesisWorker                                              │   │   ║   │
│   ║  │ │ (refines initial type classification using all agent outputs)    │   │   ║   │
│   ║  │ └─────────────────────────────────────────────────────────────────┘   │   ║   │
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
         │  selectOptimalSessions() - select up to 30 sessions
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

**Purpose**: Extract accurate behavioral data (no narrative)

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
│   ├── controlLevel: "explorer" | "navigator" | "cartographer"
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

**Purpose**: Extract productivity metrics and efficiency analysis

> Runs in parallel with Module A (Phase 1)

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

**Purpose**: Generate deep insights based on Phase 1 results

> 6 specialized agents run in parallel. Skipped for Free tier.

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

| Agent | Purpose | Output Schema |
|-------|---------|---------------|
| **PatternDetective** | Detect recurring behavioral patterns across sessions | `PatternDetectiveOutput` |
| **AntiPatternSpotter** | Detect inefficient patterns and improvement opportunities | `AntiPatternSpotterOutput` |
| **KnowledgeGap** | Identify knowledge gaps and learning opportunities | `KnowledgeGapOutput` |
| **ContextEfficiency** | Analyze context utilization efficiency | `ContextEfficiencyOutput` |
| **Metacognition** (NEW) | Detect self-awareness patterns and blind spots | `MetacognitionOutput` |
| **TemporalAnalyzer** (NEW) | Analyze prompt quality and fatigue by time of day | `TemporalAnalysisOutput` |

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
├── multitasking (NEW - Phase 1)
│   ├── sessionFocusData: string  ← semicolon-separated
│   ├── contextPollutionData: string
│   ├── workUnitSeparationData: string
│   ├── avgGoalCoherence: 0-100
│   ├── avgContextPollutionScore: 0-100
│   ├── workUnitSeparationScore: 0-100
│   ├── multitaskingEfficiencyScore: 0-100
│   ├── topInsights: string[3]
│   └── confidenceScore: 0-1
│
└── typeSynthesis (NEW - Phase 2.5)  ← Refined classification using all agent outputs
    ├── refinedPrimaryType: "architect" | "scientist" | "collaborator" | "speedrunner" | "craftsman"
    ├── refinedDistribution: string  ← "type:percent;..." format
    ├── refinedControlLevel: "explorer" | "navigator" | "cartographer"
    ├── matrixName: string  ← Combined name (e.g., "Systems Architect", "Yolo Coder")
    ├── matrixEmoji: string
    ├── adjustmentReasons: string[]  ← Why classification was adjusted
    ├── confidenceScore: 0-1
    ├── confidenceBoost: 0-1  ← How much confidence improved from synthesis
    └── synthesisEvidence: string  ← "agent:signal:detail;..." format
```

---

### Phase 2.5: Type Synthesis (NEW)

**Purpose**: Refine initial type classification using Phase 2 agent outputs

> Runs after Phase 2, before Phase 3. Available for all tiers.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 2.5: TYPE SYNTHESIS                            │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────────────────┐                                       │
│  │  INPUT (from Phase 1 + 2)    │                                       │
│  │  - Initial TypeDistribution  │  ◀── Pattern-based from sessions     │
│  │  - Initial ControlLevel      │                                       │
│  │  - AgentOutputs              │  ◀── All Phase 2 agent results       │
│  │    ├── patternDetective      │                                       │
│  │    ├── antiPatternSpotter    │                                       │
│  │    ├── metacognition         │                                       │
│  │    ├── multitasking          │                                       │
│  │    ├── temporalAnalysis      │                                       │
│  │    └── contextEfficiency     │                                       │
│  └────────────┬─────────────────┘                                       │
│               │                                                          │
│               ▼                                                          │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 4096                          │                         │
│  │  Structured Output: TypeSynthesisOutput    │                         │
│  └────────────────────────────────────────────┘                         │
│               │                                                          │
│               ▼                                                          │
│  ┌──────────────────┐                                                   │
│  │  OUTPUT          │     SYNTHESIS RULES:                              │
│  │  TypeSynthesis   │     - Error loops + low metacognition → explorer  │
│  │  Output          │     - High metacognition score → cartographer     │
│  │                  │     - Repeated questions → scientist tendency     │
│  │  - Refined type  │     - High focus → architect; scattered → speedrun│
│  │  - Matrix name   │     - High context efficiency → architect/craftsm │
│  │  - Evidence      │                                                   │
│  └──────────────────┘                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Type Synthesis Process

1. **Initial Classification** (from `type-detector.ts`):
   - Pattern-based scoring from raw session metrics
   - 5 coding styles: architect, scientist, collaborator, speedrunner, craftsman
   - 3 control levels: explorer, navigator, cartographer

2. **Agent Insights Collection**:
   - PatternDetective: repeated questions, conversation style
   - AntiPatternSpotter: error loops, learning avoidance, health score
   - Metacognition: awareness instances, blind spots, metacognitive score
   - Multitasking: session focus, context pollution, goal coherence
   - TemporalAnalysis: peak hours, fatigue patterns
   - ContextEfficiency: inefficiency patterns, efficiency score

3. **LLM Synthesis**:
   - Analyzes initial classification against agent insights
   - Adjusts type distribution and control level based on semantic evidence
   - Provides adjustment reasons with specific evidence citations
   - Calculates confidence boost from synthesis

4. **Output**:
   - Refined type and control level
   - Combined matrix name (e.g., "Systems Architect", "Curious Scientist")
   - Matrix emoji
   - Evidence trail for transparency

#### TypeSynthesisWorker

```typescript
export class TypeSynthesisWorker extends BaseWorker<TypeSynthesisOutput> {
  readonly name = 'TypeSynthesis';
  readonly phase = 2 as const;  // Runs as Phase 2.5 (after other Phase 2 workers)
  readonly minTier: Tier = 'free';

  canRun(context: WorkerContext): boolean;
  execute(context: WorkerContext): Promise<WorkerResult<TypeSynthesisOutput>>;
}
```

---

### Phase 3: Content Writer

**Purpose**: Transform Module A + Module C + Agent Outputs into personalized narrative

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

Expert knowledge structure injected into Module A:

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
                       │ [5] Pass agent outputs to Phase 2.5
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║      PHASE 2.5: TYPE SYNTHESIS (Agent-Informed Classification)   ║
  ║                                                                    ║
  ║   [TypeSynthesisWorker - runs after Phase 2, before Phase 3]      ║
  ║                                                                    ║
  ║   INPUT:  Initial TypeDistribution + ControlLevel                 ║
  ║           + AgentOutputs (all Phase 2 results)                    ║
  ║   OUTPUT: TypeSynthesisOutput                                      ║
  ║           - refinedPrimaryType + refinedDistribution               ║
  ║           - refinedControlLevel                                    ║
  ║           - matrixName + matrixEmoji                               ║
  ║           - adjustmentReasons + synthesisEvidence                  ║
  ║                                                                    ║
  ║   SYNTHESIS RULES:                                                 ║
  ║   - Error loops + low metacognition → explorer tendency             ║
  ║   - High metacognition (>70) → cartographer tendency               ║
  ║   - Repeated questions → scientist tendency                        ║
  ║   - High focus → architect; scattered → speedrunner                ║
  ║                                                                    ║
  ║   FALLBACK: Uses initial classification if no agent data available ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [6] Pass all outputs to Phase 3
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                   PHASE 3: CONTENT WRITER                         ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 65536           ║
  ║                                                                    ║
  ║   INPUT:  StructuredAnalysisData + ProductivityAnalysisData         ║
  ║           + AgentOutputs (with TypeSynthesis) + Sessions           ║
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
| Analysis Orchestrator | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` | 4-phase pipeline coordination (1→2→2.5→3), Worker registration/execution |
| Orchestrator Types | `src/lib/analyzer/orchestrator/types.ts` | WorkerResult, WorkerContext, Phase types |
| Verbose Analyzer | `src/lib/analyzer/verbose-analyzer.ts` | Entry point, Worker registration, string sanitization |
| Content Gateway | `src/lib/analyzer/content-gateway.ts` | Tier-based content filtering (free/premium/enterprise) |

### Phase 1: Data Extraction Workers

| Component | File | Description |
|-----------|------|-------------|
| Base Worker | `src/lib/analyzer/workers/base-worker.ts` | BaseWorker abstract class, runWorkerSafely |
| Data Analyst Worker | `src/lib/analyzer/workers/data-analyst-worker.ts` | Module A - behavioral data extraction |
| Productivity Worker | `src/lib/analyzer/workers/productivity-analyst-worker.ts` | Module C - productivity metrics extraction |
| **Multitasking Worker** | `src/lib/analyzer/workers/multitasking-analyzer-worker.ts` | Multi-session work pattern analysis (NEW) |
| Module A Stage | `src/lib/analyzer/stages/data-analyst.ts` | DataAnalystStage class, Gemini call |
| Module A Prompts | `src/lib/analyzer/stages/data-analyst-prompts.ts` | System/user prompt builders |
| Module A Schema | `src/lib/models/analysis-data.ts` | StructuredAnalysisData Zod schema |
| Module C Schema | `src/lib/models/productivity-data.ts` | ProductivityAnalysisData Zod schema |
| **Multitasking Schema** | `src/lib/models/multitasking-data.ts` | MultitaskingAnalysisData Zod schema (NEW) |

### Phase 2: Insight Generation Workers (Premium+)

| Component | File | Description |
|-----------|------|-------------|
| Pattern Detective | `src/lib/analyzer/workers/pattern-detective-worker.ts` | Detect recurring patterns across sessions |
| Anti-Pattern Spotter | `src/lib/analyzer/workers/anti-pattern-spotter-worker.ts` | Detect inefficient patterns |
| Knowledge Gap | `src/lib/analyzer/workers/knowledge-gap-worker.ts` | Identify knowledge gaps |
| Context Efficiency | `src/lib/analyzer/workers/context-efficiency-worker.ts` | Analyze context utilization |
| **Metacognition Worker** | `src/lib/analyzer/workers/metacognition-worker.ts` | Detect self-awareness patterns and blind spots (NEW) |
| **Temporal Analyzer** | `src/lib/analyzer/workers/temporal-analyzer-worker.ts` | Analyze quality and fatigue by time of day (NEW) |
| Agent Outputs Schema | `src/lib/models/agent-outputs.ts` | AgentOutputs, 7 agent output Zod schemas |
| **Metacognition Schema** | `src/lib/models/metacognition-data.ts` | MetacognitionOutput Zod schema (NEW) |
| **Temporal Schema** | `src/lib/models/temporal-data.ts` | TemporalAnalysisOutput Zod schema (NEW) |
| **Risk Signal Schema** | `src/lib/models/risk-signal.ts` | RiskSignal Zod schema (NEW) |

### Phase 2.5: Type Synthesis (NEW)

| Component | File | Description |
|-----------|------|-------------|
| **TypeSynthesis Worker** | `src/lib/analyzer/workers/type-synthesis-worker.ts` | Phase 2.5 - Refine type classification based on agent insights (NEW) |
| Type Detector | `src/lib/analyzer/type-detector.ts` | Initial pattern-based type detection |
| Coding Style Types | `src/lib/models/coding-style.ts` | 5×3 matrix types (15 combinations) |
| AI Control Dimension | `src/lib/analyzer/dimensions/ai-control.ts` | Control level calculation |

### Phase 3: Content Writer

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/content-writer.ts` | ContentWriterStage class, narrative transformation, evidence linking |
| Prompts (PTCF) | `src/lib/analyzer/stages/content-writer-prompts.ts` | System/user prompt builders |
| Output Schema | `src/lib/models/verbose-evaluation.ts` | VerboseLLMResponse, VerboseEvaluation schema |

### Session Parsing (Stage 0)

| Component | File | Description |
|-----------|------|-------------|
| JSONL Reader | `src/lib/parser/jsonl-reader.ts` | JSONL parsing, path encoding/decoding |
| Session Selector | `src/lib/parser/session-selector.ts` | Duration-based optimal session selection (max 30) |
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
└── fallbackToLegacy: true  ← Fallback to Claude single-stage if Orchestrator fails

Environment Variables:
├── GOOGLE_GEMINI_API_KEY  ← Required for orchestrator pipeline
└── ANTHROPIC_API_KEY      ← Required for fallback/legacy mode

Graceful Degradation:
├── Phase 1 worker fails → uses default data (createDefaultStructuredAnalysisData)
├── Phase 2 worker fails → continues without that agent's output
├── Phase 2 skipped for Free tier → AgentOutputs = empty
└── Orchestrator fails + fallbackToLegacy: true → uses Claude single-stage
```
