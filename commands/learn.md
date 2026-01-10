---
allowed-tools: Bash(npx tsx:*), WebSearch, WebFetch
description: Gather and organize AI engineering knowledge from web sources
---

# Learn - Knowledge Gathering Pipeline

Gather AI engineering knowledge from web sources and organize it into the knowledge base.

## Process

This command runs a multi-step pipeline:

1. **Search** - Use WebSearch to find relevant content about AI engineering topics
2. **Gather** - Process and extract metadata from search results
3. **Judge** - Evaluate relevance and quality using multi-dimension scoring
4. **Organize** - Transform accepted content into structured knowledge items

## Usage

First, search for relevant content using WebSearch, then pass the results to the learning pipeline.

### Step 1: Search for Knowledge

Search for content about AI engineering topics like:
- Context engineering
- Claude Code skills and hooks
- Subagent orchestration
- Memory management
- Prompt engineering best practices

Use WebSearch to find recent, high-quality content from sources like:
- Reddit (r/ClaudeAI, r/LocalLLaMA)
- Twitter/X posts from AI practitioners
- Blog posts and documentation
- GitHub discussions

### Step 2: Run the Pipeline

After gathering search results, save them to a JSON file and run:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/learn.ts <results-file.json>
```

Or use mock data for testing:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/learn.ts --mock
```

## Search Result Format

Save WebSearch results as JSON with this structure:

```json
[
  {
    "url": "https://example.com/article",
    "title": "Article Title",
    "content": "Full content text...",
    "publishedAt": "2025-01-01T00:00:00Z"
  }
]
```

## Output

The pipeline will:
- Display progress for each stage
- Show how many items were gathered, judged, and organized
- Report any duplicates skipped or errors encountered
- Display the newly created knowledge items
- Show updated knowledge base statistics
