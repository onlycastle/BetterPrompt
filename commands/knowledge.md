---
allowed-tools: Bash(npx tsx:*)
description: Browse and manage the AI engineering knowledge base
---

# Knowledge Base Management

Browse, view, and manage the curated AI engineering knowledge base.

## Usage

```bash
npx tsx /Users/sungmancho/projects/nomoreaislop/scripts/knowledge.ts $ARGUMENTS
```

## Commands

### List Items

List all knowledge items or filter by category:

```bash
# List all items
npx tsx scripts/knowledge.ts list

# List by category
npx tsx scripts/knowledge.ts list --category context-engineering
npx tsx scripts/knowledge.ts list --category claude-code-skills
```

### Show Item Details

View full details of a specific item by ID (or partial ID):

```bash
npx tsx scripts/knowledge.ts show <id>
```

### Statistics

Show knowledge base statistics:

```bash
npx tsx scripts/knowledge.ts stats
```

### Export

Export the knowledge base to markdown or JSON:

```bash
# Export as markdown (default)
npx tsx scripts/knowledge.ts export

# Export as JSON
npx tsx scripts/knowledge.ts export --format json
```

## Categories

Available categories:
- `context-engineering` - Context window management techniques
- `claude-code-skills` - Skills, hooks, and commands
- `subagents` - Multi-agent orchestration
- `memory-management` - AI memory patterns
- `prompt-engineering` - Prompting techniques
- `tool-use` - Tool integration patterns
- `workflow-automation` - Workflow automation
- `best-practices` - General best practices
