# Web Rendering System Documentation

> Version: 5.0.0 | Architecture: React 19 SPA with Vite

## Overview

The web module at `web-ui/` is a modern React Single Page Application (SPA) that renders interactive analysis reports and dashboards with a terminal-aesthetic design. It provides a complete web experience using React 19, TypeScript, Vite, and React Query for state management.

**Key Features:**
- React 19 + Vite SPA architecture
- Terminal-themed UI with macOS Big Sur aesthetics
- Neon color scheme with glow effects
- CSS Modules for component styling
- React Query for server state management
- Keyboard navigation with vim-style shortcuts
- Premium content unlock/lock system
- Responsive mobile design
- TypeScript throughout for type safety

---

## Architecture Overview

```
┌────────────────────────────────────────────────────────────────────┐
│                      React SPA Web Application                     │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Browser (Vite Dev Server on port 5173)                   │  │
│  │  Entry: main.tsx → App.tsx → Routes                        │  │
│  │  State: React Query + React Hooks                          │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Router Layer (React Router v7)                            │  │
│  │  - /report/:reportId (AnalysisReportPage)                  │  │
│  │  - /personal (PersonalDashboardPage)                       │  │
│  │  - /enterprise (EnterpriseDashboardPage)                   │  │
│  │  - /browse (BrowsePage - Knowledge Base)                   │  │
│  │  - /learn (LearnPage - Content Upload)                     │  │
│  │  - /comparison/:reportId (ComparisonPage)                  │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Component Layer                                           │  │
│  │  ├─ Layout Components (Header, Sidebar, Footer)           │  │
│  │  ├─ Report Components (Terminal, Sections, Tabs)          │  │
│  │  ├─ Personal Components (Journey, Breakdown)              │  │
│  │  ├─ Enterprise Components (Charts, Analytics)             │  │
│  │  └─ UI Components (Button, Card, Badge, Input)            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  Hooks & State Management                                  │  │
│  │  ├─ useReport() - React Query hook for fetching reports   │  │
│  │  ├─ usePersonalAnalytics() - Personal dashboard data      │  │
│  │  ├─ useEnterprise() - Enterprise dashboard data           │  │
│  │  ├─ useScrollNavigation() - Keyboard & scroll nav         │  │
│  │  └─ useComparison() - Multi-report comparison             │  │
│  └────────────────────────────────────────────────────────────┘  │
│                            ↓                                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  API Client (Vite Proxy → http://localhost:3001/api)      │  │
│  │  - /api/reports/:reportId (GET)                            │  │
│  │  - /api/personal (GET)                                     │  │
│  │  - /api/enterprise (GET)                                   │  │
│  │  - /api/reports/:reportId/share (POST analytics)           │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘

Data Flow:
  API (3001) → Fetch via React Query → Components → Terminal UI
                                    → CSS Modules → Terminal Aesthetic
```

---

## Project Structure

