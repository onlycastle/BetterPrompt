# NoMoreAISlop - Architecture Document

> Version: 2.1.0
> Last Updated: 2026-01-10
> Status: Production

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     Claude Code Plugin                          │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   Commands   │────▶│    Core      │────▶│   Output     │   │
│  │   (Entry)    │     │   Pipeline   │     │   Layer      │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
│         │                    │                    │            │
│         ▼                    ▼                    ▼            │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │   /noslop    │     │ SessionParser│     │   Reporter   │   │
│  │   /analyze   │     │ LLMAnalyzer  │     │ WebServer ◄─┐│   │
│  │   /sessions  │     │ StyleAnalyzer│     │   CLI        ││   │
│  │   /history   │     │ Dimensions   │     │   Storage    ││   │
│  │   /config    │     │              │     │   Telemetry  ││   │
│  └──────────────┘     └──────────────┘     └──────────────┘│   │
│                              │                              │   │
│                              ▼                              │   │
│                       ┌──────────────┐                     │   │
│                       │  Dimensions  │                     │   │
│                       │  (v2.1 NEW)  │                     │   │
│                       │              │                     │   │
│                       │ • AI Collab. │                     │   │
│                       │ • Prompt Scr │                     │   │
│                       │ • Burnout    │                     │   │
│                       │ • Tool Mast. │                     │   │
│                       └──────────────┘                     │   │
│                              │                              │   │
│                              └──────────────────────────────┘   │
│                                                                │
├────────────────────────────────────────────────────────────────┤
│                     External Dependencies                       │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│  │  ~/.claude/  │     │  Anthropic   │     │ ~/.nomore-   │   │
│  │  projects/   │     │     API      │     │  aislop/     │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
└────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Responsibilities

| Component | Responsibility |
|-----------|---------------|
| Commands | Entry points for user interaction |
| SessionParser | Read and parse Claude Code JSONL logs |
| LLMAnalyzer | Send session to Claude API for evaluation (legacy) |
| **StyleAnalyzer** | **NEW v2.1**: Determine AI Coding Style type |
| **Dimensions** | **NEW v2.1**: Calculate deep analysis metrics |
| ReportGenerator | Format evaluation as CLI markdown |
| **WebServer** | **NEW v2.1**: Serve terminal-aesthetic HTML reports |
| StorageManager | Persist analysis results locally |
| ConfigManager | Manage user settings |
| TelemetryClient | Track anonymous usage events |

---

## 2. Directory Structure

