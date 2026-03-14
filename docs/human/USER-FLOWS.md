# User Flows: Employee & Manager

> Complete walkthrough of both user personas — from first launch to daily usage
> Version: 1.0.1 | Last Updated: 2026-03-13

## Overview

BetterPrompt serves two personas through a single self-hosted Next.js application:

```
┌─────────────────────────────────────────────────────────────────────┐
│                        BETTERPROMPT                                  │
│                                                                      │
│   ┌──────────────────────┐        ┌───────────────────────────┐     │
│   │    EMPLOYEE FLOW     │        │      MANAGER FLOW         │     │
│   │  (Individual User)   │        │  (Enterprise Admin)       │     │
│   │                      │        │                           │     │
│   │  • Run CLI analysis  │        │  • Create organization    │     │
│   │  • View reports      │◄──────►│  • Manage teams/members   │     │
│   │  • Track progress    │  link  │  • View team analytics    │     │
│   │                      │        │  • Monitor growth trends  │     │
│   └──────────────────────┘        └───────────────────────────┘     │
│                                                                      │
│   Connection: user.organizationId bridges both flows                 │
│   Auth: Zero-config local admin (auto-created on first startup)     │
└─────────────────────────────────────────────────────────────────────┘
```

**Authentication Model**: No login screen. The server auto-creates a local admin user (`local@localhost`) on first API call. All requests use this implicit identity. Enterprise features unlock when `organizationId` is set.

---

## Part 1: Employee Flow

The employee flow covers the individual contributor experience — running analyses and reviewing personal reports.

### 1.1 Entry Points

```
┌─────────────┐     ┌──────────────────┐     ┌───────────────────────┐
│  Landing     │────►│  /dashboard/     │────►│  /dashboard/analyze   │
│  Page (/)    │     │  analyze         │     │  (default dashboard)  │
└─────────────┘     └──────────────────┘     └───────────────────────┘
```

**Landing Page** (`/` → `app/page.tsx` → `src/views/LandingPage.tsx`)
- Marketing page introducing BetterPrompt
- CTA navigates to `/dashboard/analyze`

**Dashboard Layout** (`app/dashboard/layout.tsx`)
- Two-column grid: persistent sidebar + main content area
- `AuthProvider` wraps entire layout, providing user context to all children
- Sidebar always visible (except on immersive report pages)

**Sidebar Navigation** (`src/components/dashboard/DashboardSidebar.tsx`)
- Three nav items (no enterprise link — enterprise is route-gated, not sidebar-linked):
  ```
  ┌──────────────────────────┐
  │  📊 BetterPrompt         │
  │                          │
  │  ▶ Analyze               │  → /dashboard/analyze
  │    Knowledge             │  → /dashboard/knowledge
  │    Personal              │  → /dashboard/personal
  │                          │
  │  (No enterprise link)    │
  │                          │
  │  ┌──────────────────┐   │
  │  │ 👤 local          │   │
  │  │    local@localhost │   │
  │  └──────────────────┘   │
  └──────────────────────────┘
  ```
- Active state highlights current route
- Personal link also highlights for `/dashboard/personal/*` sub-routes
- **Enterprise access**: Only reachable via landing page "Enterprise Dashboard →" button (`src/components/landing/TeamSection.tsx`) or direct URL navigation. There is no sidebar link to enterprise pages.

### 1.2 Analysis Flow

