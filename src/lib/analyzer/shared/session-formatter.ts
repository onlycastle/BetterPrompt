/**
 * Session Formatter - Shared formatting logic for analysis stages
 *
 * Provides consistent session formatting across:
 * - Data Analyst stage
 * - Personality Analyst stage
 * - Cost Estimator (for accurate token counting)
 *
 * @module analyzer/shared/session-formatter
 */

import type { ParsedSession } from '../../domain/models/analysis';

/**
 * Options for formatting sessions
 */
export interface SessionFormatOptions {
  /** Maximum characters per message content before truncation */
  maxContentLength: number;
  /** Include assistant (Claude) messages */
  includeAssistantMessages: boolean;
  /** Include tool call information */
  includeToolCalls: boolean;
  /** Include session duration in header */
  includeDuration: boolean;
}

/**
 * Preset for Data Analyst stage
 * - Both user and Claude messages
 * - Tool names included (no results)
 * - 2000 char content limit
 */
export const DATA_ANALYST_FORMAT: SessionFormatOptions = {
  maxContentLength: 2000,
  includeAssistantMessages: true,
  includeToolCalls: true,
  includeDuration: true,
};

/**
 * Preset for Personality Analyst stage
 * - User messages only
 * - No tool information
 * - 1500 char content limit
 */
export const PERSONALITY_ANALYST_FORMAT: SessionFormatOptions = {
  maxContentLength: 1500,
  includeAssistantMessages: false,
  includeToolCalls: false,
  includeDuration: false,
};

/**
 * Format a single message for analysis
 */
function formatMessage(
  msg: ParsedSession['messages'][0],
  options: SessionFormatOptions
): string | null {
  // Filter out assistant messages if not included
  if (msg.role === 'assistant' && !options.includeAssistantMessages) {
    return null;
  }

  const role = msg.role === 'user' ? 'DEVELOPER' : 'CLAUDE';
  const timestamp = msg.timestamp.toISOString().slice(11, 19);

  // Truncate content if needed
  const content =
    msg.content && msg.content.length > options.maxContentLength
      ? msg.content.slice(0, options.maxContentLength) + '...[truncated]'
      : msg.content || '';

  let text = `[${timestamp}] ${role}:\n${content}`;

  // Add tool calls if enabled
  if (options.includeToolCalls && msg.toolCalls?.length) {
    for (const tool of msg.toolCalls) {
      text += `\n  [Tool: ${tool.name}]`;
    }
  }

  return text;
}

/**
 * Format sessions for LLM analysis
 *
 * Used by both analysis stages and cost estimator to ensure
 * consistent token counting.
 */
export function formatSessionsForAnalysis(
  sessions: ParsedSession[],
  options: SessionFormatOptions
): string {
  return sessions
    .map((session, index) => {
      const date = session.startTime.toISOString().split('T')[0];
      const durationMin = Math.round(session.durationSeconds / 60);

      const messages = session.messages
        .map((msg) => formatMessage(msg, options))
        .filter((msg): msg is string => msg !== null)
        .join('\n\n');

      // Build session header based on options
      const durationAttr = options.includeDuration ? ` duration_minutes="${durationMin}"` : '';

      return `<session index="${index + 1}" date="${date}"${durationAttr}>
${messages}
</session>`;
    })
    .join('\n\n');
}

/**
 * Token counting heuristics
 * ~4 chars per token for English, with adjustments for code/JSON
 */
function countTokensFromText(text: string): number {
  if (!text) return 0;

  // Base estimate: ~4 chars per token
  let baseCount = text.length / 4;

  // Code blocks are token-heavy
  const codeBlockMatches = text.match(/```[\s\S]*?```/g);
  const codeBlockCount = codeBlockMatches ? codeBlockMatches.length : 0;
  baseCount += codeBlockCount * 50;

  // JSON structure overhead
  const jsonBraceMatches = text.match(/[{}[\]]/g);
  const jsonBraceCount = jsonBraceMatches ? jsonBraceMatches.length : 0;
  baseCount += jsonBraceCount * 0.5;

  // Newlines
  const newlineMatches = text.match(/\n/g);
  const newlineCount = newlineMatches ? newlineMatches.length : 0;
  baseCount += newlineCount * 0.1;

  // Special characters in code
  const specialCharMatches = text.match(/[<>()=;:,."'`]/g);
  const specialCharCount = specialCharMatches ? specialCharMatches.length : 0;
  baseCount += specialCharCount * 0.1;

  return Math.ceil(baseCount);
}

/**
 * Count tokens for formatted sessions
 *
 * Uses the same formatting logic as the actual stages,
 * ensuring accurate cost estimation.
 */
export function countFormattedTokens(
  sessions: ParsedSession[],
  options: SessionFormatOptions
): number {
  const formatted = formatSessionsForAnalysis(sessions, options);
  return countTokensFromText(formatted);
}