```
web-ui/
├── src/
│   ├── main.tsx                 # Entry point, imports styles + App
│   ├── App.tsx                  # Router setup, QueryClient provider
│   │
│   ├── pages/                   # Page components (full routes)
│   │   ├── ReportPage.tsx       # Display shared analysis reports
│   │   ├── PersonalDashboardPage.tsx  # Growth journey dashboard
│   │   ├── EnterpriseDashboardPage.tsx # Team analytics dashboard
│   │   ├── BrowsePage.tsx       # Knowledge base browser
│   │   ├── LearnPage.tsx        # Content upload/creation
│   │   ├── ComparisonPage.tsx   # Multi-report comparison
│   │   └── DashboardPage.tsx    # Default dashboard
│   │
│   ├── components/              # Reusable React components
│   │   ├── layout/              # Page structure
│   │   │   ├── Header.tsx       # Top navigation & title
│   │   │   ├── Sidebar.tsx      # Left sidebar navigation
│   │   │   ├── Layout.tsx       # Main layout wrapper
│   │   │   └── index.ts
│   │   │
│   │   ├── report/              # Report display components
│   │   │   ├── TerminalWindow.tsx      # macOS window frame
│   │   │   ├── TerminalTabs.tsx        # iTerm2-style tabs
│   │   │   ├── TypeResultSection.tsx   # Primary type display
│   │   │   ├── DimensionSection.tsx    # Reusable dimension display
│   │   │   ├── UnlockSection.tsx       # Premium content teaser
│   │   │   ├── DimensionSection.module.css
│   │   │   └── index.ts
│   │   │
│   │   ├── personal/            # Personal dashboard components
│   │   │   ├── JourneyHeader.tsx        # Hero section
│   │   │   ├── ScoreComparisonCard.tsx  # Score comparison widget
│   │   │   ├── DimensionBreakdown.tsx   # Dimension breakdown
│   │   │   ├── RecommendationsList.tsx  # Growth recommendations
│   │   │   └── index.ts
│   │   │
│   │   ├── enterprise/          # Enterprise dashboard components
│   │   │   ├── MemberTable.tsx         # Team member listing
│   │   │   ├── TrendLineChart.tsx      # Progress trend chart
│   │   │   ├── TypeDistributionChart.tsx # Type distribution
│   │   │   └── index.ts
│   │   │
│   │   ├── dashboard/           # Dashboard visualization components
│   │   │   ├── BarChart.tsx      # Simple bar chart
│   │   │   ├── ProgressRing.tsx   # Circular progress indicator
│   │   │   ├── AnimatedNumber.tsx # Animated numeric display
│   │   │   └── index.ts
│   │   │
│   │   ├── knowledge/           # Knowledge base components
│   │   │   ├── KnowledgeCard.tsx # Content card display
│   │   │   └── index.ts
│   │   │
│   │   └── ui/                  # Generic UI components
│   │       ├── Button.tsx        # Styled button
│   │       ├── Input.tsx         # Form input
│   │       ├── Card.tsx          # Card container
│   │       ├── Badge.tsx         # Inline badge
│   │       ├── Spinner.tsx       # Loading spinner
│   │       └── index.ts
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── useReport.ts         # Fetch single report data
│   │   ├── usePersonalAnalytics.ts # Personal dashboard data
│   │   ├── useEnterprise.ts     # Enterprise dashboard data
│   │   ├── useScrollNavigation.ts # Keyboard/scroll navigation
│   │   ├── useComparison.ts     # Multi-report comparison
│   │   ├── useKnowledge.ts      # Knowledge base queries
│   │   ├── useLearn.ts          # Learning content upload
│   │   └── index.ts
│   │
│   ├── api/                     # API client
│   │   └── client.ts            # Fetch wrapper with error handling
│   │
│   ├── types/                   # TypeScript interfaces
│   │   ├── index.ts             # Re-exports
│   │   ├── report.ts            # Report data types
│   │   ├── personal.ts          # Personal dashboard types
│   │   ├── enterprise.ts        # Enterprise dashboard types
│   │   └── __tests__/           # Type tests
│   │
│   ├── styles/                  # Global styles & CSS variables
│   │   ├── global.css           # Reset + base styles
│   │   ├── variables.css        # Standard CSS variables
│   │   ├── terminal-variables.css # Neon terminal colors & backgrounds
│   │   └── reset.css            # HTML element resets
│   │
│   ├── data/                    # Mock data for development
│   │   ├── mockPersonalData.ts  # Sample personal dashboard
│   │   └── mockEnterpriseData.ts # Sample enterprise dashboard
│   │
│   └── styles/**/*.module.css   # Component-specific CSS modules
│
├── vite.config.ts              # Vite configuration (port, proxy)
├── tsconfig.json               # TypeScript configuration
├── package.json                # Dependencies
└── index.html                  # HTML entry point
```

---

## Pages Overview

### ReportPage (`/report/:reportId`)

Displays a shared analysis report from the `/report/:reportId` route.

**Features:**
- Terminal-aesthetic report layout
- Type distribution visualization
- Dimension breakdown (if unlocked)
- Share functionality
- Keyboard navigation

**Component Tree:**
```
ReportPage
├── TerminalWindow
│   ├── TerminalTabs (navigation)
│   ├── TypeResultSection (main type + distribution)
│   ├── DimensionSection[] (AI Collaboration, Context, Burnout, etc.)
│   └── UnlockSection (if locked)
├── useReport() hook fetches data from /api/reports/:reportId
└── CSS Modules for terminal styling
```