```
                               CLI (user's machine)
                                      │
                                      ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        ANALYSIS PIPELINE                             │
│                                                                      │
│   $ npx betterprompt-cli                                               │
│        │                                                             │
│        ├─ 1. Discovers sessions from ~/.claude/projects/            │
│        ├─ 2. Parses JSONL files                                     │
│        ├─ 3. Gzip-compresses session data                           │
│        ├─ 4. POST /api/analysis/run (SSE stream)                    │
│        │                                                             │
│        │   ┌──────────────── Server ────────────────────┐           │
│        │   │                                             │           │
│        │   │  Decompress → Parse → Aggregate metrics    │           │
│        │   │       │                                     │           │
│        │   │       ▼                                     │           │
│        │   │  VerboseAnalyzer.analyzeVerbose()           │           │
│        │   │  (11 LLM calls via Gemini 3 Flash)         │           │
│        │   │       │                                     │           │
│        │   │       ▼                                     │           │
│        │   │  Store result → SQLite                      │           │
│        │   │       │                                     │           │
│        │   │       ▼                                     │           │
│        │   │  Stream SSE events:                         │           │
│        │   │    • progress (stage + %)                   │           │
│        │   │    • phase_preview (debug)                  │           │
│        │   │    • result (resultId + summary)            │           │
│        │   │    • error (if failed)                      │           │
│        │   │                                             │           │
│        │   └─────────────────────────────────────────────┘           │
│        │                                                             │
│        └─ 5. Opens browser → /dashboard/r/{resultId}                │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**API**: `POST /api/analysis/run` (`app/api/analysis/run/route.ts`)
- Request: gzip-compressed JSON with `sessions`, `activitySessions`, `totalMessages`, `totalDurationMinutes`
- Response: SSE stream with `progress`, `phase_preview`, `result`, `error` event types
- Authentication: `getCurrentUserFromRequest()` (implicit local user)
- Query params: `noTranslate=1` (skip translation), headers: `x-debug=1` (include debug output)

### 1.3 Analyze Page

**Route**: `/dashboard/analyze` → `app/dashboard/analyze/AnalyzeContent.tsx`

```
┌──────────────────────────────────────────────────────┐
│  Analyze Your Sessions                                │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  🖥️  Run the CLI to analyze your sessions       │ │
│  │                                                  │ │
│  │  $ npx betterprompt-cli                            │ │
│  │                                                  │ │
│  └─────────────────────────────────────────────────┘ │
│                                                       │
│  ┌─────────────────────────────────────────────────┐ │
│  │  📊 Most Recent Analysis                        │ │
│  │                                                  │ │
│  │  Type: Strategic Architect                       │ │
│  │  Sessions: 12                                    │ │
│  │                                                  │ │
│  │  [View Report →]  [View all analyses →]          │ │
│  └─────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

**Data Fetching**: `GET /api/analysis/user?limit=1` — fetches only the most recent analysis
**Links**:
- "View Report" → `/dashboard/r/{resultId}`
- "View all analyses" → `/dashboard/personal?tab=report`

### 1.4 Personal Dashboard

**Route**: `/dashboard/personal` → `app/dashboard/personal/PersonalContent.tsx`

Two tabs controlled by `?tab=` query parameter:

```
┌──────────────────────────────────────────────────────┐
│  My Profile                                           │
│  Hello, local 👋                                      │
│                                                       │
│  ┌─────────┐ ┌──────────┐                            │
│  │ Report  │ │ Progress │                            │
│  └─────────┘ └──────────┘                            │
│                                                       │
│  ═══════════════════════════════════════════════════  │
│                                                       │
│  [Tab Content Area]                                   │
│                                                       │
└──────────────────────────────────────────────────────┘
```

#### Report Tab (`?tab=report`, default)

Lists all analyses with cards showing primary type, date, session count.

**Data**: `GET /api/analysis/user` → array of analysis summaries
**Actions**:
- Click card → `/dashboard/r/{resultId}`
- Delete → confirmation modal → `DELETE /api/analysis/results/{resultId}`
- Focus feature: `?focus={resultId}` scrolls to and highlights a specific card for 2 seconds

#### Progress Tab (`?tab=progress`)

Growth tracking over multiple analyses.

**Data**: `GET /api/analysis/user/progress` → `PersonalAnalytics`
**Renders**: `<ProgressTab>` component with:
- Current type and analysis count
- Score trends across worker domains
- Streak tracking (consecutive analyses within 14 days)
- First vs. latest analysis comparison
- Historical timeline

**PersonalAnalytics data structure**:
```
PersonalAnalytics {
  currentType          — Latest coding style type
  analysisCount        — Total number of analyses
  totalImprovement     — Score change from first to latest
  currentDimensions    — Scores for 5 worker domains
  dimensionImprovements — Change per domain
  journey.currentStreak — Consecutive analyses (≤14 day gaps)
  journey.longestStreak — Best streak achieved
  history[]            — Timeline of all analyses
}
```

