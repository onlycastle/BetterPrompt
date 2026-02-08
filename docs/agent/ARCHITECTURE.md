# Architecture (Agent Reference)

NoMoreAISlop analyzes developer-AI collaboration sessions (JSONL/SQLite) through a 4-phase LLM pipeline, generates personalized reports, and serves them via Next.js. Hexagonal architecture: Presentation (Next.js) → Application (services, analyzer) → Domain (Zod models) → Infrastructure (Supabase, LLM adapters).

## Directory → Purpose → Layer

| Directory | Purpose | Layer |
|-----------|---------|-------|
| `app/api/` | Next.js 15 API routes | Presentation |
| `app/` | Next.js pages and layouts | Presentation |
| `src/components/` | React UI components | Presentation |
| `src/views/` | Page view components | Presentation |
| `src/hooks/` | React hooks | Presentation |
| `src/lib/application/` | Application services and ports | Application |
| `src/lib/analyzer/` | LLM analysis pipeline | Application |
| `src/lib/analyzer/orchestrator/` | 4-phase orchestration | Application |
| `src/lib/analyzer/workers/` | Phase 1 DataExtractor + Phase 2 workers (5) + Phase 2.5 TypeClassifier | Application |
| `src/lib/analyzer/stages/` | Phase 1.5 SessionSummarizer + Phase 2 ProjectSummarizer + Phase 2 WeeklyInsightGenerator + Phase 2.8 EvidenceVerifier + Phase 3 ContentWriter + Phase 4 Translator | Application |
| `src/lib/models/` | Zod schemas (analysis-data, agent-outputs, verbose-evaluation) | Domain |
| `src/lib/domain/` | Domain models (business rules, errors) | Domain |
| `src/lib/parser/` | JSONL session parsing | Infrastructure |
| `src/lib/infrastructure/` | Supabase and local storage adapters | Infrastructure |
| `packages/cli/src/lib/scanner/` | Multi-source session discovery (Claude Code + Cursor + Cursor Composer) | Infrastructure |
| `packages/cli/src/activity-scanner.ts` | CLI activity metadata scanner (tokens, duration, messages) | Infrastructure |

## Pipeline Summary

Pipeline: `Sessions → Parser → SessionSelector → CostEstimator → AnalysisOrchestrator → ContentGateway → Next.js`

| Phase | Component | LLM Calls | Input | Output | Key File |
|-------|-----------|-----------|-------|--------|----------|
| 0 | Multi-Source Scanner | 0 | JSONL/SQLite files | `SourcedParsedSession[]` | `packages/cli/src/lib/scanner/index.ts` |
| 1 | DataExtractor | 0 | Sessions + Metrics | `Phase1Output` | `src/lib/analyzer/workers/data-extractor-worker.ts` |
| 1.5 | SessionSummarizer | 1 | Phase1Output sessions | `SessionSummaryBatchLLM` | `src/lib/analyzer/stages/session-summarizer.ts` |
| 2 | 5 Insight Workers (parallel) | 5 | Phase1Output | `AgentOutputs` | `src/lib/analyzer/workers/` |
| 2 | ProjectSummarizer (parallel) | 1 | activitySessions | `ProjectSummary[]` | `src/lib/analyzer/stages/project-summarizer.ts` |
| 2 | WeeklyInsightGenerator (parallel) | 1 | activitySessions | `WeeklyInsights` | `src/lib/analyzer/stages/weekly-insight-generator.ts` |
| 2.5 | TypeClassifier | 1 | Phase1Output + AgentOutputs | `TypeClassifierOutput` | `src/lib/analyzer/workers/type-classifier-worker.ts` |
| 2.75 | KnowledgeResourceMatcher | 0 | AgentOutputs | `KnowledgeResource[]` | deterministic resource matching |
| 2.8 | EvidenceVerifier | 1 | AgentOutputs evidence | `EvidenceVerifierResult` | `src/lib/analyzer/stages/evidence-verifier.ts` |
| 3 | ContentWriter | 1 | AgentOutputs summary + top utterances | `NarrativeLLMResponse` | `src/lib/analyzer/stages/content-writer.ts` |
| 4 | Translator (conditional) | 0-1 | NarrativeLLMResponse + AgentOutputs | `TranslatorOutput` | `src/lib/analyzer/stages/translator.ts` |
| Assembly | EvaluationAssembler | 0 | AgentOutputs + NarrativeLLMResponse + TranslatorData | `VerboseEvaluation` | `src/lib/analyzer/stages/evaluation-assembler.ts` |

