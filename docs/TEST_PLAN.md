# NoMoreAISlop - Test Plan

> Version: 1.0.0
> Last Updated: 2026-01-09
> Status: Draft

---

## 1. Overview

This document defines the test strategy, test cases, and verification procedures for NoMoreAISlop plugin.

### 1.1 Test Categories

| Category | Purpose | Tools |
|----------|---------|-------|
| Unit Tests | Test individual components in isolation | Vitest |
| Integration Tests | Test component interactions | Vitest |
| Manual Tests | Verify end-to-end user experience | Manual |
| Performance Tests | Measure execution time | Custom timing |

### 1.2 Coverage Goals

| Component | Target Coverage |
|-----------|-----------------|
| SessionParser | 90% |
| LLMAnalyzer | 80% |
| ReportGenerator | 90% |
| StorageManager | 90% |
| ConfigManager | 90% |
| TelemetryClient | 70% |

---

## 2. Unit Tests

### 2.1 SessionParser Tests

**File:** `tests/parser.test.ts`

#### 2.1.1 JSONL Parsing

```typescript
describe('SessionParser', () => {
  describe('parseJsonlFile', () => {
    test('parses valid JSONL file correctly', async () => {
      // Given: A valid JSONL file with user and assistant messages
      // When: parseJsonlFile is called
      // Then: Returns array of parsed message objects
    });

    test('handles empty JSONL file', async () => {
      // Given: An empty JSONL file
      // When: parseJsonlFile is called
      // Then: Returns empty array without error
    });

    test('skips malformed JSON lines', async () => {
      // Given: JSONL file with some invalid JSON lines
      // When: parseJsonlFile is called
      // Then: Valid lines are parsed, invalid lines skipped with warning
    });

    test('ignores non-message types', async () => {
      // Given: JSONL with queue-operation and file-history-snapshot entries
      // When: parseJsonlFile is called
      // Then: Only user and assistant messages are returned
    });
  });
});
```

#### 2.1.2 Session Parsing

```typescript
describe('parseSession', () => {
  test('extracts user messages correctly', async () => {
    // Given: Session with user messages
    // When: parseSession is called
    // Then: User messages have correct role, content, timestamp
  });

  test('extracts assistant messages correctly', async () => {
    // Given: Session with assistant messages
    // When: parseSession is called
    // Then: Assistant messages include content and tool calls
  });

  test('calculates session duration correctly', async () => {
    // Given: Session spanning 45 minutes
    // When: parseSession is called
    // Then: durationSeconds equals 2700
  });

  test('counts tool calls correctly', async () => {
    // Given: Session with 10 tool uses
    // When: parseSession is called
    // Then: stats.toolCallCount equals 10
  });

  test('aggregates token usage', async () => {
    // Given: Multiple assistant messages with token usage
    // When: parseSession is called
    // Then: Total tokens are summed correctly
  });

  test('throws SessionNotFoundError for missing session', async () => {
    // Given: Non-existent session ID
    // When: parseSession is called
    // Then: Throws SessionNotFoundError
  });
});
```

#### 2.1.3 Session Listing

```typescript
describe('listSessions', () => {
  test('returns all sessions across projects', async () => {
    // Given: Multiple projects with sessions
    // When: listSessions is called
    // Then: Returns sessions from all projects
  });

  test('sorts sessions by date (newest first)', async () => {
    // Given: Sessions from different dates
    // When: listSessions is called
    // Then: Array is sorted newest to oldest
  });

  test('includes correct metadata for each session', async () => {
    // Given: Sessions with various metadata
    // When: listSessions is called
    // Then: Each session has sessionId, projectPath, timestamp, messageCount
  });

  test('handles empty projects directory', async () => {
    // Given: No projects in ~/.claude
    // When: listSessions is called
    // Then: Returns empty array without error
  });
});
```

### 2.2 LLMAnalyzer Tests

**File:** `tests/analyzer.test.ts`

#### 2.2.1 Prompt Building