```
nomoreaislop/
├── .claude-plugin/
│   └── plugin.json              # Plugin manifest (required)
│
├── commands/
│   ├── noslop.md                # Quick analysis (current session)
│   ├── analyze.md               # Analyze specific session
│   ├── sessions.md              # List available sessions
│   ├── history.md               # View past analyses
│   └── config.md                # Manage settings
│
├── scripts/                     # NEW v2.1: Entry point scripts
│   └── analyze-style.ts         # Main CLI entry for style analysis
│
├── src/
│   ├── index.ts                 # Main entry point & exports
│   │
│   ├── parser/
│   │   ├── index.ts             # SessionParser class
│   │   ├── jsonl-reader.ts      # JSONL file reading utilities
│   │   └── types.ts             # Parser-specific types
│   │
│   ├── analyzer/
│   │   ├── index.ts             # LLMAnalyzer class (legacy)
│   │   ├── prompts.ts           # System & user prompts
│   │   ├── schema-converter.ts  # Zod to JSON Schema converter
│   │   ├── style-analyzer.ts    # NEW v2.1: Style analysis orchestrator
│   │   ├── type-detector.ts     # NEW v2.1: Type detection logic
│   │   ├── evidence-extractor.ts# NEW v2.1: Extract conversation evidence
│   │   │
│   │   └── dimensions/          # NEW v2.1: Deep analysis dimensions
│   │       ├── index.ts         # Dimension aggregator
│   │       ├── ai-collaboration.ts # AI Collaboration Mastery Score (0-100)
│   │       ├── prompt-score.ts  # Prompt Engineering Score (0-100)
│   │       ├── burnout-risk.ts  # Burnout Risk Analysis
│   │       └── tool-mastery.ts  # Tool Mastery Profile
│   │
│   ├── web/                     # NEW v2.1: Web server for reports
│   │   ├── server.ts            # HTTP server (pure Node.js)
│   │   └── template.ts          # Terminal-aesthetic HTML generator
│   │
│   ├── cli/output/
│   │   ├── spinner.ts           # Loading spinner
│   │   ├── ratings.ts           # Rating display
│   │   ├── evidence.ts          # Evidence display
│   │   └── components/          # NEW v2.1: UI components
│   │       ├── index.ts         # Re-exports
│   │       └── type-result.ts   # Type result renderer
│   │
│   ├── models/
│   │   ├── evaluation.ts        # Zod schemas for evaluation (legacy)
│   │   ├── session.ts           # Zod schemas for parsed session
│   │   ├── style-types.ts       # NEW v2.1: AI Coding Style types
│   │   ├── dimensions.ts        # NEW v2.1: Dimension result types
│   │   ├── config.ts            # Zod schemas for config
│   │   ├── storage.ts           # Zod schemas for storage
│   │   └── telemetry.ts         # Zod schemas for telemetry
│   │
│   ├── utils/
│   │   ├── reporter.ts          # ReportGenerator class (legacy)
│   │   ├── storage.ts           # StorageManager class
│   │   ├── telemetry.ts         # TelemetryClient class
│   │   └── errors.ts            # Custom error types
│   │
│   └── config/
│       └── manager.ts           # ConfigManager class
│
├── tests/
│   ├── fixtures/                # Test data files
│   ├── parser.test.ts
│   ├── analyzer.test.ts
│   ├── reporter.test.ts
│   ├── style-analyzer.test.ts   # NEW v2.1
│   ├── dimensions.test.ts       # NEW v2.1
│   └── storage.test.ts
│
├── docs/
│   ├── PRD.md
│   ├── ARCHITECTURE.md          # This file
│   ├── DATA_MODELS.md
│   ├── PROMPTS.md
│   └── TEST_PLAN.md
│
├── package.json
├── tsconfig.json
├── .gitignore
├── LICENSE                      # MIT
└── README.md
```

---

## 3. Core Components

### 3.1 SessionParser

**File:** `src/parser/index.ts`

**Purpose:** Read and parse Claude Code JSONL session logs into a structured format for analysis.

```typescript
class SessionParser {
  private claudeDir: string;

  constructor(claudeDir?: string);

  /**
   * Parse a specific session by ID
   * @param sessionId - UUID of the session
   * @returns Parsed session with messages and metadata
   * @throws SessionNotFoundError if session doesn't exist
   */
  parseSession(sessionId: string): Promise<ParsedSession>;

  /**
   * List all available sessions across all projects
   * @returns Array of session metadata sorted by date (newest first)
   */
  listSessions(): Promise<SessionMetadata[]>;

  /**
   * Get the current active session ID
   * @returns Session ID or null if no active session
   */
  getCurrentSessionId(): string | null;

  /**
   * Find session file path by ID
   * @param sessionId - UUID to search for
   * @returns Full path to JSONL file
   */
  private findSessionPath(sessionId: string): Promise<string | null>;

  /**
   * Parse a single JSONL file
   * @param filePath - Path to JSONL file
   * @returns Parsed messages array
   */
  private parseJsonlFile(filePath: string): Promise<RawMessage[]>;
}
```

**Dependencies:**
- `fs/promises` - File system operations
- `readline` - Line-by-line JSONL parsing
- `path` - Path manipulation

### 3.2 StyleAnalyzer (NEW v2.1)

**File:** `src/analyzer/style-analyzer.ts`

**Purpose:** Analyze sessions to determine AI Coding Style personality type (MBTI-like for coding).

```typescript
/**
 * Analyze sessions and determine AI Coding Style
 *
 * Returns one of 5 types:
 * - Architect: Strategic planner, upfront design
 * - Scientist: Analytical, experiments before committing
 * - Collaborator: Iterative feedback loops with AI
 * - Speedrunner: Fast execution, minimal planning
 * - Craftsman: Refines and polishes iteratively
 */
function analyzeStyle(
  sessions: ParsedSession[],
  options?: StyleAnalyzerOptions
): TypeResult;

/**
 * Get detailed analysis for a single session
 */
function analyzeSession(session: ParsedSession): {
  metrics: SessionMetrics;
  distribution: TypeDistribution;
  primaryType: CodingStyleType;
};
```

