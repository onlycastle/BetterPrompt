/**
 * Multi-Source Session Scanner
 *
 * Unified scanner that discovers and parses sessions from multiple
 * AI coding assistant sources (Claude Code, Cursor, etc.)
 *
 * Architecture:
 * - SessionSource interface defines the contract for each source
 * - SourceRegistry maintains available sources
 * - MultiSourceScanner coordinates scanning across all sources
 */
export type { SessionSourceType, FileMetadata, SourcedSessionMetadata, SourcedParsedSession, DiscoveryConfig, SessionSource, } from './sources/base.js';
export { BaseSessionSource } from './sources/base.js';
export { ClaudeCodeSource, claudeCodeSource, CLAUDE_PROJECTS_DIR } from './sources/claude-code.js';
export { CursorSource, cursorSource, CURSOR_CHATS_DIR } from './sources/cursor.js';
export { CursorComposerSource, cursorComposerSource } from './sources/cursor-composer.js';
export { discoverClaudeDataDirs, validateClaudeDataDir } from './sources/claude-discovery.js';
export { TOOL_MAPPING, TOOL_CATEGORIES, CURSOR_COMPOSER_TOOL_IDS, normalizeToolName, resolveComposerToolId, getKnownTools, needsNormalization, getToolCategory, } from './tool-mapping.js';
import type { SessionSource, FileMetadata, SourcedSessionMetadata, SourcedParsedSession } from './sources/base.js';
/**
 * Registry of all available session sources
 *
 * Claude Code sources are lazily discovered on first getAvailable() call
 * using waterfall discovery (env var → default path → prefix glob).
 * Cursor sources are registered synchronously in the constructor.
 */
export declare class SourceRegistry {
    private sources;
    private claudeInitialized;
    constructor();
    /**
     * Register a new session source
     */
    register(source: SessionSource): void;
    /**
     * Get all registered sources
     */
    getAll(): SessionSource[];
    /**
     * Get available sources (directory exists, dependencies met).
     * Lazily initializes Claude Code sources on first call.
     */
    getAvailable(): Promise<SessionSource[]>;
    /**
     * Get a specific source by name
     */
    get(name: string): SessionSource | undefined;
    /**
     * Discover and register Claude Code sources from available data directories.
     */
    private initClaudeSources;
}
export declare const sourceRegistry: SourceRegistry;
/**
 * Configuration for multi-source scanning
 */
export interface MultiSourceScanConfig {
    /** Maximum candidates per source for pre-filtering */
    maxCandidatesPerSource?: number;
    /** Minimum file size to consider */
    minFileSize?: number;
    /** Maximum file size to consider */
    maxFileSize?: number;
    /** Source types to include (all if undefined) */
    includeSources?: string[];
    /** Source types to exclude */
    excludeSources?: string[];
}
/**
 * Result of multi-source file metadata collection
 */
export interface MultiSourceFileResult {
    files: FileMetadata[];
    sourceStats: Map<string, number>;
}
/**
 * Multi-source session scanner
 *
 * Coordinates scanning across multiple session sources and
 * merges results into a unified format.
 */
export declare class MultiSourceScanner {
    private registry;
    constructor(registry?: SourceRegistry);
    /**
     * Collect file metadata from all available sources
     */
    collectAllFileMetadata(config?: MultiSourceScanConfig): Promise<MultiSourceFileResult>;
    /**
     * Extract metadata for a file from the appropriate source
     */
    extractMetadata(file: FileMetadata): Promise<SourcedSessionMetadata | null>;
    /**
     * Parse a session from the appropriate source
     */
    parseSession(metadata: SourcedSessionMetadata): Promise<SourcedParsedSession | null>;
    /**
     * Get available source names
     */
    getAvailableSources(): Promise<string[]>;
    /**
     * Check source availability status.
     * Triggers lazy Claude source init if not yet done.
     */
    getSourceStatus(): Promise<Map<string, boolean>>;
    private getFilteredSources;
}
export declare const multiSourceScanner: MultiSourceScanner;
/**
 * Check if any session sources are available
 */
export declare function hasAnySources(): Promise<boolean>;
/**
 * Get display names for available sources
 */
export declare function getAvailableSourceNames(): Promise<{
    name: string;
    displayName: string;
}[]>;
