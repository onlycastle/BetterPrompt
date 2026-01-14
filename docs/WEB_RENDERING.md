# Web Rendering System Documentation

## Overview

The web module at `src/web/` is responsible for generating and serving terminal-aesthetic HTML reports that display AI coding style analysis results. It provides a complete web rendering pipeline with modular components, responsive design, and sophisticated styling.

**Key Features:**
- Pure Node.js HTTP server (no external dependencies)
- Terminal-themed UI with macOS Big Sur aesthetics
- Neon color scheme with glow effects
- iTerm2-style tab navigation
- Support for multiple report types (Standard, Unified, Verbose)
- Client-side scroll navigation with keyboard shortcuts
- Content unlock/locking system for premium features
- Social sharing functionality

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Web Rendering System                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Server Layer (server.ts)                                │  │
│  │  - Creates Node.js HTTP server                           │  │
│  │  - Auto-opens browser                                    │  │
│  │  - Serves HTML + JSON API                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Template Layer (templates/)                             │  │
│  │  - report.ts: Standard & Verbose reports                 │  │
│  │  - unified-report.ts: Unified analysis reports           │  │
│  │  - Combines sections & styles into HTML                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Section Components (sections/)                          │  │
│  │  - Modular rendering functions                           │  │
│  │  - Each returns HTML string                              │  │
│  │  - 10 section types available                            │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Styling (styles/terminal-theme.ts)                      │  │
│  │  - CSS variables for theming                             │  │
│  │  - macOS window chrome                                   │  │
│  │  - Terminal tabs & scrollbars                            │  │
│  │  - Responsive breakpoints                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                          ↓                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Client Scripts (scripts/scroll-navigation.ts)           │  │
│  │  - IntersectionObserver for section detection            │  │
│  │  - Keyboard navigation (arrow keys, vim-style)           │  │
│  │  - Progressive disclosure                                │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

Data Flow:
  Analysis Result → generateReportHTML() → HTML String → Server → Browser
  (TypeResult,    (Template combines  (Complete      (HTTP   (Rendered
   Dimensions,     sections + styles)  document)      200)     UI)
   Verbose)
```

---

## Server Module (`server.ts`)

### Primary Functions

#### `startReportServer(result, options?, dimensions?)`

Starts a local HTTP server to display a report.

```typescript
import { startReportServer } from '@/web';

const result = { /* TypeResult */ };
const dimensions = { /* FullAnalysisResult */ };

const { server, port, url } = await startReportServer(result, {
  port: 3000,
  autoOpen: true
}, dimensions);

console.log(`Report available at ${url}`);
```

**Parameters:**
- `result: TypeResult` - Type analysis result (required)
- `options?: WebServerOptions` - Server configuration
  - `port?: number` - Port number (default: 3000)
  - `autoOpen?: boolean` - Auto-open in browser (default: true)
- `dimensions?: FullAnalysisResult` - Optional extended analysis data

**Returns:**
```typescript
{
  server: Server;      // Node.js HTTP server instance
  port: number;        // Actual port number (may differ if port was in use)
  url: string;         // Full URL (e.g., http://localhost:3000)
}
```

#### `startVerboseReportServer(verboseResult, options?)`

Starts a server for verbose/hyper-personalized evaluation results.

```typescript
const { server, port, url } = await startVerboseReportServer(verboseEvaluation);
```

**Parameters:**
- `verboseResult: VerboseEvaluation` - Verbose evaluation with personality insights
- `options?: WebServerOptions` - Server configuration (same as above)

#### `stopReportServer(server)`

Gracefully shuts down the server.

```typescript
await stopReportServer(server);
```

### HTTP Endpoints

| Endpoint | Method | Returns | Purpose |
|----------|--------|---------|---------|
| `/` | GET | HTML | Main report page |
| `/index.html` | GET | HTML | Alias for main page |
| `/api/result` | GET | JSON | Raw analysis data (for API calls) |

**API Response Structure:**

Standard report endpoint (`/api/result`):
```typescript
{
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
}
```

Verbose report endpoint (`/api/result`):
```typescript
{
  typeResult: TypeResult;
  verboseEvaluation: VerboseEvaluation;
}
```

### Port Management

The server automatically handles port conflicts by incrementing the port number (up to 10 attempts):

```
Requested: 3000
In use    → try 3001
In use    → try 3002
Available → bind to 3002
```

### Browser Opening

Platform-specific commands to open the browser:

- **macOS:** `open "http://localhost:PORT"`
- **Windows:** `start "http://localhost:PORT"`
- **Linux:** `xdg-open "http://localhost:PORT"`

---

## Template System

### Report Types

The web module supports three report types:

#### 1. Standard Report
- Input: `TypeResult` only
- Features: Main result, coding style distribution
- Use case: Quick personality test results

#### 2. Extended Report
- Input: `TypeResult` + `FullAnalysisResult` (dimensions)
- Features: Standard + 6 analysis dimensions with breakdown
- Use case: Full capability assessment

#### 3. Verbose Report
- Input: `VerboseEvaluation` + multi-session analysis
- Features: Personality summary, prompt patterns, locked teasers
- Use case: Hyper-personalized employee evaluation

#### 4. Unified Report
- Input: `UnifiedReport` (comprehensive analysis)
- Features: Profile + dimensions + insights + evidence + recommendations
- Use case: Enterprise capability assessment with learning paths

### Template Functions

#### `generateReportHTML(result, dimensions?, options?, verboseEvaluation?)`

Main template generator that combines all sections.

```typescript
import { generateReportHTML } from '@/web';

