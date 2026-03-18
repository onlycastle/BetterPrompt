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

import { readdir, stat } from 'node:fs/promises';
import { join, basename, dirname } from 'node:path';
import { homedir } from 'node:os';
import {
  BaseSessionSource,
  type FileMetadata,
  type SourcedSessionMetadata,
  type SourcedParsedSession,
  type DiscoveryConfig,
} from './base.js';
import type { ParsedMessage } from '../session-types.js';
import { normalizeToolName } from '../tool-mapping.js';

/**
 * Default Cursor chats directory
 */
export const CURSOR_CHATS_DIR = join(homedir(), '.cursor', 'chats');

import { loadSqlite, type SqliteDatabase } from './sqlite-loader.js';

/**
 * SQLite Database interface (from better-sqlite3)
 * Kept for internal blob row typing
 */
type Database = SqliteDatabase;

interface BlobRow {
  id: string;
  data: Buffer;
}

/**
 * Cursor message structure (parsed from blob)
 * Cursor stores messages in individual JSON blobs with role field
 */
interface CursorMessage {
  id?: string;
  role: 'user' | 'assistant' | 'tool' | 'system';
  content?: string | Array<{ type: string; [key: string]: unknown }>;
  text?: string;
  timestamp?: string;
  createdAt?: number;
  toolCalls?: CursorToolCall[];
  tool_calls?: CursorToolCall[];
  toolResults?: CursorToolResult[];
  signature?: string;
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

/**
 * Cursor tool-call content block (inside content array)
 * This is how Cursor actually stores tool calls - in the content array
 */
interface CursorToolCallBlock {
  type: 'tool-call';
  toolCallId: string;
  toolName: string;
  args: Record<string, unknown>;
}

/**
 * Cursor tool-result content block (inside tool message content array)
 */
interface CursorToolResultBlock {
  type: 'tool-result';
  toolCallId: string;
  toolName: string;
  result: string;
  experimental_content?: Array<{ type: string; text?: string }>;
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
 * Cursor blobs can contain:
 * 1. Individual messages with { role, content, ... }
 * 2. Array of messages with { messages: [...] }
 * 3. Metadata with workspace info
 */
interface ParsedBlobData {
  messages?: CursorMessage[];
  role?: 'user' | 'assistant' | 'tool' | 'system';
  content?: string | Array<{ type: string; [key: string]: unknown }>;
  text?: string;
  id?: string;
  timestamp?: string;
  createdAt?: number;
  signature?: string;
  toolCalls?: CursorToolCall[];
  tool_calls?: CursorToolCall[];
  metadata?: {
    workspacePath?: string;
    projectPath?: string;
    createdAt?: number;
    updatedAt?: number;
  };
  workspacePath?: string;
  projectPath?: string;
  updatedAt?: number;
}

// loadSqlite is imported from shared sqlite-loader.ts

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

