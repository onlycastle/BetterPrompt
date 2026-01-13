# Search Agent Documentation

A multi-skill system for gathering, evaluating, and organizing AI engineering knowledge into a structured database.

## Overview

The Search Agent consists of **5 integrated skills** that process web content into curated knowledge:

```
Web Search Results → [Gatherer] → [Judge] → [Organizer] → Knowledge Database

Optional Skills:
  [Transcript] - Process YouTube videos
  [Discovery]  - Find influencers & content
```

## Architecture

### Directory Structure

```
src/search-agent/
├── index.ts              # Main exports & orchestration
├── models/               # Zod schemas (knowledge, relevance, influencer)
├── skills/               # Skill implementations
│   ├── base-skill.ts     # BaseSkill<Input, Output> abstract class
│   ├── gatherer/         # Content extraction & enhancement
│   ├── judge/            # Relevance evaluation
│   ├── organizer/        # Knowledge structuring & storage
│   ├── transcript/       # YouTube video processing
│   └── discovery/        # Influencer & content discovery
├── db/                   # Supabase database operations
├── storage/              # File-based storage (legacy)
└── influencers/          # Influencer management & detection
```

### BaseSkill Pattern

All skills extend `BaseSkill<TInput, TOutput>` with:
- LLM client management (Anthropic SDK)
- Exponential backoff retry logic
- Error handling with recovery strategies
- Structured output support
- Automatic execution time measurement

```typescript
interface SkillResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: { executionTimeMs: number; tokensUsed?: number };
}
```

## Skills Reference

| Skill | Purpose | Input | Output | Source |
|-------|---------|-------|--------|--------|
| **Gatherer** | Extract & enhance search results | `{ query, searchResults }` | `{ execution, enhancedResults }` | [`src/search-agent/skills/gatherer/index.ts`](../src/search-agent/skills/gatherer/index.ts) |
| **Judge** | Multi-dimensional relevance scoring | `{ results, existingKnowledge, minScore }` | `{ judgments, accepted, forReview, rejected, stats }` | [`src/search-agent/skills/judge/index.ts`](../src/search-agent/skills/judge/index.ts) |
| **Organizer** | Structure & persist knowledge items | `{ judgments, rawContents }` | `{ items, duplicatesSkipped, errors, categoryCounts }` | [`src/search-agent/skills/organizer/index.ts`](../src/search-agent/skills/organizer/index.ts) |
| **Transcript** | Process YouTube videos/playlists | `{ url, processPlaylist, maxPlaylistVideos }` | `{ results, errors, stats }` | [`src/search-agent/skills/transcript/index.ts`](../src/search-agent/skills/transcript/index.ts) |
| **Discovery** | Find influencers & content | `{ searchResults, query, topic }` | `{ discovered, influencerCandidates, stats }` | [`src/search-agent/skills/discovery/index.ts`](../src/search-agent/skills/discovery/index.ts) |

### Discovery Skill Deep Dive

The Discovery skill identifies potential influencers and high-quality content sources from search results.

#### Platform Support

| Platform | URL Detection | Author Extraction | Engagement Metrics |
|----------|---------------|-------------------|-------------------|
| **Twitter/X** | `x.com`, `twitter.com` | Handle from URL | Likes, retweets, bookmarks |
| **YouTube** | `youtube.com`, `youtu.be` | Channel ID/handle | Views, likes, comments |
| **GitHub** | `github.com` | Username from URL | Stars, forks, watchers |
| **Medium** | `medium.com` | Username from URL | Claps, responses |
| **Dev.to** | `dev.to` | Username from URL | Reactions, comments |
| **Personal Blogs** | Various domains | Author name extraction | N/A |

#### URL Parsing Utilities

Located in [`src/search-agent/models/platform-utils.ts`](../src/search-agent/models/platform-utils.ts):

