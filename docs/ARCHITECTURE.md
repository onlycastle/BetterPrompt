# NoMoreAISlop - Architecture

> Version: 5.0.0 | Status: Closed-Source SaaS

## Business Model

**Greptile Model** - Fully closed-source SaaS with Claude Code plugin integration.

| Tier | Features |
|------|----------|
| **FREE** | Basic analysis (3/month), CLI + basic web report |
| **PRO** | Unlimited analysis, detailed recommendations, growth plan |
| **PREMIUM** | Tracking dashboard, knowledge base access |
| **ENTERPRISE** | Team management, customized knowledge base |

## System Architecture

### Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│   CLI (commands/)  │  REST API (src/api/)  │  React SPA (web-ui/) │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    APPLICATION LAYER                            │
│  AnalysisService │ KnowledgeService │ RecommendationService    │
│  SharingService  │ InfluencerService│ JobService               │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      DOMAIN LAYER                               │
│  Models (Zod): Analysis, Knowledge, Influencer, User, Job      │
│  Errors: AnalysisError, StorageError, SkillError, AuthError    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   INFRASTRUCTURE LAYER                          │
│  Supabase Repos  │  Local FileCache  │  LLM Adapter  │  Jobs   │
└─────────────────────────────────────────────────────────────────┘
```

## Core Pipeline

### Analysis Pipeline (LLM-powered Verbose Analysis)
```
Session JSONL → Parser → SessionSelector → CostEstimator → [Confirmation] → VerboseAnalyzer → React SPA (web-ui/)
```

**Key Components:**
- **SessionSelector** (`src/parser/session-selector.ts`) - Selects optimal sessions (5-min minimum, 90-day window, max 10)
- **CostEstimator** (`src/analyzer/cost-estimator.ts`) - Token counting and API cost calculation
- **VerboseAnalyzer** (`src/analyzer/verbose-analyzer.ts`) - LLM-powered hyper-personalized analysis
- **VerbosePrompts** (`src/analyzer/verbose-prompts.ts`) - Behavioral analyst prompts
- **CostConfirmation** (`src/cli/output/components/cost-confirmation.ts`) - Interactive cost approval
- **React SPA** (`web-ui/`) - Unified web dashboard with analysis report view

### Hyper-Personalized Report Pipeline (NEW)

```
ParsedSession[]
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  QUOTE EXTRACTION                                │
│  DimensionQuoteExtractor → Pattern matching per dimension       │
│  ExtractedQuote[] (with sentiment: positive/negative/neutral)   │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  KNOWLEDGE LINKING                               │
│  DimensionKeywords → KB search params (reinforcement/improve)   │
│  KnowledgeLinker → LinkedKnowledge[] + LinkedInsight[]          │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  INSIGHT GENERATION                              │
│  InsightGenerator → DimensionInsight[] per dimension            │
│  (ConversationInsight + ResearchInsight + LearningResource)     │
└─────────────────────────────────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SCHEMA BRIDGE                                   │
│  SchemaBridge → UnifiedReport (complete developer assessment)   │
│  (Profile + 6 Dimensions + Summary + Evidence + Recommendations)│
└─────────────────────────────────────────────────────────────────┘
```

### UnifiedAnalyzer Pipeline

The UnifiedAnalyzer integrates all analysis components into a single orchestrator:

```
┌─────────────────────────────────────────────────────────────────┐
│                    UNIFIED ANALYZER                              │
│                                                                  │
│  Input: ParsedSession[]                                          │
│    │                                                             │
│    ├──→ PatternAnalyzer ──→ TypeResult + FullAnalysisResult     │
│    │                                                             │
│    ├──→ VerboseAnalyzer ──→ VerboseEvaluation (if enabled)      │
│    │                                                             │
│    ├──→ DimensionQuoteExtractor ──→ ExtractedQuote[]            │
│    │                                                             │
│    ├──→ KnowledgeLinker ──→ LinkedKnowledge[] + LinkedInsight[] │
│    │                                                             │
│    ├──→ InsightGenerator ──→ DimensionInsight[]                 │
│    │                                                             │
│    └──→ SchemaBridge ──→ UnifiedReport                          │
│                                                                  │
│  Output: UnifiedReport (complete assessment)                     │
└─────────────────────────────────────────────────────────────────┘
```

**Key Features:**
- **Single Entry Point**: `analyze(sessions, options)` method handles full pipeline
- **Progressive Enhancement**: Basic analysis always runs, verbose adds LLM insights
- **Knowledge Integration**: Links KB items to dimension insights
- **Schema Unification**: SchemaBridge converts all outputs to UnifiedReport

**Hyper-Personalized Report Components:**

| Component | File | Purpose |
|-----------|------|---------|
| **UnifiedReport Schema** | `src/models/unified-report.ts` | 32 Zod schemas for complete report structure |
| **SchemaBridge** | `src/models/schema-bridge.ts` | Converts VerboseEval/TypeResult → UnifiedReport |
| **DimensionKeywords** | `src/analyzer/dimension-keywords.ts` | Maps dimensions → KB search parameters |
| **KnowledgeLinker** | `src/analyzer/knowledge-linker.ts` | Links dimensions → KB items + professional insights |
| **DimensionQuoteExtractor** | `src/analyzer/dimension-quote-extractor.ts` | Extracts quotes by dimension patterns |
| **InsightPrompts** | `src/analyzer/insight-prompts.ts` | Advice templates + LLM prompt building |
| **InsightGenerator** | `src/analyzer/insight-generator.ts` | Orchestrates insight generation |

**Key Concepts:**

| Concept | Values | Description |
|---------|--------|-------------|
| **InsightMode** | reinforcement / improvement | Score ≥ 70 = reinforce strengths, < 70 = improve |
| **ResourceLevel** | beginner / intermediate / advanced | ≥ 85 = advanced, 50-84 = intermediate, < 50 = beginner |
| **DimensionLevel** | novice / developing / proficient / expert | ≥ 85 = expert, 70-84 = proficient, 50-69 = developing |
| **STRENGTH_THRESHOLD** | 70 | Universal threshold for strength vs growth area |

## Key Components

| Directory | Purpose | Layer |
|-----------|---------|-------|
| `commands/` | Claude Code plugin commands | Presentation |
| `src/api/` | REST API server (Express, port 3001) | Presentation |
| `web-ui/` | **Unified React SPA** (Vite, port 5173 dev) | Presentation |
| `src/application/` | Application services & ports | Application |
| `src/domain/` | Domain models (Zod schemas, business rules) | Domain |
| `src/infrastructure/` | Supabase & local storage adapters | Infrastructure |
| `src/lib/` | Shared utilities (Result type, Supabase client) | Infrastructure |
| `src/analyzer/` | LLM analysis (prompts, dimensions, insights) | Application |
| `src/models/` | Zod schemas (unified-report, schema-bridge) | Domain |
| `src/parser/` | JSONL session parsing | Infrastructure |
| `src/search-agent/` | Knowledge curation system | Application |

### Web UI Architecture (Unified)

The `web-ui/` React SPA serves as the **single web interface** for all features:

```
web-ui/
├── src/
│   ├── pages/
│   │   ├── BrowsePage.tsx          # Knowledge base discovery
│   │   ├── LearnPage.tsx           # Add YouTube/URL content
│   │   ├── DashboardPage.tsx       # Knowledge analytics
│   │   ├── AnalysisReportPage.tsx  # Analysis report (terminal-style)
│   │   ├── PersonalDashboardPage.tsx   # Individual growth journey
│   │   └── EnterpriseDashboardPage.tsx # Team performance (B2B)
│   ├── components/
│   │   ├── report/                 # Analysis report components
│   │   ├── verbose/                # Hyper-personalized insights
│   │   ├── enterprise/             # Team analytics components
│   │   └── ui/                     # Reusable UI primitives
│   └── hooks/
│       ├── useScrollNavigation.ts  # Section navigation (j/k, 1-8 keys)
│       └── useAnalysisReport.ts    # Report data fetching
```

**Key Features:**
- Terminal-aesthetic design (macOS window chrome, neon colors)
- Snap-scroll section navigation with keyboard shortcuts
- Premium content blur/unlock logic
- React Query for server state management

## Port Interfaces

### Repository Ports (storage.ts)
- **IAnalysisRepository** - Manage analysis records
- **IKnowledgeRepository** - Knowledge base items
- **IInfluencerRepository** - Influencer registry
- **IUserRepository** - User accounts and tiers
- **ISharingRepository** - Viral report sharing
- **ITeamRepository** - Enterprise team management
- **ITrackingRepository** - Progress metrics
- **ISyncManager** - Local ↔ Supabase sync

### Other Ports
- **ILLMPort, ILLMCachePort** (llm.ts) - LLM abstraction
- **IJobQueuePort, JobHandler** (job-queue.ts) - Async jobs

## Application Services

| Service | Purpose | Dependencies |
|---------|---------|--------------|
| **AnalysisService** | Full analysis pipeline (Parse → Evaluate → Style → Dimensions → Save) | IAnalysisRepository, ILLMPort, Parser |
| **KnowledgeService** | Knowledge learning (URL check → Influencer match → Extract → Score) | IKnowledgeRepository, IInfluencerRepository, ILLMPort |
| **RecommendationService** | Connect analysis ↔ knowledge | IAnalysisRepository, IKnowledgeRepository |
| **InfluencerService** | Influencer registry management | IInfluencerRepository |
| **SharingService** | Viral report sharing | ISharingRepository |
| **JobService** | Async job orchestration | IJobQueuePort |

## Analysis Dimensions

| Dimension | Score | Purpose |
|-----------|-------|---------|
| AI Collaboration Mastery | 0-100 | Context provision quality |
| Context Engineering | 0-100 | WRITE-SELECT-COMPRESS-ISOLATE strategies |
| Burnout Risk | 0-100 | Work pattern indicators |
| Tool Mastery | 0-100 | Tool usage effectiveness |
| AI Control Index | 0-100 | Strategic control vs vibing |
| Skill Resilience | 0-100 | Independent coding ability |

## Data Storage

### Supabase Tables (15 total)

| Table | Purpose | Tier |
|-------|---------|------|
| `users` | User accounts, tier management | All |
| `analyses` | Analysis records | PREMIUM |
| `tracking_metrics` | Daily/weekly progress | PREMIUM |
| `knowledge_items` | Knowledge base | PREMIUM |
| `influencers` | Influencer registry | Internal |
| `shared_reports` | Viral sharing | All |
| `teams` | Enterprise team management | ENTERPRISE |
| `team_members` | Team membership | ENTERPRISE |
| `learning_paths` | Personalized growth plans | PRO |
| `recommendations` | Analysis ↔ knowledge links | PRO |
| `user_settings` | Preferences | All |
| `jobs` | Background job queue | Internal |
| `api_keys` | User API keys | PRO |
| `webhooks` | Webhook subscriptions | ENTERPRISE |
| `audit_logs` | Security audit trail | ENTERPRISE |

### Local Storage

| Location | Purpose | Tier |
|----------|---------|------|
| `~/.nomoreaislop/analyses/` | Cached analysis results | FREE |
| `~/.nomoreaislop/config.json` | User config | All |
| `~/.nomoreaislop/cache/` | LLM response cache | All |

See [DATABASE.md](./DATABASE.md) for full schema details.

## API Routes

| Route | Purpose | Auth |
|-------|---------|------|
| `/api/reports` | Shared reports (viral) | Public |
| `/api/analyses` | User's analysis history | Required |
| `/api/tracking` | Daily/weekly metrics | PREMIUM |
| `/api/knowledge` | Knowledge base | PREMIUM |

## Authentication

- **Provider**: Supabase Auth
- **Middleware**: `requireAuth()`, `requireTier(minTier)`
- **Tier check**: User tier stored in `users` table

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `ANTHROPIC_API_KEY` | Claude API |
| `SUPABASE_URL` | Database URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend access |
| `POLAR_ACCESS_TOKEN` | Payments |

## Data Models Overview

The system uses Zod schemas for type safety. Key schemas are in `src/models/`:

| Schema | File | Purpose |
|--------|------|---------|
| **VerboseEvaluation** | `verbose-evaluation.ts` | LLM analysis output (personality, strengths, growth areas) |
| **UnifiedReport** | `unified-report.ts` | Complete developer assessment (profile + 6 dimensions) |
| **ParsedSession** | `session.ts` | Normalized session data from JSONL |
| **TypeResult** | `coding-style.ts` | AI coding style (5 types + distribution) |
| **StoredAnalysis** | `storage.ts` | Persisted analysis with metadata |

All schemas are self-documenting via `.describe()` calls. See the source files for details.
