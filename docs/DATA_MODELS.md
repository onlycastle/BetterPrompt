# NoMoreAISlop - Data Models

> Version: 4.0.0

## Overview

| Schema | Purpose | Location |
|--------|---------|----------|
| ParsedSession | Normalized session data | Internal |
| Evaluation | Analysis output | `~/.nomoreaislop/analyses/` |
| TypeResult | AI coding style (5 types) | Analysis output |
| CodingStyleMatrix | Style x Control Level (5x3=15) | Analysis output |
| UserTier | Subscription tier | Supabase `users` |
| KnowledgeItem | Curated knowledge | Supabase `knowledge_items` |
| Influencer | Tracked thought leaders | Supabase `influencers` |

## User Tiers

```typescript
enum UserTier {
  FREE = 'free',
  PRO = 'pro',
  PREMIUM = 'premium',
  ENTERPRISE = 'enterprise',
}
```

| Tier | analysesPerMonth | trackingDashboard | knowledgeBase | teamManagement | apiAccess |
|------|------------------|-------------------|---------------|----------------|-----------|
| FREE | 3 | ✗ | ✗ | ✗ | ✗ |
| PRO | -1 (unlimited) | ✗ | ✗ | ✗ | ✓ |
| PREMIUM | -1 | ✓ | ✓ | ✗ | ✓ |
| ENTERPRISE | -1 | ✓ | ✓ + custom | ✓ | ✓ |

## Session Data (Input)

**Location**: `~/.claude/projects/{encoded-path}/{session-id}.jsonl`

| Field | Type | Purpose |
|-------|------|---------|
| sessionId | string | UUID identifier |
| projectPath | string | Decoded project path |
| messages | ParsedMessage[] | Conversation |
| stats | SessionStats | Aggregated metrics |

## Evaluation (Output)

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | Session UUID |
| planning | CategoryEvaluation | Planning assessment |
| criticalThinking | CategoryEvaluation | Critical thinking |
| codeUnderstanding | CategoryEvaluation | Code understanding |
| recommendations | string[] | Actionable suggestions |

## AI Coding Style Types

The system identifies 5 distinct AI coding style types. All types are positive - each has unique strengths and growth points.

| Type | Primary Trait | Emoji |
|------|---------------|-------|
| architect | Strategic planning | 🏗️ |
| scientist | Critical verification | 🔬 |
| collaborator | Iterative dialogue | 🤝 |
| speedrunner | Fast execution | ⚡ |
| craftsman | Code quality | 🔧 |

## AI Coding Style Matrix (5×3)

The system uses a **2D matrix** combining:
- **5 Coding Style Types** (architect, scientist, collaborator, speedrunner, craftsman)
- **3 AI Control Levels** (vibe-coder, developing, ai-master)

This creates **15 unique personality combinations** like "Systems Architect" or "Yolo Coder".

### AI Control Levels

```typescript
enum AIControlLevel {
  'vibe-coder'  // 0-34: High AI dependency, accepts output without modification
  'developing'  // 35-64: Learning balance, building control habits
  'ai-master'   // 65-100: Strategic control, directs AI effectively
}
```

### Matrix Table

| Style Type | vibe-coder (0-34) | developing (35-64) | ai-master (65-100) |
|------------|-------------------|--------------------|--------------------|
| architect  | Dreamer 💭 | Planner 📐 | Systems Architect 🏛️ |
| scientist  | Curious 🔎 | Investigator 🧪 | Research Master 🔬 |
| collaborator | Follower 👥 | Partner 🤝 | Conductor 🎭 |
| speedrunner | Yolo Coder 🎲 | Fast Learner 🏃 | Efficient Master ⚡ |
| craftsman  | Perfectionist 🎨 | Quality Seeker 🔧 | Code Artisan 💎 |

**Example**: A developer who is primarily a "scientist" (verifies AI output) with an AI Control score of 72 would be classified as **"Research Master 🔬"** - someone who treats every AI output as a hypothesis to be tested.

## Verbose Evaluation Schema

Extended schema for hyper-personalized analysis with FREE and PREMIUM tier content. Used by `--verbose` mode.

**Source**: `src/models/verbose-evaluation.ts`