```typescript
// Extract author ID from various platforms
parseYouTubeUrl(url) // → { type: 'channel' | 'video', id: string }
parseTwitterUrl(url) // → { username: string, tweetId?: string }
parseGitHubUrl(url)  // → { username: string, repo?: string }
parseMediumUrl(url)  // → { username: string, postId?: string }
```

#### Engagement Metrics

The Discovery skill extracts engagement data when available:

```typescript
interface EngagementMetrics {
  likes?: number;       // Twitter likes, YouTube likes
  shares?: number;      // Twitter retweets
  comments?: number;    // YouTube comments
  views?: number;       // YouTube views
  bookmarks?: number;   // Twitter bookmarks
  stars?: number;       // GitHub stars
  forks?: number;       // GitHub forks
}
```

#### Candidate Scoring Algorithm

Influencer candidates are scored based on:

1. **Content Relevance** (40%) - Topic alignment with AI engineering
2. **Engagement Signal** (30%) - Likes, shares, comments normalized by platform
3. **Content Consistency** (20%) - Frequency of appearances in search results
4. **Source Authority** (10%) - Domain credibility, verified status

Formula:
```
score = (relevance * 0.4) + (engagement_normalized * 0.3) + (consistency * 0.2) + (authority * 0.1)
```

Thresholds:
- `score >= 0.7` - High potential influencer
- `0.4 <= score < 0.7` - Worth monitoring
- `score < 0.4` - Not recommended

#### Discovery Output

```typescript
interface DiscoveryResult {
  discovered: {
    totalAuthors: number;
    uniquePlatforms: string[];
    potentialInfluencers: number;
  };
  influencerCandidates: Array<{
    name: string;
    handles: Array<{ platform: string; handle: string }>;
    score: number;
    reasoning: string;
    suggestedTier: 'high' | 'medium' | 'standard';
    engagement: EngagementMetrics;
    contentSamples: string[];  // URLs to representative content
  }>;
  stats: {
    urlsParsed: number;
    authorsExtracted: number;
    engagementDataFound: number;
  };
}
```

## Judge Evaluation Criteria

The Judge evaluates content across **5 dimensions**:

| Dimension | Weight | Description |
|-----------|--------|-------------|
| Topic Relevance | 25% | Relevance to AI engineering |
| Project Fit | 25% | Applicable to NoMoreAISlop goals |
| Actionability | 20% | Provides practical guidance |
| Novelty | 15% | New insights vs. existing knowledge |
| Credibility | 15% | Source trustworthiness |

Overall score: `0-1` weighted average. Recommendation: `accept (≥0.7)`, `review (0.4-0.7)`, `reject (<0.4)`.

See [`src/search-agent/skills/judge/criteria.ts`](../src/search-agent/skills/judge/criteria.ts) for complete criteria.

## Knowledge Taxonomy

8 main categories + "other":

- **context-engineering** - Managing AI context windows
- **claude-code-skills** - Claude Code features & plugins
- **subagents** - Multi-agent orchestration
- **memory-management** - AI memory & persistence
- **prompt-engineering** - Effective prompting
- **tool-use** - Function calling & tools
- **workflow-automation** - Development automation
- **best-practices** - General collaboration patterns

## Core Data Models

### KnowledgeItem
```typescript
{
  id: string;                    // UUID
  title: string;                 // 10-200 chars
  summary: string;               // 50-1000 chars
  content: string;               // 100-10000 chars
  category: TopicCategory;
  contentType: ContentType;      // technique, pattern, tool, etc.
  tags: string[];                // 1-10 tags
  source: {
    platform: SourcePlatform;    // web, twitter, reddit, youtube
    url: string;
    author?: string;
    credibilityTier?: 'high' | 'medium' | 'standard';
  };
  relevance: {
    score: number;               // 0-1
    confidence: number;           // 0-1
    reasoning: string;
  };
  status: 'draft' | 'reviewed' | 'approved' | 'archived';
}
```

