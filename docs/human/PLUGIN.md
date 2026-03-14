# Claude Code Plugin

The BetterPrompt Claude Code Plugin turns manual analysis into an automated, embedded developer experience. Instead of running `npx betterprompt-cli` after each session, the plugin handles everything -- analyzing sessions in the background and surfacing personalized insights directly inside Claude Code conversations.

## How It Works

```
Developer uses Claude Code normally
            |
            v
    +-------------------+
    |  Session Ends      |
    |  (stop hook fires) |
    +--------+----------+
             |
             v
    +-------------------+     NO     +----------+
    |  Debounce Check    |---------->|  Exit     |
    |  (4 rules)         |           |  silently |
    +--------+----------+           +----------+
             | YES
             v
    +-------------------+
    |  Spawn Background  |  (detached process)
    |  Analyzer          |
    +--------+----------+
             |
             +-->  Scan sessions (~/.claude/projects/)
             +-->  Upload to server for analysis
             +-->  Refresh local insight cache
             +-->  Mark analysis complete

    +-------------------+
    |  Next Conversation |
    |  Claude Code calls |
    |  MCP tools         |--> Insights appear naturally
    +-------------------+     in conversation context
```

## Architecture

The plugin has three subsystems that work together:

### 1. MCP Server (Insight Delivery)

An MCP server communicates with Claude Code over stdio, exposing three tools that Claude can call proactively:

| Tool | What It Returns |
|------|----------------|
| `get_developer_profile` | Your AI collaboration type (e.g., "Architect/Navigator"), domain scores, personality summary |
| `get_growth_areas` | Top areas for improvement with actionable recommendations, filterable by domain |
| `get_recent_insights` | Strengths, anti-patterns, or Keep/Problem/Try summary |

Claude Code calls these tools during conversations when relevant -- for example, suggesting you try a different approach based on your growth areas, or acknowledging your strengths.

**Data source**: Tools read from a local SQLite cache (`~/.betterprompt/insight-cache.db`) that refreshes from the server every 24 hours or after each analysis. If the server is unreachable, stale cached data is served.

### 2. Post-Session Hook (Auto-Trigger)

A lightweight hook runs after each Claude Code session ends. It must complete in under 100ms, so it only checks debounce rules and spawns a background process if analysis is warranted.

**Debounce rules** (all must pass):

1. **Guard**: No analysis already in progress
2. **Duration**: The session that just ended was at least 3 minutes
3. **Cooldown**: At least 4 hours since the last analysis
4. **Threshold**: At least N new sessions since last analysis (default: 5)

This prevents over-analyzing short sessions or re-analyzing too frequently.

### 3. Background Analyzer (Heavy Lifting)

When the hook decides to analyze, it spawns a fully detached Node.js process that:

1. Scans session files from `~/.claude/projects/` (reuses the CLI scanner)
2. Uploads sessions to the server for LLM analysis (reuses the CLI uploader)
3. Refreshes the local insight cache with fresh results
4. Updates the debounce state file

This process runs independently -- it doesn't block Claude Code and continues even if you close your terminal.

## Setup

### Prerequisites

- A running BetterPrompt server (local: `npm run dev`, or team-hosted)
- Node.js 18+

### 1. Build the Plugin

```bash
cd packages/plugin
npm install
npm run build
```

### 2. Register with Claude Code

Add the MCP server to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "betterprompt": {
      "command": "node",
      "args": ["/absolute/path/to/BetterPrompt/packages/plugin/dist/mcp/server.js"],
      "env": {
        "BETTERPROMPT_SERVER_URL": "http://localhost:3000"
      }
    }
  }
}
```

Replace `/absolute/path/to/BetterPrompt` with the actual path where you cloned the repo.

### Configuration

The plugin reads from environment variables:

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTERPROMPT_SERVER_URL` | No | `http://localhost:3000` | Your server URL |
| `BETTERPROMPT_AUTO_ANALYZE` | No | `true` | Enable/disable auto-analysis |
| `BETTERPROMPT_ANALYZE_THRESHOLD` | No | `5` | Sessions before auto-trigger |

### Running the MCP Server Manually

```bash
export BETTERPROMPT_SERVER_URL=http://localhost:3000

node packages/plugin/dist/mcp/server.js
```

The server accepts JSON-RPC over stdin/stdout. Use the [MCP Inspector](https://github.com/modelcontextprotocol/inspector) to test tools interactively:

```bash
npx @modelcontextprotocol/inspector node packages/plugin/dist/mcp/server.js
```

## Local Data

All plugin state lives under `~/.betterprompt/`:

| File | Purpose |
|------|---------|
| `insight-cache.db` | SQLite cache of analysis summaries (24h TTL) |
| `plugin-state.json` | Debounce tracking (last analysis time, session count, in-progress flag) |
| `plugin-errors.log` | Background analyzer error log |

## For Team Managers

The plugin is designed for team deployment:

1. **Deploy the server** -- run the Next.js app on a shared machine
2. **Share the URL** -- team members set `BETTERPROMPT_SERVER_URL`
3. **Members install the plugin** -- each person registers the MCP server in their Claude Code settings
4. **Insights flow automatically** -- members get personal insights; managers see team-wide analytics on the enterprise dashboard

Each developer's analysis data flows to the shared server, where the enterprise dashboard aggregates it into team-level views (skill gaps, type distributions, growth patterns).

## Troubleshooting

**No insights appearing?**
- Check `~/.betterprompt/plugin-errors.log` for background analyzer errors
- Verify the server is running: `curl http://localhost:3000/api/auth/me`
- Check debounce state: `cat ~/.betterprompt/plugin-state.json`

**Analysis not triggering?**
- Debounce requires at least 5 sessions (configurable) and 4-hour cooldown
- Check if `analysisInProgress` is stuck `true` in state file -- delete the file to reset
- Ensure `autoAnalyze` is not disabled

**Cache stale?**
- Force refresh by deleting `~/.betterprompt/insight-cache.db`
- The MCP server will re-fetch from the server on next tool call
