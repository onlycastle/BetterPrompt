# Two-Stage LLM Pipeline

> Developer-AI 협업 세션을 분석하여 개인화된 리포트를 생성하는 파이프라인

## Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Analysis Pipeline                                │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Sessions (JSONL)                                                       │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐               │
│   │   Parse &   │────▶│  Stage 1:   │────▶│  Stage 2:   │               │
│   │  Aggregate  │     │ Data Analyst│     │Content Writer│               │
│   └─────────────┘     └─────────────┘     └─────────────┘               │
│                              │                   │                       │
│                              │                   ▼                       │
│                              │            ┌─────────────┐               │
│                              │            │  Content    │               │
│                              │            │  Gateway    │               │
│                              │            └─────────────┘               │
│                              │                   │                       │
│                              ▼                   ▼                       │
│                     StructuredData        VerboseEvaluation              │
│                     (intermediate)            (final)                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
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
         │  selectOptimalSessions() - 최대 10개 선정
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

### Stage 1: Data Analyst

**목적**: 정확한 데이터 추출 (내러티브 없음)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA ANALYST STAGE                              │
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
│  │  Max Tokens: 8192                          │                         │
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

#### Stage 1 Output Schema

```
StructuredAnalysisData
│
├── typeAnalysis
│   ├── primaryType: "architect" | "scientist" | "collaborator" | "speedrunner" | "craftsman"
│   ├── controlLevel: "vibe-coder" | "developing" | "ai-master"
│   ├── distribution: { architect: 30, scientist: 25, ... }  ← sum = 100
│   └── reasoning: "Based on planning behavior..."
│
├── extractedQuotes[15-100]
│   ├── quote: "Let me think about this before we start..."
│   ├── sessionDate: "2025-01-15"
│   ├── dimension: "aiCollaboration"
│   ├── signal: "strength" | "growth"
│   ├── behavioralMarker: "Strategic planning"
│   └── confidence: 0.92
│
├── detectedPatterns[3-15]
│   ├── patternId: "verification-loop"
│   ├── patternType: "verification_habit"
│   ├── frequency: 12
│   ├── examples: ["Wait, let me check...", ...]
│   └── significance: "Consistent output validation"
│
├── dimensionSignals[6]  ← exactly 6, one per dimension
│   ├── dimension: "aiCollaboration"
│   ├── strengthSignals: ["Good context setting", "Clear instructions"]  ← flattened strings
│   └── growthSignals: ["Could ask more questions"]
│
└── analysisMetadata
    ├── totalQuotesAnalyzed: 47
    ├── coverageScores: [{ dimension, score }]  ← flattened from z.record
    └── confidenceScore: 0.88
```

---

### Stage 2: Content Writer

**목적**: 구조화된 데이터를 개인화된 내러티브로 변환

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CONTENT WRITER STAGE                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────────┐                                                   │
│  │  INPUT           │                                                   │
│  │  - Stage 1 JSON  │  ◀── StructuredAnalysisData                      │
│  │  - Session count │                                                   │
│  └────────┬─────────┘                                                   │
│           │                                                              │
│           ▼                                                              │
│  ┌─────────────────────────────────────────────────────────────────┐    │
│  │  TRANSFORMATION RULES                                            │    │
│  │                                                                   │    │
│  │  extractedQuotes ─────────▶ dimensionInsights[].evidence[]       │    │
│  │  detectedPatterns ────────▶ promptPatterns[]                     │    │
│  │  dimensionSignals ────────▶ themed strength clusters             │    │
│  │  typeAnalysis ────────────▶ (passed through unchanged)           │    │
│  │                                                                   │    │
│  │  TONE: "Your habit of saying 'let me think'..."                  │    │
│  │    NOT: "You demonstrate good planning behaviors..."             │    │
│  └─────────────────────────────────────────────────────────────────┘    │
│           │                                                              │
│           ▼                                                              │
│  ┌────────────────────────────────────────────┐                         │
│  │  LLM CALL                                   │                         │
│  │  Model: gemini-3-flash-preview             │                         │
│  │  Temperature: 1.0 (Gemini default)         │                         │
│  │  Max Tokens: 8192                          │                         │
│  │  Structured Output: VerboseLLMResponse     │                         │
│  └────────────────────────────────────────────┘                         │
│           │                                                              │
│           ▼                                                              │
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
Stage 1 Output                          Stage 2 Output
─────────────────                       ─────────────────

