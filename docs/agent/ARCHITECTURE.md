# Architecture (Agent Reference)

The supported runtime is `Claude Code plugin + optional self-hosted Next.js server`.

## Active System

- `app/`: Next.js pages, layouts, and API routes
- `packages/cli/`: deprecated compatibility package; no longer an active analysis path
- `packages/plugin/`: Claude Code plugin — MCP server, auto-analysis hooks, canonical local pipeline (see `docs/agent/PLUGIN.md`)
- `src/lib/local/`: SQLite database, auth/session helpers, analysis persistence
- `src/lib/analyzer/`: legacy server analyzer code plus shared evaluation compatibility
- `src/lib/search-agent/storage/knowledge-store.ts`: filesystem knowledge store
- `src/lib/search-agent/influencers/registry.ts`: filesystem influencer registry

## Auth Model

Zero-config local auth — server auto-creates `local@localhost` admin via `getOrCreateLocalUser()` in `src/lib/local/auth.ts`. No signup/login flow required.

## Core Request Paths

- Auth: `app/api/auth/me` (zero-config, auto-created local admin user)
- Analysis sync: `app/api/analysis/sync`
- Analysis retrieval/delete: `app/api/analysis/results/[resultId]`
- User history: `app/api/analysis/user`
- User summary (plugin): `app/api/analysis/user/summary` — compact ~5KB summary for MCP tools
- Knowledge: `app/api/knowledge/*`, `app/api/learn/*`
- Public report pages: `/r/[resultId]`
- Share tracking: `app/api/reports/[reportId]/share`
- Organization: `app/api/org` (GET org info, POST create org)
- Org members: `app/api/org/members` (GET all members as TeamMemberAnalysis[])
- Teams CRUD: `app/api/teams`, `app/api/teams/[teamId]`
- Team members: `app/api/teams/[teamId]/members`, `app/api/teams/[teamId]/members/[userId]`

## Team Management

- `src/lib/local/team-store.ts`: CRUD for organizations, teams, team members (SQLite)
- `src/lib/local/evaluation-to-team.ts`: Pure mapper from `StoredAnalysisResult[]` → `TeamMemberAnalysis`
- `src/lib/enterprise/aggregation.ts`: Team-level aggregation (growth areas, KPT, anti-patterns, team analytics)
- `src/lib/enterprise-access.ts`: Access control (checks `user.organizationId`)
- `src/hooks/useEnterprise.ts`: Async API-backed hooks for org/team/member data
- API routes: `app/api/org/`, `app/api/teams/`
- Enterprise pages: `app/dashboard/enterprise/` (overview, members, team detail, settings, setup)
- Setup flow: `app/dashboard/enterprise/setup/` (first-time org creation)

### Data Flow

```
Plugin local analysis → optional /api/analysis/sync → analysis_results table → /api/org/members → evaluation-to-team mapper → TeamMemberAnalysis → hooks → enterprise UI
```

### Access Control

```
/api/auth/me returns organization_id → AuthContext stores user.organizationId → layout.tsx checks isEnterpriseAllowed(organizationId) → redirects admins to /setup if no org
```

## Related Docs

- [docs/agent/USER-FLOWS.md](./USER-FLOWS.md) — Employee + Manager user flows, route→component mapping, access control, API reference
- [AGENTS.md](../../AGENTS.md) — Machine-readable setup guide for AI coding agents (plugin quick start, enterprise setup)

## Cleanup Invariants

- Do not reintroduce Supabase, Lambda, SST, Polar, desktop, or billing-specific code into the supported path.
- Treat filesystem and SQLite storage as the source of truth.
- If a feature requires a managed backend, keep it out of this repository or behind a separate private implementation.