**Total**: 11 LLM calls (English), 12 LLM calls (non-English). Model: `gemini-3-flash-preview`, Temperature: 1.0, Max tokens: 65536.

## Phase Details

### Phase 1: Data Extraction (deterministic)

- Extracts `DeveloperUtterances[]`, `AIResponses[]`, `SessionMetrics` from raw sessions
- Extracts `AIInsightBlocks[]` from assistant messages via regex (★ Insight educational blocks)
- No LLM call — pure data transformation
- Output schema: `Phase1Output` in `src/lib/models/phase1-output.ts`
- Includes `displayText`, `naturalLanguageSegments`, `machineContentRatio`
- AI insight blocks sampled to max 50 (bookend strategy per session)

### Phase 1.5: Session Summarizer (1 LLM call)

- Generates concise 1-line summaries for each analyzed session via LLM
- Single batch LLM call for all sessions (token-efficient)
- Runs after DataExtractor, before Phase 2 workers
- Output schema: `SessionSummaryBatchLLM` in `src/lib/models/session-summary-data.ts`
- Summaries flow to ContentWriter (Phase 3) and Translator (Phase 4)
- Separate from CLI Activity Scanner (deterministic summaries for ALL sessions)

### Phase 2: Insight Generation (5 parallel workers + ProjectSummarizer + WeeklyInsightGenerator)

| Worker | Analysis Focus | Output Schema | Prompt File |
|--------|---------------|---------------|-------------|
| ThinkingQuality | Planning, critical thinking, verification anti-patterns | `ThinkingQualityOutput` | `workers/prompts/thinking-quality-prompts.ts` |
| CommunicationPatterns | Communication patterns, signature quotes | `CommunicationPatternsOutput` | `workers/prompts/communication-patterns-prompts.ts` |
| LearningBehavior | Knowledge gaps, repeated mistakes | `LearningBehaviorOutput` | `workers/prompts/learning-behavior-prompts.ts` |
| ContextEfficiency | Token inefficiency patterns | `ContextEfficiencyOutput` | `workers/prompts/context-efficiency-prompts.ts` |
| SessionOutcome | Goals, friction, success rates | `SessionOutcomeOutput` | `workers/prompts/session-outcome-prompts.ts` |

- All workers filter utterances: `isNoteworthy !== false && wordCount >= 8`
- Workers receive ONLY Phase1Output (context isolation from raw sessions)
- Dynamic knowledge injection via `getInsightsForWorker()` in `workers/prompts/knowledge-mapping.ts`

**ProjectSummarizer** (1 LLM call, runs in parallel with insight workers):
- Groups activitySessions by project name and generates 2-3 line LLM summaries per project
- Projects with ≤3 sessions skip LLM: session summaries used directly (passthrough optimization)
- Independent of Phase 1 output — only requires `activitySessions` from CLI
- Output: `ProjectSummary[]` in `src/lib/models/verbose-evaluation.ts`
- Consumed by Activity tab UI and translated in Phase 4

### Phase 2.5: TypeClassifier (1 LLM call)

- 5 coding styles x 3 control levels = 15 matrix combinations
- Styles: architect, analyst, conductor, speedrunner, trendsetter
- Control levels: explorer, navigator, cartographer
- Generates personalized `reasoning` narrative (1500-2500 chars, 3-4 paragraphs) used as `personalitySummary`
- Uses Phase 2 evidence utterances for developer quotes in reasoning
- Output: `TypeClassifierOutput` in `src/lib/models/agent-outputs.ts`

### Phase 2.8: EvidenceVerifier (1 LLM call)

- LLM-based verification of worker evidence quality
- Runs after Phase 2.75 KnowledgeResourceMatcher
- Output schema: `EvidenceVerifierResult` in `src/lib/analyzer/stages/evidence-verifier.ts`

### Phase 3: ContentWriter — Narrative Only (1 LLM call)