**Usage:**
```
https://example.com/report/abc123
```

**Example Data:**
```typescript
{
  typeResult: {
    primaryType: 'Architect',
    distribution: {
      Architect: 45,
      Scientist: 25,
      Collaborator: 15,
      Speedrunner: 10,
      Craftsman: 5
    }
  },
  dimensions: {
    aiCollaboration: { score: 85, level: 'expert', breakdown: {...} },
    contextEngineering: { score: 72, level: 'proficient', breakdown: {...} }
    // ... more dimensions
  }
}
```

### PersonalDashboardPage (`/personal`)

Shows an individual developer's growth journey and progress tracking.

**Features:**
- Journey hero section (current profile)
- Score comparison vs. baseline
- Trend chart over time
- Dimension breakdown
- Personalized recommendations
- Progress indicators

**Component Tree:**
```
PersonalDashboardPage
├── Header (title + subtitle)
├── JourneyHeader (hero section)
├── ScoreComparisonCard (current vs. baseline)
├── TrendLineChart (progress over time)
├── DimensionBreakdown (breakdown by dimension)
└── RecommendationsList (growth recommendations)
```

**Data:**
Uses `mockPersonalData` for MVP (real data via `usePersonalAnalytics` hook):
```typescript
{
  profile: { name, avatar, currentScore, type },
  history: [ { date, score, dimension } ],
  dimensions: { aiCollaboration, contextEngineering, ... },
  recommendations: [ { title, description, priority } ]
}
```

### EnterpriseDashboardPage (`/enterprise`)

Team analytics and capability assessment dashboard.

**Features:**
- Team member table with current scores
- Type distribution chart
- Trend line for team average
- Growth indicators
- Departmental breakdown

**Component Tree:**
```
EnterpriseDashboardPage
├── Header
├── TeamMetrics (high-level KPIs)
├── MemberTable (individual scores)
├── TypeDistributionChart
├── TrendLineChart (team average)
└── DepartmentBreakdown
```

### BrowsePage (`/`)

Knowledge base browser for learning resources.

**Features:**
- Search/filter knowledge articles
- Content card display
- Category navigation
- Learning path recommendations

**Component Tree:**
```
BrowsePage
├── Header (search bar)
├── CategoryTabs
└── KnowledgeCard[] (grid of content)
```

### LearnPage (`/learn`)

Content upload and creation interface.

**Features:**
- Content submission form
- Markdown editor
- Category tagging
- Preview

### ComparisonPage (`/comparison/:reportId?`)

Compare multiple reports side-by-side.

**Features:**
- Multi-select reports
- Side-by-side comparison
- Dimension comparison charts
- Growth indicator

---

## React Components Reference

### Report Components (`components/report/`)

#### TerminalWindow

Renders the macOS-style terminal window frame with title bar.

**Props:**
```typescript
interface TerminalWindowProps {
  title?: string;
  children: ReactNode;
}
```

**Features:**
- macOS traffic light buttons (red, yellow, green)
- Terminal title bar
- Dark glass effect background
- Responsive sizing

**Usage:**
```tsx
<TerminalWindow title="ai-coding-assessment">
  {/* Content */}
</TerminalWindow>
```

#### TerminalTabs

Renders iTerm2-style tabs for section navigation.

**Props:**
```typescript
interface TerminalTabsProps {
  tabs: Array<{ id: string; label: string; icon?: string }>;
  activeTab: string;
  onTabChange: (tabId: string) => void;
}
```

**Features:**
- Horizontal tab bar
- Active tab highlighting
- Tab index numbers (1-8)
- Keyboard focus support

**Usage:**
```tsx
<TerminalTabs
  tabs={[
    { id: 'profile', label: 'profile' },
    { id: 'aiCollaboration', label: 'ai-collab' }
  ]}
  activeTab="profile"
  onTabChange={(id) => scrollToSection(id)}
/>
```

#### TypeResultSection

Displays the primary coding type with large emoji and distribution breakdown.