**Key Features:**
- Pattern detection across conversation history
- Evidence extraction from actual prompts
- Type distribution scoring (all 5 types with percentages)
- Strengths and growth points identification

**Dependencies:**
- `type-detector.ts` - Metric extraction and type scoring
- `evidence-extractor.ts` - Conversation quote extraction

### 3.3 Dimensions Module (NEW v2.1)

**Directory:** `src/analyzer/dimensions/`

**Purpose:** Calculate deep analysis metrics for extended insights.

#### 3.3.1 AI Collaboration Mastery Score

**File:** `ai-collaboration.ts`

```typescript
interface AICollaborationResult {
  score: number; // 0-100, higher is better
  level: 'novice' | 'developing' | 'proficient' | 'expert';
  breakdown: {
    contextEngineering: number;
    structuredPlanning: number;
    orchestration: number;
    criticalVerification: number;
  };
  interpretation: string;
}

function calculateAICollaboration(sessions: ParsedSession[]): AICollaborationResult;
```

**Categories:**
- Context Engineering - Quality of information provided to AI
- Structured Planning - Pre-planning and approach clarity
- AI Orchestration - Effective multi-turn collaboration patterns
- Critical Verification - Quality of code review and validation

#### 3.3.2 Prompt Engineering Score

**File:** `prompt-score.ts`

```typescript
interface PromptScoreResult {
  score: number; // 0-100, higher is better
  level: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  breakdown: {
    contextProvision: number;
    specificity: number;
    constraintDefinition: number;
    iterativeRefinement: number;
  };
  interpretation: string;
}

function calculatePromptScore(sessions: ParsedSession[]): PromptScoreResult;
```

**Metrics:**
- Context provision (background info, code snippets)
- Specificity (clear vs vague requests)
- Constraint definition (requirements, edge cases)
- Iterative refinement (follow-up improvements)

#### 3.3.3 Burnout Risk Analysis

**File:** `burnout-risk.ts`

```typescript
interface BurnoutRiskResult {
  score: number; // 0-100, higher is riskier
  level: 'low' | 'moderate' | 'elevated' | 'high';
  breakdown: {
    sessionLength: number;
    taskSwitching: number;
    intensityPattern: string;
    recoveryTime: number;
  };
  interpretation: string;
}

function calculateBurnoutRisk(sessions: ParsedSession[]): BurnoutRiskResult;
```

**Metrics:**
- Session duration patterns
- Task-switching frequency
- Intensity patterns (sprints vs sustained)
- Recovery time between sessions

#### 3.3.4 Tool Mastery Profile

**File:** `tool-mastery.ts`

```typescript
interface ToolMasteryResult {
  overallScore: number; // 0-100
  breakdown: {
    readWriteBalance: number;
    grepEffectiveness: number;
    multiToolChains: number;
    bashUsage: number;
  };
  topTools: Array<{ tool: string; count: number }>;
  interpretation: string;
}

function calculateToolMastery(sessions: ParsedSession[]): ToolMasteryResult;
```

**Metrics:**
- Read/Write balance (verification before changes)
- Grep effectiveness (search before modify)
- Multi-tool chains (complex workflows)
- Bash usage (advanced operations)

### 3.4 WebServer (NEW v2.1)

**File:** `src/web/server.ts`

**Purpose:** Serve terminal-aesthetic HTML reports locally with freemium conversion psychology.

```typescript
/**
 * Start a local web server to display the report
 */
async function startReportServer(
  result: TypeResult,
  options?: WebServerOptions,
  dimensions?: FullAnalysisResult
): Promise<{ server: Server; port: number; url: string }>;

/**
 * Stop the report server
 */
function stopReportServer(server: Server): Promise<void>;
```

