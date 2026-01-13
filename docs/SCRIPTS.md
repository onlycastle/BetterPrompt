# Scripts Reference

CLI scripts for development, analysis, and knowledge management. Execute with `npx tsx scripts/<name>.ts`.

## Quick Reference

| Script | Purpose | Key Options | Example |
|--------|---------|------------|---------|
| **analyze-style.ts** | Analyze Claude Code sessions for AI collaboration coding style | (none) | `npx tsx scripts/analyze-style.ts` |
| **start-ui.ts** | Start API (3001) and React UI (3000) concurrently | (none) | `npm run ui` |
| **browse-knowledge.ts** | Search/filter knowledge base | `--platform`, `--category`, `--author`, `--min-score`, `--query`, `--limit`, `--sort`, `--stats`, `--metrics`, `--json` | `npx tsx scripts/browse-knowledge.ts --platform youtube --min-score 0.7` |
| **populate-knowledge.ts** | Seed knowledge base with curated content | (none) | `npx tsx scripts/populate-knowledge.ts` |
| **learn.ts** | Process search results into knowledge items | `<file>`, `--mock` | `npx tsx scripts/learn.ts results.json` |
| **manage-influencers.ts** | CRUD for influencer registry | `list`, `add`, `remove`, `search`, `stats`, `reset`, `export` | `npx tsx scripts/manage-influencers.ts add --name "Name" --tier medium --topics "AI,coding"` |
| **discover-influencers.ts** | Discover influencers from search results | `queries`, `analyze`, `candidates`, `add-candidate`, `help` | `npx tsx scripts/discover-influencers.ts queries --topic vibe-coding` |
| **evaluate-criteria.ts** | Evaluate knowledge base criteria fitness | `current`, `analyze`, `gaps`, `report`, `suggest` | `npx tsx scripts/evaluate-criteria.ts report` |
| **learn-youtube.ts** | Process YouTube video/playlist transcripts | `<url>`, `--playlist`, `--max-videos N` | `npx tsx scripts/learn-youtube.ts "https://youtube.com/watch?v=..."` |
| **migrate-to-supabase.ts** | Migrate local JSON data to Supabase | (none) | `npx tsx scripts/migrate-to-supabase.ts` |
| **test-supabase.ts** | Test Supabase connection | (none) | `npx tsx scripts/test-supabase.ts` |

## Script Details

### analyze-style.ts
Scans `~/.claude/projects/` for Claude Code sessions, analyzes last 30 sessions for patterns, calculates AI collaboration style type with 8+ dimensions, and generates interactive web report at http://localhost:3000.

**Output:** CLI summary with ratings and evidence + interactive web report

**See** [`scripts/analyze-style.ts`](scripts/analyze-style.ts)

### start-ui.ts
Starts Node.js API and React development server concurrently. Waits 2 seconds for API initialization before starting web server. Auto-opens browser.

**Ports:** API:3001, Web:3000

**See** [`scripts/start-ui.ts`](scripts/start-ui.ts)

### browse-knowledge.ts
Interactive CLI for searching/filtering knowledge base by platform (reddit, twitter, youtube, linkedin, web), category, author, score range, and text query.

**Options:** `--platform`, `--category`, `--author`, `--min-score`, `--query`, `--limit`, `--sort` (relevance/date/score), `--stats`, `--metrics`, `--json`

**See** [`scripts/browse-knowledge.ts`](scripts/browse-knowledge.ts)

### populate-knowledge.ts
Seeds knowledge base with predefined curated content (Anthropic guides, LangChain, HumanLayer, Shipyard, MIT Tech Review). Checks for duplicates by URL, reports save results.

**See** [`scripts/populate-knowledge.ts`](scripts/populate-knowledge.ts)

### learn.ts
Processes JSON search results through gathering → judging → organizing pipeline. Normalizes content, evaluates relevance, categorizes, and saves to knowledge base. Supports `--mock` flag for testing.

**Input format:** JSON array with `url`, `title`, `content`, `publishedAt`

**See** [`scripts/learn.ts`](scripts/learn.ts)

### manage-influencers.ts
Manage influencer registry (AI thought leaders).

**Commands:** `list`, `stats`, `add`, `remove`, `search`, `reset`, `export`

**Add options:** `--name` (required), `--tier` (high/medium/standard), `--twitter`, `--youtube`, `--linkedin`, `--github`, `--topics` (comma-separated, required), `--affiliation`, `--description`

**See** [`scripts/manage-influencers.ts`](scripts/manage-influencers.ts)

### discover-influencers.ts
Discover new influencers from social media using search results.

