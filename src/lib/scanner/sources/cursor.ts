/**
 * Cursor Session Source
 *
 * Parses Cursor AI session logs stored as SQLite databases in ~/.cursor/chats/
 *
 * File structure:
 * - Path: ~/.cursor/chats/{workspace-hash}/{session-uuid}/store.db
 * - Format: SQLite database with blobs table
 * - Schema: blobs (id TEXT PRIMARY KEY, data BLOB)
 *
 * Note: Requires better-sqlite3 package for SQLite parsing.
 * If not available, this source will report as unavailable.
 */

import { readdir, stat, readFile } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import {
  BaseSessionSource,
  type FileMetadata,
  type SourcedSessionMetadata,
  type SourcedParsedSession,
  type DiscoveryConfig,
} from './base';
import type { ParsedMessage } from '../../models/session';
import { normalizeToolName } from '../tool-mapping';

/**
 * Default Cursor chats directory
 */
export const CURSOR_CHATS_DIR = join(homedir(), '.cursor', 'chats');

/**
 * SQLite Database interface (from better-sqlite3)
 */
interface Database {
  prepare(sql: string): Statement;
  close(): void;
}

interface Statement {
  all(): BlobRow[];
  get(): BlobRow | undefined;
}

interface BlobRow {
  id: string;
  data: Buffer;
}

/**
 * Cursor message structure (parsed from blob)
 */
interface CursorMessage {
  id?: string;
  role: 'user' | 'assistant' | 'tool';
  content?: string;
  text?: string;
  timestamp?: string;
  createdAt?: number;
  toolCalls?: CursorToolCall[];
  tool_calls?: CursorToolCall[];
  toolResults?: CursorToolResult[];
}

interface CursorToolCall {
  id: string;
  name: string;
  type?: string;
  function?: {
    name: string;
    arguments?: string | Record<string, unknown>;
  };
  input?: Record<string, unknown>;
  arguments?: string | Record<string, unknown>;
}

interface CursorToolResult {
  tool_use_id?: string;
  toolCallId?: string;
  content: string;
  isError?: boolean;
  is_error?: boolean;
}

/**
 * Cursor conversation structure
 */
interface CursorConversation {
  id: string;
  messages: CursorMessage[];
  metadata?: {
    workspacePath?: string;
    projectPath?: string;
    createdAt?: number;
    updatedAt?: number;
  };
}

/**
 * Parsed blob data structure
 */
interface ParsedBlobData {
  messages?: CursorMessage[];
  role?: string;
  metadata?: {
    workspacePath?: string;
    projectPath?: string;
    createdAt?: number;
    updatedAt?: number;
  };
  workspacePath?: string;
  projectPath?: string;
  createdAt?: number;
  updatedAt?: number;
}

/**
 * Dynamic import for better-sqlite3
 */
let DatabaseConstructor: (new (path: string) => Database) | null = null;

async function loadSqlite(): Promise<(new (path: string) => Database) | null> {
  if (DatabaseConstructor !== null) return DatabaseConstructor;

  try {
    // Dynamic import to avoid hard dependency
    // @ts-expect-error - better-sqlite3 may not be installed
    const sqlite = await import('better-sqlite3');
    DatabaseConstructor = sqlite.default as unknown as new (path: string) => Database;
    return DatabaseConstructor;
  } catch {
    // better-sqlite3 not installed
    return null;
  }
}

/**
 * Cursor session source implementation
 */
export class CursorSource extends BaseSessionSource {
  readonly name = 'cursor' as const;
  readonly displayName = 'Cursor';

  private readonly baseDir: string;

  constructor(baseDir?: string) {
    super();
    this.baseDir = baseDir ?? CURSOR_CHATS_DIR;
  }

  getBaseDir(): string {
    return this.baseDir;
  }

  async isAvailable(): Promise<boolean> {
    try {
      // Check if directory exists
      await stat(this.baseDir);

      // Check if better-sqlite3 is available
      const Database = await loadSqlite();
      return Database !== null;
    } catch {
      return false;
    }
  }

  async collectFileMetadata(config?: DiscoveryConfig): Promise<FileMetadata[]> {
    const minSize = config?.minFileSize ?? 0;
    const maxSize = config?.maxFileSize ?? Infinity;

    const allFiles: FileMetadata[] = [];

    try {
      // List workspace directories
      const workspaceDirs = await this.listWorkspaceDirs();

      for (const workspaceDir of workspaceDirs) {
        // List session directories within each workspace
        const sessionDirs = await this.listSessionDirs(workspaceDir);

        for (const sessionDir of sessionDirs) {
          const storeDbPath = join(sessionDir, 'store.db');

          try {
            const stats = await stat(storeDbPath);
            if (
              stats.isFile() &&
              stats.size >= minSize &&
              stats.size <= maxSize
            ) {
              // Use workspace hash as project dir name
              const workspaceHash = basename(workspaceDir);

              allFiles.push({
                filePath: storeDbPath,
                fileSize: stats.size,
                mtime: stats.mtime,
                projectDirName: workspaceHash,
                source: this.name,
              });
            }
          } catch {
            // Skip inaccessible files
          }
        }
      }
    } catch {
      // Directory doesn't exist or is inaccessible
    }

    return allFiles;
  }