**Props:**
```typescript
interface TypeResultSectionProps {
  result: TypeResult;
  isUnlocked: boolean;
}
```

**Features:**
- Large emoji display (72px)
- Type name and tagline
- Horizontal distribution bar chart
- Session count metadata

**Usage:**
```tsx
<TypeResultSection result={typeResult} isUnlocked={true} />
```

#### DimensionSection

Reusable component for displaying any dimension (AI Collaboration, etc.)

**Props:**
```typescript
interface DimensionSectionProps {
  dimension: DimensionResult;
  title: string;
  icon: string;
  subtitle?: string;
  isUnlocked: boolean;
  accentColor: string;
  levelLabels?: Record<string, string>;
  breakdownLabels?: Record<string, string>;
  renderCustomMetrics?: () => ReactNode;
}
```

**Features:**
- Score display with level badge
- Breakdown metrics with progress bars
- Strengths list (always visible)
- Growth areas (blurred if locked)
- Unlock prompt overlay
- Custom metric rendering support

**Usage:**
```tsx
<DimensionSection
  dimension={aiCollaboration}
  title="AI Collaboration Mastery"
  icon="🤝"
  isUnlocked={isUnlocked}
  accentColor="var(--neon-cyan)"
  levelLabels={{
    expert: 'Expert Collaborator',
    proficient: 'Proficient'
  }}
  breakdownLabels={{
    structuredPlanning: 'Structured Planning',
    aiOrchestration: 'AI Orchestration'
  }}
/>
```

#### UnlockSection

Shows premium content teaser and upgrade call-to-action.

**Props:**
```typescript
interface UnlockSectionProps {
  reason?: string;
}
```

**Features:**
- Lock icon
- "Unlock premium insights" message
- Teaser text
- Upgrade button

**Usage:**
```tsx
{!isUnlocked && <UnlockSection reason="View detailed growth areas" />}
```

### Layout Components (`components/layout/`)

#### Layout

Main application wrapper with navigation and structure.

**Props:**
```typescript
interface LayoutProps {
  children: ReactNode;
}
```

**Features:**
- Header at top
- Optional sidebar
- Main content area
- Footer

**Usage:**
```tsx
<Layout>
  <Routes>
    {/* Routes rendered as children */}
  </Routes>
</Layout>
```

#### Header

Top navigation bar with title and optional subtitle.

**Props:**
```typescript
interface HeaderProps {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}
```

**Features:**
- Sticky positioning
- Logo/branding
- Navigation links
- Action button slot

### UI Components (`components/ui/`)

#### Button

Styled button component with variants.

**Props:**
```typescript
interface ButtonProps extends HTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}
```

#### Card

Container component with padding variants.

**Props:**
```typescript
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: 'sm' | 'md' | 'lg';
}
```

#### Badge

Inline status badge with colors.

**Props:**
```typescript
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'info';
}
```

---

## Styling System

### CSS Architecture

The styling uses CSS Modules + global CSS variables for maintainability:

```
Global CSS Variables (terminal-variables.css)
  ↓
Global Base Styles (global.css)
  ↓
Component CSS Modules (DimensionSection.module.css)
  ↓
Rendered HTML
```

### CSS Variables

**Location:** `web-ui/src/styles/terminal-variables.css`

#### Terminal Colors