const html = generateReportHTML(typeResult, dimensions, {
  reportId: 'unique-id-123',
  baseUrl: 'https://nomoreaislop.xyz',
  enableSharing: true,
  unlocked: false  // Lock premium content
});
```

**Options Object:**
```typescript
interface ReportOptions {
  reportId?: string;           // Unique identifier for sharing
  baseUrl?: string;            // Base URL for share links (default: https://nomoreaislop.xyz)
  enableSharing?: boolean;     // Include share section (default: true)
  unlocked?: boolean;          // Show premium content (default: false)
}
```

**Premium Content Unlock Logic:**

```typescript
// Content is unlocked if ANY of:
1. options.unlocked === true
2. process.env.NOSLOP_TEST_TIER is 'pro', 'premium', or 'enterprise'
3. User has paid tier subscription (in production)
```

#### `generateUnifiedReportHTML(report, options?)`

Template specifically for unified/comprehensive reports.

```typescript
import { generateUnifiedReportHTML } from '@/web';

const html = generateUnifiedReportHTML(unifiedReport, {
  reportId: 'unique-id',
  unlocked: true
});
```

### Template Structure

Both templates follow this HTML structure:

```html
<!DOCTYPE html>
<html>
<head>
  <!-- Meta tags (OG, Twitter, description) -->
  <!-- Google Fonts (JetBrains Mono) -->
  <!-- Inline CSS from getEnhancedStyles() -->
</head>
<body>
  <!-- Fixed background (macOS Big Sur gradient) -->
  <div class="macos-background"></div>

  <!-- Terminal window container -->
  <div class="terminal-window">
    <!-- Terminal titlebar with macOS buttons -->
    <div class="terminal-header">
      <!-- iTerm2-style tabs -->
      <div class="terminal-tabs">
        <div class="terminal-tab" data-section="result">profile</div>
        <div class="terminal-tab" data-section="aiCollaboration">ai-collab</div>
        <!-- More tabs... -->
      </div>
    </div>

    <!-- Scrollable content container -->
    <div class="scroll-container">
      <!-- Section 1: Main Result -->
      <div class="snap-section" data-section="result">
        <!-- Content -->
      </div>

      <!-- Sections 2-N: Analysis dimensions, share, locked, footer -->
      <!-- Each section is a snap-section -->
    </div>
  </div>

  <!-- Client-side scripts -->
  <script>/* getScrollScript() output */</script>