  async extractMetadata(
    filePath: string,
    _content: string
  ): Promise<SourcedSessionMetadata | null> {
    // For SQLite, we need to read from the database directly
    const Database = await loadSqlite();
    if (!Database) return null;

    try {
      const db = new Database(filePath);

      try {
        const conversation = this.parseConversation(db);
        if (!conversation || conversation.messages.length === 0) {
          db.close();
          return null;
        }

        const messages = conversation.messages.filter(
          (m) => m.role === 'user' || m.role === 'assistant'
        );

        if (messages.length === 0) {
          db.close();
          return null;
        }

        // Extract timestamps
        const timestamps = messages
          .map((m) => this.extractTimestamp(m))
          .filter((t): t is Date => t !== null);

        if (timestamps.length === 0) {
          db.close();
          return null;
        }

        const firstTimestamp = new Date(
          Math.min(...timestamps.map((t) => t.getTime()))
        );
        const lastTimestamp = new Date(
          Math.max(...timestamps.map((t) => t.getTime()))
        );

        // Get session ID from directory name
        const sessionDir = dirname(filePath);
        const sessionId = basename(sessionDir);

        // Get project path from workspace hash or metadata
        const workspaceDir = dirname(sessionDir);
        const workspaceHash = basename(workspaceDir);
        const projectPath = conversation.metadata?.workspacePath
          ?? conversation.metadata?.projectPath
          ?? this.decodeProjectPath(workspaceHash);

        db.close();

        return {
          sessionId,
          projectPath,
          projectName: this.getProjectName(projectPath),
          timestamp: firstTimestamp,
          messageCount: messages.length,
          durationSeconds: this.calculateDuration(firstTimestamp, lastTimestamp),
          filePath,
          source: this.name,
        };
      } catch {
        db.close();
        return null;
      }
    } catch {
      return null;
    }
  }

  async parseSessionContent(
    sessionId: string,
    projectPath: string,
    _projectName: string,
    _content: string
  ): Promise<SourcedParsedSession | null> {
    // For Cursor, we need the file path instead of content
    // This method signature is for compatibility - actual parsing happens in parseFromFile
    return null;
  }

  /**
   * Parse session directly from SQLite file
   */
  async parseFromFile(filePath: string): Promise<SourcedParsedSession | null> {
    const Database = await loadSqlite();
    if (!Database) return null;

    try {
      const db = new Database(filePath);

      try {
        const conversation = this.parseConversation(db);
        if (!conversation || conversation.messages.length === 0) {
          db.close();
          return null;
        }

        // Get session info
        const sessionDir = dirname(filePath);
        const sessionId = basename(sessionDir);
        const workspaceDir = dirname(sessionDir);
        const workspaceHash = basename(workspaceDir);
        const projectPath = conversation.metadata?.workspacePath
          ?? conversation.metadata?.projectPath
          ?? this.decodeProjectPath(workspaceHash);

        // Build tool results map for matching
        const toolResultsMap = new Map<string, { content: string; isError: boolean }>();
        for (const msg of conversation.messages) {
          if (msg.role === 'tool' && msg.toolResults) {
            for (const result of msg.toolResults) {
              const toolId = result.tool_use_id ?? result.toolCallId;
              if (toolId) {
                toolResultsMap.set(toolId, {
                  content: result.content,
                  isError: result.isError ?? result.is_error ?? false,
                });
              }
            }
          }
        }

        // Parse messages
        const messages: ParsedMessage[] = [];

        for (const msg of conversation.messages) {
          if (msg.role === 'user') {
            const content = msg.content ?? msg.text ?? '';
            if (!content.trim()) continue;

            messages.push({
              uuid: msg.id ?? this.generateUUID(),
              role: 'user',
              timestamp: this.extractTimestamp(msg) ?? new Date(),
              content,
            });
          } else if (msg.role === 'assistant') {
            const content = msg.content ?? msg.text ?? '';
            const toolCalls = this.extractToolCalls(msg, toolResultsMap);

            messages.push({
              uuid: msg.id ?? this.generateUUID(),
              role: 'assistant',
              timestamp: this.extractTimestamp(msg) ?? new Date(),
              content,
              toolCalls,
            });
          }
        }

        db.close();

        if (messages.length === 0) return null;

        // Calculate timestamps
        const timestamps = messages.map((m) => m.timestamp);
        const startTime = new Date(
          Math.min(...timestamps.map((t) => t.getTime()))
        );
        const endTime = new Date(
          Math.max(...timestamps.map((t) => t.getTime()))
        );

        const stats = this.computeStats(messages);

        return {
          sessionId,
          projectPath,
          startTime,
          endTime,
          durationSeconds: this.calculateDuration(startTime, endTime),
          claudeCodeVersion: 'cursor', // Use 'cursor' as version identifier
          messages,
          stats,
          source: this.name,
        };
      } catch {
        db.close();
        return null;
      }
    } catch {
      return null;
    }
  }

