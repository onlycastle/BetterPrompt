# NoMoreAISlop - Architecture

> Version: 5.0.0 | Status: Closed-Source SaaS

## Business Model

**Greptile Model** - Fully closed-source SaaS with Claude Code plugin integration.

| Tier | Features |
|------|----------|
| **FREE** | Basic analysis (3/month), basic web report |
| **PRO** | Unlimited analysis, detailed recommendations, growth plan |
| **PREMIUM** | Tracking dashboard, knowledge base access |
| **ENTERPRISE** | Team management, customized knowledge base |

## System Architecture

### Hexagonal Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     PRESENTATION LAYER                          │
│            Next.js API (app/api/)  │  Next.js App (app/)       │
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
Session JSONL → Parser → SessionSelector → CostEstimator → [Confirmation] → AnalysisOrchestrator → ContentGateway → Next.js App (app/)
```

**Key Components:**
- **SessionSelector** (`src/lib/parser/session-selector.ts`) - Selects optimal sessions (5-min minimum, 90-day window, max 10)
- **CostEstimator** (`src/lib/analyzer/cost-estimator.ts`) - Token counting and API cost calculation
- **VerboseAnalyzer** (`src/lib/analyzer/verbose-analyzer.ts`) - Entry point, delegates to AnalysisOrchestrator
- **AnalysisOrchestrator** (`src/lib/analyzer/orchestrator/analysis-orchestrator.ts`) - 4-phase pipeline coordinator
- **ContentGateway** (`src/lib/analyzer/content-gateway.ts`) - Tier-based content filtering
- **Next.js App** (`app/`) - Unified web dashboard with analysis report view

## Key Components

| Directory | Purpose | Layer |
|-----------|---------|-------|
| `app/api/` | Next.js 15 API routes | Presentation |
| `app/` | Next.js pages and layouts | Presentation |
| `src/components/` | React UI components | Presentation |
| `src/hooks/` | React hooks | Presentation |
| `src/views/` | Page view components | Presentation |
| `src/lib/application/` | Application services & ports | Application |
| `src/lib/domain/` | Domain models (Zod schemas, business rules) | Domain |
| `src/lib/infrastructure/` | Supabase & local storage adapters | Infrastructure |
| `src/lib/analyzer/` | LLM analysis (prompts, dimensions, insights) | Application |
| `src/lib/analyzer/orchestrator/` | 4-phase analysis orchestration | Application |
| `src/lib/analyzer/workers/` | Phase 1 DataExtractor + Phase 2 workers (StrengthGrowth, TrustVerification, WorkflowHabit, KnowledgeGap, ContextEfficiency) + Phase 2.5 TypeClassifier | Application |
| `src/lib/analyzer/stages/` | Content Writer stage (Phase 3 narrative generation) | Application |
| `src/lib/models/` | Zod schemas (analysis-data, agent-outputs, verbose-evaluation) | Domain |
| `src/lib/parser/` | JSONL session parsing | Infrastructure |
| `src/lib/search-agent/` | Knowledge curation system | Application |

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

### Orchestrator + Workers Analysis Pipeline

The analyzer uses a 4-phase Orchestrator + Workers pattern with Gemini. See [LLM_FLOW.md](./LLM_FLOW.md) for details.

**Architecture:**
- **AnalysisOrchestrator** (`src/lib/analyzer/orchestrator/analysis-orchestrator.ts`) coordinates all phases
- **Workers** (`src/lib/analyzer/workers/`) execute phase-specific analysis tasks
- **No Fallback Policy**: Worker failures propagate as errors (Promise.all)

**Phase 1: Data Extraction (Deterministic)**
- **DataExtractorWorker** (deterministic, NO LLM) - Extracts structured Phase1Output from raw sessions
- Output: `Phase1Output` (DeveloperUtterances[], AIResponses[], SessionMetrics)
- 0 LLM calls

**Phase 2: Insight Generation (Parallel, 5 workers)**
- **StrengthGrowthWorker** (free) - Identifies strengths and growth areas with evidence
- **TrustVerificationWorker** (premium) - Anti-patterns and verification behavior analysis
- **WorkflowHabitWorker** (premium) - Planning, critical thinking, multitasking patterns
- **KnowledgeGapWorker** (premium) - Knowledge gaps and learning suggestions
- **ContextEfficiencyWorker** (premium) - Token inefficiency patterns
- Output: `AgentOutputs` (merged results)
- 5 LLM calls (parallel)

**Phase 2.5: Type Classification**
- **TypeClassifierWorker** (free) - Type classification + synthesis using Phase 2 outputs
- Uses semantic analysis from Phase 2 agents to improve accuracy of:
  - 5 coding styles: architect, scientist, collaborator, speedrunner, craftsman
  - 3 control levels: explorer, navigator, cartographer
  - 15 combination matrix (5×3 = unique personalities)
- Output: `TypeClassifierOutput` with refined classification and evidence
- Available for all tiers (free and above)
- 1 LLM call

**Phase 3: Content Writer**
- **ContentWriterStage** (`src/lib/analyzer/stages/content-writer.ts`)
- Combines all phase outputs into personalized narrative
- Output: `VerboseLLMResponse` → `VerboseEvaluation`
- 1 LLM call

**Total: 7 LLM calls (0 + 5 + 1 + 1)**

**Prompt Engineering:**
- Prompts in `src/lib/analyzer/workers/prompts/phase2-worker-prompts.ts` and `content-writer-prompts.ts`
- Uses PTCF framework (Persona · Task · Context · Format)
- Zod schemas → JSON Schema via `zod-to-json-schema`

**Model:** `gemini-3-flash-preview` for all phases

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