**Key Features:**
- Pure Node.js HTTP server (no external framework)
- Terminal-aesthetic CSS with monospace fonts
- FREE tier: Type result + limited evidence (2 samples)
- LOCKED tier: Full evidence (8 samples) + dimensions + PDF + badge
- Auto-port selection (tries 3000, increments if busy)
- Auto-open in default browser

**HTML Structure:**
```
┌─────────────────────────────────┐
│     FREE SECTION (Always)       │
│  • Your Type (Architect, etc.)  │
│  • Distribution Chart           │
│  • Strengths                    │
│  • Evidence (2 samples)         │
└─────────────────────────────────┘
┌─────────────────────────────────┐
│    LOCKED SECTION (Blur)        │
│  • All Evidence (8 samples)     │
│  • Dimensions (4 scores)        │
│  • Growth Roadmap               │
│  • PDF Download                 │
│  • Shareable Badge              │
│                                 │
│  [$6.99 ONE-TIME UNLOCK]        │
└─────────────────────────────────┘
```

**Template Features (template.ts):**
- Terminal-aesthetic CSS (green text, black bg, phosphor glow)
- Typewriter font (JetBrains Mono, Fira Code fallbacks)
- Blur effect on locked sections
- Sticky CTA button
- Responsive design

### 3.5 LLMAnalyzer (Legacy)

**File:** `src/analyzer/index.ts`

**Purpose:** Send parsed session to Claude API and receive structured evaluation (original v1.0 approach).

```typescript
class LLMAnalyzer {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string);

  /**
   * Analyze a parsed session using Claude API
   * @param session - Parsed session data
   * @returns Structured evaluation
   * @throws AnalysisError on API or parsing failure
   */
  analyze(session: ParsedSession): Promise<Evaluation>;

  /**
   * Build the prompt for the LLM
   */
  private buildPrompt(session: ParsedSession): string;

  /**
   * Parse LLM response into evaluation using Structured Outputs
   */
  private parseResponse(response: string): Evaluation;
}
```

**Note:** This component is kept for backward compatibility with v1.0 evaluation approach. v2.1 primarily uses rule-based `StyleAnalyzer` for performance and cost efficiency.

**Dependencies:**
- `@anthropic-ai/sdk` - Anthropic API client
- `zod` - Response validation
- `schema-converter.ts` - Zod to JSON Schema conversion

### 3.6 ReportGenerator (Legacy)

**File:** `src/utils/reporter.ts`

**Purpose:** Transform v1.0 evaluation object into formatted CLI markdown.

```typescript
class ReportGenerator {
  generateReport(
    evaluation: Evaluation,
    metadata: SessionMetadata
  ): string;

  private formatCategory(
    category: string,
    data: CategoryEvaluation
  ): string;

  private formatRating(rating: Rating): string;
  private formatClue(clue: Clue): string;
  private generateOverviewTable(evaluation: Evaluation): string;
}
```

**Note:** v2.1 uses new CLI components in `src/cli/output/components/` for type result rendering.

### 3.7 StorageManager

**File:** `src/utils/storage.ts`

**Purpose:** Persist and retrieve analysis results from local filesystem.

```typescript
class StorageManager {
  private basePath: string;

  constructor(basePath?: string);

  saveAnalysis(
    sessionId: string,
    evaluation: Evaluation,
    metadata: SessionMetadata
  ): Promise<void>;

  loadAnalysis(sessionId: string): Promise<StoredAnalysis | null>;
  listAnalyses(): Promise<AnalysisSummary[]>;
  deleteAnalysis(sessionId: string): Promise<void>;

  private ensureDir(): Promise<void>;
  private getFilePath(sessionId: string): string;
}
```

**Storage Location:** `~/.nomoreaislop/analyses/`

**Dependencies:**
- `fs/promises` - File system operations
- `path` - Path manipulation

### 3.8 ConfigManager

**File:** `src/config/manager.ts`

**Purpose:** Manage user configuration and settings.

```typescript
class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configPath?: string);

  load(): Promise<void>;
  save(): Promise<void>;

  get<K extends keyof Config>(key: K): Config[K];
  set<K extends keyof Config>(key: K, value: Config[K]): void;

  getApiKey(): string | null;
  isTelemetryEnabled(): boolean;
  reset(): void;
}
```

