/**
 * Session Formatter - Parse JSONL and format for analysis
 *
 * Parses raw JSONL session content into structured messages,
 * applies truncation matching the server's analysis stages,
 * and provides accurate token counting for cost estimation.
 *
 * Three-stage pipeline:
 * - Stage 1A: Data Analyst (2000 char limit, includes Claude messages + tools)
 * - Stage 1B: Personality Analyst (1500 char limit, user messages only)
 * - Stage 2: Content Writer (receives Stage 1A + 1B outputs)
 */

/**
 * Parsed message from JSONL
 */
export interface ParsedMessage {
  uuid: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
    isError?: boolean;
  }>;
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
 * Supported session source types
 */
export type SessionSourceType = 'claude-code' | 'cursor' | 'cursor-composer';

/**
 * Parsed session ready for analysis
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

/**
 * Format options for different stages
 */
export interface SessionFormatOptions {
  maxContentLength: number;
  includeAssistantMessages: boolean;
  includeToolCalls: boolean;
  includeDuration: boolean;
}

/**
 * Preset for Data Analyst stage
 */
export const DATA_ANALYST_FORMAT: SessionFormatOptions = {
  maxContentLength: 2000,
  includeAssistantMessages: true,
  includeToolCalls: true,
  includeDuration: true,
};

/**
 * Preset for Personality Analyst stage
 */
export const PERSONALITY_ANALYST_FORMAT: SessionFormatOptions = {
  maxContentLength: 1500,
  includeAssistantMessages: false,
  includeToolCalls: false,
  includeDuration: false,
};

/**
 * Raw JSONL line structure
 */
interface JSONLLine {
  type: string;
  uuid: string;
  timestamp: string;
  version?: string;
  message: {
    role?: string;
    content: string | ContentBlock[];
    usage?: {
      input_tokens: number;
      output_tokens: number;
    };
  };
}

interface ContentBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | unknown;
  is_error?: boolean;
}

/**
 * Parse JSONL content into structured lines
 */
function parseJSONLContent(content: string): JSONLLine[] {
  const lines: JSONLLine[] = [];

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed.type === 'user' || parsed.type === 'assistant') {
        lines.push(parsed as JSONLLine);
      }
    } catch {
      // Skip invalid lines
    }
  }

  return lines;
}

/**
 * Extract text content from content blocks
 */
function extractTextContent(content: string | ContentBlock[]): string {
  if (typeof content === 'string') return content;

  const textParts: string[] = [];
  for (const block of content) {
    if (block.type === 'text' && block.text) {
      textParts.push(block.text);
    }
  }
  return textParts.join('\n');
}

/**
 * Extract tool calls from content blocks
 */
function extractToolCalls(
  content: ContentBlock[],
  toolResultsMap: Map<string, { content: string; isError: boolean }>
): ParsedMessage['toolCalls'] {
  const toolCalls: NonNullable<ParsedMessage['toolCalls']> = [];

  for (const block of content) {
    if (block.type === 'tool_use' && block.id && block.name) {
      const result = toolResultsMap.get(block.id);
      toolCalls.push({
        id: block.id,
        name: block.name,
        input: block.input || {},
        result: result?.content,
        isError: result?.isError,
      });
    }
  }

  return toolCalls.length > 0 ? toolCalls : undefined;
}

/**
 * Compute session statistics from parsed messages
 */
function computeMessageStats(messages: ParsedMessage[]): SessionStats {
  let userMessageCount = 0;
  let assistantMessageCount = 0;
  let toolCallCount = 0;
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const toolsUsed = new Set<string>();

  for (const msg of messages) {
    if (msg.role === 'user') {
      userMessageCount++;
      continue;
    }

    assistantMessageCount++;

    if (msg.toolCalls) {
      toolCallCount += msg.toolCalls.length;
      for (const tool of msg.toolCalls) {
        toolsUsed.add(tool.name);
      }
    }

    if (msg.tokenUsage) {
      totalInputTokens += msg.tokenUsage.input;
      totalOutputTokens += msg.tokenUsage.output;
    }
  }

  return {
    userMessageCount,
    assistantMessageCount,
    toolCallCount,
    uniqueToolsUsed: Array.from(toolsUsed).sort(),
    totalInputTokens,
    totalOutputTokens,
  };
}

/**
 * Parse raw JSONL session content into ParsedSession
 */
export function parseSessionContent(
  sessionId: string,
  projectPath: string,
  projectName: string,
  content: string
): ParsedSession | null {
  const lines = parseJSONLContent(content);

  if (lines.length === 0) return null;

  // Parse timestamps
  const timestamps = lines.map((m) => new Date(m.timestamp));
  const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
  const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
  const durationSeconds = Math.floor(
    (endTime.getTime() - startTime.getTime()) / 1000
  );

  // Get version from first message
  const claudeCodeVersion = lines[0].version || 'unknown';

  // Collect tool results first
  const toolResultsMap = new Map<string, { content: string; isError: boolean }>();

  for (const line of lines) {
    if (line.type === 'user') {
      const msgContent = line.message.content;
      if (Array.isArray(msgContent)) {
        for (const block of msgContent) {
          if (block.type === 'tool_result' && block.tool_use_id) {
            const resultContent =
              typeof block.content === 'string'
                ? block.content
                : JSON.stringify(block.content);
            toolResultsMap.set(block.tool_use_id, {
              content: resultContent,
              isError: block.is_error ?? false,
            });
          }
        }
      }
    }
  }

  // Parse messages
  const messages: ParsedMessage[] = [];

  for (const line of lines) {
    if (line.type === 'user') {
      const textContent = extractTextContent(line.message.content);
      if (!textContent.trim()) continue;

      messages.push({
        uuid: line.uuid,
        role: 'user',
        timestamp: new Date(line.timestamp),
        content: textContent,
      });
    } else if (line.type === 'assistant') {
      const textContent = extractTextContent(line.message.content);
      const toolCalls = Array.isArray(line.message.content)
        ? extractToolCalls(line.message.content, toolResultsMap)
        : undefined;

      messages.push({
        uuid: line.uuid,
        role: 'assistant',
        timestamp: new Date(line.timestamp),
        content: textContent,
        toolCalls,
        tokenUsage: line.message.usage
          ? {
              input: line.message.usage.input_tokens,
              output: line.message.usage.output_tokens,
            }
          : undefined,
      });
    }
  }

  if (messages.length === 0) return null;

  const stats = computeMessageStats(messages);

  return {
    sessionId,
    projectPath,
    projectName,
    startTime,
    endTime,
    durationSeconds,
    claudeCodeVersion,
    messages,
    stats,
  };
}

/**
 * Format a single message for analysis (with truncation)
 */
function formatMessage(
  msg: ParsedMessage,
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

      const durationAttr = options.includeDuration ? ` duration_minutes="${durationMin}"` : '';

      return `<session index="${index + 1}" date="${date}"${durationAttr}>
${messages}
</session>`;
    })
    .join('\n\n');
}

/**
 * Token counting heuristics
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

  // Special characters
  const specialCharMatches = text.match(/[<>()=;:,."'`]/g);
  const specialCharCount = specialCharMatches ? specialCharMatches.length : 0;
  baseCount += specialCharCount * 0.1;

  return Math.ceil(baseCount);
}

/**
 * Count tokens for formatted sessions (with truncation applied)
 */
export function countFormattedTokens(
  sessions: ParsedSession[],
  options: SessionFormatOptions
): number {
  const formatted = formatSessionsForAnalysis(sessions, options);
  return countTokensFromText(formatted);
}