</body>
</html>
```

---

## Section Components Reference

All section components are located in `src/web/sections/` and have a consistent signature:

```typescript
export function renderSectionName(data: DataType, isUnlocked?: boolean): string
```

Each returns an HTML string that will be embedded in the template.

### 1. Main Result Section (`main-result.ts`)

**Purpose:** Display primary coding style and distribution breakdown

**Input:**
```typescript
renderMainResultSection(
  result: TypeResult,        // Primary type + distribution
  meta: TypeMetadata         // Emoji, name, tagline
): string
```

**Features:**
- Large emoji display of primary type
- "YOU ARE [TYPE]" headline
- Type tagline quote
- Distribution bar chart across all 5 types
- Current primary type highlighted with marker

**Example Output:**
```
┌─────────────────────────────┐
│         🏛️                  │
│   YOU ARE ARCHITECT          │
│  "I design solutions"        │
├─────────────────────────────┤
│ 📊 Style Distribution        │
│ 🏛️ Architect    ████████ 45% │
│ 🔬 Scientist    █████░░░ 25% │
│ 🤝 Collaborator ███░░░░░ 15% │
│ 🚀 Speedrunner  ██░░░░░░ 10% │
│ 🎨 Craftsman    ░░░░░░░░  5% │
└─────────────────────────────┘
```

### 2. AI Collaboration Mastery (`ai-collaboration.ts`)

**Purpose:** Assess how effectively users collaborate with AI

**Input:**
```typescript
renderAICollaborationSection(
  data: AICollaborationResult,  // Score, level, breakdown
  isUnlocked: boolean           // Show detailed content
): string
```

**Features:**
- Overall collaboration score (0-100)
- Level classification (expert, proficient, developing, novice)
- Three key metrics with progress bars:
  - Structured Planning
  - AI Orchestration
  - Critical Verification
- Strengths list (always visible)
- Growth areas (blurred if locked)
- Unlock prompt (if content locked)

**Data Structure:**
```typescript
interface AICollaborationResult {
  score: number;                    // 0-100
  level: 'expert' | 'proficient' | 'developing' | 'novice';
  interpretation: string;           // Description of score
  breakdown: {
    structuredPlanning: { score: number; explanation: string };
    aiOrchestration: { score: number; explanation: string };
    criticalVerification: { score: number; explanation: string };
  };
  strengths: string[];              // Max 5
  growthAreas: string[];            // Max 5
}
```

### 3. Context Engineering (`context-engineering.ts`)

**Purpose:** Evaluate context management skills

**Input:**
```typescript
renderContextEngineeringSection(
  data: ContextEngineeringResult,
  isUnlocked: boolean
): string
```

**Features:**
- Similar structure to AI Collaboration
- Metrics: Information Architecture, Prompt Crafting, Session Management
- Shows how well developers structure context for AI

### 4. Burnout Risk (`burnout-risk.ts`)

**Purpose:** Assess developer burnout indicators

**Input:**
```typescript
renderBurnoutRiskSection(
  data: BurnoutRiskResult,
  isUnlocked: boolean
): string
```

**Features:**
- Low score is good (risk minimized)
- Risk indicators:
  - Overreliance on AI
  - Context switching frequency
  - Work-life balance signals
- Warning styling for high-risk scores
- Growth recommendations

### 5. Tool Mastery (`tool-mastery.ts`)

**Purpose:** Evaluate proficiency with development tools and AI integration

**Input:**
```typescript
renderToolMasterySection(
  data: ToolMasteryResult,
  isUnlocked: boolean
): string
```

**Features:**
- Tool effectiveness metrics
- Feature adoption rates
- Advanced technique usage
- Learning opportunities

### 6. AI Control (`ai-control.ts`)

**Purpose:** Assess intentionality in AI usage (not just reactivity)

**Input:**
```typescript
renderAIControlSection(
  data: AIControlResult,
  isUnlocked: boolean
): string
```

**Features:**
- Control level classification (vibe-coder, developing, ai-master)
- Decision-making patterns
- Proactive vs reactive AI usage
- Agency metrics

### 7. Skill Resilience (`skill-resilience.ts`)

**Purpose:** Measure how well developers maintain core skills while using AI

**Input:**
```typescript
renderSkillResilienceSection(
  data: SkillResilienceResult,
  isUnlocked: boolean
): string
```

**Features:**
- Skill maintenance indicators
- Deep understanding signals
- Risk factors for skill atrophy
- Recommendations for balance

### 8. Share Section (`share.ts`)

**Purpose:** Social sharing functionality

**Input:**
```typescript
renderShareSection(
  result: TypeResult,
  meta: TypeMetadata,
  reportId?: string,
  baseUrl?: string
): string
```

**Features:**
- Share to Twitter/X with pre-filled text
- Share to LinkedIn
- Copy link to clipboard with toast notification
- Dashboard buttons (My Dashboard, Enterprise)
- Analytics tracking

**Dashboard URLs:**
```typescript
baseUrl / personal    // Personal dashboard
baseUrl / enterprise  // Enterprise dashboard
```

**Note:** Returns empty string if no `reportId` provided.

### 9. Locked Section (`locked.ts`)

**Purpose:** Show premium content teaser with upgrade prompt

**Input:**
```typescript
renderLockedSection(): string
```

**Features:**
- "Unlock premium insights" message
- Call-to-action for subscription
- Teaser of locked content

### 10. Footer (`footer.ts`)

**Purpose:** Closing section with links and attribution

**Input:**
```typescript
renderFooter(): string
```

**Features:**
- Links to main site
- Social media links
- Privacy/Terms links
- Version information

---

## Styling System (`styles/terminal-theme.ts`)

### Architecture

The styling system provides 1148 lines of CSS organized into logical sections:

```
CSS Variables (Colors, Fonts)
  ↓
