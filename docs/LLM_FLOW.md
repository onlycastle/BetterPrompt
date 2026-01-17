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
│                                                                          │
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

### Pipeline Orchestration

| Component | File | Description |
|-----------|------|-------------|
| Orchestrator | `src/lib/analyzer/verbose-analyzer.ts` | Two-stage 파이프라인 조율, 문자열 sanitization |
| Content Gateway | `src/lib/analyzer/content-gateway.ts` | 티어별 콘텐츠 필터링 (free/premium/enterprise) |

### Stage 1: Data Analyst

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/data-analyst.ts` | DataAnalystStage 클래스, Gemini 호출 |
| Prompts (PTCF) | `src/lib/analyzer/stages/data-analyst-prompts.ts` | 시스템/유저 프롬프트 빌더 |
| Output Schema | `src/lib/models/analysis-data.ts` | StructuredAnalysisData Zod 스키마 |

### Stage 2: Content Writer

| Component | File | Description |
|-----------|------|-------------|
| Stage Implementation | `src/lib/analyzer/stages/content-writer.ts` | ContentWriterStage 클래스, 내러티브 변환 |
| Prompts (PTCF) | `src/lib/analyzer/stages/content-writer-prompts.ts` | 시스템/유저 프롬프트 빌더 |
| Output Schema | `src/lib/models/verbose-evaluation.ts` | VerboseLLMResponse, VerboseEvaluation 스키마 |

### Session Parsing (Stage 0)

| Component | File | Description |
|-----------|------|-------------|
| JSONL Reader | `src/lib/parser/jsonl-reader.ts` | JSONL 파싱, 경로 인코딩/디코딩 |
| Session Selector | `src/lib/parser/session-selector.ts` | Duration-based 최적 세션 선정 (max 30) |
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