### 1.5 Report Detail (Immersive View)

**Route**: `/dashboard/r/{resultId}` → `app/dashboard/r/[resultId]/ImmersiveReportContent.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  [← Back]                                                         │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │                                                             │  │
│  │  CONTINUOUS SCROLL REPORT                                   │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Section 1: Identity & Type                            │  │  │
│  │  │ Primary type, control level, personality narrative    │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Section 2: Activity Overview                          │  │  │
│  │  │ Sessions analyzed, duration, message counts           │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Section 3: Strengths                                  │  │  │
│  │  │ Top strengths per domain with evidence               │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Section 4: Growth Areas                               │  │  │
│  │  │ Areas for improvement with actionable advice          │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Section 5: Worker Domain Insights (×5)                │  │  │
│  │  │ Thinking, Communication, Learning, Context, Session  │  │  │
│  │  │ Each with score, strengths, growth areas, insights   │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │ Section 6: Resources                                  │  │  │
│  │  │ Matched knowledge resources and recommendations      │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  │                                                             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                   │
│  [Share Bar]                                                      │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Key behaviors**:
- Sidebar hidden via CSS `:has([data-immersive-report])` selector
- `useScrollSpy` + `FloatingProgressDots` track scroll position (optional)
- All 6 sections render simultaneously (continuous scroll, no tabs)
- Back button returns to `/dashboard/personal`
- Error states: 404 (not found), 410 (expired), generic (retry)

**Data**: `GET /api/analysis/results/{resultId}` → full evaluation object

**Legacy redirect**: `/dashboard/personal/r/{resultId}` → `/dashboard/r/{resultId}` (server-side)

### 1.6 Employee Navigation Map

```
/  (Landing Page)
│
└──► /dashboard/analyze  ◄─── Default entry point
     │
     ├──► /dashboard/r/{resultId}  ← "View Report" link
     │    └── Back button → /dashboard/personal
     │
     ├──► /dashboard/personal?tab=report  ← "View all analyses"
     │    │
     │    ├── Click card → /dashboard/r/{resultId}
     │    ├── Delete → confirmation → DELETE API
     │    └── ?focus={resultId} → scroll + highlight
     │
     ├──► /dashboard/personal?tab=progress
     │    └── Growth tracking (read-only)
     │
     └──► /dashboard/knowledge
          └── Knowledge base (learn URLs, YouTube)
```

---

## Part 2: Manager Flow

The manager flow covers the enterprise admin experience — setting up an organization, managing teams, and monitoring member analytics.

### 2.1 Access Control

```
┌──────────────────────────────────────────────────────────────────┐
│                    ACCESS CONTROL DECISION TREE                   │
│                                                                   │
│   GET /api/auth/me                                               │
│        │                                                          │
│        ▼                                                          │
│   user.organizationId?                                           │
│        │                                                          │
│   ┌────┴──────────────────┐                                      │
│   │                       │                                      │
│   ▼                       ▼                                      │
│   NULL                    SET                                    │
│   │                       │                                      │
│   ▼                       ▼                                      │
│   user.role?              ✅ Enterprise access granted           │
│   │                       │                                      │
│   ├── admin ──► /dashboard/enterprise/setup                      │
│   │             (3-step wizard)                                   │
│   │                                                               │
│   └── other ──► /dashboard/analyze                               │
│                 (personal only, no enterprise)                    │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Key file**: `src/lib/enterprise-access.ts`
```typescript
function isEnterpriseAllowed(organizationId): boolean {
  return !!organizationId;
}
```

**Layout guard**: `app/dashboard/enterprise/layout.tsx`
- Checks `isEnterpriseAllowed(user?.organizationId)`
- Admin with no org → redirect to `/dashboard/enterprise/setup`
- Non-admin with no org → redirect to `/dashboard/analyze`
- Has org → render enterprise children

### 2.2 Setup Wizard

**Route**: `/dashboard/enterprise/setup` → `app/dashboard/enterprise/setup/page.tsx`