    let db: Database | null = null;
    try {
      db = new Database(filePath);

      const conversation = this.parseConversation(db);
      if (!conversation || conversation.messages.length === 0) {
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
      // Cursor stores tool results in 'tool' role messages with content array
      const toolResultsMap = new Map<string, { content: string; isError: boolean; toolName: string }>();
      for (const msg of conversation.messages) {
        if (msg.role === 'tool') {
          // Check for tool results in content array (Cursor's actual format)
          if (Array.isArray(msg.content)) {
            for (const block of msg.content) {
              if (block.type === 'tool-result') {
                const resultBlock = block as unknown as CursorToolResultBlock;
                if (resultBlock.toolCallId) {
                  const resultText = resultBlock.result || '';
                  const isError = resultText.toLowerCase().includes('error');
                  toolResultsMap.set(resultBlock.toolCallId, {
                    content: resultText,
                    isError,
                    toolName: resultBlock.toolName || 'unknown',
                  });
                }
              }
            }
          }
          // Also check legacy format
          if (msg.toolResults) {
            for (const result of msg.toolResults) {
              const toolId = result.tool_use_id ?? result.toolCallId;
              if (toolId) {
                toolResultsMap.set(toolId, {
                  content: result.content,
                  isError: result.isError ?? result.is_error ?? false,
                  toolName: 'unknown',
                });
              }
            }
          }
        }
      }

      // Parse messages
      const messages: ParsedMessage[] = [];

      for (const msg of conversation.messages) {
        if (msg.role === 'user') {
          // Content can be string or array (from tool messages)
          const content = typeof msg.content === 'string' ? msg.content : (msg.text ?? '');
          if (!content.trim()) continue;

          messages.push({
            uuid: msg.id ?? this.generateUUID(),
            role: 'user',
            timestamp: this.extractTimestamp(msg) ?? new Date(),
            content,
          });
        } else if (msg.role === 'assistant') {
          // Extract text content and tool calls from content array
          const { textContent, toolCallBlocks } = this.parseAssistantContent(msg);
          const toolCalls = this.extractToolCallsFromBlocks(toolCallBlocks, toolResultsMap);

          // Also check legacy toolCalls/tool_calls fields
          const legacyToolCalls = this.extractLegacyToolCalls(msg, toolResultsMap);
          const allToolCalls = toolCalls.length > 0 ? toolCalls :
            (legacyToolCalls && legacyToolCalls.length > 0 ? legacyToolCalls : undefined);

          messages.push({
            uuid: msg.id ?? this.generateUUID(),
            role: 'assistant',
            timestamp: this.extractTimestamp(msg) ?? new Date(),
            content: textContent,
            toolCalls: allToolCalls,
          });
        }
      }

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
      return null;
    } finally {
      db?.close();
    }
  }

