# Search Agent Module

> Gather, evaluate, and organize AI engineering knowledge

The search-agent module extends BetterPrompt with capabilities to collect knowledge from web sources (Reddit, X/Twitter, blogs) about AI engineering topics and organize it into a searchable knowledge base.

## Architecture

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Gatherer   │───▶│    Judge     │───▶│  Organizer   │
│    Skill     │    │    Skill     │    │    Skill     │
└──────────────┘    └──────────────┘    └──────────────┘
       │                   │                   │
       ▼                   ▼                   ▼
   WebSearch          Multi-dim           Knowledge
   + Extract          Scoring             Store
```

## Skills

### GathererSkill

Collects information from web sources and extracts metadata.

```typescript
import { createGatherer, createSearchQuery } from './search-agent';

const gatherer = createGatherer();
const result = await gatherer.execute({
  query: createSearchQuery(['context engineering', 'Claude Code']),
  searchResults: [...], // From WebSearch tool
});
```

**Extracts:**
- Main topic category
- Key insights
- Code snippets
- Referenced tools

### JudgeSkill

Evaluates content relevance using multi-dimension scoring.

```typescript
import { createJudge } from './search-agent';

const judge = createJudge();
const result = await judge.execute({
  results: enhancedSearchResults,
  existingKnowledge: existingSummaries, // For novelty check
});
```

**Dimensions:**
- Topic relevance (0.25)
- Project fit (0.25)
- Actionability (0.20)
- Novelty (0.15)
- Credibility (0.15)

**Recommendations:**
- `accept` (score >= 0.7)
- `review` (0.4 <= score < 0.7)
- `reject` (score < 0.4)

### OrganizerSkill

Transforms judged content into structured knowledge items.

```typescript
import { createOrganizer } from './search-agent';

const organizer = createOrganizer();
const result = await organizer.execute({
  judgments: acceptedJudgments,
  rawContents: contentMap,
});
```

## Knowledge Storage

Knowledge is persisted to `~/.betterprompt/knowledge/`:

```
~/.betterprompt/knowledge/
├── index.json          # Category index
└── items/
    ├── {uuid}.json     # Individual items
    └── ...
```

### KnowledgeItem Schema

```typescript
interface KnowledgeItem {
  id: string;           // UUID
  title: string;        // 10-200 chars
  summary: string;      // 50-1000 chars
  content: string;      // 100-10000 chars
  category: TopicCategory;
  contentType: ContentType;
  tags: string[];
  source: {
    platform: 'reddit' | 'twitter' | 'threads' | 'web';
    url: string;
    fetchedAt: string;
  };
  relevance: {
    score: number;      // 0-1
    confidence: number; // 0-1
    reasoning: string;
  };
  status: 'draft' | 'reviewed' | 'approved' | 'archived';
}
```

## Topic Categories

| Category | Description |
|----------|-------------|
| `context-engineering` | Context window management techniques |
| `claude-code-skills` | Skills, hooks, and commands |
| `subagents` | Multi-agent orchestration |
| `memory-management` | AI memory patterns |
| `prompt-engineering` | Prompting techniques |
| `tool-use` | Tool integration patterns |
| `workflow-automation` | Workflow automation |
| `best-practices` | General best practices |

## Usage

### Full Pipeline

```typescript
import { learn } from './search-agent';

const result = await learn(searchResults, {
  includeForReview: false,
});

console.log(`Organized ${result.summary.totalOrganized} items`);
```

### Search Knowledge

```typescript
import { searchKnowledge, getTopKnowledge } from './search-agent';

// Search by query
const items = await searchKnowledge('context engineering');

// Get top-rated items
const topItems = await getTopKnowledge(10);
```

### Knowledge Stats

```typescript
import { getKnowledgeStats } from './search-agent';

const stats = await getKnowledgeStats();
console.log(`Total items: ${stats.totalItems}`);
console.log(`By category:`, stats.byCategory);
```

## CLI Commands

```bash
# Run learning pipeline with mock data
npx tsx scripts/learn.ts --mock

# Search knowledge base
npx tsx scripts/search-knowledge.ts "context engineering"

# Show top items
npx tsx scripts/search-knowledge.ts --top

# List all items
npx tsx scripts/knowledge.ts list

# Show item details
npx tsx scripts/knowledge.ts show <id>

# Show statistics
npx tsx scripts/knowledge.ts stats

# Export to markdown
npx tsx scripts/knowledge.ts export --format md
```

## Slash Commands

| Command | Description |
|---------|-------------|
| `/betterprompt:learn` | Run the knowledge gathering pipeline |
| `/betterprompt:search-knowledge <query>` | Search the knowledge base |
| `/betterprompt:knowledge [cmd]` | Browse and manage knowledge |

## Integration with Analysis

Knowledge items can enrich BetterPrompt analysis recommendations:

```typescript
import { searchKnowledge } from './search-agent';
import { analyzeSession } from '../index';

// After analysis, find relevant knowledge
const knowledge = await searchKnowledge(
  evaluation.recommendations.join(' '),
  3
);

// Enrich recommendations with knowledge links
```