First-time organization creation for admin users. Three-step wizard:

```
┌──────────────────────────────────────────────────────────────────┐
│  Step 1                    Step 2                   Step 3       │
│  ● Create Org              ○ Create Team            ○ Ready      │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │                                                              │ │
│  │  Organization Name: [ Acme Corp          ]                  │ │
│  │  URL Slug:          [ acme-corp           ]  (auto-gen)     │ │
│  │                                                              │ │
│  │                                    [Create Organization →]  │ │
│  │                                                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘

     Step 1 ──────────────► Step 2 ────────────────► Step 3
     POST /api/org          POST /api/teams           Show server URL
     Creates org +          Creates first team         Display BETTERPROMPT_API_URL
     sets user.orgId        (optional, can skip)       for team members
                                                       Force reload auth
```

**Step details**:
1. **Create Organization** — name (auto-slugifies) + URL slug → `POST /api/org`
2. **Create Team** (optional) — name + description → `POST /api/teams` (can skip)
3. **Ready** — displays server URL (`BETTERPROMPT_API_URL`) for sharing, then redirects to enterprise dashboard

**Post-setup**: Forces full page reload to re-fetch auth state with new `organizationId`.

### 2.3 Enterprise Overview Dashboard

**Route**: `/dashboard/enterprise` → `app/dashboard/enterprise/EnterpriseOverviewContent.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  Organization Dashboard                                           │
│                                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌──────────────┐          │
│  │ Active  │ │Sessions │ │ Avg     │ │ Anti-Pattern │          │
│  │ Members │ │This Week│ │ Token   │ │ Count        │          │
│  │   12    │ │   47    │ │ Burn    │ │    8         │          │
│  │         │ │ ▲ +15%  │ │  125K   │ │              │          │
│  └─────────┘ └─────────┘ └─────────┘ └──────────────┘          │
│                                                                   │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐   │
│  │ Growth Leaderboard          │ │ Token Usage Trends       │   │
│  │ Members ranked by score +   │ │ Weekly burn across team  │   │
│  │ growth trend                │ │ [chart]                  │   │
│  └─────────────────────────────┘ └──────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐   │
│  │ Anti-Pattern Deep Dive      │ │ Common Growth Areas      │   │
│  │ Aggregated patterns with    │ │ Areas affecting 2+       │   │
│  │ descriptions + actions      │ │ members, ranked by count │   │
│  └─────────────────────────────┘ └──────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────┐ ┌──────────────────────────┐   │
│  │ Team KPT Retrospective      │ │ Project Activity Feed    │   │
│  │ Keep / Problem / TryNext    │ │ Active projects with     │   │
│  │ (items appearing 2+ times)  │ │ session counts           │   │
│  └─────────────────────────────┘ └──────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Data hooks**:
- `useOrganization()` → org metadata + teams
- `useMembers()` → all members as `TeamMemberAnalysis[]`
- `useOrgAntiPatterns()` → aggregated anti-patterns
- `useOrgGrowthAreas()` → shared growth areas
- `useOrgKpt()` → team KPT retrospective

### 2.4 Members Management

**Route**: `/dashboard/enterprise/members` → `app/dashboard/enterprise/members/MembersContent.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  Team Members                                   [+ Invite Member]│
│                                                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐              │
│  │ Active  │ │ Avg     │ │Improving│ │ Anti-   │              │
│  │ Members │ │ Score   │ │ Members │ │Patterns │              │
│  │   12    │ │   72    │ │    8    │ │    5    │              │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Name     │ Email        │ Role   │ Score │ Type │ Actions│   │
│  │──────────│──────────────│────────│───────│──────│────────│   │
│  │ Alice    │ a@acme.com   │ admin  │  85   │ SA   │ ✏️ 🗑️ │   │
│  │ Bob      │ b@acme.com   │ member │  72   │ PO   │ ✏️ 🗑️ │   │
│  │ Carol    │ c@acme.com   │ member │  68   │ RC   │ ✏️ 🗑️ │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  Click row → /dashboard/enterprise/members/{memberId}            │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Actions**:
- **Invite**: Opens dialog (email + role) → `POST /api/teams/{teamId}/members`
- **Edit role**: Opens dialog → `PATCH /api/teams/{teamId}/members/{userId}`
- **Remove**: Confirmation → `DELETE` from all teams (loops through teams)
- **Row click**: Navigate to member detail

