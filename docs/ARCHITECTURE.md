# NoMoreAISlop - Architecture Document

> Version: 1.0.0
> Last Updated: 2026-01-09
> Status: Draft

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
│  │   /analyze   │     │ LLMAnalyzer  │     │   Storage    │   │
│  │   /sessions  │     │              │     │   Telemetry  │   │
│  │   /history   │     │              │     │              │   │
│  │   /config    │     │              │     │              │   │
│  └──────────────┘     └──────────────┘     └──────────────┘   │
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
| LLMAnalyzer | Send session to Claude API for evaluation |
| ReportGenerator | Format evaluation as CLI markdown |
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
├── src/
│   ├── index.ts                 # Main entry point & exports
│   │
│   ├── parser/
│   │   ├── index.ts             # SessionParser class
│   │   ├── jsonl-reader.ts      # JSONL file reading utilities
│   │   └── types.ts             # Parser-specific types
│   │
│   ├── analyzer/
│   │   ├── index.ts             # LLMAnalyzer class
│   │   ├── prompts.ts           # System & user prompts
│   │   └── types.ts             # Analyzer-specific types
│   │
│   ├── models/
│   │   ├── evaluation.ts        # Zod schemas for evaluation
│   │   ├── session.ts           # Zod schemas for parsed session
│   │   └── config.ts            # Zod schemas for config
│   │
│   ├── utils/
│   │   ├── reporter.ts          # ReportGenerator class
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

### 3.2 LLMAnalyzer

**File:** `src/analyzer/index.ts`

**Purpose:** Send parsed session to Claude API and receive structured evaluation.

```typescript
class LLMAnalyzer {
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model?: string);

  /**
   * Analyze a parsed session
   * @param session - Parsed session data
   * @returns Structured evaluation
   * @throws AnalysisError on API or parsing failure
   */
  analyze(session: ParsedSession): Promise<Evaluation>;

  /**
   * Build the prompt for the LLM
   * @param session - Parsed session data
   * @returns Complete prompt string
   */
  private buildPrompt(session: ParsedSession): string;

  /**
   * Parse LLM response into evaluation
   * @param response - Raw LLM response text
   * @returns Validated evaluation object
   * @throws ValidationError if response doesn't match schema
   */
  private parseResponse(response: string): Evaluation;

  /**
   * Format session as conversation text
   * @param session - Parsed session
   * @returns Formatted conversation string
   */
  private formatConversation(session: ParsedSession): string;
}
```

**Dependencies:**
- `@anthropic-ai/sdk` - Anthropic API client
- `zod` - Response validation

### 3.3 ReportGenerator

**File:** `src/utils/reporter.ts`

**Purpose:** Transform evaluation object into formatted CLI markdown.

```typescript
class ReportGenerator {
  /**
   * Generate full markdown report
   * @param evaluation - Evaluation result
   * @param metadata - Session metadata
   * @returns Formatted markdown string
   */
  generateReport(
    evaluation: Evaluation,
    metadata: SessionMetadata
  ): string;

  /**
   * Format a single category section
   * @param category - Category name
   * @param data - Category evaluation data
   * @returns Formatted section string
   */
  private formatCategory(
    category: string,
    data: CategoryEvaluation
  ): string;

  /**
   * Format rating with appropriate styling
   * @param rating - Rating value
   * @returns Styled rating string
   */
  private formatRating(rating: Rating): string;

  /**
   * Format a clue/evidence item
   * @param clue - Clue object
   * @returns Formatted clue string
   */
  private formatClue(clue: Clue): string;

  /**
   * Generate overview table
   * @param evaluation - Full evaluation
   * @returns Markdown table string
   */
  private generateOverviewTable(evaluation: Evaluation): string;
}
```

**Dependencies:**
- None (pure string manipulation)

### 3.4 StorageManager

**File:** `src/utils/storage.ts`

**Purpose:** Persist and retrieve analysis results from local filesystem.

```typescript
class StorageManager {
  private basePath: string;

  constructor(basePath?: string);

  /**
   * Save analysis result
   * @param sessionId - Session identifier
   * @param evaluation - Evaluation to save
   * @param metadata - Session metadata
   */
  saveAnalysis(
    sessionId: string,
    evaluation: Evaluation,
    metadata: SessionMetadata
  ): Promise<void>;

  /**
   * Load a specific analysis
   * @param sessionId - Session identifier
   * @returns Stored analysis or null if not found
   */
  loadAnalysis(sessionId: string): Promise<StoredAnalysis | null>;

  /**
   * List all stored analyses
   * @returns Array of analysis summaries
   */
  listAnalyses(): Promise<AnalysisSummary[]>;

  /**
   * Delete a stored analysis
   * @param sessionId - Session identifier
   */
  deleteAnalysis(sessionId: string): Promise<void>;

  /**
   * Ensure storage directory exists
   */
  private ensureDir(): Promise<void>;

  /**
   * Get file path for a session
   * @param sessionId - Session identifier
   * @returns Full file path
   */
  private getFilePath(sessionId: string): string;
}
```

**Dependencies:**
- `fs/promises` - File system operations
- `path` - Path manipulation

### 3.5 ConfigManager

**File:** `src/config/manager.ts`

**Purpose:** Manage user configuration and settings.

