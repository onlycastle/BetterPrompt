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
import { BaseSessionSource, type FileMetadata, type SourcedSessionMetadata, type SourcedParsedSession, type DiscoveryConfig } from './base.js';
/**
 * Default Cursor chats directory
 */
export declare const CURSOR_CHATS_DIR: string;
/**
 * Cursor session source implementation
 */
export declare class CursorSource extends BaseSessionSource {
    readonly name: "cursor";
    readonly displayName = "Cursor";
    private readonly baseDir;
    constructor(baseDir?: string);
    getBaseDir(): string;
    isAvailable(): Promise<boolean>;
    collectFileMetadata(config?: DiscoveryConfig): Promise<FileMetadata[]>;
    extractMetadata(filePath: string, _content: string): Promise<SourcedSessionMetadata | null>;
    parseSessionContent(sessionId: string, projectPath: string, _projectName: string, _content: string): Promise<SourcedParsedSession | null>;
    /**
     * Parse session directly from SQLite file
     */
    parseFromFile(filePath: string): Promise<SourcedParsedSession | null>;
    readSessionContent(filePath: string): Promise<string>;
    /**
     * List all subdirectories within a given directory
     */
    private listSubdirectories;
    private listWorkspaceDirs;
    private listSessionDirs;
    private parseConversation;
    private parseBlob;
    /**
     * Parse a varint from buffer at given offset
     * Protobuf uses variable-length encoding for integers
     */
    private parseVarint;
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
    private parseProtobuf;
    /**
     * Map protobuf fields to a message-like structure
     */
    private mapProtobufFields;
    /**
     * Check if a string is printable text (not binary garbage)
     */
    private isPrintableText;
    /**
     * Convert Unix timestamp to Date, handling both seconds and milliseconds
     */
    private unixToDate;
    private extractTimestamp;
    /**
     * Parse assistant message content array to extract text and tool-call blocks
     * Cursor stores tool calls in the content array with type: 'tool-call'
     */
    private parseAssistantContent;
    /**
     * Extract tool calls from Cursor's tool-call blocks
     */
    private extractToolCallsFromBlocks;
    /**
     * Extract tool calls from legacy toolCalls/tool_calls fields
     */
    private extractLegacyToolCalls;
    private generateUUID;
}
export declare const cursorSource: CursorSource;