Reset & Base Styles
  ↓
macOS Background (Gradient)
  ↓
Terminal Window Frame
  ↓
Terminal Titlebar & Tabs
  ↓
Scrollable Content
  ↓
Section Layouts
  ↓
Component Styles
  ↓
Responsive Breakpoints
```

### CSS Variables

#### Color Palette

```css
/* Background Colors */
--bg-primary: #0a0a0a;        /* Darkest - main background */
--bg-secondary: #111111;      /* Mid-dark - cards */
--bg-tertiary: #1a1a1a;       /* Lighter - accents */

/* Text Colors */
--text-primary: #e0e0e0;      /* Main text */
--text-secondary: #888888;    /* Secondary text */
--text-muted: #555555;        /* Disabled/muted */

/* Neon Colors (iTerm2-inspired) */
--neon-green: #00ff88;        /* Success, highlights */
--neon-cyan: #00d4ff;         /* Primary accent */
--neon-magenta: #ff00ff;      /* Alerts, secondary */
--neon-yellow: #ffcc00;       /* Warnings */
--neon-red: #ff4444;          /* Errors, danger */
--neon-purple: #8b5cf6;       /* Tertiary accent */
--neon-pink: #ec4899;         /* Soft accent */

/* Borders & Misc */
--border: #333333;            /* Border color */
--font-mono: 'JetBrains Mono' /* Monospace font stack */
```

#### Color Usage Guidelines

| Purpose | Color | Use Case |
|---------|-------|----------|
| Success/Good | `--neon-green` | High scores, strengths |
| Primary | `--neon-cyan` | Main UI, emphasis |
| Alert/Warning | `--neon-yellow` | Caution, warnings |
| Danger/Error | `--neon-red` | Errors, high risk |
| Secondary | `--neon-magenta` | Secondary emphasis |
| Soft Accent | `--neon-pink` | Alternative highlights |

### Key Style Classes

#### Terminal Window Frame

```css
.terminal-window
  /* Fixed position container */
  /* Centered with padding */
  /* 900px max-width */
  /* Semi-transparent dark background */
  /* Glass-morphism blur effect */
  /* Subtle border and shadow */

.terminal-titlebar
  /* macOS-style dark gray titlebar */
  /* Traffic light buttons (red, yellow, green) */
  /* Title text */

.terminal-tabs
  /* Horizontal scrollable tab bar */
  /* Active tab highlighted */
  /* Tab index numbers */

.terminal-btn
  /* Circular traffic light buttons */
  /* Red: #ed6158, Yellow: #fcc02e, Green: #5fc038 */
```

#### Section Layout

```css
.snap-section
  /* Snap-scroll section container */
  /* Full viewport height */
  /* Padding for content */

.snap-section.in-view
  /* Active section styling */
  /* Tab highlight synchronization */

.section-header
  /* Icon, title, subtitle */
  /* Flex layout for alignment */

.score-display
  /* Score value (large) */
  /* Level classification badge */
  /* Contextual styling based on level */

.score-level.healthy
  /* Green styling (good level) */

.score-level.balanced
  /* Cyan styling (developing level) */

.score-level.moderate
  /* Yellow styling (intermediate) */

.score-level.warning
  /* Red styling (needs improvement) */
```

#### Metric Visualization

```css
.metric-bar
  /* Progress bar container */
  /* Background color */

.metric-fill.green
  /* Green progress fill */

.metric-fill.cyan
  /* Cyan progress fill */

.metric-fill.magenta
  /* Magenta progress fill */

.metric-fill.yellow
  /* Yellow progress fill */
```

#### Blur/Lock Effects

```css
.blurred-content
  /* Frozen/locked premium content */
  filter: blur(6px);
  pointer-events: none;

.unlock-prompt
  /* "Unlock premium insights" message */
  /* Centered, prominent styling */