**Commands:** `queries --topic` (vibe-coding/context-engineering/claude-code/general), `analyze --file`, `candidates`, `add-candidate "<name>" --handle --tier`, `help`

**Workflow:** Get queries → Execute WebSearch → Save results → Analyze → Review candidates → Add to registry

**See** [`scripts/discover-influencers.ts`](scripts/discover-influencers.ts)

### evaluate-criteria.ts
Analyze knowledge base to evaluate relevance criteria fitness.

**Commands:** `current` (show criteria definitions and weights), `analyze` (coverage/variance), `gaps` (missing topics/signals), `report` (generate JSON report), `suggest` (TypeScript code snippets for improvements)

**Output:** JSON reports saved to `~/.nomoreaislop/reports/`

**See** [`scripts/evaluate-criteria.ts`](scripts/evaluate-criteria.ts)

### learn-youtube.ts
Fetches and analyzes YouTube video transcripts for AI engineering insights.

**Features:**
- Single video or full playlist processing
- Transcript extraction and analysis
- Relevance scoring with configurable threshold (default: 0.3)
- Auto-saves to knowledge base

**Options:**
- `<url>` (required) - YouTube video or playlist URL
- `--playlist` - Process all videos in a playlist
- `--max-videos N` - Limit number of videos (default: 10)

**Output:** Video info, key insights, topics, code examples, timestamps

**See** [`scripts/learn-youtube.ts`](scripts/learn-youtube.ts)

### migrate-to-supabase.ts
Migrates JSON-based local data to Supabase PostgreSQL.

**Migrates:**
- Knowledge items from `~/.nomoreaislop/knowledge/items/`
- Influencers from `~/.nomoreaislop/influencers.json`
- Influencer identifiers (platform handles)

**Process:**
1. Tests Supabase connection
2. Reads local JSON files
3. Transforms to Supabase format
4. Inserts with duplicate handling

**Output:** Migration stats, errors, summary

**See** [`scripts/migrate-to-supabase.ts`](scripts/migrate-to-supabase.ts)

### test-supabase.ts
Simple connection test for Supabase setup.

**Validates:**
- SUPABASE_URL environment variable
- SUPABASE_SERVICE_ROLE_KEY environment variable
- knowledge_items table access
- influencers table access

**Output:** Connection status, table accessibility

**See** [`scripts/test-supabase.ts`](scripts/test-supabase.ts)

## Storage Locations

```
~/.nomoreaislop/
├── knowledge/          # Knowledge base items
├── analyses/           # Analysis results
├── discovery/          # Discovery session storage
├── reports/            # Evaluation reports
├── influencers.json    # Influencer registry
└── config.json         # Configuration
```

## Tips

**Direct Execution:** `chmod +x scripts/script.ts && ./scripts/script.ts`

**Debug Output:** `DEBUG=nomoreaislop:* npx tsx scripts/analyze-style.ts`

**Mock Data:** Scripts support `--mock` flag for testing without external dependencies

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `ANTHROPIC_API_KEY` | Required for analysis | (required) |
| `NOSLOP_MODEL` | Override analysis model | claude-sonnet-4-20250514 |
| `NOSLOP_TELEMETRY` | Enable/disable telemetry | enabled |
| `SUPABASE_URL` | Supabase project URL (for migration/test) | (optional) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (for migration/test) | (optional) |

## Common Workflows

**Analyze Coding Style:**
```bash
npx tsx scripts/analyze-style.ts
# Opens http://localhost:3000 automatically
```

**Build Knowledge Base:**
```bash
npx tsx scripts/populate-knowledge.ts
npx tsx scripts/browse-knowledge.ts --stats
npx tsx scripts/discover-influencers.ts queries --topic vibe-coding
# Execute WebSearch in Claude Code, save results
npx tsx scripts/discover-influencers.ts analyze --file results.json
npx tsx scripts/discover-influencers.ts candidates
npx tsx scripts/discover-influencers.ts add-candidate "Name" --handle handle --tier medium
npx tsx scripts/evaluate-criteria.ts report
```

**Start Development Server:**
```bash
npm run ui
# Or: npm run api (Terminal 1) + npm run ui:web (Terminal 2)
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Script not found | Ensure project root: `cd /path/to/nomoreaislop` |
| Permission denied | `chmod +x scripts/*.ts` |
| Port 3000/3001 in use | `lsof -ti:3000 \| xargs kill -9` |
| Knowledge base empty | `npx tsx scripts/populate-knowledge.ts` |
| No sessions found | Use Claude Code first; sessions stored in `~/.claude/projects/` |