**Config Location:** `~/.nomoreaislop/config.json`

**Dependencies:**
- `fs/promises` - File system operations

### 3.9 TelemetryClient

**File:** `src/utils/telemetry.ts`

**Purpose:** Track anonymous usage events (opt-out).

```typescript
class TelemetryClient {
  private enabled: boolean;
  private endpoint: string;
  private anonymousId: string;

  constructor(enabled: boolean, endpoint?: string);

  trackEvent(
    event: TelemetryEventType,
    properties?: Record<string, unknown>
  ): Promise<void>;

  private getAnonymousId(): string;
  private send(payload: TelemetryPayload): Promise<void>;
}

type TelemetryEventType =
  | 'plugin_installed'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'sessions_listed'
  | 'history_viewed'
  | 'style_analyzed'      // NEW v2.1
  | 'web_report_opened';  // NEW v2.1
```

**Dependencies:**
- `fetch` - HTTP requests (native)
- `crypto` - UUID generation

---

## 4. Data Flow

### 4.1 Style Analysis Flow (NEW v2.1)

```
┌─────────────┐
│   Command   │  User runs script: node scripts/analyze-style.ts
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Session   │  1. Scan ~/.claude/projects/
│   Parser    │  2. Find all *.jsonl files
│             │  3. Parse recent 30 sessions
└──────┬──────┘
       │
       ├──────────────────────────────┐
       ▼                              ▼
┌─────────────┐               ┌─────────────┐
│   Style     │               │ Dimensions  │
│  Analyzer   │               │   Module    │
│             │               │             │
│ 1. Extract  │               │ • AI Collab.│
│    metrics  │               │ • Prompt    │
│ 2. Calculate│               │ • Burnout   │
│    scores   │               │ • Tool      │
│ 3. Detect   │               │             │
│    type     │               │ Score each  │
│ 4. Extract  │               │ dimension   │
│    evidence │               │ 0-100       │
└──────┬──────┘               └──────┬──────┘
       │                             │
       └──────────┬──────────────────┘
                  ▼
           ┌─────────────┐
           │   Output    │
           │   Layer     │
           │             │
           │  CLI + Web  │
           └──────┬──────┘
                  │
       ┌──────────┴──────────┐
       ▼                     ▼
┌─────────────┐       ┌─────────────┐
│    CLI      │       │     Web     │
│   Output    │       │   Server    │
│             │       │             │
│ • Type box  │       │ • Terminal  │
│ • Distrib.  │       │   aesthetic │
│ • Evidence  │       │ • FREE tier │
│   (2 samp.) │       │ • LOCKED    │
│ • Dim. prev.│       │   sections  │
│ • Web link  │       │ • CTA       │
└─────────────┘       └─────────────┘
       │                     │
       ▼                     ▼
  Terminal            http://localhost:3000
```

### 4.2 Legacy Analysis Flow (v1.0)

```
┌─────────────┐
│   Command   │  User runs /noslop or /noslop:analyze <id>
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Config    │  Load API key and settings
│   Manager   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Session   │  1. Find session JSONL file
│   Parser    │  2. Parse line by line
│             │  3. Extract messages & metadata
└──────┬──────┘
       │
       ▼
┌─────────────┐     ┌─────────────┐
│    LLM      │────▶│  Anthropic  │
│  Analyzer   │◀────│    API      │
│             │     │             │
│  1. Build   │     │  claude-4.5 │
│     prompt  │     │  -sonnet    │
│  2. Call API│     │             │
│  3. Parse   │     │ Structured  │
│     response│     │  Outputs    │
└──────┬──────┘     └─────────────┘
       │
       ▼
┌─────────────┐
│   Report    │  Format evaluation as markdown
│  Generator  │
└──────┬──────┘
       │
       ├─────────────────────────────┐
       ▼                             ▼
┌─────────────┐               ┌─────────────┐
│    CLI      │               │   Storage   │
│   Output    │               │   Manager   │
│             │               │             │
│  Display    │               │  Save JSON  │
│  markdown   │               │  to disk    │
└─────────────┘               └─────────────┘
       │
       ▼
┌─────────────┐
│  Telemetry  │  Track analysis_completed event
│   Client    │
└─────────────┘
```

