# NoMoreAISlop - Data Models Specification

> Version: 1.0.0
> Last Updated: 2026-01-09
> Status: Draft

---

## 1. Input: Claude Code JSONL Schema

### 1.1 Overview

Claude Code stores session logs in JSONL (JSON Lines) format at:
```
~/.claude/projects/{encoded-path}/{session-id}.jsonl
```

Where `{encoded-path}` is the project path with `/` replaced by `-`.

Example:
- Project: `/Users/dev/projects/myapp`
- Encoded: `-Users-dev-projects-myapp`
- Session: `e0c35da6-6274-44c3-85c0-736d3d4d900f.jsonl`

### 1.2 Message Types

Each line in the JSONL file is one of these types:

```typescript
type MessageType =
  | 'user'              // User message
  | 'assistant'         // Assistant response
  | 'queue-operation'   // Internal queue management
  | 'file-history-snapshot'; // File change tracking
```

### 1.3 User Message Schema

```typescript
interface UserMessage {
  type: 'user';
  sessionId: string;          // UUID
  timestamp: string;          // ISO 8601
  uuid: string;               // Message UUID
  parentUuid: string | null;  // Parent message UUID (for threading)
  cwd: string;                // Current working directory
  version: string;            // Claude Code version (e.g., "2.1.2")
  gitBranch: string;          // Current git branch (if applicable)
  userType: 'external';       // User type
  isSidechain: boolean;       // If message is a sidechain

  message: {
    role: 'user';
    content: string | ContentBlock[];
  };
}
```

### 1.4 Assistant Message Schema

```typescript
interface AssistantMessage {
  type: 'assistant';
  sessionId: string;
  timestamp: string;
  uuid: string;
  parentUuid: string;
  cwd: string;
  version: string;
  gitBranch: string;
  userType: 'external';
  isSidechain: boolean;
  requestId?: string;         // API request ID

  message: {
    model: string;            // e.g., "claude-opus-4-5-20251101"
    id: string;               // Message ID (e.g., "msg_xxx")
    type: 'message';
    role: 'assistant';
    content: ContentBlock[];
    stop_reason: string | null;
    stop_sequence: string | null;
    usage: TokenUsage;
  };
}
```

### 1.5 Content Block Types

```typescript
type ContentBlock =
  | TextBlock
  | ToolUseBlock
  | ToolResultBlock;

interface TextBlock {
  type: 'text';
  text: string;
}

interface ToolUseBlock {
  type: 'tool_use';
  id: string;                 // Tool use ID
  name: string;               // Tool name (e.g., "Read", "Write", "Bash")
  input: Record<string, unknown>;
}

interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;        // References ToolUseBlock.id
  content: string | ContentBlock[];
  is_error?: boolean;
}
```

### 1.6 Token Usage Schema

```typescript
interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation?: {
    ephemeral_5m_input_tokens: number;
    ephemeral_1h_input_tokens: number;
  };
  service_tier?: string;
}
```

### 1.7 Queue Operation Schema

```typescript
interface QueueOperation {
  type: 'queue-operation';
  operation: 'dequeue' | 'enqueue';
  timestamp: string;
  sessionId: string;
}
```

### 1.8 File History Snapshot Schema

```typescript
interface FileHistorySnapshot {
  type: 'file-history-snapshot';
  messageId: string;
  isSnapshotUpdate: boolean;
  snapshot: {
    messageId: string;
    trackedFileBackups: Record<string, unknown>;
    timestamp: string;
  };
}
```

---

## 2. Internal: Parsed Session

### 2.1 ParsedSession

The main data structure after parsing a JSONL file:

```typescript
interface ParsedSession {
  sessionId: string;
  projectPath: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  claudeCodeVersion: string;

  messages: ParsedMessage[];

  stats: SessionStats;
}

interface SessionStats {
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  uniqueToolsUsed: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
}
```

### 2.2 ParsedMessage

Simplified message format for analysis:

```typescript
interface ParsedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  content: string;            // Flattened text content
  toolCalls?: ToolCall[];     // For assistant messages only
  tokenUsage?: {
    input: number;
    output: number;
  };
}

interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;            // Matched tool_result content
  isError?: boolean;
}
```

### 2.3 SessionMetadata

Lightweight session info for listing:

```typescript
interface SessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string;        // Last segment of path
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string;           // Full path to JSONL file
}
```

---

## 3. Output: Evaluation Schema

### 3.1 Zod Schema Definitions

