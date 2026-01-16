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
│   CLI (commands/)  │  Next.js API (app/api/)  │  Next.js App (app/) │
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
Session JSONL → Parser → SessionSelector → CostEstimator → [Confirmation] → VerboseAnalyzer → Next.js App (app/)
```

**Key Components:**
- **SessionSelector** (`src/lib/parser/session-selector.ts`) - Selects optimal sessions (5-min minimum, 90-day window, max 10)
- **CostEstimator** (`src/lib/analyzer/cost-estimator.ts`) - Token counting and API cost calculation
- **VerboseAnalyzer** (`src/lib/analyzer/verbose-analyzer.ts`) - LLM-powered hyper-personalized analysis
- **VerbosePrompts** (`src/lib/analyzer/verbose-prompts.ts`) - Behavioral analyst prompts
- **CostConfirmation** (`src/lib/cli/output/components/cost-confirmation.ts`) - Interactive cost approval
- **Next.js App** (`app/`) - Unified web dashboard with analysis report view

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
| **UnifiedReport Schema** | `src/lib/models/unified-report.ts` | 32 Zod schemas for complete report structure |
| **SchemaBridge** | `src/lib/models/schema-bridge.ts` | Converts VerboseEval/TypeResult → UnifiedReport |
| **DimensionKeywords** | `src/lib/analyzer/dimension-keywords.ts` | Maps dimensions → KB search parameters |
| **KnowledgeLinker** | `src/lib/analyzer/knowledge-linker.ts` | Links dimensions → KB items + professional insights |
| **DimensionQuoteExtractor** | `src/lib/analyzer/dimension-quote-extractor.ts` | Extracts quotes by dimension patterns |
| **InsightPrompts** | `src/lib/analyzer/insight-prompts.ts` | Advice templates + LLM prompt building |
| **InsightGenerator** | `src/lib/analyzer/insight-generator.ts` | Orchestrates insight generation |

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
| `app/api/` | Next.js 15 API routes | Presentation |
| `app/` | Next.js pages and layouts | Presentation |
| `src/components/` | React UI components | Presentation |
| `src/hooks/` | React hooks | Presentation |
| `src/views/` | Page view components | Presentation |
| `src/lib/application/` | Application services & ports | Application |
| `src/lib/domain/` | Domain models (Zod schemas, business rules) | Domain |
| `src/lib/infrastructure/` | Supabase & local storage adapters | Infrastructure |
| `src/lib/analyzer/` | LLM analysis (prompts, dimensions, insights) | Application |
| `src/lib/analyzer/stages/` | Two-stage pipeline (data-analyst, content-writer) | Application |
| `src/lib/models/` | Zod schemas (unified-report, schema-bridge) | Domain |
| `src/lib/parser/` | JSONL session parsing | Infrastructure |
| `src/lib/search-agent/` | Knowledge curation system | Application |
| `packages/cli/` | NPM CLI package (npx no-ai-slop) | Presentation |

### Next.js 15 App Router Architecture

The `app/` directory serves as the **single web interface** using Next.js 15 App Router:

```
app/
├── layout.tsx                  # Root layout with providers
├── page.tsx                    # Home page
├── browse/page.tsx             # Knowledge base discovery
├── learn/page.tsx              # Add YouTube/URL content
├── dashboard/page.tsx          # Knowledge analytics
├── personal/page.tsx           # Individual growth journey
├── enterprise/page.tsx         # Team performance (B2B)
├── report/[reportId]/page.tsx  # Analysis report (terminal-style)
├── comparison/[reportId]/page.tsx  # Compare multiple analyses
├── r/[resultId]/page.tsx       # Public result pages
└── api/                        # API routes
    ├── knowledge/              # Knowledge base operations
    ├── learn/                  # YouTube/URL learning
    ├── reports/                # Report sharing
    ├── enterprise/             # Team analytics
    ├── analysis/               # Analysis operations
    └── influencers/            # Influencer management
