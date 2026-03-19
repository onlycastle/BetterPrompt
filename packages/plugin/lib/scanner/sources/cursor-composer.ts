/**
 * Cursor Composer Session Source
 *
 * Parses Cursor AI sessions stored in globalStorage/state.vscdb.
 * This is the modern Cursor storage format (2025+), replacing the
 * legacy ~/.cursor/chats/ directory structure.
 *
 * Storage: ~/Library/Application Support/Cursor/User/globalStorage/state.vscdb
 * Format: SQLite database with `cursorDiskKV` table
 *
 * Key patterns:
 * - composerData:{composerId}  → session metadata (JSON)
 * - bubbleId:{composerId}:{messageId} → individual messages (JSON)
 *
 * Bubble types:
 * - type 1: user message
 * - type 2: assistant message (text, tool calls, or thinking)
 *
 * Note: Requires better-sqlite3. Opens database in readonly mode
 * to avoid conflicts with running Cursor process.
 */

import { stat } from 'node:fs/promises';
import {
  BaseSessionSource,
  type FileMetadata,
  type SourcedSessionMetadata,
  type SourcedParsedSession,
  type DiscoveryConfig,
} from './base.js';
import type { ParsedMessage, ToolCall } from '../session-types.js';
import { resolveComposerToolId } from '../tool-mapping.js';
import { getCursorGlobalStateDbPath } from './cursor-paths.js';
import { loadSqlite, type SqliteDatabase } from './sqlite-loader.js';

// ─────────────────────────────────────────────────────────────────────────
// Types for Cursor Composer data structures
// ─────────────────────────────────────────────────────────────────────────

/** Row from cursorDiskKV table */
interface KVRow {
  key: string;
  value: string;
}

/** ComposerData metadata stored under composerData:{id} key */
interface ComposerData {
  composerId?: string;
  name?: string;
  unifiedMode?: string;
  createdAt?: string;
  lastUpdatedAt?: string;
  context?: unknown;
  tokenCount?: { inputTokens?: number; outputTokens?: number };
  richText?: unknown;
  workspaceProjectDir?: string;
}

/** Bubble (message) stored under bubbleId:{composerId}:{messageId} key */
interface ComposerBubble {
  type: number; // 1 = user, 2 = assistant
  text?: string;
  createdAt?: string;
  tokenCount?: { inputTokens?: number; outputTokens?: number };
  capabilityType?: number;
  toolFormerData?: {
    tool: number;
    toolCallId?: string;
    status?: string;
    rawArgs?: string;
  };
  thinking?: { text?: string };
  codeBlocks?: unknown[];
  workspaceProjectDir?: string;
  context?: {
    fileSelections?: unknown[];
    terminalSelections?: unknown[];
  };
}

// ─────────────────────────────────────────────────────────────────────────
// CursorComposerSource implementation
// ─────────────────────────────────────────────────────────────────────────

/**
 * Cursor Composer session source
 *
 * Reads sessions from Cursor's globalStorage/state.vscdb SQLite database.
 * Each composer session is identified by a composerId and contains
 * multiple bubbles (messages) stored as individual key-value entries.
 */
export class CursorComposerSource extends BaseSessionSource {
  readonly name = 'cursor-composer' as const;
  readonly displayName = 'Cursor Composer';

  private readonly dbPath: string;

  constructor(dbPath?: string) {
    super();
    this.dbPath = dbPath ?? getCursorGlobalStateDbPath();
  }

  getBaseDir(): string {
    return this.dbPath;
  }

  async isAvailable(): Promise<boolean> {
    try {
      await stat(this.dbPath);
      const Database = await loadSqlite();
      return Database !== null;
    } catch {
      return false;
    }
  }

