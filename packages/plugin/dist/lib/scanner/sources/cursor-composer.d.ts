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
import { BaseSessionSource, type FileMetadata, type SourcedSessionMetadata, type SourcedParsedSession, type DiscoveryConfig } from './base.js';
/**
 * Cursor Composer session source
 *
 * Reads sessions from Cursor's globalStorage/state.vscdb SQLite database.
 * Each composer session is identified by a composerId and contains
 * multiple bubbles (messages) stored as individual key-value entries.
 */
export declare class CursorComposerSource extends BaseSessionSource {
    readonly name: "cursor-composer";
    readonly displayName = "Cursor Composer";
    private readonly dbPath;
    constructor(dbPath?: string);
    getBaseDir(): string;
    isAvailable(): Promise<boolean>;
    /**
     * Collect file metadata for all composer sessions in state.vscdb.
     *
     * Each composerId becomes a virtual "file" entry with a synthetic path
     * of the form: state.vscdb#{composerId}
     */
    collectFileMetadata(config?: DiscoveryConfig): Promise<FileMetadata[]>;
    extractMetadata(filePath: string, _content: string): Promise<SourcedSessionMetadata | null>;
    parseSessionContent(_sessionId: string, _projectPath: string, _projectName: string, _content: string): Promise<SourcedParsedSession | null>;
    /**
     * Parse a composer session directly from state.vscdb
     */
    parseFromFile(filePath: string): Promise<SourcedParsedSession | null>;
    readSessionContent(_filePath: string): Promise<string>;
    /**
     * List all composer IDs from composerData:* keys
     */
    private listComposerIds;
    /**
     * Get composer metadata for a specific composer ID
     */
    private getComposerData;
    /**
     * Count bubbles for a composer session
     */
    private countBubbles;
    /**
     * Get all bubbles for a composer session, sorted by creation time
     */
    private getBubbles;
    /**
     * Get project directory from the first bubble that has workspaceProjectDir
     */
    private getProjectDirFromBubbles;
    /**
     * Get project directory from already-loaded bubbles
     */
    private getProjectDirFromBubbleList;
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
    private convertBubblesToMessages;
    /**
     * Convert toolFormerData to a ToolCall
     */
    private convertToolFormerData;
    /**
     * Extract token usage from bubble
     */
    private extractTokenUsage;
    /**
     * Extract composerId from synthetic file path: state.vscdb#{composerId}
     */
    private extractComposerId;
    /**
     * Encode a project directory path into a safe directory name.
     * Replaces '/' with '-' for consistency with ClaudeCodeSource encoding.
     */
    private encodeProjectDir;
    private generateUUID;
}
export declare const cursorComposerSource: CursorComposerSource;