### VerboseEvaluation

| Field | Type | Tier | Description |
|-------|------|------|-------------|
| sessionId | string | - | Session UUID |
| analyzedAt | datetime | - | Analysis timestamp |
| sessionsAnalyzed | number | - | Number of sessions analyzed |
| primaryType | CodingStyleType | FREE | Primary style (architect, scientist, etc.) |
| controlLevel | AIControlLevel | FREE | Control level (vibe-coder, developing, ai-master) |
| distribution | TypeDistribution | FREE | Percentage breakdown across 5 types |
| personalitySummary | string (200-800 chars) | FREE | Hyper-personalized paragraph |
| strengths | PersonalizedStrength[] (3-5) | FREE | Unique strengths with evidence quotes |
| growthAreas | GrowthArea[] (2-4) | FREE | Growth opportunities with recommendations |
| promptPatterns | PromptPattern[] (3-6) | FREE | Unique prompting style patterns |
| toolUsageDeepDive | ToolUsageInsight[] | PREMIUM | Deep tool usage analysis |
| tokenEfficiency | TokenEfficiency | PREMIUM | Token usage efficiency analysis |
| growthRoadmap | GrowthRoadmap | PREMIUM | Personalized growth plan |
| comparativeInsights | ComparativeInsight[] | PREMIUM | Peer comparison metrics |
| sessionTrends | SessionTrend[] | PREMIUM | Progress trends over time |

### PersonalizedEvidence

Evidence quotes extracted from conversations:

| Field | Type | Description |
|-------|------|-------------|
| quote | string (20-500 chars) | Actual quote from conversation |
| sessionDate | string | ISO date when said |
| context | string (max 200 chars) | What was being discussed |
| significance | string (max 300 chars) | What this reveals about personality |
| sentiment | enum | positive, neutral, growth_opportunity |

### PersonalizedStrength

| Field | Type | Description |
|-------|------|-------------|
| title | string (max 50 chars) | Short strength title |
| description | string (100-500 chars) | Detailed description |
| evidence | PersonalizedEvidence[] (2-5) | Quotes demonstrating strength |
| percentile | number (0-100) | Optional peer comparison |

### GrowthArea

| Field | Type | Description |
|-------|------|-------------|
| title | string (max 50 chars) | Growth area title |
| description | string (100-500 chars) | Detailed description |
| evidence | PersonalizedEvidence[] (1-3) | Examples showing opportunity |
| recommendation | string (max 300 chars) | Specific actionable advice |
| resources | string[] (max 3) | Optional learning resources |

### PromptPattern

| Field | Type | Description |
|-------|------|-------------|
| patternName | string (max 50 chars) | Pattern identifier |
| description | string (max 300 chars) | Pattern description |
| frequency | enum | frequent, occasional, rare |
| examples | { quote, analysis }[] (1-3) | Examples with analysis |
| effectiveness | enum | highly_effective, effective, could_improve |
| tip | string (max 200 chars) | Optional improvement tip |

## Cost Estimation

Token counting and API cost calculation for verbose analysis.

**Source**: `src/analyzer/cost-estimator.ts`

### CostEstimate

| Field | Type | Description |
|-------|------|-------------|
| totalInputTokens | number | Total estimated input tokens |
| estimatedOutputTokens | number | Estimated output tokens (~6,000) |
| totalCost | number | Estimated cost in USD |
| breakdown.sessionTokens | number | Tokens from session content |
| breakdown.systemPromptTokens | number | System prompt overhead (~2,500) |
| breakdown.schemaOverhead | number | Schema overhead (~1,500) |
| model | string | Model identifier |
| modelName | string | Human-readable model name |

### Token Counting Methodology

The cost estimator uses character-based heuristics with adjustments:
- Base: ~4 characters per token (English text)
- Code blocks: +50 tokens per block (symbol-heavy)
- JSON structure: +0.5 tokens per brace/bracket
- Newlines: +0.1 tokens per newline
- Special characters: +0.1 tokens per special char

### Pricing (as of 2025)