  /**
   * Collect file metadata for all composer sessions in state.vscdb.
   *
   * Each composerId becomes a virtual "file" entry with a synthetic path
   * of the form: state.vscdb#{composerId}
   */
  async collectFileMetadata(config?: DiscoveryConfig): Promise<FileMetadata[]> {
    const Database = await loadSqlite();
    if (!Database) return [];

    let db: SqliteDatabase | null = null;
    try {
      db = new Database(this.dbPath, { readonly: true });
      const composerIds = this.listComposerIds(db);
      const results: FileMetadata[] = [];

      for (const composerId of composerIds) {
        try {
          const data = this.getComposerData(db, composerId);
          if (!data) continue;

          // Count bubbles to estimate session size
          const bubbleCount = this.countBubbles(db, composerId);
          // Rough size estimate: each bubble averages ~2KB
          const estimatedSize = bubbleCount * 2048;

          if (config?.minFileSize && estimatedSize < config.minFileSize) continue;
          if (config?.maxFileSize && estimatedSize > config.maxFileSize) continue;

          // Determine project path from bubble data or composerData
          const projectDir = data.workspaceProjectDir
            ?? this.getProjectDirFromBubbles(db, composerId)
            ?? 'unknown';

          // Parse timestamp
          const createdAt = data.createdAt ? new Date(data.createdAt) : new Date();
          const lastUpdated = data.lastUpdatedAt ? new Date(data.lastUpdatedAt) : createdAt;

          results.push({
            filePath: `${this.dbPath}#${composerId}`,
            fileSize: estimatedSize,
            mtime: lastUpdated,
            projectDirName: this.encodeProjectDir(projectDir),
            source: this.name,
          });
        } catch {
          // Skip problematic sessions
        }
      }

      return results;
    } catch {
      return [];
    } finally {
      db?.close();
    }
  }

  async extractMetadata(
    filePath: string,
    _content: string,
  ): Promise<SourcedSessionMetadata | null> {
    const composerId = this.extractComposerId(filePath);
    if (!composerId) return null;

    const Database = await loadSqlite();
    if (!Database) return null;

    let db: SqliteDatabase | null = null;
    try {
      db = new Database(this.dbPath, { readonly: true });
      const data = this.getComposerData(db, composerId);
      if (!data) return null;

      const bubbles = this.getBubbles(db, composerId);
      const conversationBubbles = bubbles.filter(b => b.type === 1 || b.type === 2);
      if (conversationBubbles.length === 0) return null;

      const timestamps = conversationBubbles
        .map(b => b.createdAt ? new Date(b.createdAt) : null)
        .filter((t): t is Date => t !== null && !isNaN(t.getTime()));

      if (timestamps.length === 0) return null;

      const firstTimestamp = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const lastTimestamp = new Date(Math.max(...timestamps.map(t => t.getTime())));

      const projectDir = data.workspaceProjectDir
        ?? this.getProjectDirFromBubbleList(bubbles)
        ?? 'unknown';

      return {
        sessionId: composerId,
        projectPath: projectDir,
        projectName: this.getProjectName(projectDir),
        timestamp: firstTimestamp,
        messageCount: conversationBubbles.length,
        durationSeconds: this.calculateDuration(firstTimestamp, lastTimestamp),
        filePath,
        source: this.name,
      };
    } catch {
      return null;
    } finally {
      db?.close();
    }
  }

  async parseSessionContent(
    _sessionId: string,
    _projectPath: string,
    _projectName: string,
    _content: string,
  ): Promise<SourcedParsedSession | null> {
    // SQLite-based source: use parseFromFile instead
    return null;
  }