- Generates `topFocusAreas` (+ `promptPatterns` fallback)
- `personalitySummary` is sourced from TypeClassifier `reasoning` (Phase 2.5), NOT generated here
- Structural data assembled deterministically by EvaluationAssembler from Phase 2
- Input summarized via `phase3-summarizer.ts` (~15-20K chars vs 50-100K raw JSON)
- Always generates in English; translation is Phase 4

### Phase 4: Translator (conditional, 0-1 LLM call)

- Runs only when non-English detected (5% non-ASCII character threshold)
- Supported languages: Korean (ko), Japanese (ja), Chinese (zh)
- Translates text fields while preserving structure, IDs, technical terms
- All translated fields use structured JSON (e.g., `examples: [{quote, analysis}]`, `actions: {start, stop, continue}`)

> WARNING: Translation merge timing is critical. `translatorData` is stored (hoisted), NOT merged immediately. Merge happens AFTER `assembleEvaluation()` via `mergeTranslatedFields()` to prevent English defaults from overwriting translations. See `analysis-orchestrator.ts`.

### Assembly: EvaluationAssembler (deterministic)

Two paths merge into `VerboseEvaluation`:
- PATH 1: Phase 2 AgentOutputs → structural fields (deterministic, no LLM)
- PATH 2: Phase 3 NarrativeLLMResponse → narrative fields (direct copy)
- Both paths use structured JSON schemas; legacy pipe-delimited fallbacks in `evaluation-assembler.ts`

Assembly in `assembleEvaluation()` in `src/lib/analyzer/stages/evaluation-assembler.ts`.

## Worker → VerboseEvaluation Field Mapping

| Source (AgentOutputs) | Target (VerboseEvaluation) | Transformation |
|-----------------------|---------------------------|----------------|
| `thinkingQuality.verificationAntiPatterns[]` | `antiPatternsAnalysis` | Severity mapping, evidence extraction |
| `thinkingQuality.planningHabits[]` | `planningAnalysis` | Maturity level assessment |
| `thinkingQuality.criticalThinkingMoments[]` | `criticalThinkingAnalysis` | Score calculation from type variety |
| `thinkingQuality.communicationPatterns[]` | `promptPatterns[]` | Map to prompt patterns with evidence |
| `learningBehavior.knowledgeGaps[]` | `dimensionInsights[]` | Group by topic, map to dimension buckets |
| `typeClassifier` | `primaryType`, `controlLevel`, `distribution` | Direct field copy |
| `personalitySummary` (Phase 3) | `personalitySummary` | Truncate to <=3000 chars |
| `topFocusAreas` (Phase 3) | `topFocusAreas` | Structured `actions` object (legacy `actionsData` fallback) |

## UI Section → Worker → Access Mapping

The report page uses a **continuous scroll layout** (no tabs). All sections render sequentially with `FloatingProgressDots` for navigation.

| Section | Data Source | Worker | Access |
|---------|------------|--------|--------|
| Fixed Header: Type Result | Phase 2.5 TypeClassifier | TypeClassifierWorker | FREE |
| Fixed Header: Personality Summary | Phase 3 ContentWriter | ContentWriterStage | FREE |
| Growth / Progress | Phase 2 worker data + `/api/benchmarks/personal` | All workers (aggregated) | FREE |
| Activity | CLI Activity Scanner + Phase 2 ProjectSummarizer | ProjectSummarizerStage | FREE |
| Thinking Quality | Phase 2 | ThinkingQualityWorker | FREE (recommendation: PAID) |
| Communication | Phase 2 | CommunicationPatternsWorker | FREE (recommendation: PAID) |
| Learning Behavior | Phase 2 | LearningBehaviorWorker | FREE (recommendation: PAID) |
| Context Efficiency | Phase 2 | ContextEfficiencyWorker | FREE (recommendation: PAID) |
| Sidebar: Resources | Phase 2.75 KnowledgeResourceMatcher | N/A | 1/dim FREE, all PAID |

Section order matches `REPORT_SECTIONS` array: Growth → Activity → Thinking → Communication → Learning → Context.

Key UI files: `TabbedReportContainer.tsx`, `WorkerInsightsSection.tsx`, `FloatingProgressDots.tsx`, `useScrollSpy.ts`, `useGrowthData.ts`, `content-gateway.ts` (TIER_POLICY).

## Content Gateway Tier Matrix