extractedQuotes[]                       dimensionInsights[]
┌──────────────────┐                    ┌──────────────────────────────────┐
│ quote: "..."     │                    │ dimension: "aiCollaboration"     │
│ dimension: "ai.."│───┐                │ dimensionDisplayName: "AI..."    │
│ signal: strength │   │                │ strengths: [                     │
│ confidence: 0.9  │   │                │   {                              │
└──────────────────┘   │                │     title: "Strategic Delegation"│
                       │    group &     │     description: "Your habit..." │
┌──────────────────┐   ├───────────────▶│     evidence: [                  │
│ quote: "..."     │   │    cluster     │       { quote, sessionDate, ... }│
│ dimension: "ai.."│───┘                │     ]                            │
│ signal: strength │                    │   }                              │
└──────────────────┘                    │ ]                                │
                                        │ growthAreas: [...]               │
                                        └──────────────────────────────────┘


detectedPatterns[]                      promptPatterns[]
┌──────────────────┐                    ┌──────────────────────────────────┐
│ patternType:     │                    │ patternName: "The Thoughtful..." │
│  "verification"  │                    │ category: "verification"         │
│ frequency: 12    │───────────────────▶│ description: "Before diving..."  │
│ examples: [...]  │      humanize      │ examples: [{ quote, analysis }]  │
│ significance:... │                    │ effectiveness: "high"            │
└──────────────────┘                    │ improvementTip: "Consider..."    │
                                        └──────────────────────────────────┘
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
│  (200-800 chars)                                                         │
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
│  Advanced Analytics              ✗          ✗           ✓               │
│  - toolUsageDeepDive                                                     │
│  - tokenEfficiency                                                       │
│  - growthRoadmap                                                         │
│  - comparativeInsights                                                   │
│  - sessionTrends                                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Knowledge Context Injection