```css
:root {
  /* Terminal Background Colors */
  --terminal-bg: #0a0a0a;        /* Darkest - main background */
  --terminal-surface: #1a1a1a;   /* Mid - card backgrounds */
  --terminal-elevated: #2a2a2a;  /* Lighter - hover states */

  /* Neon Colors - Primary Palette */
  --neon-cyan: #00d4ff;          /* Primary accent */
  --neon-green: #00ff88;         /* Success, strengths */
  --neon-magenta: #ff00ff;       /* Secondary accent */
  --neon-yellow: #ffcc00;        /* Warnings */
  --neon-red: #ff4444;           /* Errors, danger */
  --neon-purple: #8b5cf6;        /* Tertiary accent */
  --neon-pink: #ec4899;          /* Soft accent */
  --neon-orange: #ff8800;        /* Alternative highlight */

  /* Text Colors */
  --text-primary: #e0e0e0;       /* Main text */
  --text-secondary: #888888;     /* Secondary text */
  --text-muted: #555555;         /* Disabled/muted */

  /* Border Colors */
  --border: #333333;             /* Standard border */
  --border-subtle: #2a2a2a;      /* Subtle dividers */

  /* Glow Effects */
  --glow-cyan: 0 0 20px rgba(0, 212, 255, 0.3);
  --glow-green: 0 0 20px rgba(0, 255, 136, 0.3);
  --glow-magenta: 0 0 20px rgba(255, 0, 255, 0.3);
  --glow-yellow: 0 0 20px rgba(255, 204, 0, 0.3);
  --glow-red: 0 0 20px rgba(255, 68, 68, 0.3);
  --glow-purple: 0 0 20px rgba(139, 92, 246, 0.3);
  --glow-pink: 0 0 20px rgba(236, 72, 153, 0.3);

  /* Typography */
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Consolas', monospace;
  --font-sans: 'Plus Jakarta Sans', -apple-system, sans-serif;

  /* macOS Traffic Light Buttons */
  --traffic-red: #ff5f56;
  --traffic-yellow: #ffbd2e;
  --traffic-green: #27c93f;

  /* Section-specific Accent Colors */
  --accent-ai-collaboration: var(--neon-cyan);
  --accent-context-engineering: var(--neon-green);
  --accent-burnout-risk: var(--neon-yellow);
  --accent-tool-mastery: var(--neon-magenta);
  --accent-ai-control: var(--neon-purple);
  --accent-skill-resilience: var(--neon-pink);
}
```

### macOS Big Sur Background

Fixed position background with gradient:

```css
.macos-background {
  position: fixed;
  inset: 0;
  z-index: -1;
  background:
    /* Blue sky */
    radial-gradient(ellipse 100% 50% at 80% 10%, #4FA4E5 0%, transparent 50%),
    /* Warm white streak */
    radial-gradient(ellipse 80% 30% at 70% 45%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 200, 150, 0.4) 40%, transparent 60%),
    /* Coral-red wave */
    radial-gradient(ellipse 130% 70% at 50% 70%, #FF6B6B 0%, #D64545 35%, transparent 65%),
    /* Purple-magenta blend */
    radial-gradient(ellipse 80% 90% at 8% 75%, #8B5CF6 0%, #EC4899 50%, transparent 70%),
    /* Base gradient */
    linear-gradient(160deg, #1E3A5F 0%, #1A1A2E 50%, #0F0F1A 100%);
}
```

### Color Selection Guidelines

| Purpose | CSS Variable | Use Case |
|---------|--------------|----------|
| Success/Good | `--neon-green` | High scores, strengths |
| Primary Accent | `--neon-cyan` | Main UI, emphasis |
| Warning | `--neon-yellow` | Caution, warnings |
| Danger/Error | `--neon-red` | Errors, risk indicators |
| Secondary | `--neon-magenta` | Alternative highlights |
| Soft Accent | `--neon-pink` | Tertiary emphasis |

### Component CSS Modules

Each component has its own `.module.css` file scoped to that component:

**DimensionSection.module.css Example:**

```css
.dimensionSection {
  --accent: var(--neon-cyan);  /* Can be customized per instance */
  padding: 32px;
  background: var(--terminal-surface);
  border-radius: 12px;
  border: 1px solid var(--border);
}

.scoreValue {
  font-size: 72px;
  font-weight: 700;
  color: var(--accent);
  text-shadow: 0 0 40px var(--accent);
}

.blurred {
  filter: blur(6px);
  user-select: none;
  pointer-events: none;
}

.unlockPrompt {
  text-align: center;
  padding: 20px;
  background: rgba(255, 204, 0, 0.08);
  border: 1px dashed var(--neon-yellow);
  border-radius: 8px;
}
```

### Responsive Design

Breakpoints for mobile optimization:

```css
@media (max-width: 768px) {
  /* Smaller fonts */
  /* Reduced padding */
  /* Stacked layouts */
  /* Touch-friendly sizes */
}
```

---