| Content | Free | One-time | Pro | Enterprise |
|---------|------|----------|-----|------------|
| Type Result + Personality Summary | Full | Full | Full | Full |
| Dimensions 1-2 (full detail) | Full | Full | Full | Full |
| Dimensions 3-6 | Empty | Full | Full | Full |
| Prompt Patterns | No | Yes | Yes | Yes |
| Top Focus Areas | No | Yes | Yes | Yes |
| Agent Insights | Teaser | Full | Full | Full |
| Advanced Analytics | No | Yes | Yes | Yes |

Philosophy: "Diagnosis Free, Prescription Paid"

## API Routes

| Route | Purpose | Auth | Directory |
|-------|---------|------|-----------|
| `/api/analysis` | Analysis operations | Optional | `app/api/analysis/` |
| `/api/auth` | Authentication (device flow) | Public | `app/api/auth/` |
| `/api/credits` | Credit management | Required | `app/api/credits/` |
| `/api/payments` | Payment processing | Required | `app/api/payments/` |
| `/api/webhooks/polar` | Polar webhook handler | Public | `app/api/webhooks/polar/` |
| `/api/reports` | Report sharing, OG images, comparison | Public | `app/api/reports/` |
| `/api/benchmarks` | Benchmark percentiles (personal + global) | Public+Auth | `app/api/benchmarks/` |
| `/api/knowledge` | Knowledge base operations | PREMIUM | `app/api/knowledge/` |
| `/api/learn` | YouTube/URL learning | PREMIUM | `app/api/learn/` |
| `/api/health` | Health check | Public | `app/api/health/` |
| `/api/og-metadata` | OG metadata generation | Public | `app/api/og-metadata/` |
| `/api/waitlist` | Waitlist management | Public | `app/api/waitlist/` |

## Data Models

| Schema | File | Purpose |
|--------|------|---------|
| `VerboseEvaluation` | `src/lib/models/verbose-evaluation.ts` | Full LLM analysis output |
| `AgentOutputs` | `src/lib/models/agent-outputs.ts` | Merged Phase 2 worker results |
| `Phase1Output` | `src/lib/models/phase1-output.ts` | DataExtractor output |
| `NarrativeLLMResponse` | `src/lib/models/verbose-evaluation.ts` | Phase 3 narrative-only output |
| `TranslatorOutput` | `src/lib/models/translator-output.ts` | Phase 4 translation output |
| `TypeClassifierOutput` | `src/lib/models/agent-outputs.ts` | Type classification (5x3 matrix) |
| `ParsedSession` | `src/lib/models/session.ts` | Normalized session data |
| `StoredAnalysis` | `src/lib/models/storage.ts` | Persisted analysis with metadata |
| `ActivitySessionInfo` | `src/types/verbose.ts` | Per-session activity metadata |
| `SessionSummaryData` | `src/lib/models/session-summary-data.ts` | LLM-generated session summaries |

All schemas use Zod with `.describe()` for self-documentation. Gemini structured output via `zod-to-json-schema`.

### Canonical Type Sources

When adding or modifying types, import from the canonical source — never duplicate definitions.

| Domain | Canonical Source | Key Types |
|--------|-----------------|-----------|
| JSONL Parsing | `src/lib/models/session.ts` | `TextBlock`, `ContentBlock`, `UserMessage`, `AssistantMessage`, `JSONLLine`, `ParsedSession`, `SessionMetadata`, type guards |
| Coding Style | `src/lib/models/coding-style.ts` | `CodingStyleType`, `AIControlLevel`, `TypeDistribution`, `MatrixDistribution`, `SessionMetrics`, `TYPE_METADATA`, `MATRIX_NAMES` |
| Analysis-specific | `src/lib/domain/models/analysis.ts` | `Rating`, `Clue`, `Evaluation`, `StoredAnalysis`, `DimensionsSchema` (re-exports session + coding-style types) |
| Frontend Report | `src/types/report.ts` | `FullAnalysisResult`, `ReportData`, dimension results (imports shared types from `coding-style.ts`) |
| Enterprise | `src/types/enterprise.ts` | `DimensionScores`, `TeamAnalytics` (imports `CodingStyleType`/`AIControlLevel` from `coding-style.ts`) |
| Knowledge | `src/lib/domain/models/knowledge.ts` | `KnowledgeItem`, `ProfessionalInsight` (strict schema, `applicableDimensions` required) |
| Knowledge (legacy) | `src/lib/search-agent/models/knowledge.ts` | Same types but `applicableDimensions` optional (used by API routes) |

