# Architecture (Agent Reference)

The only supported runtime is `self-hosted Next.js server + CLI`.

## Active System

- `app/`: Next.js pages, layouts, and API routes
- `packages/cli/`: local session discovery, device auth, upload to `/api/analysis/run`
- `src/lib/local/`: SQLite database, auth/session helpers, analysis persistence
- `src/lib/analyzer/`: Gemini worker pipeline
- `src/lib/search-agent/storage/knowledge-store.ts`: filesystem knowledge store
- `src/lib/search-agent/influencers/registry.ts`: filesystem influencer registry

## Core Request Paths

- Web login/signup: `app/api/auth/login`, `signup`, `logout`, `me`
- CLI device flow: `app/api/auth/device`, `authorize`, `token`
- Analysis run: `app/api/analysis/run`
- Analysis retrieval/delete: `app/api/analysis/results/[resultId]`
- User history: `app/api/analysis/user`
- Knowledge: `app/api/knowledge/*`, `app/api/learn/*`
- Public report pages: `/r/[resultId]`
- Share tracking: `app/api/reports/[reportId]/share`

## Cleanup Invariants

- Do not reintroduce Supabase, Lambda, SST, Polar, desktop, or billing-specific code into the supported path.
- Treat filesystem and SQLite storage as the source of truth.
- If a feature requires a managed backend, keep it out of this repository or behind a separate private implementation.
