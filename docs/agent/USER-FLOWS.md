# User Flows (Agent Reference)

Two personas: **Employee** (individual contributor) and **Manager** (enterprise admin). Bridge: `user.organizationId`.

## Auth Model

Zero-config. `getOrCreateLocalUser()` auto-creates `local@localhost` admin. No login screen.

- `src/lib/local/auth.ts` — `getOrCreateLocalUser()`, `getCurrentUserFromRequest()`
- `src/contexts/AuthContext.tsx` — provides `{ user, isLoading, isAuthenticated }`
- `GET /api/auth/me` — returns user with `organizationId`

## Employee Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/` | `app/page.tsx` → `LandingPage` | Marketing entry, CTA → `/dashboard/analyze` |
| `/dashboard/analyze` | `AnalyzeContent.tsx` | CLI instructions, most recent analysis link |
| `/dashboard/personal` | `PersonalContent.tsx` | `?tab=report` list, `?tab=progress` analytics |
| `/dashboard/r/{resultId}` | `ImmersiveReportContent.tsx` | Full report (sidebar hidden via CSS `:has()`) |
| `/dashboard/personal/r/{resultId}` | `page.tsx` | Legacy redirect → `/dashboard/r/{resultId}` |
| `/dashboard/knowledge` | `KnowledgeContent.tsx` | Knowledge base |

### Employee Data Flow

```
CLI (npx betterprompt-cli) → gzip POST /api/analysis/run (SSE) → SQLite → GET /api/analysis/user → Personal UI
```

### Employee APIs

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/analysis/run` | Run pipeline (SSE: progress/result/error) |
| `GET` | `/api/analysis/user?limit=N` | List analyses |
| `GET` | `/api/analysis/user/progress` | PersonalAnalytics (streak, scores, history) |
| `GET` | `/api/analysis/results/{id}` | Single result with full evaluation |
| `DELETE` | `/api/analysis/results/{id}` | Delete result (owner check) |

## Manager Routes

| Route | Component | Purpose |
|-------|-----------|---------|
| `/dashboard/enterprise/setup` | `setup/page.tsx` | 3-step wizard (Create Org → Team → Ready) |
| `/dashboard/enterprise` | `EnterpriseOverviewContent.tsx` | 4 stat cards + 6 analytics panels |
| `/dashboard/enterprise/members` | `MembersContent.tsx` | Member table + invite/edit/remove |
| `/dashboard/enterprise/members/{id}` | `MemberDetailContent.tsx` | 8-section member diagnostic |
| `/dashboard/enterprise/team/{id}` | `TeamDetailContent.tsx` | Radar, trends, type dist, members |
| `/dashboard/enterprise/settings` | `SettingsContent.tsx` | Org info, server URL, SSO placeholder |

### Access Control

**Entry point**: Landing page "Enterprise Dashboard →" button (`src/components/landing/TeamSection.tsx`) or direct URL. No sidebar link — enterprise is route-gated only.

```
user.organizationId?
├── null + admin → redirect /dashboard/enterprise/setup
├── null + other → redirect /dashboard/analyze
└── set → enterprise access granted
```

- Guard: `app/dashboard/enterprise/layout.tsx` (exempts `/setup` route so wizard can render)
- Check: `src/lib/enterprise-access.ts` → `isEnterpriseAllowed(organizationId)`
- Role hierarchy: `owner > admin > member > viewer` (highest across teams wins)
- Write ops (invite/edit/remove): require `owner` or `admin`
- **Nav gap**: No sub-navigation within enterprise — overview has no links to members/settings (direct URL only)

### Manager Data Flow

```
analysis_results (per user) → GET /api/org/members → evaluation-to-team mapper → TeamMemberAnalysis → aggregation.ts → Enterprise UI
```

### Manager APIs

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/org` | Create org (sets user.organizationId) |
| `GET` | `/api/org` | Org info + teams + member count |
| `GET` | `/api/org/members` | All members as TeamMemberAnalysis[] |
| `GET/POST` | `/api/teams` | List / create teams |
| `GET/PATCH/DELETE` | `/api/teams/{teamId}` | Team CRUD |
| `GET/POST` | `/api/teams/{teamId}/members` | List / invite members |
| `PATCH/DELETE` | `/api/teams/{teamId}/members/{userId}` | Update role / remove |

## Dimension Mapping

Worker domains → enterprise dimensions (in `evaluation-to-team.ts`):

| Worker Domain | Enterprise Dimension | Notes |
|---------------|---------------------|-------|
| `thinkingQuality` | `aiCollaboration` | |
| `contextEfficiency` | `contextEngineering` | |
| `sessionOutcome` | `burnoutRisk` | Inverted: `100 - score` |
| `communicationPatterns` | `aiControl` | |
| `learningBehavior` | `skillResilience` | |

## Key Files

### Navigation
- `app/dashboard/layout.tsx` — layout with sidebar + AuthProvider
- `src/components/dashboard/DashboardSidebar.tsx` — Analyze, Knowledge, Personal links

### Enterprise Data
- `src/hooks/useEnterprise.ts` — `useOrganization()`, `useTeams()`, `useMembers()`, `useMember()`
- `src/lib/local/team-store.ts` — SQLite CRUD for orgs/teams/members
- `src/lib/local/evaluation-to-team.ts` — `mapUserToTeamMember()` transform
- `src/lib/enterprise/aggregation.ts` — `buildTeamAnalytics()`, `aggregateGrowthAreas()`, `aggregateKPT()`

### Report Components
- `app/dashboard/r/[resultId]/ImmersiveReportContent.tsx` — immersive report
- `src/components/personal/tabs/containers/ProgressTab.tsx` — progress analytics