### 4.3 Session Listing Flow

```
┌─────────────┐
│   Command   │  User runs /noslop:sessions
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Session   │  1. Scan ~/.claude/projects/
│   Parser    │  2. Find all *.jsonl files
│             │  3. Read metadata from each
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    CLI      │  Display table of sessions
│   Output    │
└─────────────┘
```

### 4.4 History Flow

```
┌─────────────┐
│   Command   │  User runs /noslop:history
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Storage   │  1. Scan ~/.nomoreaislop/analyses/
│   Manager   │  2. Read metadata from each JSON
└──────┬──────┘
       │
       ▼
┌─────────────┐
│    CLI      │  Display table of past analyses
│   Output    │
└─────────────┘
```

---

## 5. Data Models (v2.1)

### 5.1 AI Coding Style Types

```typescript
type CodingStyleType =
  | 'architect'      // Strategic planner
  | 'scientist'      // Analytical experimenter
  | 'collaborator'   // Iterative feedback loops
  | 'speedrunner'    // Fast execution
  | 'craftsman';     // Refines and polishes

interface TypeMetadata {
  name: string;
  emoji: string;
  tagline: string;
  description: string;
  strengths: string[];
  growthPoints: string[];
  traits: {
    planningStyle: string;
    communicationPattern: string;
    iterationSpeed: string;
  };
}
```

**Type Definitions:**

| Type | Emoji | Tagline | Planning | Communication | Speed |
|------|-------|---------|----------|---------------|-------|
| Architect | 🏗️ | "I design before I build" | Upfront, detailed | Structured requests | Measured |
| Scientist | 🔬 | "I experiment to understand" | Hypothesis-driven | Questions first | Exploratory |
| Collaborator | 🤝 | "I iterate with feedback" | Incremental | Conversational | Steady |
| Speedrunner | ⚡ | "I move fast and fix later" | Minimal | Terse commands | Rapid |
| Craftsman | 🎨 | "I refine until perfect" | Iterative polish | Detailed refinement | Patient |

### 5.2 Type Result

```typescript
interface TypeResult {
  primaryType: CodingStyleType;
  distribution: TypeDistribution;
  metrics: {
    avgPromptLength: number;
    avgFirstPromptLength: number;
    avgTurnsPerSession: number;
    questionFrequency: number;
    modificationRate: number;
    toolUsageHighlight: string;
  };
  evidence: Evidence[];
  sessionCount: number;
  analyzedAt: string;
}

interface TypeDistribution {
  architect: number;      // 0-100%
  scientist: number;
  collaborator: number;
  speedrunner: number;
  craftsman: number;
}

interface Evidence {
  type: CodingStyleType;
  quote: string;          // Actual user prompt
  timestamp: string;
  explanation: string;    // Why this is evidence
}
```

### 5.3 Dimension Results

```typescript
interface FullAnalysisResult {
  aiCollaboration: AICollaborationResult;
  promptScore: PromptScoreResult;
  burnoutRisk: BurnoutRiskResult;
  toolMastery: ToolMasteryResult;
}

// Each dimension has:
// - score: number (0-100)
// - level: string (e.g., 'novice' | 'developing' | 'proficient' | 'expert')
// - breakdown: Record<string, number>
// - interpretation: string
```

---

## 6. Error Handling Strategy

### 6.1 Error Types

```typescript
// Base error class
class NoSlopError extends Error {
  code: string;
  suggestion?: string;
}

// Specific error types
class SessionNotFoundError extends NoSlopError {
  code = 'SESSION_NOT_FOUND';
}

class ApiKeyMissingError extends NoSlopError {
  code = 'API_KEY_MISSING';
  suggestion = 'Set ANTHROPIC_API_KEY environment variable';
}

class AnalysisError extends NoSlopError {
  code = 'ANALYSIS_FAILED';
}

class ParseError extends NoSlopError {
  code = 'PARSE_ERROR';
}

class StorageError extends NoSlopError {
  code = 'STORAGE_ERROR';
}

// NEW v2.1
class ServerError extends NoSlopError {
  code = 'SERVER_ERROR';
}
```

