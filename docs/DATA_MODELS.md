# NoMoreAISlop - Data Models Specification

> Version: 2.1.0
> Last Updated: 2026-01-10
> Status: Current

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

## 4. Analysis Dimensions (v2.1)

### 4.1 Overview

Version 2.1 introduces multi-dimensional analysis that goes beyond simple ratings. Each dimension provides quantified metrics, actionable insights, and personalized recommendations.

### 4.2 AI Coding Style Types

The AI Coding Style Type is an MBTI-like personality type for developers. All types are positive, each with unique strengths and growth points.

```typescript
type CodingStyleType = 'architect' | 'scientist' | 'collaborator' | 'speedrunner' | 'craftsman';

interface TypeResult {
  primaryType: CodingStyleType;
  distribution: Record<CodingStyleType, number>; // percentages that sum to 100
  evidence: ConversationEvidence[];
  metrics: SessionMetrics;
  sessionCount: number;
  analyzedAt: string; // ISO 8601
}

interface ConversationEvidence {
  type: CodingStyleType;
  quote: string;
  timestamp: string; // ISO 8601
  explanation: string;
}

interface SessionMetrics {
  avgPromptLength: number;
  avgFirstPromptLength: number;
  maxPromptLength: number;
  avgTurnsPerSession: number;
  totalTurns: number;
  questionFrequency: number;
  whyHowWhatCount: number;
  toolUsage: {
    read: number;
    grep: number;
    glob: number;
    task: number;
    plan: number;
    bash: number;
    write: number;
    edit: number;
    total: number;
  };
  modificationRequestCount: number;
  modificationRate: number;
  refactorKeywordCount: number;
  styleKeywordCount: number;
  qualityTermCount: number;
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;
  avgCycleTimeSeconds: number;
  sessionDurationSeconds: number;
}
```

#### The 5 AI Coding Style Types

1. **Architect** (🏗️): Strategic thinker who plans before diving into code
   - Strengths: Systematic approach, maximizes AI implementation speed, high consistency
   - Growth: Quick prototyping can sometimes be more efficient

2. **Scientist** (🔬): Truth-seeker who always verifies AI output
   - Strengths: Catches bugs early, high code quality, low AI dependency
   - Growth: Verifying everything can slow velocity

3. **Collaborator** (🤝): Partnership master who finds answers through dialogue
   - Strengths: Maximizes AI synergy, quality through iteration, flexible problem solving
   - Growth: Clearer initial requirements could reduce turns

4. **Speedrunner** (⚡): Agile executor who delivers through fast iteration
   - Strengths: Rapid prototyping, new discoveries through experimentation, high output
   - Growth: Technical debt may accumulate

5. **Craftsman** (🔧): Artisan who prioritizes code quality above all
   - Strengths: Maintainable code, codebase consistency, minimizes technical debt
   - Growth: Perfectionism may delay deployment

### 4.3 AI Collaboration Mastery Score

Measures a developer's mastery of effective AI collaboration. Score 0-100: higher is better (more collaborative mastery).

