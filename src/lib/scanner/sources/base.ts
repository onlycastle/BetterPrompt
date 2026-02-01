/**
 * Session Source Base Interface
 *
 * Abstract interface for different AI coding assistant session sources.
 * Enables multi-source scanning while maintaining a unified data model.
 *
 * Supported sources:
 * - claude-code: Claude Code JSONL logs (~/.claude/projects/)
 * - cursor: Cursor SQLite databases (~/.cursor/chats/)
 */

import type { ParsedSession, ParsedMessage, SessionStats } from '../../models/session';

/**
 * Supported session source identifiers
 */
export type SessionSourceType = 'claude-code' | 'cursor';

/**
 * Lightweight file/session metadata for pre-filtering (no content read)
 */
export interface FileMetadata {
  filePath: string;
  fileSize: number;
  mtime: Date;
  projectDirName: string;
  /** Source identifier */
  source: SessionSourceType;
}

/**
 * Session metadata with source information
 */
export interface SourcedSessionMetadata {
  sessionId: string;
  projectPath: string;
  projectName: string;
  timestamp: Date;
  messageCount: number;
  durationSeconds: number;
  filePath: string;
  qualityScore?: number;
  /** Source identifier */
  source: SessionSourceType;
}

/**
 * Parsed session with source information
 */
export interface SourcedParsedSession extends ParsedSession {
  /** Source identifier */
  source: SessionSourceType;
}

/**
 * Configuration for session discovery
 */
export interface DiscoveryConfig {
  /** Minimum file size to consider (bytes) */
  minFileSize?: number;
  /** Maximum file size to consider (bytes) */
  maxFileSize?: number;
}

/**
 * Session source interface
 *
 * Each source implementation handles:
 * - Discovering session files in its specific location
 * - Parsing source-specific formats into unified ParsedSession
 * - Normalizing tool names to match Claude Code conventions
 */
export interface SessionSource {
  /**
   * Source identifier
   */
  readonly name: SessionSourceType;

  /**
   * Human-readable display name
   */
  readonly displayName: string;

  /**
   * Get the base directory for this source
   */
  getBaseDir(): string;

  /**
   * Check if this source is available (directory exists, dependencies met)
   */
  isAvailable(): Promise<boolean>;

  /**
   * Collect lightweight file metadata for pre-filtering
   * Should not read file contents - only uses fs.stat
   */
  collectFileMetadata(config?: DiscoveryConfig): Promise<FileMetadata[]>;

  /**
   * Extract session metadata from file content
   * Used for quality scoring after pre-filtering
   */
  extractMetadata(
    filePath: string,
    content: string
  ): Promise<SourcedSessionMetadata | null>;

  /**
   * Parse session content into unified format
   */
  parseSessionContent(
    sessionId: string,
    projectPath: string,
    projectName: string,
    content: string
  ): Promise<SourcedParsedSession | null>;

  /**
   * Read raw session content from file
   */
  readSessionContent(filePath: string): Promise<string>;
}

/**
 * Abstract base class with common utility methods
 */
export abstract class BaseSessionSource implements SessionSource {
  abstract readonly name: SessionSourceType;
  abstract readonly displayName: string;

  abstract getBaseDir(): string;
  abstract isAvailable(): Promise<boolean>;
  abstract collectFileMetadata(config?: DiscoveryConfig): Promise<FileMetadata[]>;
  abstract extractMetadata(
    filePath: string,
    content: string
  ): Promise<SourcedSessionMetadata | null>;
  abstract parseSessionContent(
    sessionId: string,
    projectPath: string,
    projectName: string,
    content: string
  ): Promise<SourcedParsedSession | null>;
  abstract readSessionContent(filePath: string): Promise<string>;

  /**
   * Decode project path from encoded directory name
   * Default implementation: replace '-' with '/'
   */
  protected decodeProjectPath(encoded: string): string {
    if (encoded.startsWith('-')) {
      return encoded.replace(/-/g, '/');
    }
    return encoded;
  }

  /**
   * Get project name from path (last segment)
   */
  protected getProjectName(projectPath: string): string {
    const parts = projectPath.split('/').filter(Boolean);
    return parts[parts.length - 1] || 'unknown';
  }

  /**
   * Calculate session duration in seconds
   */
  protected calculateDuration(startTime: Date, endTime: Date): number {
    return Math.floor((endTime.getTime() - startTime.getTime()) / 1000);
  }

  /**
   * Compute session statistics from parsed messages
   */
  protected computeStats(messages: ParsedMessage[]): SessionStats {
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
}