### 6.2 Error Handling Matrix

| Error Type | Behavior | User Message |
|------------|----------|--------------|
| API Key Missing | Stop | "API key required. Set ANTHROPIC_API_KEY or run /noslop:config" |
| Session Not Found | Stop | "Session {id} not found. Run /noslop:sessions to see available" |
| API Rate Limit | Retry 3x | "Rate limited. Retrying..." |
| API Error | Stop | "API error: {message}. Please try again." |
| Parse Error (JSONL) | Skip line | Warning in output, continue |
| Parse Error (Response) | Retry 1x | "Failed to parse response. Retrying..." |
| Storage Error | Continue | Warning in output, analysis still displayed |
| **Port Unavailable** | **Retry 10x** | **"Port {N} busy, trying {N+1}..."** |
| **Server Error** | **Continue** | **"Could not start web server. Check CLI output."** |

### 6.3 Retry Strategy

```typescript
async function withRetry<T>(
  fn: () => Promise<T>,
  options: {
    maxRetries: number;
    backoff: 'exponential' | 'linear';
    initialDelayMs: number;
  }
): Promise<T> {
  let lastError: Error;

  for (let i = 0; i <= options.maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (i < options.maxRetries) {
        const delay = options.backoff === 'exponential'
          ? options.initialDelayMs * Math.pow(2, i)
          : options.initialDelayMs * (i + 1);

        await sleep(delay);
      }
    }
  }

  throw lastError;
}
```

---

## 7. Configuration

### 7.1 Plugin Manifest

**File:** `.claude-plugin/plugin.json`

```json
{
  "name": "noslop",
  "displayName": "NoMoreAISlop",
  "version": "2.1.0",
  "description": "Analyze your AI collaboration skills",
  "author": "nomoreaislop",
  "license": "MIT",
  "repository": "https://github.com/nomoreaislop/nomoreaislop",
  "engines": {
    "claude-code": ">=2.0.12"
  },
  "commands": [
    "commands/noslop.md",
    "commands/analyze.md",
    "commands/sessions.md",
    "commands/history.md",
    "commands/config.md"
  ]
}
```

### 7.2 User Configuration Schema

**File:** `~/.nomoreaislop/config.json`

```json
{
  "version": "2.1.0",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop",
  "model": "claude-sonnet-4-20250514",
  "apiKey": null,
  "webServerPort": 3000,
  "webServerAutoOpen": true
}
```

### 7.3 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `ANTHROPIC_API_KEY` | API key for Claude (legacy LLM mode) | No (v2.1 rule-based) |
| `NOSLOP_STORAGE_PATH` | Override storage location | No |
| `NOSLOP_TELEMETRY` | Override telemetry setting | No |
| `NOSLOP_MODEL` | Override default model | No |
| **`NOSLOP_WEB_PORT`** | **Override default port (3000)** | **No** |

---

## 8. Dependencies

### 8.1 Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | ^0.35.0 | Anthropic API client (legacy) |
| `zod` | ^3.24.0 | Schema validation |
| `zod-to-json-schema` | ^3.24.0 | Schema conversion for API |
| **`picocolors`** | **^1.1.1** | **Terminal colors** |
| **`boxen`** | **^8.0.1** | **CLI boxes** |
| **`cli-table3`** | **^0.6.5** | **CLI tables** |
| **`ora`** | **^8.1.1** | **CLI spinner** |
| **`wrap-ansi`** | **^9.0.0** | **Text wrapping** |
| **`dotenv`** | **^17.2.3** | **Environment variables** |

### 8.2 Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.7.0 | TypeScript compiler |
| `vitest` | ^2.1.0 | Testing framework |
| `@types/node` | ^22.0.0 | Node.js types |
| **`tsx`** | **^4.21.0** | **TypeScript execution** |

### 8.3 Peer Dependencies

| Dependency | Version | Notes |
|------------|---------|-------|
| Node.js | >=18.0.0 | Required runtime |
| Claude Code | >=2.0.12 | Plugin host |

---

## 9. Security Considerations

### 9.1 Data Privacy

