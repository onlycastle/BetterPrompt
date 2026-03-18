/**
 * Claude Code Session Source
 *
 * Parses Claude Code session logs stored as JSONL files in ~/.claude/projects/
 *
 * File format:
 * - Path: ~/.claude/projects/{encoded-path}/{session-uuid}.jsonl
 * - Format: JSONL (one JSON object per line)
 * - Message types: user, assistant, queue-operation, file-history-snapshot
 *
 * Path encoding: Paths are encoded by replacing '/' with '-'
 * Example: /Users/dev/myapp -> -Users-dev-myapp
 */
import { BaseSessionSource, type FileMetadata, type SourcedSessionMetadata, type SourcedParsedSession, type DiscoveryConfig } from './base.js';
/**
 * Default Claude Code projects directory.
 * @deprecated Use {@link discoverClaudeDataDirs} from `claude-discovery.ts` for robust path resolution.
 */
export declare const CLAUDE_PROJECTS_DIR: string;
/**
 * Claude Code session source implementation
 */
export declare class ClaudeCodeSource extends BaseSessionSource {
    readonly name: "claude-code";
    readonly displayName = "Claude Code";
    private readonly baseDir;
    constructor(baseDir?: string);
    getBaseDir(): string;
    isAvailable(): Promise<boolean>;
    collectFileMetadata(config?: DiscoveryConfig): Promise<FileMetadata[]>;
    extractMetadata(filePath: string, content: string): Promise<SourcedSessionMetadata | null>;
    parseSessionContent(sessionId: string, projectPath: string, projectName: string, content: string): Promise<SourcedParsedSession | null>;
    readSessionContent(filePath: string): Promise<string>;
    private listProjectDirs;
    private listSessionFiles;
    private parseJSONLLine;
    private parseJSONLContent;
    private extractTextContent;
    private extractToolCalls;
}
export declare const claudeCodeSource: ClaudeCodeSource;
