# BetterPrompt

> AI coding session analysis that runs entirely inside your AI coding tool. No API keys. No server. Just install the plugin and ask for your report.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

**How it works:** BetterPrompt is a Claude Code plugin. It scans your session logs, extracts metrics deterministically, then uses Claude (the model you're already paying for) to analyze your collaboration patterns across 5 domains: thinking quality, communication, learning behavior, context efficiency, and session outcomes. Results are served as a standalone HTML report on localhost.

No separate server. No Gemini API key. No data leaves your machine.

**Supported AI coding tools:**

| Tool | Session Source | Format |
|------|---------------|--------|
| Claude Code | `~/.claude/projects/` | JSONL |

## Screenshots

| Team Dashboard | Growth Areas | Project Breakdown |
|:-:|:-:|:-:|
| ![Team Dashboard](images/team_dashboard.png) | ![Growth Areas](images/team_problem.png) | ![Projects](images/team_projects.png) |

## Quick Start (Plugin)

The recommended way to use BetterPrompt. Zero configuration required.

### 1. Install the plugin

In any Claude Code session, run:

```
/plugin marketplace add onlycastle/BetterPrompt
/plugin install betterprompt@betterprompt
```

That's it. The MCP server, analysis skills, and post-session hooks are registered automatically.

### 2. Run your analysis

In any Claude Code session, say:

> "Analyze my coding sessions and generate a report"

Claude will call the MCP tools in sequence -- scan sessions, extract data, analyze each domain, classify your type, and serve a report at `http://localhost:3456`.

## Alternative: Server + CLI

For teams or if you prefer a web dashboard, you can still use the traditional server-based approach.

### Prerequisites

- [Node.js 18+](https://nodejs.org/)
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier works)
- Existing AI coding sessions

### Setup

```bash
git clone https://github.com/onlycastle/BetterPrompt.git
cd BetterPrompt
npm install
cp .env.example .env
# Add GOOGLE_GEMINI_API_KEY to .env
npm run dev
```

Then in a separate terminal:

```bash
npx betterprompt-cli
```

The CLI discovers sessions, uploads parsed data to your local server, and opens your report at `http://localhost:3000/dashboard/r/{resultId}`.

## Packages

This is a monorepo with three packages:

### Plugin (`packages/plugin`) -- Primary

Claude Code plugin with local-first analysis. Provides MCP tools for the full pipeline and analysis skills that guide Claude through each domain.

**MCP Tools (local-first, no server needed):**

| Tool | Description |
|------|-------------|
| `scan_sessions` | Discover and cache session logs from `~/.claude/projects/` |
| `extract_data` | Run deterministic Phase 1 extraction (metrics, scores) |
| `save_domain_results` | Store domain analysis results (called by analysis skills) |
| `classify_developer_type` | Classify into the 5x3 type matrix |
| `generate_report` | Generate HTML report and serve on localhost |
| `sync_to_team` | Optional: sync results to a team server |

**MCP Tools (server-backed, backward compatible):**

| Tool | Description |
|------|-------------|
| `get_developer_profile` | Profile type, scores, personality summary |
| `get_growth_areas` | Growth areas with optional domain filter |
| `get_recent_insights` | Strengths, anti-patterns, KPT retrospective |

**Analysis Skills** (`packages/plugin/skills/`): Markdown files containing PTCF analysis frameworks. Claude reads these as instructions and calls `save_domain_results` with structured findings. Domains: thinking quality, communication patterns, learning behavior, context efficiency, session outcomes, plus a content writer for narrative synthesis.

```bash
cd packages/plugin
npm run build
```

### Web Server (root)

Next.js app with the team dashboard UI, API routes, and the Gemini analysis pipeline. Required only for team/enterprise features or the web-based dashboard.

```bash
npm run dev        # Dev server on port 3000
npm run build      # Production build
npm run typecheck  # Type-check without emitting
```

### CLI (`packages/cli`)

Scans session logs and uploads parsed data to the web server for analysis. Alternative to the plugin for users who prefer a CLI workflow.

```bash
npx betterprompt-cli
```

Published to npm as `betterprompt-cli`. In development:

```bash
cd packages/cli
npm run build
node dist/index.js
```

## Testing

Tests use [Vitest](https://vitest.dev/) for unit/integration and [Playwright](https://playwright.dev/) for E2E.

```bash
npm test                # Unit tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report (threshold: 50%)
npm run test:integration # Full pipeline integration test
```

E2E tests (requires dev server or auto-starts one):

```bash
npx playwright test --config tests/e2e/playwright.config.ts
```

Test structure:

```
tests/
  unit/              # Analyzer stages, workers, models, CLI, search agent
  e2e/               # Playwright browser tests (report rendering, scroll nav)
  integration.test.ts # Full pipeline: session parsing -> multi-phase analysis
  fixtures/          # Real session logs and evaluation data
```

## Environment Variables

**Plugin (none required):**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `BETTERPROMPT_SERVER_URL` | No | - | Team server URL (only for `sync_to_team`) |
| `BETTERPROMPT_AUTH_TOKEN` | No | - | Auth token for team server sync |

**Web Server + CLI:**

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `GOOGLE_GEMINI_API_KEY` | Yes | - | Gemini API key ([get one here](https://aistudio.google.com/apikey)) |
| `BETTERPROMPT_BASE_URL` | No | `http://localhost:3000` | Server URL for metadata and OpenGraph |
| `BETTERPROMPT_WEB_APP_URL` | No | `http://localhost:3000` | Web app URL for CLI report links |
| `BETTERPROMPT_DB_PATH` | No | `~/.betterprompt/betterprompt.db` | SQLite database path |
| `BETTERPROMPT_TELEMETRY` | No | `true` | Enable/disable anonymous usage telemetry |
| `BETTERPROMPT_DEBUG` | No | `false` | Enable verbose debug logging (`1` to enable) |

## Project Structure

```
packages/
  plugin/                   Claude Code plugin (primary interface)
    mcp/                    MCP server + tool implementations
      tools/                Individual MCP tool modules
    skills/                 Analysis skill files (markdown)
    lib/
      core/                 Standalone extraction, scoring, type mapping
      report-template.ts    HTML report generator
      results-db.ts         Local SQLite storage
    hooks/                  Post-session analysis trigger
  cli/                      CLI for session discovery and upload

app/                        Next.js app router (team dashboard)
src/
  components/               React components
    dashboard/              Dashboard layout and navigation
    enterprise/             Team and org-level views
    landing/                Landing page sections
    personal/               Individual report tabs and insights
    report/                 Shared report UI
    ui/                     Reusable UI primitives
  lib/
    analyzer/               Gemini-powered multi-phase analysis pipeline
    domain/                 Domain models (config, knowledge, user, sharing)
    enterprise/             Team aggregation and enterprise features
    local/                  SQLite persistence (auth, reports, teams)
    models/                 Zod schemas and TypeScript types
    parser/                 JSONL session log parser
    search-agent/           Knowledge search and curation engine
  views/                    Page-level view components
tests/                      Unit, integration, and E2E test suites
docs/                       Architecture and deployment documentation
```

## Documentation

- [Architecture](./docs/human/ARCHITECTURE.md) - system design and pipeline overview
- [Plugin](./docs/human/PLUGIN.md) - plugin setup and MCP tools
- [User Flows](./docs/human/USER-FLOWS.md) - employee and manager workflows
- [Contributing](./CONTRIBUTING.md)

## License

MIT - see [LICENSE](./LICENSE).