```

### macOS Big Sur Background

The background uses a sophisticated 5-layer radial gradient:

```css
/* Top blue sky */
radial-gradient(ellipse 100% 50% at 80% 10%, #4FA4E5 0%, transparent 50%)

/* Center warm/white streak */
radial-gradient(ellipse 80% 30% at 70% 45%, rgba(255, 255, 255, 0.7) 0%, rgba(255, 200, 150, 0.4) 40%, transparent 60%)

/* Main coral/red wave */
radial-gradient(ellipse 130% 70% at 50% 70%, #FF6B6B 0%, #D64545 35%, transparent 65%)

/* Left purple-magenta blend */
radial-gradient(ellipse 80% 90% at 8% 75%, #8B5CF6 0%, #EC4899 50%, transparent 70%)

/* Base gradient */
linear-gradient(160deg, #1E3A5F 0%, #1A1A2E 50%, #0F0F1A 100%)
```

This creates the characteristic warm-to-cool sunset/sunrise aesthetic.

### Responsive Breakpoints

```css
/* Mobile optimization */
@media (max-width: 768px) {
  .terminal-window {
    width: calc(100% - 20px);  /* Reduced padding on mobile */
    max-width: 100%;
  }

  .terminal-titlebar {
    font-size: 12px;          /* Smaller text */
  }

  .metric-bar {
    height: 8px;              /* Slimmer bars on mobile */
  }

  /* Adjust font sizes */
  body { font-size: 12px; }

  /* Stack layouts vertically if needed */
}
```

---

## Client-Side Scripts (`scripts/scroll-navigation.ts`)

### Features

The scroll navigation system provides an intuitive interface for navigating report sections:

#### 1. Intersection Observer

Automatically detects which section is in view:

```javascript
// Activate section when it appears in viewport
const observerOptions = {
  root: container,
  rootMargin: '-10% 0px -80% 0px',  // Adjust sensitivity
  threshold: [0, 0.1, 0.2]
};
```

**Behavior:**
- Sections activate when top 10% enters viewport
- Bottom 80% not considered for activation
- Debounced with 50ms delay to prevent flickering

#### 2. Tab Synchronization

Updates terminal tabs to match active section:

```javascript
// When section enters view:
sections.forEach(s => s.classList.remove('in-view'));
activeSection.classList.add('in-view');

// Update tabs:
terminalTabs.forEach(tab => {
  tab.classList.toggle('active', tab.dataset.section === sectionId);
});
```

#### 3. Keyboard Navigation

| Key | Action |
|-----|--------|
| `↓` / `j` | Next section |
| `↑` / `k` | Previous section |
| `1-8` | Jump to section (1 = first) |
| `Home` | Jump to first section |
| `End` | Jump to last section |

**Features:**
- Debounce to prevent rapid key presses (100ms)
- Ignores keys when typing in input/textarea
- Smooth scroll animation (500ms)

#### 4. Tab Click Navigation

Clicking terminal tabs scrolls to that section:

```javascript
terminalTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    scrollToSection(tab.dataset.section);
  });
});
```

#### 5. Progressive Disclosure

Shows/hides additional quotes with animation:

```javascript
toggleDimensionQuotes(quoteWallId, btn, totalQuotes)
```

**Behavior:**
- Initially shows first 3 quotes
- Click "Show more" to expand remaining
- Staggered animation: `(index - 3) * 50ms`
- Smooth opacity and transform transitions

**HTML Structure for Quotes:**

```html
<div id="wall-123" class="dimension-quotes">
  <div class="quote-card">Quote 1</div>
  <div class="quote-card">Quote 2</div>
  <div class="quote-card">Quote 3</div>
  <div class="quote-card" style="display: none;">Quote 4</div>
  <div class="quote-card" style="display: none;">Quote 5</div>
</div>

<button onclick="toggleDimensionQuotes('wall-123', this, 5)">
  Show +2 more quotes
</button>
```

---

## Verbose Report Components (`verbose/`)

For multi-session hyper-personalized analysis, additional specialized sections:

### 1. Personality Summary (`personality-summary.ts`)

Renders a personalized AI coding personality description.

```typescript
renderVerbosePersonalitySummary(
  verboseEval: VerboseEvaluation,
  isUnlocked: boolean
): string
```

**Features:**
- LLM-generated personality narrative (100-1500 chars)
- Custom styled card with cyan left border
- 🎭 emoji icon

### 2. Prompt Patterns (`prompt-patterns.ts`)

Analyzes recurring patterns in how users prompt the AI.

```typescript
renderVerbosePromptPatterns(
  verboseEval: VerboseEvaluation,
  isUnlocked: boolean
): string
```

**Features:**
- Pattern name and description
- Frequency classification (frequent, occasional, rare)
- 2-3 example quotes per pattern
- Analysis of each example

### 3. Dimension Insights (`dimension-insights.ts`)

Deep-dive into each dimension with examples and resources.

```typescript
renderVerboseDimensionInsights(
  verboseEval: VerboseEvaluation,
  isUnlocked: boolean
): string
```

**Features:**
- Conversation-based insights (actual quotes)
- Research-based insights (industry sources)
- Actionable learning resources
- Resource level (beginner, intermediate, advanced)
- Relevance scoring

### 4. Locked Teasers (`locked-teasers.ts`)

Premium features preview for locked content.

```typescript
renderVerboseLockedTeasers(): string
```

**Features:**
- Teaser text showing what's locked
- Call-to-action for upgrade
- Visual lock icon

---

## Component Utilities (`components.ts`)

Helper functions for common rendering patterns:

### Props Interfaces

```typescript
interface MetricRowProps {
  label: string;
  score: number;
  colorThreshold?: number;       // Score above which uses positive color
  positiveColor?: string;        // Color for good scores
  negativeColor?: string;        // Color for poor scores
}

