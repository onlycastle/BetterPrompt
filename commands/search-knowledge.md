---
allowed-tools: Bash(npx tsx:*)
description: Search the local AI engineering knowledge base
---

# Search Knowledge Base

Search the curated knowledge base for AI engineering information.

## Usage

Search by query:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/search-knowledge.ts "$ARGUMENTS"
```

Show top-rated items:

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/search-knowledge.ts --top --limit 10
```

## Options

- `<query>` - Search terms to find relevant knowledge
- `--limit N` - Maximum number of results (default: 10)
- `--top` - Show top-rated items instead of searching

## Examples

```bash
# Search for context engineering knowledge
npx tsx scripts/search-knowledge.ts "context engineering"

# Search for CLAUDE.md patterns
npx tsx scripts/search-knowledge.ts "CLAUDE.md" --limit 5

# Show top 10 highest-rated items
npx tsx scripts/search-knowledge.ts --top --limit 10
```

## Output

For each matching item, displays:
- Title and source URL
- Category and content type
- Tags
- Relevance score
- Status (draft/reviewed/approved)
- Summary excerpt