```typescript
import { z } from 'zod';

// Rating enum
export const RatingSchema = z.enum(['Strong', 'Developing', 'Needs Work']);
export type Rating = z.infer<typeof RatingSchema>;

// Clue (evidence) schema
export const ClueSchema = z.object({
  type: z.enum(['positive', 'negative']),
  quote: z.string()
    .min(10)
    .max(500)
    .describe('Direct quote from the conversation'),
  explanation: z.string()
    .min(10)
    .max(300)
    .describe('Why this quote is evidence for the rating'),
});
export type Clue = z.infer<typeof ClueSchema>;

// Category evaluation schema
export const CategoryEvaluationSchema = z.object({
  rating: RatingSchema,
  summary: z.string()
    .min(50)
    .max(500)
    .describe('2-3 sentence summary of performance in this category'),
  clues: z.array(ClueSchema)
    .min(1)
    .max(5)
    .describe('1-5 specific evidence items'),
});
export type CategoryEvaluation = z.infer<typeof CategoryEvaluationSchema>;

// Full evaluation schema
export const EvaluationSchema = z.object({
  sessionId: z.string().uuid(),
  analyzedAt: z.string().datetime(),

  planning: CategoryEvaluationSchema,
  criticalThinking: CategoryEvaluationSchema,
  codeUnderstanding: CategoryEvaluationSchema,

  overallSummary: z.string()
    .min(100)
    .max(1000)
    .describe('Overall assessment of the developer\'s AI collaboration style'),

  recommendations: z.array(z.string().min(20).max(200))
    .min(1)
    .max(5)
    .describe('Specific, actionable recommendations for improvement'),
});
export type Evaluation = z.infer<typeof EvaluationSchema>;
```

### 3.2 Example Evaluation Object

```json
{
  "sessionId": "e0c35da6-6274-44c3-85c0-736d3d4d900f",
  "analyzedAt": "2026-01-09T12:00:00.000Z",

  "planning": {
    "rating": "Strong",
    "summary": "The developer consistently broke down complex tasks into clear steps and provided relevant context. They specified expected behavior before requesting implementations.",
    "clues": [
      {
        "type": "positive",
        "quote": "First, let me understand the current auth flow. Then we'll modify the middleware, and finally update the tests.",
        "explanation": "Demonstrates systematic task breakdown with clear sequence"
      },
      {
        "type": "positive",
        "quote": "The function should accept a user ID and return a Promise<UserProfile>. Handle the case where the user doesn't exist by throwing UserNotFoundError.",
        "explanation": "Clear specification of inputs, outputs, and error handling"
      }
    ]
  },

  "criticalThinking": {
    "rating": "Developing",
    "summary": "The developer occasionally questioned AI suggestions but missed opportunities to verify generated code. Some patterns were accepted without review.",
    "clues": [
      {
        "type": "positive",
        "quote": "Wait, won't this create a race condition if two users submit at the same time?",
        "explanation": "Good identification of potential concurrency issue"
      },
      {
        "type": "negative",
        "quote": "[Accepted AI-generated database schema without reviewing indexes]",
        "explanation": "Missed opportunity to verify performance implications"
      }
    ]
  },

  "codeUnderstanding": {
    "rating": "Strong",
    "summary": "Excellent awareness of existing codebase patterns. Consistently referenced existing implementations and ensured new code followed established conventions.",
    "clues": [
      {
        "type": "positive",
        "quote": "Use the same error handling pattern as src/services/userService.ts",
        "explanation": "Direct reference to existing pattern for consistency"
      },
      {
        "type": "positive",
        "quote": "We already have a validateInput utility in src/utils. Use that instead of creating a new one.",
        "explanation": "Prevented code duplication by referencing existing utility"
      }
    ]
  },

  "overallSummary": "This developer demonstrates strong planning and code understanding skills, with a systematic approach to breaking down tasks and leveraging existing code patterns. The main area for growth is in critical evaluation of AI-generated code, particularly around performance and edge cases. With more active verification of AI suggestions, this developer could significantly reduce potential issues in generated code.",

  "recommendations": [
    "Before accepting code, ask 'What could go wrong here?' to prompt consideration of edge cases",
    "When AI generates database queries, always verify that appropriate indexes exist",
    "Consider adding a quick mental checklist: correctness, performance, security, maintainability",
    "Ask 'Are there any alternative approaches?' when the first solution seems too simple"
  ]
}
```

---

## 4. Storage: Analysis JSON

### 4.1 Stored Analysis Schema

```typescript
export const StoredAnalysisSchema = z.object({
  version: z.literal('1.0.0'),
  createdAt: z.string().datetime(),

  evaluation: EvaluationSchema,

  metadata: z.object({
    projectPath: z.string(),
    projectName: z.string(),
    durationSeconds: z.number(),
    messageCount: z.number(),
    toolCallCount: z.number(),
    claudeCodeVersion: z.string(),
  }),
});
export type StoredAnalysis = z.infer<typeof StoredAnalysisSchema>;
```

### 4.2 Storage Location