**Access control**: Invite/Edit/Remove require `owner` or `admin` role.

### 2.5 Member Detail View

**Route**: `/dashboard/enterprise/members/{memberId}` → `app/dashboard/enterprise/members/[memberId]/MemberDetailContent.tsx`

Continuous-scroll diagnostic view of an individual team member:

```
┌──────────────────────────────────────────────────────────────────┐
│  [← Back to Members]                                              │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Profile: Alice                                            │   │
│  │ a@acme.com | admin | Engineering                         │   │
│  │ Type: Strategic Architect | Control: High                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │Sessions│ │Context │ │Anti-   │ │Projects│                   │
│  │  47    │ │Fill 82%│ │Pat. 3  │ │   5    │                   │
│  └────────┘ └────────┘ └────────┘ └────────┘                   │
│                                                                   │
│  ┌──────────────────────┐ ┌─────────────────────────────┐      │
│  │ Score History         │ │ Dimension Radar              │      │
│  │ [trend line chart]    │ │ [radar chart: 5 dimensions]  │      │
│  └──────────────────────┘ └─────────────────────────────┘      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Strengths Overview                                        │   │
│  │ Grid of domain cards with progress rings                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Token Usage: Weekly trend + total messages               │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Anti-Patterns: frequency, impact, pattern names          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Project Activity: per-project session cards              │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Growth Tracking: current / WoW / MoM deltas             │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.6 Team Detail View

**Route**: `/dashboard/enterprise/team/{teamId}` → `app/dashboard/enterprise/team/[teamId]/TeamDetailContent.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  Team: Engineering                                                │
│  8 members | Avg score: 74 | ▲ +3.2% WoW                        │
│                                                                   │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────┐                 │
│  │Members │ │Avg     │ │ WoW %  │ │ Skill    │                 │
│  │   8    │ │Score 74│ │ +3.2%  │ │ Gaps: 2  │                 │
│  └────────┘ └────────┘ └────────┘ └──────────┘                 │
│                                                                   │
│  ┌──────────────────────┐ ┌─────────────────────────────┐      │
│  │ Dimension Radar       │ │ Weekly Score Trend           │      │
│  │ [5-axis radar chart]  │ │ [line chart over time]       │      │
│  │ Average across team   │ │ Aggregate team score         │      │
│  └──────────────────────┘ └─────────────────────────────┘      │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Type Distribution                                         │   │
│  │ Bar/pie chart showing coding style type breakdown        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Team Members Table                                        │   │
│  │ Name | Score | Type | Control Level                      │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

**Aggregations** (computed in `src/lib/enterprise/aggregation.ts`):
- Average dimensions across all team members
- Skill gaps: dimensions scoring below 65
- Type and control level distributions
- Week-over-week and month-over-month score changes
- Anti-pattern aggregates

### 2.7 Organization Settings

**Route**: `/dashboard/enterprise/settings` → `app/dashboard/enterprise/settings/SettingsContent.tsx`

```
┌──────────────────────────────────────────────────────────────────┐
│  Organization Settings                                            │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Organization Info (read-only)                             │   │
│  │ Name: Acme Corp | Teams: 3 | Members: 12                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Server URL                                                │   │
│  │ BETTERPROMPT_API_URL for team member CLI configuration         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Allowed Domains (placeholder)                             │   │
│  │ Future: restrict signups by email domain                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ SSO Configuration (placeholder)                           │   │
│  │ Future: single sign-on integration                       │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### 2.8 Manager Navigation Map

**Entry point**: Landing page "Enterprise Dashboard →" button (`src/components/landing/TeamSection.tsx`) or direct URL `/dashboard/enterprise`. No sidebar link exists.

> **Navigation gap**: The enterprise section has **no sub-navigation**. The overview page has no links to Members or Settings — those pages are only reachable by direct URL. The only in-page links within enterprise are: member table row → member detail, team card → team detail, and back buttons to parent pages.

```
/dashboard/enterprise/setup  ◄─── First-time only (no orgId)
│
├── Step 1: POST /api/org
├── Step 2: POST /api/teams (optional)
└── Step 3: Redirect → /dashboard/enterprise