- Session content is only sent to Anthropic API (user's own key) **in legacy mode**
- **v2.1**: Style analysis is **local-only** (no API calls)
- No data stored on third-party servers (except telemetry if enabled)
- Local storage uses plain JSON (no encryption for MVP)
- User can delete all data by removing `~/.nomoreaislop/`
- **Web server runs locally** (localhost only, no external access)

### 9.2 API Key Security

- API key read from environment variable (preferred)
- Alternative: stored in local config file (user's responsibility)
- Never logged or sent to telemetry
- **Not required for v2.1 style analysis**

### 9.3 Telemetry Data

Only collects:
- Anonymous installation ID (UUID)
- Event type (e.g., "style_analyzed", "web_report_opened")
- Timestamp
- Plugin version
- Session count (number, not content)

Never collects:
- Session content
- API keys
- File paths
- User identifiable information
- Prompts or code

### 9.4 Web Server Security

- Runs on localhost only (no external binding)
- No authentication (local-only access)
- No persistent storage (in-memory only)
- Auto-stops when process exits
- No file system access from browser

---

## 10. Future Considerations

### 10.1 Extensibility Points

| Point | Description |
|-------|-------------|
| Additional evaluators | Support multiple evaluation frameworks |
| Output formats | JSON, **HTML (v2.1)**, PDF exports (planned) |
| Storage backends | Cloud sync, database |
| AI tool support | Cursor, Copilot, other IDEs |
| **Type system expansion** | **More personality types** |
| **Dimension plugins** | **Custom metrics via plugins** |

### 10.2 Performance Optimizations

| Optimization | Benefit |
|--------------|---------|
| Session caching | Faster re-analysis |
| Streaming API | Faster perceived response (legacy) |
| Incremental parsing | Lower memory usage |
| Background analysis | Non-blocking UX |
| **Web report caching** | **Faster page loads** |
| **Dimension parallelization** | **Faster multi-dimension analysis** |

### 10.3 Monetization (v2.1+)

| Feature | Tier |
|---------|------|
| Type analysis | FREE |
| Evidence (2 samples) | FREE |
| CLI output | FREE |
| Web report (basic) | FREE |
| **All evidence (8 samples)** | **LOCKED ($6.99)** |
| **Dimension scores** | **LOCKED ($6.99)** |
| **Growth roadmap** | **LOCKED ($6.99)** |
| **PDF download** | **LOCKED ($6.99)** |
| **Shareable badge** | **LOCKED ($6.99)** |

**Payment Integration:**
- Stripe Checkout (planned)
- One-time payment (no subscription)
- License key activation
- Unlock stored locally (~/.nomoreaislop/license.json)

### 10.4 Cloud Integration Points

| Feature | Integration |
|---------|-------------|
| Authentication | OAuth (GitHub/Google) |
| Data sync | REST API upload |
| Team features | Multi-tenant backend |
| Billing | Stripe integration |
| **Badge hosting** | **CDN for shareable badges** |
| **Leaderboard** | **Anonymous type distribution stats** |

---

## 11. Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-01-09 | Initial release: LLM-based evaluation |
| **2.1.0** | **2026-01-10** | **Style types, dimensions, web reports, freemium model** |

---

## Appendix A: Terminal Aesthetic Design Principles

The v2.1 web interface follows these design principles:

### Color Palette
- Background: `#0d1117` (GitHub dark)
- Text: `#00ff00` (phosphor green)
- Dim text: `#58a6ff` (accent blue)
- Glow: `text-shadow: 0 0 10px #00ff00`

### Typography
- Font: JetBrains Mono, Fira Code, Courier New
- Line height: 1.6
- Letter spacing: 0.5px
- Monospace everywhere

### Layout
- Max width: 800px
- Padding: 24px
- Border radius: 8px
- Box shadows for depth

### Interactivity
- Hover effects: Glow intensification
- Smooth transitions: 0.3s ease
- Locked sections: Blur filter + overlay
- CTA button: Sticky bottom, yellow highlight

### Conversion Psychology
- Free tier shows value
- Locked sections create curiosity
- One-time pricing reduces friction
- Social proof via testimonials (planned)
- Scarcity: "Unlock this analysis forever"