```typescript
class ConfigManager {
  private configPath: string;
  private config: Config;

  constructor(configPath?: string);

  /**
   * Load configuration from disk
   */
  load(): Promise<void>;

  /**
   * Save configuration to disk
   */
  save(): Promise<void>;

  /**
   * Get a configuration value
   * @param key - Config key
   * @returns Config value
   */
  get<K extends keyof Config>(key: K): Config[K];

  /**
   * Set a configuration value
   * @param key - Config key
   * @param value - New value
   */
  set<K extends keyof Config>(key: K, value: Config[K]): void;

  /**
   * Get API key from config or environment
   * @returns API key or null
   */
  getApiKey(): string | null;

  /**
   * Check if telemetry is enabled
   * @returns Boolean
   */
  isTelemetryEnabled(): boolean;

  /**
   * Reset to default configuration
   */
  reset(): void;
}
```

**Dependencies:**
- `fs/promises` - File system operations

### 3.6 TelemetryClient

**File:** `src/utils/telemetry.ts`

**Purpose:** Track anonymous usage events (opt-out).

```typescript
class TelemetryClient {
  private enabled: boolean;
  private endpoint: string;
  private anonymousId: string;

  constructor(enabled: boolean, endpoint?: string);

  /**
   * Track an event
   * @param event - Event type
   * @param properties - Additional properties
   */
  trackEvent(
    event: TelemetryEventType,
    properties?: Record<string, unknown>
  ): Promise<void>;

  /**
   * Get or create anonymous ID
   * @returns Anonymous identifier
   */
  private getAnonymousId(): string;

  /**
   * Send event to endpoint
   * @param payload - Event payload
   */
  private send(payload: TelemetryPayload): Promise<void>;
}

type TelemetryEventType =
  | 'plugin_installed'
  | 'analysis_started'
  | 'analysis_completed'
  | 'analysis_failed'
  | 'sessions_listed'
  | 'history_viewed';
```

**Dependencies:**
- `fetch` - HTTP requests (native)
- `crypto` - UUID generation

---

## 4. Data Flow

### 4.1 Analysis Flow

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
│  1. Build   │     │  claude-3.5 │
│     prompt  │     │  -sonnet    │
│  2. Call API│     │             │
│  3. Parse   │     │             │
│     response│     │             │
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

### 4.2 Session Listing Flow

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

### 4.3 History Flow

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

## 5. Error Handling Strategy

### 5.1 Error Types

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
```

### 5.2 Error Handling Matrix

| Error Type | Behavior | User Message |
|------------|----------|--------------|
| API Key Missing | Stop | "API key required. Set ANTHROPIC_API_KEY or run /noslop:config" |
| Session Not Found | Stop | "Session {id} not found. Run /noslop:sessions to see available" |
| API Rate Limit | Retry 3x | "Rate limited. Retrying..." |
| API Error | Stop | "API error: {message}. Please try again." |
| Parse Error (JSONL) | Skip line | Warning in output, continue |
| Parse Error (Response) | Retry 1x | "Failed to parse response. Retrying..." |
| Storage Error | Continue | Warning in output, analysis still displayed |

### 5.3 Retry Strategy

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

## 6. Configuration

### 6.1 Plugin Manifest

**File:** `.claude-plugin/plugin.json`

```json
{
  "name": "noslop",
  "displayName": "NoMoreAISlop",
  "version": "1.0.0",
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

### 6.2 User Configuration Schema

**File:** `~/.nomoreaislop/config.json`

```json
{
  "version": "1.0.0",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop",
  "model": "claude-3-5-sonnet-20241022",
  "apiKey": null
}
```

### 6.3 Environment Variables

| Variable | Purpose | Required |
|----------|---------|----------|
| `ANTHROPIC_API_KEY` | API key for Claude | Yes (or in config) |
| `NOSLOP_STORAGE_PATH` | Override storage location | No |
| `NOSLOP_TELEMETRY` | Override telemetry setting | No |

---

## 7. Dependencies

### 7.1 Runtime Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `@anthropic-ai/sdk` | ^0.30.0 | Anthropic API client |
| `zod` | ^3.23.0 | Schema validation |

### 7.2 Development Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| `typescript` | ^5.0.0 | TypeScript compiler |
| `vitest` | ^2.0.0 | Testing framework |
| `@types/node` | ^20.0.0 | Node.js types |

### 7.3 Peer Dependencies

| Dependency | Version | Notes |
|------------|---------|-------|
| Node.js | >=18.0.0 | Required runtime |
| Claude Code | >=2.0.12 | Plugin host |

---

## 8. Security Considerations

### 8.1 Data Privacy

- Session content is only sent to Anthropic API (user's own key)
- No data stored on third-party servers (except telemetry if enabled)
- Local storage uses plain JSON (no encryption for MVP)
- User can delete all data by removing `~/.nomoreaislop/`

### 8.2 API Key Security

- API key read from environment variable (preferred)
- Alternative: stored in local config file (user's responsibility)
- Never logged or sent to telemetry

### 8.3 Telemetry Data

Only collects:
- Anonymous installation ID (UUID)
- Event type (e.g., "analysis_completed")
- Timestamp
- Plugin version

Never collects:
- Session content
- API keys
- File paths
- User identifiable information

---

## 9. Future Considerations

### 9.1 Extensibility Points

| Point | Description |
|-------|-------------|
| Additional evaluators | Support multiple evaluation frameworks |
| Output formats | JSON, HTML, PDF exports |
| Storage backends | Cloud sync, database |
| AI tool support | Cursor, Copilot, other IDEs |

### 9.2 Performance Optimizations

| Optimization | Benefit |
|--------------|---------|
| Session caching | Faster re-analysis |
| Streaming API | Faster perceived response |
| Incremental parsing | Lower memory usage |
| Background analysis | Non-blocking UX |

### 9.3 Cloud Integration Points

| Feature | Integration |
|---------|-------------|
| Authentication | OAuth (GitHub/Google) |
| Data sync | REST API upload |
| Team features | Multi-tenant backend |
| Billing | Stripe integration |