## React Hooks Reference

### useReport

Fetches a single report by ID using React Query.

**Signature:**
```typescript
function useReport(
  reportId: string | undefined,
  options?: UseReportOptions
): UseQueryResult<ReportData>
```

**Options:**
```typescript
interface UseReportOptions {
  enabled?: boolean;        // Enable/disable query
  staleTime?: number;       // 5 minutes default
  retry?: boolean | number; // false default (don't retry 404)
}
```

**Returns:**
```typescript
{
  data?: ReportData,
  isLoading: boolean,
  error?: Error,
  refetch: () => Promise<ReportData>
}
```

**Usage:**
```tsx
const { data, isLoading, error } = useReport(reportId);

if (isLoading) return <Spinner />;
if (error) return <ErrorMessage error={error} />;

return <ReportContent data={data} />;
```

**API Endpoint:**
```
GET /api/reports/:reportId
```

**Example Response:**
```json
{
  "typeResult": {
    "primaryType": "Architect",
    "distribution": { "Architect": 45, "Scientist": 25, ... }
  },
  "dimensions": {
    "aiCollaboration": { "score": 85, "level": "expert", ... },
    ...
  },
  "stats": { "viewCount": 42, "shareCount": 5 }
}
```

### usePersonalAnalytics

Fetches personal dashboard data (growth journey).

**Signature:**
```typescript
function usePersonalAnalytics(
  options?: UseQueryOptions
): UseQueryResult<PersonalAnalyticsData>
```

**Usage:**
```tsx
const { data: analytics, isLoading } = usePersonalAnalytics();
```

**API Endpoint:**
```
GET /api/personal
```

### useEnterprise

Fetches enterprise dashboard data (team analytics).

**Signature:**
```typescript
function useEnterprise(
  options?: UseQueryOptions
): UseQueryResult<EnterpriseData>
```

**API Endpoint:**
```
GET /api/enterprise
```

### useScrollNavigation

Custom hook for keyboard navigation and scroll synchronization.

**Signature:**
```typescript
function useScrollNavigation(
  containerRef: React.RefObject<HTMLElement>,
  options?: UseScrollNavOptions
): {
  activeSection: string;
  scrollToSection: (sectionId: string) => void;
}
```

**Features:**
- Arrow key / vim-style (j/k) navigation
- Number keys (1-8) for direct jumps
- Home/End for first/last section
- Automatic tab synchronization
- Smooth scroll animation

**Usage:**
```tsx
const containerRef = useRef<HTMLDivElement>(null);
const { activeSection, scrollToSection } = useScrollNavigation(containerRef);

return (
  <TerminalTabs
    activeTab={activeSection}
    onTabChange={scrollToSection}
  />
);
```

### useComparison

Compares multiple reports side-by-side.

**Signature:**
```typescript
function useComparison(
  reportIds: string[]
): UseQueryResult<ComparisonData>
```

### useKnowledge

Searches and fetches knowledge base articles.

**Signature:**
```typescript
function useKnowledge(
  query?: string,
  category?: string
): UseQueryResult<KnowledgeArticle[]>
```

### useLearn

Handles content upload and creation.

**Signature:**
```typescript
function useLearn(): UseMutationResult<UploadResponse, Error, ContentInput>
```

---

## Data Fetching with React Query

The application uses React Query for server state management. All API calls are configured in hooks and wrapped with React Query's `useQuery` and `useMutation`.

### QueryClient Configuration

**Location:** `web-ui/src/App.tsx`

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 minutes
      refetchOnWindowFocus: false,    // Don't refetch on focus
    },
  },
});
```

### API Proxy

Vite proxy forwards API calls to the backend:

**Location:** `web-ui/vite.config.ts`

```typescript
export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

### API Client

**Location:** `web-ui/src/api/client.ts`

Provides a fetch wrapper with error handling:

```typescript
export async function apiCall<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(endpoint, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.message || `API error: ${res.status}`);
  }

  return res.json();
}
```

---

## Development

### Starting the Dev Server

```bash
cd web-ui
npm install
npm run dev
```

This starts:
- React dev server on http://localhost:5173
- Vite HMR for hot module replacement
- API proxy to http://localhost:3001