### Influencer
```typescript
{
  id: string;
  name: string;
  handles: Array<{ platform: string; handle: string }>;
  credibilityTier: 'high' | 'medium' | 'standard';
  topicsOfInterest: string[];
}
```

See [`src/search-agent/models/`](../src/search-agent/models/) for complete definitions.

## Professional Insights System

The Search Agent includes a Professional Insights system that provides curated tips for developers based on their analysis results. These insights are sourced from verified research and industry experts.

### Insight Categories

| Category | Purpose |
|----------|---------|
| `diagnosis` | Help users understand their current AI usage state |
| `trend` | Latest industry best practices |
| `type-specific` | Advice for specific coding styles |
| `tool` | Tool and workflow tips |

### Insight Sources

| Source Type | Description |
|-------------|-------------|
| `x-post` | Twitter/X posts |
| `arxiv` | Academic papers |
| `blog` | Blog posts |
| `research` | Research studies |
| `official` | Official documentation |

### ProfessionalInsight Schema

```typescript
interface ProfessionalInsight {
  id: string;
  version: '1.0.0';
  category: InsightCategory;
  title: string;
  keyTakeaway: string;
  actionableAdvice: string[];
  source: {
    type: InsightSourceType;
    url: string;
    author: string;
    engagement?: { likes?: number; bookmarks?: number; retweets?: number };
    verifiedAt?: string;
  };
  applicableStyles?: CodingStyleType[];
  applicableControlLevels?: AIControlLevel[];
  applicableDimensions?: string[];
  minScore?: number;
  maxScore?: number;
  priority: number;
  enabled: boolean;
}
```

### Initial Insights (10 pre-built)

The system includes 10 verified insights:

1. **Skill Atrophy Self-Diagnosis** (VCP Paper) - Warns about skill decay from AI over-reliance
2. **The 50% Modification Test** - Professional devs modify ~50% of AI code
3. **New Skill Layer: Context Engineering** (Karpathy) - Vibe coding as a new skill layer
4. **The 80% Planning Rule** - Top devs spend 80% planning, 20% executing
5. **For Speedrunners: Quick Verification** - 30-second sanity checks
6. **Anthropic Context Engineering Techniques** - Compaction, Sub-agents, JIT retrieval
7. **For Architects: Validate Against Your Plans** - Use plans as checkpoints
8. **For Scientists: Inverted TDD** - Write tests first, let AI implement
9. **AI Dependency Checklist** - Self-assessment for learned helplessness
10. **From Vibe Coding to Context Engineering** (MIT Tech Review) - 2025 paradigm shift

### Insight Applicability

Insights are filtered based on:
- `applicableStyles` - Which coding style types (architect, scientist, etc.)
- `applicableControlLevels` - Which control levels (vibe-coder, developing, ai-master)
- `applicableDimensions` - Which dimension scores trigger the insight
- `minScore` / `maxScore` - Score range filters

## Main API

### Orchestration

```typescript
import { learn, searchKnowledge } from '@/search-agent';

// Run full Gatherer → Judge → Organizer pipeline
const result = await learn(searchResults, { minScore: 0.7 });
console.log(`Organized ${result.summary.totalOrganized} items`);

// Search knowledge base
const items = await searchKnowledge('context engineering', limit);
```

### Database Operations

```typescript
import { knowledgeDb, influencerDb } from '@/search-agent';

// Knowledge operations
await knowledgeDb.save(item);
const results = await knowledgeDb.search({ query, category }, { limit, sortBy });
const stats = await knowledgeDb.getStats();
const metrics = await knowledgeDb.getQualityMetrics();

// Influencer operations
await influencerDb.save(influencer);
const influencer = await influencerDb.findByHandle(handle, platform);
```

### Advanced Search

```typescript
import { searchKnowledgeAdvanced } from '@/search-agent';

const items = await searchKnowledgeAdvanced({
  query?: string;
  platform?: SourcePlatform;
  category?: TopicCategory;
  author?: string;
  minScore?: number;
  limit?: number;
  sortBy?: 'relevance' | 'date';
});
```