```

**Components Structure** (`src/components/`):
```
src/components/
├── ui/                 # Reusable UI primitives (Button, Badge, Card, etc.)
├── report/             # Analysis report components
├── verbose/            # Hyper-personalized insights
├── enterprise/         # Team analytics components
├── personal/           # Personal dashboard components
├── knowledge/          # Knowledge base components
├── dashboard/          # Dashboard widgets
├── auth/               # Authentication components
└── layout/             # Layout components (Header, Sidebar)
```

**Hooks** (`src/hooks/`):
```
src/hooks/
├── useAnalysisReport.ts        # Report data fetching
├── useScrollNavigation.ts      # Section navigation (j/k, 1-8 keys)
├── useKnowledge.ts             # Knowledge base operations
├── useLearn.ts                 # Learning/content addition
├── useReport.ts                # Report management
├── useComparison.ts            # Analysis comparison
├── useEnterprise.ts            # Enterprise/team features
├── usePersonalAnalytics.ts     # Personal analytics
└── useLatestAnalysis.ts        # Latest analysis fetching
```

**Key Features:**
- Terminal-aesthetic design (macOS window chrome, neon colors)
- Snap-scroll section navigation with keyboard shortcuts
- Premium content blur/unlock logic
- Server Components for optimal performance
- React hooks for client-side state management

### CLI Package (NPM)

The `packages/cli/` directory contains the standalone CLI tool published as `no-ai-slop` on npm:

```
packages/cli/
├── src/
│   ├── index.ts        # Main CLI entry point
│   ├── scanner.ts      # Session directory scanning
│   ├── uploader.ts     # API communication
│   └── display.ts      # Terminal output formatting
```

**Usage:**
```bash
npx no-ai-slop          # Scan and analyze current project
npx no-ai-slop --help   # Show help
```

**Key Features:**
- Scans `~/.claude/projects/` for session JSONL files
- Uploads session data to NoMoreAISlop API
- Displays analysis results in terminal
- Generates shareable report URLs
- Zero configuration required

**Published as:** `no-ai-slop` on npm registry

### Two-Stage Analysis Pipeline

The analyzer uses a two-stage Gemini pipeline for structured output. See [LLM_FLOW.md](./LLM_FLOW.md) for details.

**Stage 1: Data Analyst** (`src/lib/analyzer/stages/data-analyst.ts`)
- Extracts behavioral patterns from session data
- Outputs structured JSON using `responseJsonSchema`
- Temperature: 1.0 (Gemini's recommended default)

**Stage 2: Content Writer** (`src/lib/analyzer/stages/content-writer.ts`)
- Transforms behavioral data into personalized narrative
- Generates dimension insights and recommendations
- Outputs structured JSON using `responseJsonSchema`

**Prompt Engineering:**
- Prompts in `src/lib/analyzer/stages/data-analyst-prompts.ts` and `content-writer-prompts.ts`
- Uses PTCF framework (Persona · Task · Context · Format)
- Zod schemas → JSON Schema via `zod-to-json-schema`

**Model:** `gemini-3-flash-preview` for both stages

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

## API Routes (Next.js App Router)

| Route | Purpose | Auth | Directory |
|-------|---------|------|-----------|
| `/api/analysis` | Local and remote analysis | Optional | `app/api/analysis/` |
| `/api/reports` | Report sharing and OG images | Public | `app/api/reports/` |
| `/api/knowledge` | Knowledge base operations | PREMIUM | `app/api/knowledge/` |
| `/api/learn` | YouTube/URL learning | PREMIUM | `app/api/learn/` |
| `/api/enterprise` | Team analytics | ENTERPRISE | `app/api/enterprise/` |
| `/api/influencers` | Influencer management | Internal | `app/api/influencers/` |
| `/api/health` | Health check | Public | `app/api/health/` |

**Key Endpoints:**

**Analysis Route** (`app/api/analysis/`):
- `POST /api/analysis/remote` - Analyze session data remotely
- `GET /api/analysis/results/:resultId` - Retrieve analysis by ID

**Reports Route** (`app/api/reports/`):
- `GET /api/reports/:reportId` - Get shared report
- `GET /api/reports/:reportId/og-image` - Generate OG image for sharing
- `POST /api/reports/:reportId/share` - Create shareable report
- `GET /api/reports/comparison/:reportId` - Compare reports
- `GET /api/reports/comparison/features` - Comparison features

**Knowledge Route** (`app/api/knowledge/`):
- `GET /api/knowledge` - List knowledge items (filterable by platform, category, status)
- `POST /api/knowledge` - Create knowledge item
- `GET /api/knowledge/:id` - Get specific knowledge item
- `GET /api/knowledge/stats` - Get statistics
- `GET /api/knowledge/metrics` - Get quality metrics

**Learn Route** (`app/api/learn/`):
- `POST /api/learn/youtube` - Learn from YouTube video
- `POST /api/learn/url` - Learn from URL content
- `GET /api/learn/status/:id` - Get job status

**Enterprise Route** (`app/api/enterprise/`):
- `GET /api/enterprise/team/demo` - Get demo team data
- `GET /api/enterprise/team/demo/members` - Get team members
- `GET /api/enterprise/team/demo/trends` - Get trend data
- `GET /api/enterprise/personal/history` - Personal history
- `POST /api/enterprise/personal/tracking` - Personal tracking

**Influencers Route** (`app/api/influencers/`):
- `GET /api/influencers` - List influencers
- `POST /api/influencers` - Create influencer
- `GET /api/influencers/active` - Get active influencers
- `GET /api/influencers/:id` - Get specific influencer
- `DELETE /api/influencers/:id/deactivate` - Deactivate influencer
- `GET /api/influencers/tier/:tier` - Filter by tier

## Authentication

- **Provider**: Supabase Auth
- **Middleware**: `requireAuth()`, `requireTier(minTier)`
- **Tier check**: User tier stored in `users` table

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `GOOGLE_GEMINI_API_KEY` | Gemini 3 Flash API (two-stage pipeline) |
| `ANTHROPIC_API_KEY` | Claude API (legacy/fallback) |
| `SUPABASE_URL` | Database URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Backend access |
| `POLAR_ACCESS_TOKEN` | Payments |

## Data Models Overview

The system uses Zod schemas for type safety. Key schemas are in `src/lib/models/`:

| Schema | File | Purpose |
|--------|------|---------|
| **VerboseEvaluation** | `verbose-evaluation.ts` | LLM analysis output (personality, strengths, growth areas) |
| **UnifiedReport** | `unified-report.ts` | Complete developer assessment (profile + 6 dimensions) |
| **ParsedSession** | `session.ts` | Normalized session data from JSONL |
| **TypeResult** | `coding-style.ts` | AI coding style (5 types + distribution) |
| **StoredAnalysis** | `storage.ts` | Persisted analysis with metadata |

All schemas are self-documenting via `.describe()` calls. See the source files for details.