| Model | Input (per 1M tokens) | Output (per 1M tokens) |
|-------|----------------------|------------------------|
| Claude Sonnet 4 | $3.00 | $15.00 |
| Claude Opus 4 | $15.00 | $75.00 |
| Claude Opus 4.5 | $15.00 | $75.00 |
| Claude 3.5 Haiku | $0.80 | $4.00 |

## Analysis Dimensions

Six numeric dimensions rated 0-100 with three proficiency levels:

| Dimension | Range | Description | Levels |
|-----------|-------|-------------|--------|
| AI Collaboration Mastery | 0-100 | Planning, orchestration, verification skills | novice/developing/proficient/expert |
| Context Engineering | 0-100 | WRITE-SELECT-COMPRESS-ISOLATE strategies | beginner/intermediate/advanced/expert |
| Tool Mastery | 0-100 | Effective use of Read, Grep, Task, etc. | novice/basic/adept/expert |
| Burnout Risk | 0-100 | Work pattern health (higher = more risk) | low/moderate/elevated/high |
| AI Control Index | 0-100 | Strategic AI control vs. dependency | vibe-coder/developing/ai-master |
| Skill Resilience | 0-100 | Protection against skill atrophy | at-risk/developing/resilient |

### Context Engineering Breakdown

Based on [Anthropic's Context Engineering Guide](https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents), this dimension measures four strategies:

| Strategy | Weight | Description | Signals |
|----------|--------|-------------|---------|
| **WRITE** (Preserve) | 30% | Preserve information for AI | File references, constraints, patterns |
| **SELECT** (Retrieve) | 25% | Retrieve relevant context | file:line references, specificity |
| **COMPRESS** (Reduce) | 25% | Reduce token usage | /compact usage, iteration efficiency |
| **ISOLATE** (Partition) | 20% | Partition work across agents | Task tool usage, multi-agent sessions |

## SessionMetrics Interface

Raw metrics extracted from session analysis:

```typescript
interface SessionMetrics {
  // Prompt characteristics
  avgPromptLength: number;
  avgFirstPromptLength: number;
  maxPromptLength: number;

  // Turn patterns
  avgTurnsPerSession: number;
  totalTurns: number;

  // Question patterns
  questionFrequency: number; // Questions per turn
  whyHowWhatCount: number;

  // Tool usage patterns
  toolUsage: {
    read: number;
    grep: number;
    glob: number;
    task: number;
    plan: number;
    bash: number;
    write: number;
    edit: number;
    total: number;
  };

  // Modification patterns
  modificationRequestCount: number;
  modificationRate: number; // modification requests / total turns

  // Quality signals
  refactorKeywordCount: number;
  styleKeywordCount: number;
  qualityTermCount: number; // test, type, doc mentions

  // Feedback patterns
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;

  // Time patterns
  avgCycleTimeSeconds: number;
  sessionDurationSeconds: number;
}
```

## Domain Model Exports

The system uses a domain-driven architecture with consolidated models in `src/domain/models/`:

### Analysis Models (`analysis.ts`)

**Core Types**:
- `Session` - Parsed JSONL session with messages and stats
- `Evaluation` - LLM analysis output with ratings and recommendations
- `CodingStyle` - Type detection results (5 types + distribution)
- `CodingStyleMatrix` - 2D matrix result (Style × Control Level)
- `Dimensions` - Six numeric dimensions (0-100 scores)
- `TypeResult` - Complete type detection with evidence
- `StoredAnalysis` - Persisted analysis with metadata

**Supporting Types**:
- `ParsedMessage`, `SessionStats`, `SessionMetadata`
- `Rating`, `Clue`, `CategoryEvaluation`
- `DimensionResult`, `DimensionLevel`
- `TypeScores`, `TypeDistribution`, `ConversationEvidence`

**Constants**:
- `TYPE_METADATA` - Display info for 5 coding types
- `MATRIX_NAMES` - 15 combination names (5×3 matrix)
- `MATRIX_METADATA` - Detailed descriptions for each combination
- `CONTROL_LEVEL_METADATA` - AI control level descriptions
- `PATTERN_KEYWORDS` - Pattern detection keywords

### Knowledge Models (`knowledge.ts`)

**Core Types**:
- `KnowledgeItem` - Curated knowledge with source tracking
- `KnowledgeSource` - Source attribution (platform, author, URL)
- `KnowledgeRelevance` - Relevance score + confidence
- `ProfessionalInsight` - Curated tips for developers
- `KnowledgeCollection` - Grouped items by category

**Classification**:
- `TopicCategory` - 9 categories (context-engineering, claude-code-skills, etc.)
- `ContentType` - technique/pattern/tool/configuration/insight/example/reference
- `SourcePlatform` - reddit/twitter/youtube/linkedin/web/manual
- `KnowledgeStatus` - draft/reviewed/approved/archived
- `CredibilityTier` - high/medium/standard

**Constants**:
- `DEFAULT_SEARCH_TOPICS` - Default search categories
- `TOPIC_DISPLAY_NAMES` - UI display names
- `RELEVANCE_THRESHOLDS` - Auto-accept/review/reject thresholds
- `INITIAL_INSIGHTS` - Seed professional insights

### Influencer Models (`influencer.ts`)

**Core Types**:
- `Influencer` - Tracked thought leader with credibility tier
- `PlatformIdentifier` - Platform-specific handle/URL
- `InfluencerMatch` - Match result when detecting from content
- `CandidateInfluencer` - Discovered influencer candidate
- `InfluencerRegistry` - Collection of tracked influencers

**Classification**:
- `InfluencerPlatform` - twitter/youtube/linkedin/github/web/reddit
- `CredibilityTier` - high/medium/standard (shared with knowledge)

**Constants**:
- `DEFAULT_INFLUENCERS` - Seed influencers (Karpathy, Willison, etc.)

**Utilities**:
- `normalizeHandle()` - Normalize handles for comparison
- `extractHandleFromUrl()` - Parse handle from URL
- `detectPlatformFromUrl()` - Detect platform from URL

### User Models (`user.ts`)

**Core Types**:
- `User` - User profile with tier and usage tracking
- `Team` - Team within organization
- `Organization` - Enterprise organization
- `License` - PRO tier license key
- `TeamMember` - Team membership with role

**Tracking**:
- `UsageRecord` - Rate limiting records
- `TrackingMetrics` - Daily dimension scores (PREMIUM)

**Classification**:
- `UserTier` - free/pro/premium/enterprise
- `TeamRole` - owner/admin/member/viewer
- `LicenseType` - one_time/pro/team

**Constants**:
- `TIER_LIMITS` - Feature limits per tier

**Utilities**:
- `getEffectiveTier()` - Resolve tier with test override
- `canUserPerformAction()` - Check tier permissions
- `getRemainingAnalyses()` - Calculate remaining analyses

### Job Models (`job.ts`)

**Core Types**:
- `Job` - Async task with status and progress
- `JobPayload` - Type-discriminated payload union
- `JobResult` - Execution result with metrics
- `JobStatusResponse` - API response format

**Job Types**:
- `youtube_transcript` - Process YouTube content
- `knowledge_learn` - Run learning pipeline
- `bulk_analysis` - Analyze multiple sessions
- `influencer_discover` - Discover influencers
- `knowledge_sync` - Sync to/from cloud
- `report_generate` - Generate reports

**Classification**:
- `JobStatus` - pending/processing/completed/failed/cancelled/retrying
- `JobPriority` - low/normal/high/urgent

**Utilities**:
- `isJobTerminal()` - Check if job is done
- `canRetryJob()` - Check retry eligibility
- `getJobProgressPercentage()` - Calculate progress
- `getEstimatedTimeRemaining()` - Estimate completion time

### Sharing Models (`sharing.ts`)

**Core Types**:
- `SharedReport` - Public-facing analysis result
- `ShareToken` - Access token for protected reports
- `ShareLink` - Generated social share link
- `ShareEvent` - Share event tracking
- `AggregateStats` - Peer comparison statistics

**UI Types**:
- `PublicReportView` - What external viewers see
- `OGMetadata` - OpenGraph tags for social
- `EmbedCode` - Embed iframe code

**Classification**:
- `ShareAccessLevel` - public/protected/private
- `SocialPlatform` - twitter/linkedin/facebook/reddit/email/copy

**Utilities**:
- `generateReportId()` - Generate short ID
- `buildShareUrl()` - Build shareable URL
- `generateTwitterShareLink()` - Twitter intent URL
- `generateLinkedInShareLink()` - LinkedIn share URL
- `generateOGMetadata()` - Generate OG tags
- `generateEmbedCode()` - Generate embed HTML

### Config Models (`config.ts`)

**Core Types**:
- `Config` - Application configuration
- `SupabaseConfig` - Supabase connection settings
- `TelemetryEvent` - Anonymous telemetry event
- `FeatureFlags` - Feature toggles

**Classification**:
- `RuntimeEnvironment` - development/staging/production
- `TelemetryEventType` - 8 event types

**Constants**:
- `DEFAULT_CONFIG` - Default configuration values
- `ENV_MAPPINGS` - Environment variable mappings
- `SUPABASE_ENV_MAPPINGS` - Supabase env vars
- `DEFAULT_FEATURE_FLAGS` - Default feature flags

**Utilities**:
- `resolveConfig()` - Merge env + file config
- `getEnvValue()` - Read from environment
- `parseEnvBoolean()` - Parse boolean env var
- `validateSupabaseConfig()` - Validate Supabase setup

## Supabase Tables

### users
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | References auth.users |
| tier | text | FREE/PRO/PREMIUM/ENTERPRISE |
| analyses_this_month | int | Monthly usage counter |
| analyses_reset_at | timestamptz | Reset timestamp |
| organization_id | UUID | Enterprise org (optional) |
| created_at | timestamptz | |

### analyses
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | References users |
| session_id | text | Claude session ID |
| evaluation | jsonb | Full evaluation |
| type_result | jsonb | Coding style result |
| dimensions | jsonb | Six dimension scores |
| metadata | jsonb | Project info |
| created_at | timestamptz | |

### tracking_metrics
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| user_id | UUID | References users |
| date | date | Metric date |
| sessions_analyzed | int | Daily count |
| average_score | float | Daily average |
| dimension_scores | jsonb | Per-dimension averages |

### knowledge_items
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| title | text | Item title |
| content | text | Full content |
| category | text | TopicCategory enum |
| content_type | text | ContentType enum |
| tags | text[] | Search tags |
| source | jsonb | KnowledgeSource object |
| relevance | jsonb | Score + confidence |
| status | text | draft/approved/archived |
| created_at | timestamptz | |

### influencers
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| name | text | Full name |
| description | text | Bio/description |
| credibility_tier | text | high/medium/standard |
| identifiers | jsonb | PlatformIdentifier[] |
| expertise_topics | text[] | Topic tags |
| affiliation | text | Organization (optional) |
| content_count | int | Tracked content count |
| is_active | boolean | Active flag |
| added_at | timestamptz | |

### shared_reports
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| report_id | text | Short URL ID (8 chars) |
| access_level | text | public/protected/private |
| type_result | jsonb | TypeResult object |
| dimensions | jsonb | Dimensions object (optional) |
| view_count | int | Analytics |
| share_count | int | Share analytics |
| expires_at | timestamptz | Expiration (optional) |
| created_at | timestamptz | |

### jobs
| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| type | text | JobType enum |
| status | text | JobStatus enum |
| priority | text | low/normal/high/urgent |
| payload | jsonb | Type-specific input |
| result | jsonb | JobResult (on completion) |
| progress | jsonb | Current/total/message |
| retry_count | int | Retry attempts |
| created_at | timestamptz | |
| started_at | timestamptz | |
| completed_at | timestamptz | |

## Storage Locations

| Data | FREE | PRO | PREMIUM | ENTERPRISE |
|------|------|-----|---------|------------|
| Analyses | Local JSON | Local + Supabase | Local + Supabase | Local + Supabase |
| Tracking | N/A | N/A | Supabase | Supabase |
| Knowledge | N/A | N/A | Supabase | Supabase + custom |
| Shared Reports | Supabase | Supabase | Supabase | Supabase |

**Local Storage**: `~/.nomoreaislop/`
- `analyses/{session-id}.json` - Analysis results
- `config.json` - User configuration
- `knowledge/` - Cached knowledge items (PREMIUM)
- `influencers.json` - Tracked influencers (PREMIUM)