  async readSessionContent(filePath: string): Promise<string> {
    // For SQLite, return empty string - use parseFromFile instead
    return '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helper methods
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List all subdirectories within a given directory
   */
  private async listSubdirectories(parentDir: string): Promise<string[]> {
    try {
      const entries = await readdir(parentDir);
      const dirs: string[] = [];

      for (const entry of entries) {
        const fullPath = join(parentDir, entry);
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

  private async listWorkspaceDirs(): Promise<string[]> {
    return this.listSubdirectories(this.baseDir);
  }

  private async listSessionDirs(workspaceDir: string): Promise<string[]> {
    return this.listSubdirectories(workspaceDir);
  }

  private parseConversation(db: Database): CursorConversation | null {
    try {
      // Query blobs table
      const stmt = db.prepare('SELECT id, data FROM blobs');
      const rows = stmt.all();

      if (rows.length === 0) return null;

      const messages: CursorMessage[] = [];
      let metadata: CursorConversation['metadata'] | undefined;

      for (const row of rows as Array<{ id: string; data: Buffer }>) {
        try {
          // Parse blob data
          const data = this.parseBlob(row.data) as ParsedBlobData | null;
          if (!data) continue;

          if (data.messages && Array.isArray(data.messages)) {
            // This blob contains conversation messages array
            messages.push(...data.messages);
          } else if (data.role) {
            // This blob is a single message object
            // Convert to CursorMessage format
            const msg: CursorMessage = {
              id: data.id ?? row.id,
              role: data.role,
              // Preserve content array for assistant messages (contains tool-call blocks)
              content: data.content,
              text: data.text,
              timestamp: data.timestamp,
              createdAt: data.createdAt,
              toolCalls: data.toolCalls ?? data.tool_calls,
              signature: data.signature,
            };

            // Handle content array for tool messages (extract tool results)
            if (Array.isArray(data.content) && msg.role === 'tool') {
              for (const block of data.content) {
                if (block.type === 'tool-result' && typeof block.result === 'string') {
                  const toolId = block.toolCallId as string | undefined;
                  if (toolId) {
                    msg.toolResults = msg.toolResults ?? [];
                    msg.toolResults.push({
                      toolCallId: toolId,
                      content: block.result as string,
                      isError: (block.result as string).toLowerCase().includes('error'),
                    });
                  }
                }
              }
            }

            // Skip system messages (prompts)
            if (msg.role !== 'system') {
              messages.push(msg);
            }
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
        id: this.generateUUID(),
        messages,
        metadata,
      };
    } catch {
      return null;
    }
  }

  private parseBlob(data: Buffer): Record<string, unknown> | null {
    // 1. Try parsing as UTF-8 JSON first
    try {
      const text = data.toString('utf-8');
      return JSON.parse(text);
    } catch {
      // Not JSON
    }

    // 2. Try decompressing if it looks like compressed data
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const zlib = require('zlib');
      const decompressed = zlib.inflateSync(data);
      return JSON.parse(decompressed.toString('utf-8'));
    } catch {
      // Not compressed JSON
    }

    // 3. Try parsing as Protobuf (Cursor uses protobuf for some blobs)
    try {
      return this.parseProtobuf(data);
    } catch {
      // Not protobuf
    }

    return null;
  }

  /**
   * Parse a varint from buffer at given offset
   * Protobuf uses variable-length encoding for integers
   */
  private parseVarint(data: Buffer, offset: number): { value: number; bytesRead: number } | null {
    if (offset >= data.length) return null;

    let value = 0;
    let shift = 0;
    let bytesRead = 0;
    const MAX_VARINT_BYTES = 10;

    while (offset + bytesRead < data.length) {
      const byte = data[offset + bytesRead]!;
      value |= (byte & 0x7f) << shift;
      bytesRead++;

      const isLastByte = (byte & 0x80) === 0;
      if (isLastByte) break;

      shift += 7;
      if (bytesRead > MAX_VARINT_BYTES) return null;
    }

    return { value, bytesRead };
  }

  /**
   * Parse Cursor protobuf blob format
   *
   * Cursor stores some messages in a simple protobuf format:
   * - field1 (wire2): text content (message body, tool results)
   * - field2 (wire2): UUID (message ID)
   * - field3 (wire2): usually empty
   * - field4 (wire2): nested JSON (full message object)
   *
   * Wire type 2 = length-delimited (string, bytes, embedded messages)
   */
  private parseProtobuf(data: Buffer): Record<string, unknown> | null {
    const fields = new Map<number, Array<{ wireType: number; content: Buffer | number }>>();
    let offset = 0;

    while (offset < data.length) {
      // Read tag (varint)
      const tagVarint = this.parseVarint(data, offset);
      if (!tagVarint) break;

      const tag = tagVarint.value;
      const fieldNumber = tag >> 3;
      const wireType = tag & 0x07;
      offset += tagVarint.bytesRead;

      let fieldContent: Buffer | number;

      switch (wireType) {
        case 0: { // Varint
          const varint = this.parseVarint(data, offset);
          if (!varint) break;
          fieldContent = varint.value;
          offset += varint.bytesRead;
          break;
        }
        case 1: { // 64-bit fixed
          if (offset + 8 > data.length) return null;
          fieldContent = data.subarray(offset, offset + 8);
          offset += 8;
          break;
        }
        case 2: { // Length-delimited (string, bytes, nested message)
          const lengthVarint = this.parseVarint(data, offset);
          if (!lengthVarint) return null;
          const length = lengthVarint.value;
          offset += lengthVarint.bytesRead;
          if (offset + length > data.length) return null;
          fieldContent = data.subarray(offset, offset + length);
          offset += length;
          break;
        }
        case 5: { // 32-bit fixed
          if (offset + 4 > data.length) return null;
          fieldContent = data.subarray(offset, offset + 4);
          offset += 4;
          break;
        }
        default:
          // Unknown wire type, stop parsing
          return null;
      }

      if (!fields.has(fieldNumber)) {
        fields.set(fieldNumber, []);
      }
      fields.get(fieldNumber)!.push({ wireType, content: fieldContent! });
    }

    return this.mapProtobufFields(fields);
  }

  /**
   * Map protobuf fields to a message-like structure
   */
  private mapProtobufFields(
    fields: Map<number, Array<{ wireType: number; content: Buffer | number }>>
  ): Record<string, unknown> | null {
    // Check for field4 first - it contains full JSON message
    const field4 = fields.get(4);
    if (field4 && field4.length > 0) {
      for (const { content } of field4) {
        if (Buffer.isBuffer(content)) {
          try {
            const jsonStr = content.toString('utf-8');
            const parsed = JSON.parse(jsonStr);
            // Return the full JSON object if it has message structure
            if (parsed && (parsed.role || parsed.messages || parsed.content)) {
              return parsed;
            }
          } catch {
            // Not JSON
          }
        }
      }
    }

    // Try to construct message from individual fields
    const result: Record<string, unknown> = {};

    // Field 1: text content
    const field1 = fields.get(1);
    if (field1 && field1.length > 0) {
      const { content } = field1[0]!;
      if (Buffer.isBuffer(content)) {
        const text = content.toString('utf-8');
        // Check if it's printable text
        if (text.length > 0 && this.isPrintableText(text)) {
          result.text = text;
        }
      }
    }

    // Field 2: UUID
    const field2 = fields.get(2);
    if (field2 && field2.length > 0) {
      const { content } = field2[0]!;
      if (Buffer.isBuffer(content)) {
        const uuid = content.toString('utf-8');
        // Check if it looks like a UUID
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(uuid)) {
          result.id = uuid;
        }
      }
    }

    // Only return if we found meaningful content
    if (Object.keys(result).length > 0) {
      return result;
    }

    return null;
  }

  /**
   * Check if a string is printable text (not binary garbage)
   */
  private isPrintableText(str: string): boolean {
    // Check first 100 characters for printability
    const sample = str.substring(0, 100);
    // Allow common printable characters, newlines, tabs
    return /^[\x20-\x7E\n\r\t\u00A0-\uFFFF]+$/.test(sample);
  }

  /**
   * Convert Unix timestamp to Date, handling both seconds and milliseconds
   */
  private unixToDate(timestamp: number): Date {
    const MILLISECONDS_THRESHOLD = 1e12;
    const normalizedTs = timestamp > MILLISECONDS_THRESHOLD ? timestamp : timestamp * 1000;
    return new Date(normalizedTs);
  }

  private extractTimestamp(msg: CursorMessage): Date | null {
    if (msg.timestamp) return new Date(msg.timestamp);
    if (msg.createdAt) return this.unixToDate(msg.createdAt);
    return null;
  }

  /**
   * Parse assistant message content array to extract text and tool-call blocks
   * Cursor stores tool calls in the content array with type: 'tool-call'
   */
  private parseAssistantContent(msg: CursorMessage): {
    textContent: string;
    toolCallBlocks: CursorToolCallBlock[];
  } {
    const textParts: string[] = [];
    const toolCallBlocks: CursorToolCallBlock[] = [];

    if (typeof msg.content === 'string') {
      return { textContent: msg.content, toolCallBlocks: [] };
    }

    if (!Array.isArray(msg.content)) {
      return { textContent: msg.text ?? '', toolCallBlocks: [] };
    }

    for (const block of msg.content) {
      if (block.type === 'text' && typeof block.text === 'string') {
        textParts.push(block.text);
      } else if (block.type === 'reasoning' && typeof block.text === 'string') {
        // Include reasoning as part of content for analysis
        textParts.push(block.text);
      } else if (block.type === 'tool-call') {
        // Cursor's tool call format
        const toolBlock = block as unknown as CursorToolCallBlock;
        if (toolBlock.toolCallId && toolBlock.toolName) {
          toolCallBlocks.push(toolBlock);
        }
      }
    }

    return {
      textContent: textParts.join('\n'),
      toolCallBlocks,
    };
  }

  /**
   * Extract tool calls from Cursor's tool-call blocks
   */
  private extractToolCallsFromBlocks(
    blocks: CursorToolCallBlock[],
    toolResultsMap: Map<string, { content: string; isError: boolean; toolName: string }>
  ): NonNullable<ParsedMessage['toolCalls']> {
    const toolCalls: NonNullable<ParsedMessage['toolCalls']> = [];

    for (const block of blocks) {
      const id = block.toolCallId;
      const name = block.toolName;
      const input = block.args || {};

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

    return toolCalls;
  }

  /**
   * Extract tool calls from legacy toolCalls/tool_calls fields
   */
  private extractLegacyToolCalls(
    msg: CursorMessage,
    toolResultsMap: Map<string, { content: string; isError: boolean; toolName: string }>
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
        try {
          input = typeof call.arguments === 'string'
            ? JSON.parse(call.arguments)
            : call.arguments;
        } catch {
          input = { raw: call.arguments };
        }
      } else if (call.function?.arguments) {
        try {
          input = typeof call.function.arguments === 'string'
            ? JSON.parse(call.function.arguments)
            : call.function.arguments;
        } catch {
          input = { raw: call.function.arguments };
        }
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
