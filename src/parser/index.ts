import {
  type UserMessage,
  type AssistantMessage,
  type ContentBlock,
  type ParsedSession,
  type ParsedMessage,
  type SessionStats,
  type SessionMetadata,
  type ToolCall,
  isConversationMessage,
  isTextBlock,
  isToolUseBlock,
  isToolResultBlock,
} from '../models/index.js';
import {
  readJSONLFile,
  findSessionFile,
  listAllSessions,
  getSessionMetadata,
  decodeProjectPath,
  CLAUDE_PROJECTS_DIR,
} from './jsonl-reader.js';
import { join, basename } from 'node:path';

/**
 * SessionParser - Parses Claude Code JSONL session logs
 *
 * Responsible for:
 * - Reading and parsing JSONL files
 * - Extracting conversation messages
 * - Flattening content blocks into text
 * - Matching tool results with tool calls
 * - Computing session statistics
 */
export class SessionParser {
  /**
   * Parse a session by ID
   */
  async parseSession(sessionId: string): Promise<ParsedSession> {
    const filePath = await findSessionFile(sessionId);
    if (!filePath) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    return this.parseSessionFile(filePath);
  }

  /**
   * Parse a session from a file path
   */
  async parseSessionFile(filePath: string): Promise<ParsedSession> {
    const lines = await readJSONLFile(filePath);
    const messages = lines.filter(isConversationMessage);

    if (messages.length === 0) {
      throw new Error(`No messages found in session: ${filePath}`);
    }

    const sessionId = basename(filePath, '.jsonl');
    const projectDirName = basename(join(filePath, '..'));
    const projectPath = decodeProjectPath(projectDirName);

    // Parse timestamps
    const timestamps = messages.map((m) => new Date(m.timestamp));
    const startTime = new Date(Math.min(...timestamps.map((t) => t.getTime())));
    const endTime = new Date(Math.max(...timestamps.map((t) => t.getTime())));
    const durationSeconds = Math.floor(
      (endTime.getTime() - startTime.getTime()) / 1000
    );

    // Get Claude Code version from first message
    const firstMessage = messages[0];
    const claudeCodeVersion = firstMessage.version || 'unknown';

    // Parse messages
    const parsedMessages = this.parseMessages(messages);

    // Compute stats
    const stats = this.computeStats(parsedMessages);

    return {
      sessionId,
      projectPath,
      startTime,
      endTime,
      durationSeconds,
      claudeCodeVersion,
      messages: parsedMessages,
      stats,
    };
  }

  /**
   * Parse raw messages into simplified format
   */
  private parseMessages(
    messages: (UserMessage | AssistantMessage)[]
  ): ParsedMessage[] {
    const parsed: ParsedMessage[] = [];
    const toolResultsMap = new Map<string, { content: string; isError: boolean }>();

    // First pass: collect all tool results
    for (const msg of messages) {
      if (msg.type === 'user') {
        const content = msg.message.content;
        if (Array.isArray(content)) {
          for (const block of content) {
            if (isToolResultBlock(block)) {
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

    // Second pass: parse messages and match tool calls with results
    for (const msg of messages) {
      if (msg.type === 'user') {
        const content = this.extractTextContent(msg.message.content);
        // Skip empty user messages (tool results only)
        if (!content.trim()) {
          continue;
        }

        parsed.push({
          uuid: msg.uuid,
          role: 'user',
          timestamp: new Date(msg.timestamp),
          content,
        });
      } else {
        // Assistant message
        const content = this.extractTextContent(msg.message.content);
        const toolCalls = this.extractToolCalls(
          msg.message.content,
          toolResultsMap
        );

        parsed.push({
          uuid: msg.uuid,
          role: 'assistant',
          timestamp: new Date(msg.timestamp),
          content,
          toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          tokenUsage: msg.message.usage
            ? {
                input: msg.message.usage.input_tokens,
                output: msg.message.usage.output_tokens,
              }
            : undefined,
        });
      }
    }

    return parsed;
  }

  /**
   * Extract text content from content blocks
   */
  private extractTextContent(
    content: string | ContentBlock[]
  ): string {
    if (typeof content === 'string') {
      return content;
    }

    const textParts: string[] = [];
    for (const block of content) {
      if (isTextBlock(block)) {
        textParts.push(block.text);
      }
    }

    return textParts.join('\n');
  }

  /**
   * Extract tool calls from content blocks
   */
  private extractToolCalls(
    content: ContentBlock[],
    toolResultsMap: Map<string, { content: string; isError: boolean }>
  ): ToolCall[] {
    const toolCalls: ToolCall[] = [];

    for (const block of content) {
      if (isToolUseBlock(block)) {
        const result = toolResultsMap.get(block.id);
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input,
          result: result?.content,
          isError: result?.isError,
        });
      }
    }

    return toolCalls;
  }

  /**
   * Compute session statistics
   */
  private computeStats(messages: ParsedMessage[]): SessionStats {
    let userMessageCount = 0;
    let assistantMessageCount = 0;
    let toolCallCount = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    const toolsUsed = new Set<string>();

    for (const msg of messages) {
      if (msg.role === 'user') {
        userMessageCount++;
      } else {
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
   * List available sessions
   */
  async listSessions(): Promise<SessionMetadata[]> {
    return listAllSessions();
  }

  /**
   * Get metadata for a specific session
   */
  async getSessionMetadata(sessionId: string): Promise<SessionMetadata | null> {
    const filePath = await findSessionFile(sessionId);
    if (!filePath) {
      return null;
    }
    return getSessionMetadata(filePath);
  }

  /**
   * Get the current session ID (from environment or most recent)
   * Returns null if no session can be determined
   */
  async getCurrentSessionId(): Promise<string | null> {
    // Check environment variable first
    const envSessionId = process.env.CLAUDE_SESSION_ID;
    if (envSessionId) {
      return envSessionId;
    }

    // Fall back to most recent session
    const sessions = await this.listSessions();
    if (sessions.length === 0) {
      return null;
    }

    return sessions[0].sessionId;
  }

  /**
   * Get the projects directory path
   */
  getProjectsDir(): string {
    return CLAUDE_PROJECTS_DIR;
  }
}

// Export singleton instance
export const sessionParser = new SessionParser();

// Re-export utilities
export {
  readJSONLFile,
  findSessionFile,
  listAllSessions,
  getSessionMetadata,
  decodeProjectPath,
  encodeProjectPath,
  getProjectName,
  CLAUDE_PROJECTS_DIR,
} from './jsonl-reader.js';