**Source**: [Collaborative Intelligence in Software Development](https://anthropic.com/research)

```typescript
interface AICollaborationMasteryResult {
  score: number; // 0-100, higher is better
  level: 'novice' | 'developing' | 'proficient' | 'expert';
  breakdown: {
    contextEngineering: {
      score: number;                // 0-100
      fileReferences: number;        // Count of explicit file/path references
      constraintsMentioned: number;  // Count of constraints specified
      patternReferences: number;     // Count of existing code pattern references
    };
    structuredPlanning: {
      score: number;                // 0-100
      todoWriteUsage: number;        // Count of todo write operations
      stepByStepPlans: number;       // Count of step-by-step request patterns
      specFileReferences: number;    // Count of spec/doc references
    };
    aiOrchestration: {
      score: number;                // 0-100
      taskToolUsage: number;         // Count of task tool invocations
      multiAgentSessions: number;    // Count of multi-agent collaboration patterns
      parallelWorkflows: number;     // Count of parallel execution patterns
    };
    criticalVerification: {
      score: number;                // 0-100
      codeReviewRequests: number;    // Count of review/verify requests
      testRequests: number;          // Count of test/verification requests
      outputModifications: number;   // Count of modifications made
    };
  };
  strengths: string[];
  growthAreas: string[];
  interpretation: string;
}
```

#### Scoring Components (weights)

- **Context Engineering** (25%): Effective file references, constraint specification, pattern awareness
- **Structured Planning** (25%): Use of planning tools, step-by-step approaches, documentation references
- **AI Orchestration** (25%): Advanced tool usage, multi-agent coordination, parallel workflows
- **Critical Verification** (25%): Code reviews, test requests, intentional modifications

#### Level Thresholds

- **Novice** (0-25): Beginning to establish collaboration patterns, limited tool usage
- **Developing** (26-50): Building consistent practices, moderate tool utilization, emerging patterns
- **Proficient** (51-75): Strong collaboration practices, effective tool usage, clear intentionality
- **Expert** (76-100): Mastery of AI collaboration, advanced orchestration, exceptional intentionality

### 4.4 Prompt Engineering Score

Measures how effective a developer's prompts are. Score 0-100: higher is better.

**Source**: [JetBrains State of Developer Ecosystem 2025](https://blog.jetbrains.com/research/2025/10/state-of-developer-ecosystem-2025/)

```typescript
interface PromptScoreResult {
  score: number; // 0-100, higher is better
  breakdown: {
    contextProvision: number;      // 0-100
    specificity: number;           // 0-100
    iterationEfficiency: number;   // 0-100
    firstTrySuccess: number;       // 0-100
    constraintClarity: number;     // 0-100
  };
  bestPrompt: {
    content: string;
    score: number;
    reasons: string[];
  } | null;
  worstPrompt: {
    content: string;
    score: number;
    reasons: string[];
  } | null;
  tips: string[];
  avgPromptLength: number;
  constraintUsageRate: number; // % prompts with constraints
}
```

#### Scoring Components (weights)

- **Context Provision** (25%): Length, file references, existing patterns, explains goal
- **Specificity** (20%): Numbered steps, technical terms, specific requirements, avoids vague language
- **Iteration Efficiency** (20%): Fewer turns for same result = more efficient prompts
- **First Try Success** (20%): No correction patterns, positive feedback early
- **Constraint Clarity** (15%): Includes constraints, format requirements, expected outputs

#### Iteration Efficiency Scale

- 3 or fewer turns: 90 points
- 4-5 turns: 80 points
- 6-8 turns: 60 points
- 9-12 turns: 40 points
- 13+ turns: 20 points

### 4.5 Burnout Risk Indicators

Analyzes session patterns to detect potential burnout risk. Score 0-100: lower is healthier (higher = more risk).

**Source**: [Software Developer Burnout - How to Spot Early Warning Signs](https://www.usehaystack.io/blog/software-developer-burnout-how-to-spot-early-warning-signs)

```typescript
interface BurnoutRiskResult {
  score: number; // 0-100, lower is healthier
  level: 'low' | 'moderate' | 'elevated' | 'high';
  breakdown: {
    afterHoursRate: number;        // % sessions after 9 PM
    weekendRate: number;           // % sessions on weekends
    lateNightCount: number;        // Sessions after midnight
    avgSessionDuration: number;    // Average session length in minutes
    sessionTrend: 'increasing' | 'stable' | 'decreasing';
    longestSession: number;        // Longest session in minutes
  };
  timeDistribution: {
    businessHours: number;         // % 9 AM - 6 PM weekdays
    evening: number;               // % 6 PM - 9 PM
    lateNight: number;             // % 9 PM - 6 AM
    weekend: number;               // % Saturday/Sunday
  };
  recommendations: string[];
  qualityCorrelation: {
    shortSessions: {
      avgDuration: number;
      qualityIndicator: string;    // 'High quality' | 'Good quality' | etc.
    };
    longSessions: {
      avgDuration: number;
      qualityIndicator: string;
    };
  };
}
```

#### Scoring Components (weights)

- **After Hours Rate** (25%): Sessions after 9 PM
- **Weekend Rate** (20%): Weekend sessions
- **Late Night Rate** (15%): Sessions after midnight or before 6 AM
- **Long Sessions** (20%): Sessions over 2 hours
- **Increasing Trend** (10%): Session duration increasing over time
- **Frequency** (10%): Total number of sessions

#### Level Thresholds

- **Low** (0-25): Healthy work patterns
- **Moderate** (26-45): Some late hours, monitor patterns
- **Elevated** (46-65): Concerning patterns, consider breaks
- **High** (66-100): High risk, prioritize work-life balance

### 4.6 Tool Mastery Profile

Analyzes how effectively a developer uses Claude Code's tools. Score 0-100: higher is better.

**Source**: [GitHub Copilot Metrics Dashboard](https://docs.github.com/en/copilot/concepts/copilot-metrics)

```typescript
type MasteryLevel = 'novice' | 'basic' | 'adept' | 'expert';

interface ToolMasteryResult {
  overallScore: number; // 0-100
  toolUsage: Record<string, {
    count: number;
    percentage: number;          // % of total tool calls
    level: MasteryLevel;
    assessment: string;           // Personalized feedback
  }>;
  topTools: string[];             // 3 most-used tools
  underutilizedTools: string[];   // Tools used < 30% of expected
  tips: string[];
}
```

#### Tool Categories

**Exploration Tools** (expected 40% of usage):
- **Read** (20%): Review code before changes
- **Grep** (10%): Search for patterns in codebase
- **Glob** (10%): Find files by pattern

**Modification Tools** (expected 30% of usage):
- **Edit** (20%): Targeted code edits
- **Write** (10%): Create new files

**Execution Tools** (expected 15% of usage):
- **Bash** (15%): Run commands and scripts

**Orchestration Tools** (expected 5% of usage):
- **Task** (5%): Parallel agent execution

**Planning Tools** (expected 5% of usage):
- **TodoWrite** (5%): Track task progress

**Research Tools** (expected 5% of usage):
- **WebSearch** (3%): Search for documentation
- **WebFetch** (2%): Fetch web content

#### Mastery Level Calculation

Ratio = Actual Usage / Expected Usage

- **Novice** (< 0.3): Using tool less than 30% of expected
- **Basic** (0.3 - 0.7): Using tool 30-70% of expected
- **Adept** (0.7 - 1.5): Using tool at expected level
- **Expert** (> 1.5): Using tool more than 150% of expected

#### Overall Score Calculation

- **Diversity Score** (30 points): Number of tools used / 6 * 30
- **Balance Score** (40 points): How close usage is to expected proportions
- **Advanced Usage Score** (30 points): Use of Task, WebSearch, WebFetch, TodoWrite (7.5 points each)

### 4.7 Full Analysis Result

```typescript
interface FullAnalysisResult {
  aiCollaborationMastery: AICollaborationMasteryResult;
  promptScore: PromptScoreResult;
  burnoutRisk: BurnoutRiskResult;
  toolMastery: ToolMasteryResult;
}
```

This complete analysis result combines all dimensions for a comprehensive developer profile.

---

## 5. Storage: Analysis JSON

### 5.1 Stored Analysis Schema

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

### 5.2 Storage Location

```
~/.nomoreaislop/
├── analyses/
│   ├── e0c35da6-6274-44c3-85c0-736d3d4d900f.json
│   ├── abc12345-1234-5678-9012-abcdef123456.json
│   └── ...
└── config.json
```

### 5.3 Example Stored Analysis File

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

## 6. Configuration: User Settings

### 6.1 Config Schema

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

### 6.2 Default Configuration

```json
{
  "version": "1.0.0",
  "telemetry": true,
  "storagePath": "~/.nomoreaislop",
  "model": "claude-3-5-sonnet-20241022",
  "apiKey": null
}
```

### 6.3 Configuration Resolution Order

1. Environment variable (`ANTHROPIC_API_KEY`, `NOSLOP_*`)
2. Config file (`~/.nomoreaislop/config.json`)
3. Default value

---

## 7. Telemetry: Event Schema

### 7.1 Telemetry Event Schema

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

### 7.2 Example Telemetry Events

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

## 8. Type Export Summary

### 8.1 Public Types (src/models/index.ts)

```typescript
// Input types
export type { UserMessage, AssistantMessage, ContentBlock, ToolUseBlock };

// Internal types
export type { ParsedSession, ParsedMessage, SessionMetadata, ToolCall };

// Output types (v1.0)
export type { Rating, Clue, CategoryEvaluation, Evaluation };

// Analysis Dimensions (v2.1)
export type {
  CodingStyleType,
  TypeResult,
  ConversationEvidence,
  SessionMetrics,
  AICollaborationMasteryResult,
  PromptScoreResult,
  BurnoutRiskResult,
  ToolMasteryResult,
  MasteryLevel,
  FullAnalysisResult,
};

// Storage types
export type { StoredAnalysis, Config };

// Telemetry types
export type { TelemetryEvent };

// Zod schemas (v1.0)
export {
  RatingSchema,
  ClueSchema,
  CategoryEvaluationSchema,
  EvaluationSchema,
  StoredAnalysisSchema,
  ConfigSchema,
  TelemetryEventSchema,
};

// Zod schemas (v2.1)
export {
  CodingStyleTypeSchema,
  TypeResultSchema,
};
```

---

## 9. Validation Utilities

### 9.1 Safe Parse Helper

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

### 9.2 JSONL Line Validator

```typescript
export function isValidMessage(line: unknown): line is UserMessage | AssistantMessage {
  if (typeof line !== 'object' || line === null) return false;
  const { type } = line as { type?: string };
  return type === 'user' || type === 'assistant';
}
```

---

## 10. Migration Strategy

### 10.1 Schema Versioning

All persisted data includes a `version` field:
- `StoredAnalysis.version: "1.0.0"`
- `Config.version: "1.0.0"`

### 10.2 Version History

- **v1.0.0** (2026-01-09): Initial release with basic evaluation schema
  - Planning, Critical Thinking, Code Understanding ratings
  - Clues and recommendations

- **v2.1.0** (2026-01-10): Multi-dimensional analysis
  - AI Coding Style Types (5 personality types)
  - AI Collaboration Mastery Score (replaced AI Dependency Score)
  - Prompt Engineering Score
  - Burnout Risk Indicators
  - Tool Mastery Profile
  - Full Analysis Result combining all dimensions

### 10.3 Future Migration

When schema changes:
1. Increment version number
2. Add migration function: `migrate_X_X_X_to_Y_Y_Y()`
3. Auto-migrate on load if version mismatch
4. Keep backward compatibility for at least 2 versions

---

## 11. Summary of Changes in v2.1

### New Data Models

1. **AI Coding Style Types**: MBTI-like personality assessment with 5 positive types
2. **AI Collaboration Mastery Score**: Measures effective AI collaboration across 4 dimensions (0-100, higher is better)
3. **Prompt Engineering Score**: Quantifies prompt effectiveness (0-100, higher is better)
4. **Burnout Risk Indicators**: Analyzes session patterns for burnout signals (0-100, lower is better)
5. **Tool Mastery Profile**: Evaluates Claude Code tool usage effectiveness (0-100, higher is better)
6. **Full Analysis Result**: Combines all dimensions for comprehensive profile

### AI Collaboration Mastery Dimensions

The AI Collaboration Mastery Score replaces the previous AI Dependency Score with a more comprehensive framework:

- **Context Engineering** (25%): Ability to provide clear references, constraints, and pattern context
- **Structured Planning** (25%): Effective use of planning tools and step-by-step methodologies
- **AI Orchestration** (25%): Mastery of advanced features like task tools and multi-agent coordination
- **Critical Verification** (25%): Intentional code review, testing, and output verification practices

### Key Features

- **Quantified Metrics**: All scores are 0-100 with clear interpretations
- **Personalized Insights**: Evidence-based recommendations specific to developer patterns
- **Research-Backed**: Each dimension cites industry research and best practices
- **Actionable Tips**: Concrete suggestions for improvement in each area
- **Comparative Data**: Shows developer's usage vs. expected/optimal patterns
- **Positive Framing**: Mastery score celebrates collaboration skills rather than measuring dependency

### Integration Points

All new dimensions integrate seamlessly with existing session parsing:
- Input: `ParsedSession[]` (same as v1.0)
- Processing: New analyzer functions in `src/analyzer/dimensions/`
- Output: Structured results with consistent interfaces
- Storage: Compatible with existing `StoredAnalysis` schema