### Building for Production

```bash
npm run build
```

Outputs optimized bundle to `web-ui/dist/`

### Type Checking

```bash
npm run lint
```

---

## Keyboard Navigation

The terminal interface supports vim-style navigation:

| Key | Action |
|-----|--------|
| `↓` or `j` | Next section |
| `↑` or `k` | Previous section |
| `1-8` | Jump to section |
| `Home` | Jump to first section |
| `End` | Jump to last section |
| `Tab` | Cycle through tabs |

**Implementation:**
- Global keyboard event listeners in `useScrollNavigation` hook
- Debounced (100ms) to prevent rapid repeats
- Ignores input when typing in forms
- Smooth scroll animation (500ms)

---

## Premium Content Unlock System

### How It Works

Content is unlocked by:

1. **Query Parameter:** `?unlocked=true` in URL
2. **Component Prop:** `isUnlocked={true}` passed to components
3. **Environment Variable:** `NOSLOP_TIER=pro|premium|enterprise`
4. **User Subscription:** (production) Check user tier in Redux/API

### Implementation

**DimensionSection.tsx:**

```tsx
export function DimensionSection({
  isUnlocked,
  ...props
}: DimensionSectionProps) {
  const blurClass = isUnlocked ? '' : styles.blurred;

  return (
    <div>
      {/* Visible always */}
      <div className={styles.subsectionTitle}>✨ Strengths</div>
      <ul className={styles.strengthsList}>{/* ... */}</ul>

      {/* Blurred if locked */}
      <div className={blurClass}>
        <div className={styles.subsectionTitle}>🌱 Growth Areas</div>
        <ul className={styles.growthList}>{/* ... */}</ul>
      </div>

      {/* Unlock prompt overlay */}
      {!isUnlocked && (
        <div className={styles.unlockPrompt}>
          <span>🔓 Unlock detailed breakdown</span>
        </div>
      )}
    </div>
  );
}
```

**CSS Module (DimensionSection.module.css):**

```css
.blurred {
  filter: blur(6px);
  user-select: none;
  pointer-events: none;
}

.unlockPrompt {
  text-align: center;
  padding: 20px;
  background: rgba(255, 204, 0, 0.08);
  border: 1px dashed var(--neon-yellow);
  border-radius: 8px;
}
```

---

## Common Patterns

### Creating a New Page

**1. Create page component:**

```tsx
// web-ui/src/pages/NewPage.tsx
export function NewPage() {
  return (
    <div>
      <Header title="Page Title" />
      {/* Content */}
    </div>
  );
}
```

**2. Add to pages index:**

```tsx
// web-ui/src/pages/index.ts
export { NewPage } from './NewPage';
```

**3. Add route in App.tsx:**

```tsx
// web-ui/src/App.tsx
import { NewPage } from './pages';

<Route path="/new" element={<NewPage />} />
```

### Creating a New Component

**1. Create component file with module CSS:**

```tsx
// web-ui/src/components/custom/MyComponent.tsx
import styles from './MyComponent.module.css';

export function MyComponent({ title, data }: Props) {
  return <div className={styles.container}>{title}</div>;
}
```

**2. Create CSS module:**

```css
/* web-ui/src/components/custom/MyComponent.module.css */
.container {
  padding: 16px;
  background: var(--terminal-surface);
  border-radius: 8px;
}
```

**3. Export from index:**

```tsx
// web-ui/src/components/custom/index.ts
export { MyComponent } from './MyComponent';
```

### Using React Query

**1. Create hook:**

```tsx
// web-ui/src/hooks/useMyData.ts
import { useQuery } from '@tanstack/react-query';

export function useMyData(id: string) {
  return useQuery({
    queryKey: ['myData', id],
    queryFn: async () => {
      const res = await fetch(`/api/data/${id}`);
      if (!res.ok) throw new Error('Failed to fetch');
      return res.json();
    },
    staleTime: 1000 * 60 * 5,
  });
}
```

**2. Use in component:**