```
~/.nomoreaislop/
├── analyses/
│   ├── e0c35da6-6274-44c3-85c0-736d3d4d900f.json
│   ├── abc12345-1234-5678-9012-abcdef123456.json
│   └── ...
└── config.json
```

### 4.3 Example Stored Analysis File

```json
{
  "version": "1.0.0",
  "createdAt": "2026-01-09T12:00:00.000Z",

  "evaluation": {
    "sessionId": "e0c35da6-6274-44c3-85c0-736d3d4d900f",
    "analyzedAt": "2026-01-09T12:00:00.000Z",
    "planning": { "..." },
    "criticalThinking": { "..." },
    "codeUnderstanding": { "..." },
    "overallSummary": "...",
    "recommendations": ["..."]
  },

  "metadata": {
    "projectPath": "/Users/dev/projects/myapp",
    "projectName": "myapp",
    "durationSeconds": 2700,
    "messageCount": 45,
    "toolCallCount": 123,
    "claudeCodeVersion": "2.1.2"
  }
}
```

---

## 5. Configuration: User Settings

### 5.1 Config Schema

```typescript
export const ConfigSchema = z.object({
  version: z.literal('1.0.0'),
  telemetry: z.boolean().default(true),
  storagePath: z.string().default('~/.nomoreaislop'),
  model: z.string().default('claude-3-5-sonnet-20241022'),
  apiKey: z.string().nullable().default(null),
});
export type Config = z.infer<typeof ConfigSchema>;
```

### 5.2 Default Configuration

```json
{
  "version": "1.0.0",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop",
  "model": "claude-3-5-sonnet-20241022",
  "apiKey": null
}
```

### 5.3 Configuration Resolution Order

1. Environment variable (`ANTHROPIC_API_KEY`, `NOSLOP_*`)
2. Config file (`~/.nomoreaislop/config.json`)
3. Default value

---

## 6. Telemetry: Event Schema

### 6.1 Telemetry Event Schema

```typescript
export const TelemetryEventSchema = z.object({
  event: z.enum([
    'plugin_installed',
    'analysis_started',
    'analysis_completed',
    'analysis_failed',
    'sessions_listed',
    'history_viewed',
  ]),
  timestamp: z.string().datetime(),
  anonymousId: z.string().uuid(),
  version: z.string(),
  properties: z.record(z.unknown()).optional(),
});
export type TelemetryEvent = z.infer<typeof TelemetryEventSchema>;
```

### 6.2 Example Telemetry Events

**Plugin Installed:**
```json
{
  "event": "plugin_installed",
  "timestamp": "2026-01-09T12:00:00.000Z",
  "anonymousId": "550e8400-e29b-41d4-a716-446655440000",
  "version": "1.0.0"
}
```

**Analysis Completed:**
```json
{
  "event": "analysis_completed",
  "timestamp": "2026-01-09T12:05:00.000Z",
  "anonymousId": "550e8400-e29b-41d4-a716-446655440000",
  "version": "1.0.0",
  "properties": {
    "durationMs": 15000,
    "messageCount": 45,
    "rating_planning": "Strong",
    "rating_criticalThinking": "Developing",
    "rating_codeUnderstanding": "Strong"
  }
}
```

---

## 7. Type Export Summary

### 7.1 Public Types (src/models/index.ts)

```typescript
// Input types
export type { UserMessage, AssistantMessage, ContentBlock, ToolUseBlock };

// Internal types
export type { ParsedSession, ParsedMessage, SessionMetadata, ToolCall };

// Output types
export type { Rating, Clue, CategoryEvaluation, Evaluation };

// Storage types
export type { StoredAnalysis, Config };

// Telemetry types
export type { TelemetryEvent };

// Zod schemas
export {
  RatingSchema,
  ClueSchema,
  CategoryEvaluationSchema,
  EvaluationSchema,
  StoredAnalysisSchema,
  ConfigSchema,
  TelemetryEventSchema,
};
```

---

## 8. Validation Utilities

### 8.1 Safe Parse Helper

```typescript
export function safeParse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}
```

### 8.2 JSONL Line Validator

```typescript
export function isValidMessage(line: unknown): line is UserMessage | AssistantMessage {
  if (typeof line !== 'object' || line === null) return false;
  const { type } = line as { type?: string };
  return type === 'user' || type === 'assistant';
}
```

---

## 9. Migration Strategy

### 9.1 Schema Versioning

All persisted data includes a `version` field:
- `StoredAnalysis.version: "1.0.0"`
- `Config.version: "1.0.0"`

### 9.2 Future Migration

When schema changes:
1. Increment version number
2. Add migration function: `migrate_1_0_0_to_1_1_0()`
3. Auto-migrate on load if version mismatch
4. Keep backward compatibility for at least 2 versions