/dashboard/enterprise  ◄─── Overview (requires orgId)
│
├──► /dashboard/enterprise/members      ◄─── Direct URL only (no link from overview)
│    │
│    ├── Invite → POST /api/teams/{teamId}/members
│    ├── Edit → PATCH /api/teams/{teamId}/members/{userId}
│    ├── Remove → DELETE (from all teams)
│    │
│    └──► /dashboard/enterprise/members/{memberId}  ◄─── Linked from member table row
│         └── Back → /dashboard/enterprise/members
│
├──► /dashboard/enterprise/team/{teamId}  ◄─── Linked from TeamOverviewGrid card
│    └── Back → /dashboard/enterprise
│
└──► /dashboard/enterprise/settings      ◄─── Direct URL only (no link from overview)
     └── Org info, server URL, future SSO/domains
```

---

## Part 3: How the Flows Connect

### 3.1 Data Flow: Employee → Manager

```
┌─────────────────────────────────────────────────────────────────────┐
│                     DATA FLOW ARCHITECTURE                           │
│                                                                      │
│  EMPLOYEE SIDE                           MANAGER SIDE                │
│                                                                      │
│  $ npx betterprompt-cli                                                │
│       │                                                              │
│       ▼                                                              │
│  POST /api/analysis/run                                             │
│       │                                                              │
│       ▼                                                              │
│  ┌──────────────────┐                                               │
│  │ analysis_results │ ◄── SQLite table                              │
│  │ (per user)       │                                               │
│  └────────┬─────────┘                                               │
│           │                                                          │
│   ┌───────┴────────────────────────────────────────────┐            │
│   │                                                     │            │
│   ▼                                                     ▼            │
│  GET /api/analysis/user                  GET /api/org/members       │
│  GET /api/analysis/results/{id}                │                    │
│       │                                        │                    │
│       ▼                                        ▼                    │
│  Personal Dashboard                     evaluation-to-team.ts      │
│  (Report + Progress tabs)               mapUserToTeamMember()      │
│                                                │                    │
│                                                ▼                    │
│                                         TeamMemberAnalysis          │
│                                         (scores, patterns,         │
│                                          projects, growth)         │
│                                                │                    │
│                                                ▼                    │
│                                         aggregation.ts              │
│                                         (team/org level rollups)   │
│                                                │                    │
│                                                ▼                    │
│                                         Enterprise Dashboard       │
│                                         (overview, members,        │
│                                          teams, settings)          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

**The bridge**: `user.organizationId`
- When a user's `organization_id` is set in the `users` table, their analyses become visible to enterprise APIs
- `GET /api/org/members` finds all users with the same `organizationId`, fetches their analyses, and transforms them via `mapUserToTeamMember()` into `TeamMemberAnalysis` objects
- The manager sees aggregated views of individual employee data — they never see raw session logs

### 3.2 Dimension Score Mapping

Worker domain scores from the analysis pipeline are mapped to enterprise dimensions for team views:

```
Analysis Pipeline                Enterprise Dimensions
─────────────────                ─────────────────────
thinkingQuality       ──────►   aiCollaboration
contextEfficiency     ──────►   contextEngineering
sessionOutcome        ──────►   burnoutRisk (inverted: 100 - score)
communicationPatterns ──────►   aiControl
learningBehavior      ──────►   skillResilience
```

### 3.3 Role Hierarchy

```
owner  ──► Can do everything (created the org)
  │
admin  ──► Can invite/edit/remove members, create/delete teams
  │
member ──► Can view dashboards (no management actions)
  │
viewer ──► Read-only access
```

Role is determined by `getUserOrgRole()` which returns the **highest** role across all teams.

---

## Part 4: API Route Reference

### Employee APIs

