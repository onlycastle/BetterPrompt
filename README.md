# BetterPrompt

> Self-hosted AI coding session analysis. Reads your local session logs, runs them through a multi-phase Gemini pipeline, and generates reports on thinking patterns, communication quality, token efficiency, and more.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js 18+](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue)](https://www.typescriptlang.org/)

**How it works:** BetterPrompt is a local Next.js server paired with a CLI tool. The CLI scans your AI coding sessions, sends them to the server for multi-phase Gemini analysis, and generates detailed reports. For teams, individual reports aggregate into enterprise dashboards with growth tracking and anti-pattern detection.

Everything runs on your machine. Session data never leaves your network.

**Supported AI coding tools:**

| Tool | Session Source | Format |
|------|---------------|--------|
| Claude Code | `~/.claude/projects/` | JSONL |
| Cursor | `~/.cursor/chats/` | SQLite |

## Screenshots

| Team Dashboard | Growth Areas | Project Breakdown |
|:-:|:-:|:-:|
| ![Team Dashboard](images/team_dashboard.png) | ![Growth Areas](images/team_problem.png) | ![Projects](images/team_projects.png) |

## Prerequisites

- [Node.js 18+](https://nodejs.org/)
- A [Google Gemini API key](https://aistudio.google.com/apikey) (free tier works - the pipeline uses Gemini 3 Flash)
- Existing AI coding sessions from a supported tool (see table above)

> **No sessions yet?** Use an AI coding assistant for a few sessions first. BetterPrompt needs session logs to analyze - without them, the CLI will have nothing to scan.

## Getting Started

### 1. Start the server

```bash
git clone https://github.com/onlycastle/BetterPrompt.git
cd BetterPrompt
npm install
cp .env.example .env
```

Add your Gemini API key to `.env`:

```env
GOOGLE_GEMINI_API_KEY=your-key-here
```

Start the server:

```bash
npm run dev
```

### 2. Run the CLI

In a separate terminal:

```bash
npx betterprompt
```

The CLI discovers sessions from your AI coding tools, lets you pick a project, and uploads parsed session data to your local server for analysis.

### 3. View your report

When analysis completes, the CLI opens your browser to `http://localhost:3000/dashboard/r/{resultId}` with your full report: personality type, strengths, growth areas, and domain-level insights.

## Packages

This is a monorepo with three packages:

### Web Server (root)

Next.js 15 app with the dashboard UI, API routes, and the Gemini analysis pipeline.

```bash
npm run dev        # Dev server on port 3000
npm run build      # Production build
npm run typecheck  # Type-check without emitting
```

### CLI (`packages/cli`)

Scans session logs from supported AI coding tools, lets you pick a project, and uploads parsed data to your local server for analysis.

```bash
npx betterprompt
```

Published to npm as `betterprompt`. In development, run from the monorepo:

```bash
cd packages/cli
npm run build
node dist/index.js
```

### Plugin (`packages/plugin`)

Claude Code plugin that provides an MCP server and a post-session hook. After each coding session, it automatically triggers analysis in the background and exposes insights via three MCP tools:

| Tool | Description |
|------|-------------|
| `get_developer_profile` | Profile type, scores, personality summary |
| `get_growth_areas` | Growth areas with optional domain filter |
| `get_recent_insights` | Strengths, anti-patterns, KPT retrospective |

#### Installing the Plugin

1. Build the plugin:

```bash
cd packages/plugin
npm install
npm run build
```

2. Add the MCP server to your Claude Code settings (`~/.claude/settings.json`):

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

3. The post-session hook auto-triggers analysis after enough sessions accumulate. See [Plugin docs](./docs/human/PLUGIN.md) for configuration options.

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
app/                        Next.js app router - pages, API routes, layouts
packages/cli/               CLI for session discovery and upload
packages/plugin/            MCP server plugin + post-session hook
src/
  components/               React components
    dashboard/              Dashboard layout and navigation
    enterprise/             Team and org-level views
    landing/                Landing page sections
    personal/               Individual report tabs and insights
    report/                 Shared report UI (terminal window, share, footer)
    knowledge/              Knowledge base UI
    ui/                     Reusable UI primitives
  lib/
    analyzer/               Gemini-powered multi-phase analysis pipeline
    domain/                 Domain models (config, knowledge, user, sharing)
    enterprise/             Team aggregation and enterprise features
    local/                  SQLite persistence (auth, reports, teams)
    models/                 Zod schemas and TypeScript types
    parser/                 JSONL session log parser
    search-agent/           Knowledge search and curation engine
    config/                 App configuration management
    utils/                  Shared utilities (storage, local analysis)
  views/                    Page-level view components
scripts/                    Development utilities and test helpers
docs/                       Architecture and deployment documentation
tests/                      Unit, integration, and E2E test suites
```

## Documentation

- [Architecture](./docs/human/ARCHITECTURE.md) - system design and pipeline overview
- [Plugin](./docs/human/PLUGIN.md) - plugin setup and MCP tools
- [User Flows](./docs/human/USER-FLOWS.md) - employee and manager workflows
- [Contributing](./CONTRIBUTING.md)

## License

MIT - see [LICENSE](./LICENSE).