interface SectionHeaderProps {
  icon: string;                  // Emoji or SVG
  title: string;                 // Main heading
  subtitle: string;              // Subheading
}

interface ScoreDisplayProps {
  score: number;                 // 0-100 or custom range
  level: string;                 // 'expert', 'proficient', etc.
  levelLabel: string;            // Display text for level
  levelClass: string;            // CSS class (healthy, balanced, etc.)
  scoreLabel?: string;           // Custom label
}

interface ListSectionProps {
  title: string;
  icon: string;
  items: string[];
  itemColor: string;             // CSS color value
  itemPrefix: string;            // Symbol before each item (✓, →, etc.)
  blurred?: boolean;             // Apply blur filter
}
```

### Dimension Configuration

```typescript
const DIMENSION_CONFIG = {
  aiCollaboration: {
    icon: '🤝',
    title: 'AI Collaboration Mastery',
    subtitle: 'How effectively do you collaborate with AI?',
    levelLabels: {
      expert: 'Expert Collaborator',
      proficient: 'Proficient User',
      developing: 'Developing Skills',
      novice: 'Getting Started'
    },
    goodLevels: ['expert', 'proficient']
  },
  // ... similar for other dimensions
}
```

### Utility Functions

```typescript
function getLevelClass(
  level: string,
  positiveLevel: string | string[],
  useWarning?: boolean
): CssLevelClass

// Maps levels to CSS classes:
// - Positive level → 'healthy' (green)
// - 'developing' → 'balanced' (cyan)
// - Other → 'moderate' (yellow) or 'warning' (red)
```

---

## How to Add a New Section

Step-by-step guide to add a new report section:

### 1. Create Section Component

Create `/src/web/sections/my-section.ts`:

```typescript
/**
 * My Section Component
 *
 * Brief description of what this section shows.
 */

import { getLevelClass } from '../types.js';

export interface MySectionData {
  score: number;
  level: 'expert' | 'proficient' | 'developing' | 'novice';
  interpretation: string;
  strengths: string[];
  growthAreas: string[];
}

export function renderMySection(
  data: MySectionData,
  isUnlocked: boolean
): string {
  const levelClass = getLevelClass(data.level, ['expert', 'proficient']);

  return `
    <div class="section-header">
      <div class="section-icon">🎯</div>
      <div class="section-title">My Section Title</div>
      <div class="section-subtitle">Subtitle explaining what we measure</div>
    </div>

    <div class="score-display">
      <div class="score-value">${data.score}</div>
      <div class="score-label">out of 100</div>
      <span class="score-level ${levelClass}">${data.level}</span>
    </div>

    <div class="interpretation">
      ${data.interpretation}
    </div>

    ${data.strengths.length > 0 ? `
    <div class="subsection-title">✨ Your Strengths</div>
    <ul style="list-style: none;">
      ${data.strengths.map(s => `<li style="color: var(--neon-green);">✓ ${s}</li>`).join('')}
    </ul>
    ` : ''}

    ${data.growthAreas.length > 0 ? `
    <div class="subsection-title">🌱 Growth Areas</div>
    <ul style="list-style: none;">
      ${data.growthAreas.map(g => `<li style="color: var(--text-muted);">→ ${g}</li>`).join('')}
    </ul>
    ` : ''}

    ${isUnlocked ? '' : `
    <div class="unlock-prompt">
      <span>🔓 Unlock detailed insights</span>
    </div>
    `}
  `;
}
```

### 2. Export from Sections Index

Add to `/src/web/sections/index.ts`:

```typescript
export { renderMySection } from './my-section.js';
```

### 3. Import in Template

Add to `/src/web/templates/report.ts`:

```typescript
import { renderMySection } from '../sections/index.js';
```

### 4. Add to Template Generation

In the `generateReportHTML()` function, add:

```typescript
const myData = dimensions?.mySection; // Or from other source