Stage 1에 주입되는 전문가 지식 구조:

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
                       │ [3] Inject expert knowledge
                       ▼
           ┌───────────────────────┐
           │  Expert Knowledge     │
           │  Context (XML)        │
           └───────────┬───────────┘
                       │
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                    STAGE 1: DATA ANALYST                          ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 8192            ║
  ║                                                                    ║
  ║   INPUT:  Sessions + Metrics + Knowledge Context                   ║
  ║   OUTPUT: StructuredAnalysisData                                   ║
  ║           - 20-100 extracted quotes                                ║
  ║           - 3-15 detected patterns                                 ║
  ║           - 6 dimension signals                                    ║
  ║           - Type classification                                    ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [4] Pass structured data to Stage 2
                       ▼
  ╔═══════════════════════════════════════════════════════════════════╗
  ║                   STAGE 2: CONTENT WRITER                         ║
  ║                                                                    ║
  ║   Model: gemini-3-flash      Temp: 1.0    Tokens: 8192            ║
  ║                                                                    ║
  ║   INPUT:  StructuredAnalysisData (JSON)                           ║
  ║   OUTPUT: VerboseLLMResponse                                       ║
  ║           - Personality summary                                    ║
  ║           - 6 dimension insights (themed clusters)                 ║
  ║           - 3-6 prompt patterns                                    ║
  ║           - Advanced analytics                                     ║
  ╚═══════════════════════════════════════════════════════════════════╝
                       │
                       │ [5] Add metadata
                       ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  VerboseEvaluation (Full)                                        │
  │  - sessionId, analyzedAt, sessionsAnalyzed                       │
  │  - ... all VerboseLLMResponse fields                             │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [6] Apply tier-based filtering
                                   ▼
  ┌─────────────────────────────────────────────────────────────────┐
  │  ContentGateway.filter(evaluation, tier)                         │
  │                                                                   │
  │  tier = 'free'       → Limited dimensions, no patterns          │
  │  tier = 'premium'    → All dimensions + patterns                │
  │  tier = 'enterprise' → Everything + advanced analytics          │
  └────────────────────────────────┬────────────────────────────────┘
                                   │
                                   │ [7] Save & serve
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
│  Single-Stage (Legacy)                                                   │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Sonnet only                                              │           │
│  │  Input: ~15K tokens    Output: ~6K tokens                │           │
│  │  Cost: ~$0.13 per analysis                               │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Two-Stage (Current - Gemini 3 Flash)                                    │
│  ┌──────────────────────────────────────────────────────────┐           │
│  │  Stage 1: Gemini 3 Flash                                  │           │
│  │  Input: ~15K tokens    Output: ~6K tokens                │           │
│  │                                                           │           │
│  │  Stage 2: Gemini 3 Flash                                  │           │
│  │  Input: ~6K tokens     Output: ~4K tokens                │           │
│  │                                                           │           │
│  │  Total Cost: ~$0.05 per analysis                         │           │
│  └──────────────────────────────────────────────────────────┘           │
│                                                                          │
│  Result: Two-stage with Gemini is CHEAPEST with PRO-LEVEL QUALITY       │
│  - Gemini 3 Flash: Pro-level intelligence at Flash pricing              │
│  - 1M token context window for comprehensive analysis                   │
│  - Unified model simplifies pipeline                                    │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Key Files Reference

| Component | File | Description |
|-----------|------|-------------|
| Orchestrator | `src/analyzer/verbose-analyzer.ts` | 파이프라인 조율 |
| Stage 1 | `src/analyzer/stages/data-analyst.ts` | 데이터 추출 |
| Stage 1 Prompts | `src/analyzer/stages/data-analyst-prompts.ts` | Gemini PTCF 프롬프트 |
| Stage 2 | `src/analyzer/stages/content-writer.ts` | 내러티브 변환 |
| Stage 2 Prompts | `src/analyzer/stages/content-writer-prompts.ts` | Gemini PTCF 프롬프트 |
| Knowledge Context | `src/analyzer/verbose-knowledge-context.ts` | 전문가 지식 빌더 |
| Content Gateway | `src/analyzer/content-gateway.ts` | 티어별 필터링 |
| Stage 1 Schema | `src/models/analysis-data.ts` | 중간 데이터 스키마 |
| Final Schema | `src/models/verbose-evaluation.ts` | 최종 출력 스키마 |

---

## Configuration

```
VerboseAnalyzerConfig
│
├── pipeline
│   ├── mode: 'single' | 'two-stage'  ← default: 'two-stage'
│   │
│   ├── stage1 (Data Analyst - Gemini 3 Flash)
│   │   ├── model: 'gemini-3-flash-preview'
│   │   ├── temperature: 1.0  ← Gemini default (do not lower)
│   │   └── maxOutputTokens: 8192
│   │
│   └── stage2 (Content Writer - Gemini 3 Flash)
│       ├── model: 'gemini-3-flash-preview'
│       ├── temperature: 1.0  ← Gemini default (do not lower)
│       └── maxOutputTokens: 8192
│
├── tier: 'free' | 'premium' | 'enterprise'  ← default: 'enterprise'
│
└── fallbackToLegacy: true  ← two-stage 실패시 Claude single로 폴백

Environment Variables:
├── GOOGLE_GEMINI_API_KEY  ← Required for two-stage pipeline
└── ANTHROPIC_API_KEY      ← Required for fallback/legacy mode
```