`analysis.ts` re-exports all types from `session.ts` and `coding-style.ts` for backward compatibility — consumers importing from `analysis.ts` or `domain/models/index.ts` will get the canonical definitions.

## Port Interfaces

| Port | File | Purpose |
|------|------|---------|
| `IAnalysisRepository` | `src/lib/application/ports/storage.ts` | Analysis record management |
| `IKnowledgeRepository` | `src/lib/application/ports/storage.ts` | Knowledge base items |
| `IUserRepository` | `src/lib/application/ports/storage.ts` | User accounts and tiers |
| `ISharingRepository` | `src/lib/application/ports/storage.ts` | Viral report sharing |
| `ILLMPort` | `src/lib/application/ports/llm.ts` | LLM abstraction |
| `IJobQueuePort` | `src/lib/application/ports/job-queue.ts` | Async job queue |

## Multi-Source Session Scanning

| Source | Path | Parser | Key File |
|--------|------|--------|----------|
| Claude Code | `~/.claude/projects/**/*.jsonl` | JSONL | `packages/cli/src/lib/scanner/sources/claude-code.ts` |
| Cursor | `~/.cursor/chats/**/*.db` | SQLite (better-sqlite3) | `packages/cli/src/lib/scanner/sources/cursor.ts` |
| Cursor Composer | `globalStorage/state.vscdb` | SQLite KV (better-sqlite3) | `packages/cli/src/lib/scanner/sources/cursor-composer.ts` |

Supporting files: `cursor-paths.ts` (cross-platform), `sqlite-loader.ts` (shared import), `tool-mapping.ts` (tool name normalization).

Type: `SessionSourceType = 'claude-code' | 'cursor' | 'cursor-composer'`

## Key Files Reference

| Component | File |
|-----------|------|
| Entry point | `src/lib/analyzer/verbose-analyzer.ts` |
| Pipeline coordinator | `src/lib/analyzer/orchestrator/analysis-orchestrator.ts` |
| Content gateway | `src/lib/analyzer/content-gateway.ts` |
| Evaluation assembler | `src/lib/analyzer/stages/evaluation-assembler.ts` |
| Session summarizer | `src/lib/analyzer/stages/session-summarizer.ts` |
| Project summarizer | `src/lib/analyzer/stages/project-summarizer.ts` |
| Evidence verifier | `src/lib/analyzer/stages/evidence-verifier.ts` |
| Phase 3 summarizer | `src/lib/analyzer/stages/phase3-summarizer.ts` |
| Knowledge mapping | `src/lib/analyzer/workers/prompts/knowledge-mapping.ts` |
| Report container | `src/components/personal/tabs/containers/TabbedReportContainer.tsx` |
| Scroll spy hook | `src/hooks/useScrollSpy.ts` |
| Floating nav dots | `src/components/personal/tabs/shared/FloatingProgressDots.tsx` |
| Worker insights UI | `src/components/personal/tabs/insights/WorkerInsightsSection.tsx` |
| Growth data hook | `src/hooks/useGrowthData.ts` |
| Growth components | `src/components/personal/tabs/growth/` (`GrowthSummaryBanner`, `ProgressSection`, `PercentileGauge`) |
| OG image (home) | `app/opengraph-image.tsx` |
| OG image (report) | `app/r/[resultId]/opengraph-image.tsx` |
| Translation verifier | `src/lib/analyzer/stages/translation-verifier.ts` |
| Gemini client | `src/lib/analyzer/clients/gemini-client.ts` |
| JSONL reader | `src/lib/parser/jsonl-reader.ts` |
| Session selector | `src/lib/parser/session-selector.ts` |
| Activity scanner | `packages/cli/src/activity-scanner.ts` |
| Activity UI | `src/components/personal/tabs/activity/ActivitySection.tsx` |
| Text formatting | `src/utils/textFormatting.tsx` |

## Cost

- 11-12 LLM calls per analysis using Gemini 3 Flash
- ~$0.04-0.05 per analysis
- Phase 2 runs 5 workers + ProjectSummarizer + WeeklyInsightGenerator in parallel for speed
- No Fallback Policy: worker failures propagate as errors (Promise.all)