const html = `
  ...
  <div class="snap-section" data-section="mySection" data-index="4">
    <div class="section-content">
      ${renderMySection(myData, isUnlocked)}
    </div>
  </div>
  ...
`;
```

### 5. Add Terminal Tab

In the tabs section:

```typescript
<div class="terminal-tab" data-section="mySection">
  <span class="tab-index">4:</span>
  <span class="tab-text">my-section</span>
</div>
```

### 6. Update Styles (if needed)

Add any custom CSS to `getEnhancedStyles()` in `styles/terminal-theme.ts`:

```typescript
/* My Section Styles */
.my-section-custom-class {
  /* Custom styling */
}
```

### 7. Test

```bash
npm run build
# Test with sample data
```

---

## Report Types Comparison

| Aspect | Standard | Extended | Verbose | Unified |
|--------|----------|----------|---------|---------|
| **Input Data** | TypeResult | TypeResult + Dimensions | VerboseEvaluation | UnifiedReport |
| **Sessions** | Single | Single | Multiple | Multiple |
| **Report Size** | ~5KB | ~15KB | ~50KB | ~80KB |
| **Sections** | 3-4 | 8-10 | 4-5 (verbose) | 10+ (detailed) |
| **Premium Content** | None | Yes (Blurred) | Yes (Blurred) | Yes (Blurred) |
| **Sharing** | Basic | Full | Full | Full |
| **API Response** | Small | Medium | Large | Extra Large |
| **Load Time** | <100ms | ~200ms | ~300ms | ~400ms |
| **Use Case** | Quick test | Full assessment | Hyper-personal | Enterprise |

---

## Performance Optimization

### CSS Performance

- **Reduced gradient layers:** 9 → 5 for macOS background
- **GPU acceleration:** `will-change` on animated elements
- **Efficient selectors:** Avoid deep nesting
- **CSS variables:** Single source of truth for colors

### JavaScript Performance

- **Debouncing:** 100ms for keyboard input, 50ms for section activation
- **IntersectionObserver:** More efficient than scroll listeners
- **requestAnimationFrame:** Smooth animations
- **Lazy initialization:** Scripts run after DOM ready

### HTML/Network

- **Inline CSS:** No extra request for styles
- **Inline JavaScript:** Single JS file
- **No external dependencies:** Server works offline
- **Compression:** Gzip reduces HTML ~60%

### Caching Headers

```typescript
res.writeHead(200, {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-cache',  // Always fresh, but use browser cache
});
```

---

## Common Patterns & Best Practices

### Section Component Template

```typescript
export function renderSectionName(
  data: SectionData,
  isUnlocked: boolean
): string {
  // 1. Determine styling based on level
  const levelClass = getLevelClass(data.level, ['expert']);

  // 2. Render header
  // 3. Render score display
  // 4. Render interpretation
  // 5. Render metrics/breakdown
  // 6. Render strengths (always visible)
  // 7. Render growth areas (with blur if locked)
  // 8. Render unlock prompt (if locked)
  // 9. Return complete HTML string
}
```

### Color Selection

- High scores: Use `--neon-green` (#00ff88)
- Primary emphasis: Use `--neon-cyan` (#00d4ff)
- Warnings: Use `--neon-yellow` (#ffcc00)
- Errors: Use `--neon-red` (#ff4444)
- Secondary: Use `--neon-magenta` or `--neon-pink`

### Unlock/Lock Pattern

```typescript
// Always visible
<div class="subsection-title">✨ Your Strengths</div>

// Blurred if locked
<div class="${isUnlocked ? '' : 'blurred-content'}">
  Growth areas content...
</div>

// Unlock prompt (only if locked)
${isUnlocked ? '' : `
<div class="unlock-prompt">
  <span>🔓 Unlock detailed insights</span>
</div>
`}
```

---

## Troubleshooting

### Server Won't Start

**Problem:** Port already in use
**Solution:** Server auto-increments port. Check actual port in return value.

```typescript
const { port } = await startReportServer(result);
console.log(`Running on port ${port}`); // May not be 3000
```

### Browser Won't Open

**Problem:** `openBrowser()` fails silently
**Solution:** Browser opening is non-blocking. Manually open the URL.

```typescript
const { url } = await startReportServer(result, { autoOpen: false });
console.log(`Open ${url} in your browser`);
```

### Styling Issues

**Problem:** Colors look different in different browsers
**Solution:**
- Test in Chrome/Firefox/Safari
- Check system color settings
- Verify CSS variables are loaded

### Performance Issues

**Problem:** Slow scroll or janky animations
**Solution:**
- Check for layout thrashing in scroll handlers
- Use `will-change` CSS sparingly
- Profile with DevTools Performance tab

### Content Not Unlocking

**Problem:** Premium content stays blurred
**Solution:** Check environment variable or options:

```typescript
// Option 1: Explicit unlock
await startReportServer(result, { unlocked: true });

