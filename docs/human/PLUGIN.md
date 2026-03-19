# Claude Code Plugin

The BetterPrompt Claude Code Plugin is now the primary analysis entrypoint. It runs the pipeline locally inside Claude Code, queues auto-analysis across sessions, and can optionally sync finished runs to the BetterPrompt dashboard.

## How It Works

```
Developer uses Claude Code normally
            |
            v
    +-------------------+
    |  Session Ends      |
    |  (SessionEnd hook) |
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
    |  Mark Analysis     |
    |  Pending           |
    +--------+----------+
             |
             v
    +-------------------+
    |  Next SessionStart |
    |  injects `/bp-analyze`|
    +--------+----------+
             |
             +-->  Scan sessions (~/.claude/projects/, Cursor)
             +-->  Run local pipeline inside Claude Code
             +-->  Generate report
             +-->  Optionally sync to dashboard
             +-->  Mark analysis complete

    +-------------------+
    |  Next Conversation |
    |  MCP tools surface |
    |  synced insights   |--> Insights appear naturally
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

### 2. Session Hooks (Auto-Trigger)

Lightweight hooks run at `SessionEnd` and `SessionStart`. `SessionEnd` only evaluates debounce rules and marks analysis as pending; `SessionStart` injects queued BetterPrompt context so Claude Code can resume the local pipeline in-band.

**Debounce rules** (all must pass):

1. **Guard**: No analysis already in progress
2. **Duration**: The session that just ended was at least 3 minutes
3. **Cooldown**: At least 4 hours since the last analysis
4. **Threshold**: At least N new sessions since last analysis (default: 5)

This prevents over-analyzing short sessions or re-analyzing too frequently.

### 3. Local Analysis Pipeline

When Claude Code consumes the queued BetterPrompt context, the plugin:

1. Scans supported local session sources
2. Runs deterministic extraction and typed stage persistence
3. Executes the domain/type/content/translation skills inside Claude Code
4. Generates the local report and optionally syncs the canonical run to the dashboard

## Setup

See [Quick Start](../../README.md#quick-start-plugin) in the README for installation and configuration.

### Running the MCP Server Manually

```bash
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
| `plugin-state.json` | Debounce + lifecycle tracking (`idle/pending/running/complete/failed`) |
| `plugin-errors.log` | Hook and deprecation error log |

## For Team Managers

The plugin is designed for team deployment:

1. **Deploy the server** -- run the Next.js app on a shared machine
2. **Share the URL** -- team members set the BetterPrompt plugin `serverUrl` setting or pass `serverUrl` to `sync_to_team`
3. **Members install the plugin** -- each person installs BetterPrompt in Claude Code
4. **Insights flow automatically** -- members run local analysis; managers see synced team analytics on the enterprise dashboard

Each developer's analysis data flows to the shared server, where the enterprise dashboard aggregates it into team-level views (skill gaps, type distributions, growth patterns).

## Troubleshooting

**No insights appearing?**
- Check `~/.betterprompt/plugin-errors.log` for hook or sync errors
- Verify the server is running: `curl http://localhost:3000/api/auth/me`
- Check debounce state: `cat ~/.betterprompt/plugin-state.json`

**Analysis not triggering?**
- Debounce requires at least 5 sessions (configurable) and 4-hour cooldown
- Check if `analysisInProgress` is stuck `true` in state file -- delete the file to reset
- Ensure `autoAnalyze` is not disabled in plugin settings

**Cache stale?**
- Force refresh by deleting `~/.betterprompt/insight-cache.db`
- The MCP server will re-fetch from the server on next tool call