### YouTube Processing

```typescript
import { learnFromYouTube } from '@/search-agent';

const result = await learnFromYouTube(url, {
  processPlaylist?: boolean;
  maxPlaylistVideos?: 10;
});
console.log(`Processed ${result.data?.stats.videosProcessed} videos`);
```

### Influencer Management

```typescript
import { getInfluencerRegistry, getInfluencerDetector } from '@/search-agent';

const registry = getInfluencerRegistry();
registry.getAll();
registry.findByName('Author Name');
await registry.add({ name, credibilityTier, handles, topicsOfInterest });

const detector = getInfluencerDetector();
const { found, influencer, credibilityBoost } = await detector.detect(url, author, handle, platform);
```

## Configuration

All skills accept `SkillConfig`:

```typescript
interface SkillConfig {
  apiKey?: string;              // ANTHROPIC_API_KEY env default
  model?: string;               // claude-sonnet-4-20250514 default
  maxRetries?: number;          // 2 default
}

interface LearnConfig extends SkillConfig {
  minScore?: number;            // 0.7 default
  includeForReview?: boolean;   // false default
}
```

## Error Handling

```typescript
import { SkillError } from '@/search-agent';

try {
  const result = await skill.execute(input);
  if (!result.success) throw new Error(result.error);
} catch (error) {
  if (error instanceof SkillError) {
    console.log(`Code: ${error.code}`);
    console.log(`Retryable: ${error.retryable}`);
  }
}
```

Common error codes: `NO_API_KEY`, `AUTH_ERROR`, `PARSE_ERROR`, `MAX_RETRIES_EXCEEDED`, `RATE_LIMIT_ERROR`.

## Best Practices

1. **Full Pipeline** - Use `learn()` for web content instead of individual skills
2. **Batch Large Datasets** - Gatherer batches 3 at a time with 500ms delays; use delays between batches
3. **Influencer Detection** - Set up registry first; Judge automatically applies credibility boost
4. **Advanced Search** - Use filters for precise queries
5. **Monitor Quality** - Check `getQualityMetrics()` to adjust `minScore` thresholds
6. **Transcript Chunking** - Long videos (>6000 chars) auto-chunked; configure `maxPlaylistVideos`

## Extending

### Creating a Custom Skill

```typescript
import { BaseSkill, SkillResult, SkillConfig } from '@/search-agent';

class MySkill extends BaseSkill<MyInput, MyOutput> {
  readonly name = 'my-skill';
  readonly description = 'Does something useful';

  async execute(input: MyInput): Promise<SkillResult<MyOutput>> {
    try {
      const result = await this.callLLM('System prompt', 'User prompt');
      return { success: true, data: { /* ... */ }, metadata: { executionTimeMs: 100 } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }
}

export function createMySkill(config?: SkillConfig): MySkill {
  return new MySkill(config);
}
```

### Adding a Category

1. Update `TopicCategorySchema` in [`src/search-agent/models/knowledge.ts`](../src/search-agent/models/knowledge.ts)
2. Add taxonomy node in [`src/search-agent/skills/organizer/`](../src/search-agent/skills/organizer/)
3. Update Judge criteria in [`src/search-agent/skills/judge/criteria.ts`](../src/search-agent/skills/judge/criteria.ts)

## Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Low accept rate | Threshold too high or irrelevant results | Lower `minScore` or improve search queries |
| Many duplicates | Items already in database | Archive old items or refresh periodically |
| Rate limiting | Too many LLM calls | Increase delays, reduce batch sizes |
| High failure rate | API/parse issues | Check error code; enable retries |

## Related Documentation

- [Architecture Overview](./ARCHITECTURE.md) - System design
- [Data Models](./DATA_MODELS.md) - Type definitions
- [Project README](../README.md) - High-level overview