// Option 2: Environment variable
process.env.NOSLOP_TEST_TIER = 'pro';

// Option 3: Check report tier (for unified reports)
if (report.tier === 'premium') { /* already unlocked */ }
```

---

## Files Reference

| File | Purpose | Lines |
|------|---------|-------|
| `src/web/server.ts` | HTTP server, port management, browser opening | 225 |
| `src/web/index.ts` | Module exports | 23 |
| `src/web/types.ts` | TypeScript interfaces and utilities | 61 |
| `src/web/components.ts` | Reusable component functions | ~300 |
| `src/web/templates/index.ts` | Template barrel export | 8 |
| `src/web/templates/report.ts` | Standard/Verbose report generator | ~500 |
| `src/web/templates/unified-report.ts` | Unified report generator | ~400 |
| `src/web/sections/main-result.ts` | Primary type display | 51 |
| `src/web/sections/ai-collaboration.ts` | Collaboration assessment | 91 |
| `src/web/sections/context-engineering.ts` | Context management | ~80 |
| `src/web/sections/burnout-risk.ts` | Burnout indicators | ~80 |
| `src/web/sections/tool-mastery.ts` | Tool proficiency | ~80 |
| `src/web/sections/ai-control.ts` | AI intentionality | ~80 |
| `src/web/sections/skill-resilience.ts` | Skill maintenance | ~80 |
| `src/web/sections/share.ts` | Social sharing | 212 |
| `src/web/sections/locked.ts` | Premium teaser | ~40 |
| `src/web/sections/footer.ts` | Closing section | ~50 |
| `src/web/sections/index.ts` | Section exports | 16 |
| `src/web/styles/terminal-theme.ts` | All CSS styling | 1148 |
| `src/web/scripts/scroll-navigation.ts` | Client-side navigation | 203 |
| `src/web/verbose/personality-summary.ts` | Verbose personality | 15 |
| `src/web/verbose/prompt-patterns.ts` | Prompt analysis | ~50 |
| `src/web/verbose/dimension-insights.ts` | Deep dimension analysis | ~60 |
| `src/web/verbose/locked-teasers.ts` | Locked content preview | ~40 |
| `src/web/verbose/index.ts` | Verbose exports | ~10 |

---

## API Integration Example

```typescript
// Start server and get data endpoint
const { server, port, url } = await startReportServer(result, dimensions);

// Fetch data via API
const response = await fetch(`http://localhost:${port}/api/result`);
const data = await response.json();

// Access data
console.log(data.typeResult.primaryType);
console.log(data.dimensions?.aiCollaboration?.score);

// Stop server when done
await stopReportServer(server);
```

---

## Environment Variables

| Variable | Default | Purpose |
|----------|---------|---------|
| `NOSLOP_DASHBOARD_URL` | `http://localhost:5173` | Dashboard link URL |
| `NOSLOP_TEST_TIER` | (none) | Test tier (pro/premium/enterprise) |
| `NODE_ENV` | `development` | Environment mode |

---

## Future Enhancement Ideas

1. **Dark/Light Mode Toggle:** CSS variable switching
2. **Export to PDF:** Use Puppeteer or similar
3. **Custom Branding:** Logo, colors, domain
4. **Offline Mode:** Service worker caching
5. **Mobile App:** React Native wrapper
6. **Real-time Updates:** WebSocket for live analysis
7. **Comparison View:** Compare multiple reports
8. **Historical Tracking:** Graph progress over time
9. **Print Optimization:** Print-friendly stylesheet
10. **Accessibility:** WCAG 2.1 AA compliance

---

## Contributing

When modifying the web module:

1. **Update this documentation** if adding new sections
2. **Test responsive design** on mobile (375px, 768px)
3. **Verify accessibility** with keyboard navigation
4. **Performance test** with DevTools Lighthouse
5. **Check browser compatibility** (Chrome, Firefox, Safari)
6. **Validate HTML** for proper semantic structure

---

## See Also

- `src/models/unified-report.ts` - Report data schemas
- `src/analyzer/` - Analysis logic that feeds web templates
- `src/cli/output/` - CLI rendering (similar patterns)
- `docs/ARCHITECTURE.md` - System architecture overview