```tsx
function MyPage() {
  const { data, isLoading, error } = useMyData(id);

  if (isLoading) return <Spinner />;
  if (error) return <Error message={error.message} />;

  return <div>{/* Render data */}</div>;
}
```

---

## TypeScript Types

Key type definitions for report data:

**Location:** `web-ui/src/types/report.ts`

```typescript
export interface TypeResult {
  primaryType: string;
  distribution: Record<string, number>;
  sessionCount: number;
  analyzedAt: string;
}

export interface DimensionResult {
  score: number;
  level: string;
  interpretation: string;
  breakdown: Record<string, DimensionBreakdown>;
  strengths?: string[];
  growthAreas?: string[];
  tips?: string[];
  warnings?: string[];
  recommendations?: string[];
}

export interface ReportData {
  typeResult: TypeResult;
  dimensions?: Record<string, DimensionResult>;
  stats: { viewCount: number; shareCount: number };
}
```

---

## Responsive Design

### Breakpoints

- **Mobile:** max-width 640px
- **Tablet:** 640px - 1024px
- **Desktop:** 1024px+

### Mobile Optimization

- Touch-friendly button sizes (48px minimum)
- Vertical stacking of layouts
- Reduced font sizes
- Simplified navigation
- Full-width cards

**Example:**

```css
@media (max-width: 768px) {
  .scoreValue {
    font-size: 56px;
  }

  .metricLabel {
    width: 120px;
    font-size: 12px;
  }

  .grid {
    grid-template-columns: 1fr;
  }
}
```

---

## Performance Optimization

### React Query Caching

- 5-minute stale time by default
- No refetch on window focus
- Manual refetch available via hook return

### CSS Performance

- CSS Modules prevent global scope pollution
- GPU acceleration with `will-change`
- Minimal repaints via CSS variables
- No deep selector nesting

### Bundle Optimization

- Tree-shaking with ES6 modules
- Code splitting with React.lazy()
- Dynamic imports for routes
- Gzip compression in production

---

## Troubleshooting

### API Proxy Not Working

**Problem:** 404 on `/api/*` endpoints

**Solution:** Ensure backend API server is running on port 3001:

```bash
# Terminal 1
cd web-ui && npm run dev

# Terminal 2
npm run api  # or backend startup command
```

### Styles Not Applying

**Problem:** CSS Module styles not showing

**Solution:**
- Verify `.module.css` filename format
- Check CSS variable definitions in `terminal-variables.css`
- Restart dev server to refresh HMR

### React Query Data Not Updating

**Problem:** Stale data in components

**Solution:**
- Use `refetch()` from hook return
- Reduce `staleTime` option
- Manually invalidate with `queryClient.invalidateQueries()`

### Mobile Layout Issues

**Problem:** Content doesn't fit on mobile

**Solution:**
- Test with DevTools device emulation
- Ensure media queries are applied
- Check font sizes and padding

---

## Future Enhancement Ideas

1. **Dark/Light Mode Toggle** - CSS variable switching
2. **Offline Mode** - Service worker caching
3. **Print Optimization** - Print-friendly stylesheet
4. **Progressive Web App** - Installable web app
5. **Real-time Updates** - WebSocket subscriptions
6. **Comparison View** - Enhanced multi-report UI
7. **Historical Tracking** - Progress graphs
8. **Accessibility** - WCAG 2.1 AA compliance
9. **Custom Themes** - User-configurable colors
10. **Export PDF** - Report download

---

## See Also

- `src/analyzer/` - Backend analysis that feeds reports
- `src/models/unified-report.ts` - Report data schemas
- `docs/ARCHITECTURE.md` - System architecture overview
- `web-ui/vite.config.ts` - Vite configuration
- `web-ui/src/App.tsx` - Router setup

---

## Contributing

When modifying the web module:

1. **Update this documentation** if adding new pages/components
2. **Test responsive design** on mobile (375px, 768px)
3. **Verify keyboard navigation** (j/k, 1-8 keys)
4. **Type check** with `npm run lint`
5. **Test accessibility** with screen readers if possible
6. **Profile performance** with DevTools Lighthouse
7. **Validate HTML** for semantic structure

---

**Last Updated:** January 2026 | React 19.2 + Vite 7.2