```typescript
describe('LLMAnalyzer', () => {
  describe('buildPrompt', () => {
    test('includes system prompt', () => {
      // Given: Parsed session
      // When: buildPrompt is called
      // Then: Result includes system prompt content
    });

    test('formats conversation correctly', () => {
      // Given: Session with messages
      // When: buildPrompt is called
      // Then: Conversation is formatted with timestamps and roles
    });

    test('includes session metadata', () => {
      // Given: Session with stats
      // When: buildPrompt is called
      // Then: Includes duration, message count, tool count
    });

    test('truncates long conversations', () => {
      // Given: Session with 100+ messages
      // When: buildPrompt is called
      // Then: Conversation is truncated with indicator
    });
  });
});
```

#### 2.2.2 Response Parsing

```typescript
describe('parseResponse', () => {
  test('parses valid JSON response', () => {
    // Given: Valid JSON evaluation response
    // When: parseResponse is called
    // Then: Returns Evaluation object
  });

  test('extracts JSON from markdown code block', () => {
    // Given: Response with JSON in ```json block
    // When: parseResponse is called
    // Then: Extracts and parses JSON correctly
  });

  test('validates against schema', () => {
    // Given: JSON with invalid rating value
    // When: parseResponse is called
    // Then: Throws ValidationError
  });

  test('throws ParseError for invalid JSON', () => {
    // Given: Malformed JSON string
    // When: parseResponse is called
    // Then: Throws ParseError
  });
});
```

#### 2.2.3 API Integration

```typescript
describe('analyze', () => {
  test('calls Anthropic API with correct parameters', async () => {
    // Given: Mocked Anthropic client
    // When: analyze is called
    // Then: API called with correct model, max_tokens, messages
  });

  test('handles rate limit with retry', async () => {
    // Given: API returns 429 first, then success
    // When: analyze is called
    // Then: Retries and returns result
  });

  test('throws AnalysisError after max retries', async () => {
    // Given: API consistently fails
    // When: analyze is called
    // Then: Throws AnalysisError after retries exhausted
  });
});
```

### 2.3 ReportGenerator Tests

**File:** `tests/reporter.test.ts`

```typescript
describe('ReportGenerator', () => {
  describe('generateReport', () => {
    test('includes session summary header', () => {
      // Given: Evaluation with metadata
      // When: generateReport is called
      // Then: Output includes session ID, duration, message count
    });

    test('generates overview table', () => {
      // Given: Evaluation with all three ratings
      // When: generateReport is called
      // Then: Output includes markdown table with ratings
    });

    test('formats each category section', () => {
      // Given: Evaluation with category data
      // When: generateReport is called
      // Then: Each category has heading, summary, and clues
    });

    test('includes evidence quotes', () => {
      // Given: Evaluation with clues
      // When: generateReport is called
      // Then: Quotes are formatted as blockquotes
    });

    test('includes recommendations', () => {
      // Given: Evaluation with recommendations
      // When: generateReport is called
      // Then: Recommendations are numbered list
    });

    test('includes footer with save path', () => {
      // Given: Evaluation with session ID
      // When: generateReport is called
      // Then: Footer shows save location
    });
  });

  describe('formatRating', () => {
    test('formats Strong rating', () => {
      expect(formatRating('Strong')).toContain('Strong');
    });

    test('formats Developing rating', () => {
      expect(formatRating('Developing')).toContain('Developing');
    });

    test('formats Needs Work rating', () => {
      expect(formatRating('Needs Work')).toContain('Needs Work');
    });
  });
});
```

### 2.4 StorageManager Tests

**File:** `tests/storage.test.ts`

```typescript
describe('StorageManager', () => {
  describe('saveAnalysis', () => {
    test('saves analysis to correct path', async () => {
      // Given: Evaluation and metadata
      // When: saveAnalysis is called
      // Then: File created at ~/.nomoreaislop/analyses/{id}.json
    });

    test('creates directory if not exists', async () => {
      // Given: No existing storage directory
      // When: saveAnalysis is called
      // Then: Directory is created
    });

    test('overwrites existing analysis', async () => {
      // Given: Existing analysis file
      // When: saveAnalysis called with same ID
      // Then: File is overwritten
    });

    test('includes version and timestamp', async () => {
      // Given: Evaluation to save
      // When: saveAnalysis is called
      // Then: Saved JSON includes version and createdAt
    });
  });

  describe('loadAnalysis', () => {
    test('loads existing analysis', async () => {
      // Given: Saved analysis file
      // When: loadAnalysis is called
      // Then: Returns StoredAnalysis object
    });

    test('returns null for missing analysis', async () => {
      // Given: Non-existent session ID
      // When: loadAnalysis is called
      // Then: Returns null without error
    });

    test('validates loaded data against schema', async () => {
      // Given: Corrupted JSON file
      // When: loadAnalysis is called
      // Then: Throws ValidationError or returns null
    });
  });

  describe('listAnalyses', () => {
    test('returns all stored analyses', async () => {
      // Given: Multiple saved analyses
      // When: listAnalyses is called
      // Then: Returns array of summaries
    });

    test('sorts by date descending', async () => {
      // Given: Analyses from different dates
      // When: listAnalyses is called
      // Then: Newest first
    });

    test('handles empty directory', async () => {
      // Given: No saved analyses
      // When: listAnalyses is called
      // Then: Returns empty array
    });
  });

  describe('deleteAnalysis', () => {
    test('deletes existing analysis', async () => {
      // Given: Saved analysis
      // When: deleteAnalysis is called
      // Then: File is removed
    });

    test('no error for missing analysis', async () => {
      // Given: Non-existent session ID
      // When: deleteAnalysis is called
      // Then: No error thrown
    });
  });
});
```

### 2.5 ConfigManager Tests

**File:** `tests/config.test.ts`

```typescript
describe('ConfigManager', () => {
  describe('load', () => {
    test('loads existing config file', async () => {
      // Given: Config file exists
      // When: load is called
      // Then: Config values are available via get()
    });

    test('creates default config if not exists', async () => {
      // Given: No config file
      // When: load is called
      // Then: Default config is used and saved
    });
  });

  describe('get/set', () => {
    test('gets config value', () => {
      // Given: Config with telemetry=true
      // When: get('telemetry') called
      // Then: Returns true
    });

    test('sets config value', () => {
      // Given: Config manager
      // When: set('telemetry', false) called
      // Then: get('telemetry') returns false
    });
  });

  describe('getApiKey', () => {
    test('returns API key from environment', () => {
      // Given: ANTHROPIC_API_KEY set in env
      // When: getApiKey is called
      // Then: Returns env value
    });

    test('falls back to config file', () => {
      // Given: No env var, config has apiKey
      // When: getApiKey is called
      // Then: Returns config value
    });

    test('returns null if not configured', () => {
      // Given: No env var or config
      // When: getApiKey is called
      // Then: Returns null
    });
  });

  describe('save', () => {
    test('persists config to file', async () => {
      // Given: Modified config
      // When: save is called
      // Then: Changes persisted to disk
    });
  });

  describe('reset', () => {
    test('resets to default values', () => {
      // Given: Modified config
      // When: reset is called
      // Then: All values are defaults
    });
  });
});
```

### 2.6 TelemetryClient Tests

**File:** `tests/telemetry.test.ts`

```typescript
describe('TelemetryClient', () => {
  describe('trackEvent', () => {
    test('sends event when enabled', async () => {
      // Given: Telemetry enabled
      // When: trackEvent called
      // Then: HTTP request sent to endpoint
    });

    test('does not send when disabled', async () => {
      // Given: Telemetry disabled
      // When: trackEvent called
      // Then: No HTTP request made
    });

    test('includes anonymous ID', async () => {
      // Given: Telemetry enabled
      // When: trackEvent called
      // Then: Payload includes anonymousId
    });

    test('handles network errors gracefully', async () => {
      // Given: Network failure
      // When: trackEvent called
      // Then: No exception thrown, error logged
    });
  });

  describe('getAnonymousId', () => {
    test('returns consistent ID across calls', () => {
      // Given: TelemetryClient
      // When: getAnonymousId called multiple times
      // Then: Returns same UUID each time
    });

    test('persists ID across sessions', () => {
      // Given: ID stored in config
      // When: New TelemetryClient created
      // Then: Uses stored ID
    });
  });
});
```

---

## 3. Integration Tests

**File:** `tests/integration.test.ts`

### 3.1 End-to-End Analysis Flow

```typescript
describe('Integration: Analysis Flow', () => {
  test('complete analysis pipeline', async () => {
    // Given: Real session JSONL fixture
    // When: Full pipeline executed
    // Then:
    //   1. Session parsed correctly
    //   2. LLM called (mocked)
    //   3. Response parsed
    //   4. Report generated
    //   5. Analysis saved
  });

  test('handles API error gracefully', async () => {
    // Given: Session and mocked API error
    // When: Analysis attempted
    // Then: Error message shown, no crash
  });
});
```

### 3.2 Command Integration

```typescript
describe('Integration: Commands', () => {
  test('/noslop with current session', async () => {
    // Given: Active Claude Code session
    // When: /noslop command executed
    // Then: Analysis displayed in CLI
  });

  test('/noslop:sessions lists available', async () => {
    // Given: Multiple projects with sessions
    // When: /noslop:sessions executed
    // Then: Table displayed with all sessions
  });

  test('/noslop:history shows past analyses', async () => {
    // Given: Previous saved analyses
    // When: /noslop:history executed
    // Then: Summary list displayed
  });

  test('/noslop:config allows editing', async () => {
    // Given: Default config
    // When: /noslop:config executed
    // Then: Can view and modify settings
  });
});
```

---

## 4. Manual Testing Checklist

### 4.1 Installation

- [ ] Plugin installs via marketplace command
  ```
  /plugin marketplace add nomoreaislop/marketplace
  /plugin install noslop
  ```
- [ ] Plugin installs from local path
  ```
  /plugin install --dir /path/to/nomoreaislop
  ```
- [ ] All commands register correctly
  - [ ] `/noslop` appears in command list
  - [ ] `/noslop:analyze` appears
  - [ ] `/noslop:sessions` appears
  - [ ] `/noslop:history` appears
  - [ ] `/noslop:config` appears

### 4.2 First Run Experience

- [ ] `/noslop` without API key shows helpful error
  ```
  Expected: "API key required. Set ANTHROPIC_API_KEY..."
  ```
- [ ] `/noslop` with API key runs analysis
- [ ] Progress indicator shown during analysis
- [ ] Report displays correctly in CLI
  - [ ] Session summary visible
  - [ ] Overview table renders
  - [ ] Category sections formatted
  - [ ] Evidence quotes displayed
  - [ ] Recommendations listed
- [ ] Analysis saved to `~/.nomoreaislop/analyses/`
- [ ] Save path shown in footer

### 4.3 Session Management

- [ ] `/noslop:sessions` shows all available sessions
  - [ ] Sessions grouped by project
  - [ ] Date, message count visible
  - [ ] Session IDs copyable
- [ ] `/noslop:analyze <id>` works with valid ID
- [ ] `/noslop:analyze <invalid>` shows helpful error
- [ ] `/noslop:history` shows past analyses
  - [ ] Ratings summary visible
  - [ ] Can identify which session each is for

### 4.4 Configuration

- [ ] `/noslop:config` displays current settings
- [ ] Can disable telemetry
- [ ] Setting persists after restart
- [ ] Storage path can be changed
- [ ] Model can be changed

### 4.5 Edge Cases

#### Short Sessions (< 5 messages)
- [ ] Analysis completes without error
- [ ] Report acknowledges limited data
- [ ] Ratings are reasonable given context

#### Long Sessions (> 100 messages)
- [ ] Analysis completes in reasonable time
- [ ] No memory issues
- [ ] Conversation truncated appropriately

#### Tool-Heavy Sessions
- [ ] Tool calls visible in analysis
- [ ] Evaluation considers tool usage
- [ ] No parsing errors

#### Sessions with Errors
- [ ] Malformed JSONL lines skipped
- [ ] Warning shown for skipped content
- [ ] Analysis still completes

### 4.6 Telemetry

- [ ] Events sent when enabled (default)
  - [ ] `plugin_installed` on first run
  - [ ] `analysis_completed` after analysis
- [ ] Events NOT sent when disabled
  - [ ] Verify via network monitor
- [ ] Config setting persists correctly

---

## 5. Performance Benchmarks

### 5.1 Targets

| Scenario | Target | Max Acceptable |
|----------|--------|----------------|
| Parse 50-message session | < 200ms | 500ms |
| Parse 100-message session | < 400ms | 800ms |
| Parse 200-message session | < 800ms | 1500ms |
| List 50 sessions | < 1s | 3s |
| LLM analysis (API) | < 15s | 30s |
| Report generation | < 50ms | 100ms |
| Storage save | < 30ms | 50ms |
| Storage list 20 analyses | < 200ms | 500ms |

### 5.2 Benchmark Tests

**File:** `tests/benchmark.test.ts`

```typescript
describe('Performance Benchmarks', () => {
  test('parseSession performance', async () => {
    const start = performance.now();

    await parser.parseSession(largeSessionId);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(800);
  });

  test('generateReport performance', () => {
    const start = performance.now();

    reporter.generateReport(evaluation, metadata);

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  test('listSessions performance', async () => {
    const start = performance.now();

    await parser.listSessions();

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(3000);
  });
});
```

---

## 6. Test Fixtures

### 6.1 Sample JSONL Files

**Location:** `tests/fixtures/`

| File | Description |
|------|-------------|
| `valid-session.jsonl` | Complete valid session |
| `short-session.jsonl` | < 5 messages |
| `long-session.jsonl` | > 100 messages |
| `tool-heavy-session.jsonl` | Many tool calls |
| `malformed-lines.jsonl` | Contains invalid JSON |
| `empty-session.jsonl` | Zero messages |

### 6.2 Sample Evaluation Responses

**Location:** `tests/fixtures/responses/`

| File | Description |
|------|-------------|
| `valid-evaluation.json` | Complete valid response |
| `strong-all.json` | All Strong ratings |
| `needs-work-all.json` | All Needs Work ratings |
| `minimal-clues.json` | Minimum 1 clue per category |
| `max-clues.json` | Maximum 5 clues per category |
| `malformed-json.txt` | Invalid JSON response |
| `missing-fields.json` | Response missing required fields |

---

## 7. Test Environment Setup

### 7.1 Environment Variables

```bash
# Required for integration tests
export ANTHROPIC_API_KEY="test-key-xxx"

# Override storage for tests
export NOSLOP_STORAGE_PATH="./test-storage"

# Disable telemetry in tests
export NOSLOP_TELEMETRY="false"
```

### 7.2 Mock Setup

```typescript
// tests/setup.ts
import { vi } from 'vitest';

// Mock Anthropic client
vi.mock('@anthropic-ai/sdk', () => ({
  Anthropic: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  })),
}));

// Mock file system for storage tests
vi.mock('fs/promises', async () => {
  const actual = await vi.importActual('fs/promises');
  return {
    ...actual,
    // Custom mocks as needed
  };
});
```

### 7.3 Cleanup

```typescript
// tests/cleanup.ts
import { rmdir } from 'fs/promises';

afterAll(async () => {
  // Clean up test storage
  await rmdir('./test-storage', { recursive: true });
});
```

---

## 8. CI/CD Integration

### 8.1 GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run integration tests
        run: npm run test:integration
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}

      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

### 8.2 Test Scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:integration": "vitest run tests/integration.test.ts",
    "test:benchmark": "vitest run tests/benchmark.test.ts"
  }
}
```

---

## 9. Bug Reporting Template

When a test fails, create an issue with:

```markdown
## Test Failure Report

**Test:** [Test name and file]
**Date:** [Date of failure]
**Environment:** [Node version, OS, Claude Code version]

### Expected Behavior
[What should happen]

### Actual Behavior
[What actually happened]

### Steps to Reproduce
1. [Step 1]
2. [Step 2]

### Error Output
```
[Error message and stack trace]
```

### Related Fixtures
[Any relevant test data]
```