  async readSessionContent(filePath: string): Promise<string> {
    // For SQLite, return empty string - use parseFromFile instead
    return '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────────────────

  private async listWorkspaceDirs(): Promise<string[]> {
    try {
      const entries = await readdir(this.baseDir);
      const dirs: string[] = [];

      for (const entry of entries) {
        const fullPath = join(this.baseDir, entry);
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            dirs.push(fullPath);
          }
        } catch {
          // Skip inaccessible entries
        }
      }

      return dirs;
    } catch {
      return [];
    }
  }

  private async listSessionDirs(workspaceDir: string): Promise<string[]> {
    try {
      const entries = await readdir(workspaceDir);
      const dirs: string[] = [];

      for (const entry of entries) {
        const fullPath = join(workspaceDir, entry);
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            dirs.push(fullPath);
          }
        } catch {
          // Skip inaccessible entries
        }
      }

      return dirs;
    } catch {
      return [];
    }
  }

  private parseConversation(db: Database): CursorConversation | null {
    try {
      // Query blobs table
      const stmt = db.prepare('SELECT id, data FROM blobs');
      const rows = stmt.all();

      if (rows.length === 0) return null;

      const messages: CursorMessage[] = [];
      let metadata: CursorConversation['metadata'] | undefined;

      for (const row of rows) {
        try {
          // Parse blob data
          const data = this.parseBlob(row.data) as ParsedBlobData | null;
          if (!data) continue;

          if (data.messages && Array.isArray(data.messages)) {
            // This blob contains conversation messages
            messages.push(...data.messages);
          } else if (data.role) {
            // This blob is a single message
            messages.push(data as unknown as CursorMessage);
          }

          // Extract metadata if present
          if (data.metadata || data.workspacePath) {
            metadata = {
              workspacePath: data.workspacePath ?? data.metadata?.workspacePath,
              projectPath: data.projectPath ?? data.metadata?.projectPath,
              createdAt: data.createdAt ?? data.metadata?.createdAt,
              updatedAt: data.updatedAt ?? data.metadata?.updatedAt,
            };
          }
        } catch {
          // Skip unparseable blobs
        }
      }

      // Sort messages by timestamp
      messages.sort((a, b) => {
        const tsA = this.extractTimestamp(a);
        const tsB = this.extractTimestamp(b);
        if (!tsA || !tsB) return 0;
        return tsA.getTime() - tsB.getTime();
      });

      return {
        id: basename(dirname(db.prepare('SELECT 1').get() ? '' : '')),
        messages,
        metadata,
      };
    } catch {
      return null;
    }
  }

  private parseBlob(data: Buffer): Record<string, unknown> | null {
    try {
      // Try parsing as UTF-8 JSON first
      const text = data.toString('utf-8');
      return JSON.parse(text);
    } catch {
      // Try decompressing if it looks like compressed data
      try {
        const zlib = require('zlib');
        const decompressed = zlib.inflateSync(data);
        return JSON.parse(decompressed.toString('utf-8'));
      } catch {
        // Not JSON or compressed JSON
        return null;
      }
    }
  }

  private extractTimestamp(msg: CursorMessage): Date | null {
    if (msg.timestamp) {
      return new Date(msg.timestamp);
    }
    if (msg.createdAt) {
      // Unix timestamp (milliseconds or seconds)
      const ts = msg.createdAt > 1e12 ? msg.createdAt : msg.createdAt * 1000;
      return new Date(ts);
    }
    return null;
  }

  private extractToolCalls(
    msg: CursorMessage,
    toolResultsMap: Map<string, { content: string; isError: boolean }>
  ): ParsedMessage['toolCalls'] {
    const rawCalls = msg.toolCalls ?? msg.tool_calls ?? [];
    if (rawCalls.length === 0) return undefined;

    const toolCalls: NonNullable<ParsedMessage['toolCalls']> = [];

    for (const call of rawCalls) {
      // Handle different tool call formats
      const name = call.name ?? call.function?.name ?? 'unknown';
      const id = call.id ?? this.generateUUID();

      // Parse input/arguments
      let input: Record<string, unknown> = {};
      if (call.input) {
        input = call.input;
      } else if (call.arguments) {
        input = typeof call.arguments === 'string'
          ? JSON.parse(call.arguments)
          : call.arguments;
      } else if (call.function?.arguments) {
        input = typeof call.function.arguments === 'string'
          ? JSON.parse(call.function.arguments)
          : call.function.arguments;
      }

      // Get result if available
      const result = toolResultsMap.get(id);

      // Normalize tool name to Claude Code format
      const normalizedName = normalizeToolName(name, this.name);

      toolCalls.push({
        id,
        name: normalizedName,
        input,
        result: result?.content,
        isError: result?.isError,
      });
    }

    return toolCalls.length > 0 ? toolCalls : undefined;
  }

  private generateUUID(): string {
    return 'cursor-' + Math.random().toString(36).substring(2, 15);
  }
}

// Export singleton instance for convenience
export const cursorSource = new CursorSource();