| Method | Route | Purpose |
|--------|-------|---------|
| `GET` | `/api/auth/me` | Get current user (implicit local auth) |
| `POST` | `/api/analysis/run` | Run analysis pipeline (SSE stream) |
| `GET` | `/api/analysis/user` | List user's analyses |
| `GET` | `/api/analysis/user/progress` | Get progress analytics |
| `GET` | `/api/analysis/results/{resultId}` | Get single result |
| `DELETE` | `/api/analysis/results/{resultId}` | Delete a result |

### Manager APIs

| Method | Route | Purpose |
|--------|-------|---------|
| `POST` | `/api/org` | Create organization |
| `GET` | `/api/org` | Get org info + teams |
| `GET` | `/api/org/members` | List all members as TeamMemberAnalysis[] |
| `GET` | `/api/teams` | List org teams |
| `POST` | `/api/teams` | Create team |
| `GET` | `/api/teams/{teamId}` | Get team detail |
| `PATCH` | `/api/teams/{teamId}` | Update team |
| `DELETE` | `/api/teams/{teamId}` | Delete team |
| `GET` | `/api/teams/{teamId}/members` | List team members |
| `POST` | `/api/teams/{teamId}/members` | Invite member (by email) |
| `PATCH` | `/api/teams/{teamId}/members/{userId}` | Update member role |
| `DELETE` | `/api/teams/{teamId}/members/{userId}` | Remove member |

---

## Part 5: Key Files by Area

### Navigation & Layout

| File | Purpose |
|------|---------|
| `app/page.tsx` | Landing page entry |
| `app/dashboard/layout.tsx` | Dashboard layout with sidebar + AuthProvider |
| `src/components/dashboard/DashboardSidebar.tsx` | Sidebar nav (Analyze, Knowledge, Personal) |

### Authentication

| File | Purpose |
|------|---------|
| `src/contexts/AuthContext.tsx` | React context providing user state |
| `src/lib/local/auth.ts` | Zero-config local user (auto-create admin) |
| `app/api/auth/me/route.ts` | Returns current user identity |

### Employee Pages

| File | Purpose |
|------|---------|
| `app/dashboard/analyze/AnalyzeContent.tsx` | CLI instructions + most recent analysis |
| `app/dashboard/personal/PersonalContent.tsx` | Report list + Progress tabs |
| `app/dashboard/r/[resultId]/ImmersiveReportContent.tsx` | Full immersive report view |

### Enterprise Pages

| File | Purpose |
|------|---------|
| `app/dashboard/enterprise/layout.tsx` | Access guard (orgId check) |
| `app/dashboard/enterprise/setup/page.tsx` | 3-step org setup wizard |
| `app/dashboard/enterprise/EnterpriseOverviewContent.tsx` | Org dashboard with 7 panels |
| `app/dashboard/enterprise/members/MembersContent.tsx` | Member table + CRUD |
| `app/dashboard/enterprise/members/[memberId]/MemberDetailContent.tsx` | Deep member diagnostics |
| `app/dashboard/enterprise/team/[teamId]/TeamDetailContent.tsx` | Team analytics + radar |
| `app/dashboard/enterprise/settings/SettingsContent.tsx` | Org settings + server URL |

### Data Layer

| File | Purpose |
|------|---------|
| `src/hooks/useEnterprise.ts` | React hooks for org/team/member data |
| `src/lib/local/team-store.ts` | SQLite CRUD for orgs, teams, members |
| `src/lib/local/evaluation-to-team.ts` | Transforms analysis results → TeamMemberAnalysis |
| `src/lib/enterprise/aggregation.ts` | Team/org-level rollup functions |
| `src/lib/enterprise-access.ts` | `isEnterpriseAllowed()` — checks organizationId |

### Analysis Pipeline

| File | Purpose |
|------|---------|
| `app/api/analysis/run/route.ts` | SSE endpoint for running analysis |
| `app/api/analysis/user/route.ts` | List user's analyses |
| `app/api/analysis/results/[resultId]/route.ts` | Get/delete single result |
| `app/api/analysis/user/progress/route.ts` | Personal analytics |
