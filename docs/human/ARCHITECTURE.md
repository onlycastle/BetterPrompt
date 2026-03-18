# BetterPrompt Architecture

The supported open-source product is a self-hosted Next.js server plus Claude Code plugin.

## Runtime Shape

- `Next.js app` serves the web UI, auth routes, report pages, knowledge routes, and the analysis sync API.
- `Claude Code plugin` (`packages/plugin/`) runs LLM analysis locally and syncs results to the server.
- `SQLite` stores users, sessions, and analysis results.
- `Local files` store curated knowledge under `~/.betterprompt/knowledge` and influencer registry data under `~/.betterprompt`.

## Main Data Flow

1. The Claude Code plugin scans local session sources and runs LLM analysis locally.
2. Finished analysis results sync to the server via `POST /api/analysis/sync`.
3. Results are persisted to SQLite and exposed through authenticated dashboard pages and public `/r/:resultId` report pages.

## Key Subsystems

### Web Server

- `app/api/auth/*`: local email/password auth, browser sessions, CLI device flow
- `app/api/analysis/*`: run analysis, fetch user analyses, fetch/delete stored results
- `app/api/knowledge/*` and `app/api/learn/*`: local knowledge browsing and ingestion
- `app/api/reports/[reportId]/share`: share tracking for self-hosted public report links
- `app/api/benchmarks/global`: aggregates local report data for benchmark views

### Analyzer

- `src/lib/analyzer/`: multi-phase Gemini analysis pipeline
- Deterministic preprocessing selects and summarizes sessions before worker analysis
- Worker outputs are assembled into a single verbose evaluation and stored in SQLite

### Persistence

- `src/lib/local/`: SQLite schema, auth helpers, and analysis persistence
- `src/lib/search-agent/storage/knowledge-store.ts`: filesystem-backed knowledge store
- `src/lib/search-agent/influencers/registry.ts`: filesystem-backed influencer registry

## Supported Public Surface

- Landing page and docs
- Dashboard: analyze, knowledge, personal history
- Public report pages at `/r/:resultId`
- CLI-based local analysis flow

Removed from the supported OSS runtime:

- desktop app
- Lambda/SST deployment path
- Supabase-backed storage and auth
- payments, credits, waitlist, surveys, and Polar webhooks