  /**
   * Parse a composer session directly from state.vscdb
   */
  async parseFromFile(filePath: string): Promise<SourcedParsedSession | null> {
    const composerId = this.extractComposerId(filePath);
    if (!composerId) return null;

    const Database = await loadSqlite();
    if (!Database) return null;

    let db: SqliteDatabase | null = null;
    try {
      db = new Database(this.dbPath, { readonly: true });

      const data = this.getComposerData(db, composerId);
      if (!data) return null;

      const bubbles = this.getBubbles(db, composerId);
      if (bubbles.length === 0) return null;

      const messages = this.convertBubblesToMessages(bubbles);
      if (messages.length === 0) return null;

      // Extract timestamps
      const timestamps = messages.map(m => m.timestamp);
      const startTime = new Date(Math.min(...timestamps.map(t => t.getTime())));
      const endTime = new Date(Math.max(...timestamps.map(t => t.getTime())));

      // Determine project path
      const projectDir = data.workspaceProjectDir
        ?? this.getProjectDirFromBubbleList(bubbles)
        ?? 'unknown';

      const stats = this.computeStats(messages);

      return {
        sessionId: composerId,
        projectPath: projectDir,
        projectName: this.getProjectName(projectDir),
        startTime,
        endTime,
        durationSeconds: this.calculateDuration(startTime, endTime),
        claudeCodeVersion: 'cursor-composer',
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

  async readSessionContent(_filePath: string): Promise<string> {
    // SQLite source: return empty string
    return '';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: Database query helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * List all composer IDs from composerData:* keys
   */
  private listComposerIds(db: SqliteDatabase): string[] {
    const stmt = db.prepare(
      "SELECT key FROM cursorDiskKV WHERE key LIKE 'composerData:%'",
    );
    const rows = stmt.all() as KVRow[];
    return rows.map(r => r.key.replace('composerData:', ''));
  }

  /**
   * Get composer metadata for a specific composer ID
   */
  private getComposerData(db: SqliteDatabase, composerId: string): ComposerData | null {
    const stmt = db.prepare(
      "SELECT value FROM cursorDiskKV WHERE key = ?",
    );
    const row = stmt.get(`composerData:${composerId}`) as KVRow | undefined;
    if (!row?.value) return null;

    try {
      return JSON.parse(row.value) as ComposerData;
    } catch {
      return null;
    }
  }

  /**
   * Count bubbles for a composer session
   */
  private countBubbles(db: SqliteDatabase, composerId: string): number {
    const stmt = db.prepare(
      "SELECT COUNT(*) as count FROM cursorDiskKV WHERE key LIKE ?",
    );
    const row = stmt.get(`bubbleId:${composerId}:%`) as { count: number } | undefined;
    return row?.count ?? 0;
  }

  /**
   * Get all bubbles for a composer session, sorted by creation time
   */
  private getBubbles(db: SqliteDatabase, composerId: string): ComposerBubble[] {
    const stmt = db.prepare(
      "SELECT key, value FROM cursorDiskKV WHERE key LIKE ?",
    );
    const rows = stmt.all(`bubbleId:${composerId}:%`) as KVRow[];

    const bubbles: ComposerBubble[] = [];
    for (const row of rows) {
      try {
        const bubble = JSON.parse(row.value) as ComposerBubble;
        bubbles.push(bubble);
      } catch {
        // Skip unparseable bubbles
      }
    }

    // Sort by createdAt timestamp
    bubbles.sort((a, b) => {
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return timeA - timeB;
    });

    return bubbles;
  }

  /**
   * Get project directory from the first bubble that has workspaceProjectDir
   */
  private getProjectDirFromBubbles(db: SqliteDatabase, composerId: string): string | null {
    const stmt = db.prepare(
      "SELECT value FROM cursorDiskKV WHERE key LIKE ? LIMIT 20",
    );
    const rows = stmt.all(`bubbleId:${composerId}:%`) as KVRow[];

    for (const row of rows) {
      try {
        const bubble = JSON.parse(row.value) as ComposerBubble;
        if (bubble.workspaceProjectDir) {
          return bubble.workspaceProjectDir;
        }
      } catch {
        // Skip
      }
    }

    return null;
  }

  /**
   * Get project directory from already-loaded bubbles
   */
  private getProjectDirFromBubbleList(bubbles: ComposerBubble[]): string | null {
    for (const bubble of bubbles) {
      if (bubble.workspaceProjectDir) {
        return bubble.workspaceProjectDir;
      }
    }
    return null;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: Bubble → ParsedMessage conversion
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Convert sorted bubbles into ParsedMessages.
   *
   * Conversion rules:
   * - User bubbles (type=1): → ParsedMessage { role: 'user' }
   * - Assistant text bubbles (type=2, has text): → ParsedMessage { role: 'assistant' }
   * - Assistant tool bubbles (type=2, has toolFormerData): → append toolCall to previous assistant message
   * - Thinking bubbles (type=2, has thinking): → skip (not relevant for analysis)
   * - Empty bubbles (type=2, no text, no tool): → skip
   *
   * Consecutive assistant tool bubbles are merged into the preceding text message.
   */
  private convertBubblesToMessages(bubbles: ComposerBubble[]): ParsedMessage[] {
    const messages: ParsedMessage[] = [];
    let currentAssistant: ParsedMessage | null = null;

    for (const bubble of bubbles) {
      if (bubble.type === 1) {
        // User message
        const text = bubble.text?.trim();
        if (!text) continue;

        // Close any pending assistant message
        currentAssistant = null;

        messages.push({
          uuid: this.generateUUID(),
          role: 'user',
          timestamp: bubble.createdAt ? new Date(bubble.createdAt) : new Date(),
          content: text,
        });
      } else if (bubble.type === 2) {
        // Assistant message — determine subtype
        const hasText = bubble.text && bubble.text.trim().length > 0;
        const hasTool = bubble.toolFormerData != null;
        const hasThinking = bubble.thinking?.text != null;

        if (hasThinking && !hasText && !hasTool) {
          // Thinking-only bubble: skip
          continue;
        }

        if (hasText) {
          // Text bubble: create new assistant message
          currentAssistant = {
            uuid: this.generateUUID(),
            role: 'assistant',
            timestamp: bubble.createdAt ? new Date(bubble.createdAt) : new Date(),
            content: bubble.text!.trim(),
            toolCalls: [],
            tokenUsage: this.extractTokenUsage(bubble),
          };
          messages.push(currentAssistant);
        }

        if (hasTool) {
          const toolCall = this.convertToolFormerData(bubble.toolFormerData!);
          if (toolCall) {
            if (currentAssistant) {
              // Append to existing assistant message
              if (!currentAssistant.toolCalls) {
                currentAssistant.toolCalls = [];
              }
              currentAssistant.toolCalls.push(toolCall);
            } else {
              // No preceding text bubble: create a new assistant message for the tool call
              currentAssistant = {
                uuid: this.generateUUID(),
                role: 'assistant',
                timestamp: bubble.createdAt ? new Date(bubble.createdAt) : new Date(),
                content: '',
                toolCalls: [toolCall],
                tokenUsage: this.extractTokenUsage(bubble),
              };
              messages.push(currentAssistant);
            }
          }
        }

        // Update token usage if this bubble has it (last bubble often has cumulative tokens)
        if (bubble.tokenCount && currentAssistant) {
          const usage = this.extractTokenUsage(bubble);
          if (usage && (usage.input > 0 || usage.output > 0)) {
            currentAssistant.tokenUsage = usage;
          }
        }
      }
      // type !== 1 && type !== 2: skip unknown types
    }

    // Clean up empty toolCalls arrays
    for (const msg of messages) {
      if (msg.toolCalls && msg.toolCalls.length === 0) {
        delete msg.toolCalls;
      }
    }

    return messages;
  }

  /**
   * Convert toolFormerData to a ToolCall
   */
  private convertToolFormerData(
    toolData: NonNullable<ComposerBubble['toolFormerData']>,
  ): ToolCall | null {
    const toolName = resolveComposerToolId(toolData.tool);

    // Parse rawArgs into input object
    let input: Record<string, unknown> = {};
    if (toolData.rawArgs) {
      try {
        input = JSON.parse(toolData.rawArgs);
      } catch {
        input = { raw: toolData.rawArgs };
      }
    }

    return {
      id: toolData.toolCallId ?? this.generateUUID(),
      name: toolName,
      input,
    };
  }

  /**
   * Extract token usage from bubble
   */
  private extractTokenUsage(
    bubble: ComposerBubble,
  ): { input: number; output: number } | undefined {
    if (!bubble.tokenCount) return undefined;
    const input = bubble.tokenCount.inputTokens ?? 0;
    const output = bubble.tokenCount.outputTokens ?? 0;
    if (input === 0 && output === 0) return undefined;
    return { input, output };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: Utility helpers
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Extract composerId from synthetic file path: state.vscdb#{composerId}
   */
  private extractComposerId(filePath: string): string | null {
    const hashIndex = filePath.indexOf('#');
    if (hashIndex === -1) return null;
    return filePath.substring(hashIndex + 1);
  }

  /**
   * Encode a project directory path into a safe directory name.
   * Replaces '/' with '-' for consistency with ClaudeCodeSource encoding.
   */
  private encodeProjectDir(projectDir: string): string {
    return projectDir.replace(/\//g, '-');
  }

  private generateUUID(): string {
    return 'composer-' + Math.random().toString(36).substring(2, 15);
  }
}

// Export singleton instance
export const cursorComposerSource = new CursorComposerSource();
