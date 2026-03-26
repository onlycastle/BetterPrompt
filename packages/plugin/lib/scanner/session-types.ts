/**
 * Session Types for CLI
 *
 * Plain TypeScript interfaces extracted from src/lib/models/session.ts
 * for CLI usage without zod dependency.
 */

/**
 * Supported session source identifiers
 */
export type SessionSourceType = 'claude-code' | 'cursor' | 'cursor-composer';

/**
 * Tool call representation
 */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  result?: string;
  isError?: boolean;
}

/**
 * Parsed message - simplified for analysis
 */
export interface ParsedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  content: string;
  isMeta?: boolean;
  sourceToolUseID?: string;
  toolUseResult?: unknown;
  toolCalls?: ToolCall[];
  tokenUsage?: {
    input: number;
    output: number;
  };
}

/**
 * Session statistics
 */
export interface SessionStats {
  userMessageCount: number;
  assistantMessageCount: number;
  toolCallCount: number;
  uniqueToolsUsed: string[];
  totalInputTokens: number;
  totalOutputTokens: number;
}

/**
 * Fully parsed session ready for analysis
 */
export interface ParsedSession {
  sessionId: string;
  projectPath: string;
  projectName?: string;
  startTime: Date;
  endTime: Date;
  durationSeconds: number;
  claudeCodeVersion: string;
  messages: ParsedMessage[];
  stats: SessionStats;
  /** Source identifier (claude-code, cursor, etc.) */
  source?: SessionSourceType;
}
