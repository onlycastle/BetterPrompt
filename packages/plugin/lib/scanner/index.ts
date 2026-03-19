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

// Export types
export type {
  SessionSourceType,
  FileMetadata,
  SourcedSessionMetadata,
  SourcedParsedSession,
  DiscoveryConfig,
  SessionSource,
} from './sources/base.js';

export { BaseSessionSource } from './sources/base.js';

// Export source implementations
export { ClaudeCodeSource, claudeCodeSource, CLAUDE_PROJECTS_DIR } from './sources/claude-code.js';
export { CursorSource, cursorSource, CURSOR_CHATS_DIR } from './sources/cursor.js';
export { CursorComposerSource, cursorComposerSource } from './sources/cursor-composer.js';
export { discoverClaudeDataDirs, validateClaudeDataDir } from './sources/claude-discovery.js';

// Export tool mapping utilities
export {
  TOOL_MAPPING,
  TOOL_CATEGORIES,
  CURSOR_COMPOSER_TOOL_IDS,
  normalizeToolName,
  resolveComposerToolId,
  getKnownTools,
  needsNormalization,
  getToolCategory,
} from './tool-mapping.js';

// ─────────────────────────────────────────────────────────────────────────
// Source Registry
// ─────────────────────────────────────────────────────────────────────────

import type { SessionSource, FileMetadata, SourcedSessionMetadata, SourcedParsedSession } from './sources/base.js';
import { ClaudeCodeSource } from './sources/claude-code.js';
import { CursorSource } from './sources/cursor.js';
import { CursorComposerSource } from './sources/cursor-composer.js';
import { discoverClaudeDataDirs } from './sources/claude-discovery.js';

/**
 * Registry of all available session sources
 *
 * Claude Code sources are lazily discovered on first getAvailable() call
 * using waterfall discovery (default path → prefix glob).
 * Cursor sources are registered synchronously in the constructor.
 */
export class SourceRegistry {
  private sources: SessionSource[] = [];
  private claudeInitialized = false;

  constructor() {
    // Claude Code sources are registered lazily via initClaudeSources()
    this.register(new CursorSource());
    this.register(new CursorComposerSource());
  }

  /**
   * Register a new session source
   */
  register(source: SessionSource): void {
    this.sources.push(source);
  }

  /**
   * Get all registered sources
   */
  getAll(): SessionSource[] {
    return [...this.sources];
  }

  /**
   * Get available sources (directory exists, dependencies met).
   * Lazily initializes Claude Code sources on first call.
   */
  async getAvailable(): Promise<SessionSource[]> {
    if (!this.claudeInitialized) {
      await this.initClaudeSources();
      this.claudeInitialized = true;
    }

    const available: SessionSource[] = [];

    for (const source of this.sources) {
      if (await source.isAvailable()) {
        available.push(source);
      }
    }

    return available;
  }

  /**
   * Get a specific source by name
   */
  get(name: string): SessionSource | undefined {
    return this.sources.find((s) => s.name === name);
  }

  /**
   * Discover and register Claude Code sources from available data directories.
   */
  private async initClaudeSources(): Promise<void> {
    const dirs = await discoverClaudeDataDirs();
    for (const dir of dirs) {
      this.register(new ClaudeCodeSource(dir));
    }
  }
}

// Default registry instance
export const sourceRegistry = new SourceRegistry();

// ─────────────────────────────────────────────────────────────────────────
// Multi-Source Scanner
// ─────────────────────────────────────────────────────────────────────────

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
export class MultiSourceScanner {
  constructor(private registry: SourceRegistry = sourceRegistry) {}

  /**
   * Collect file metadata from all available sources
   */
  async collectAllFileMetadata(
    config?: MultiSourceScanConfig
  ): Promise<MultiSourceFileResult> {
    const sources = await this.getFilteredSources(config);
    const allFiles: FileMetadata[] = [];
    const sourceStats = new Map<string, number>();

    for (const source of sources) {
      const files = await source.collectFileMetadata({
        minFileSize: config?.minFileSize,
        maxFileSize: config?.maxFileSize,
      });

      allFiles.push(...files);
      sourceStats.set(source.name, files.length);
    }

    return { files: allFiles, sourceStats };
  }

  /**
   * Extract metadata for a file from the appropriate source
   */
  async extractMetadata(
    file: FileMetadata
  ): Promise<SourcedSessionMetadata | null> {
    const source = this.registry.get(file.source);
    if (!source) return null;

    try {
      const content = await source.readSessionContent(file.filePath);
      return source.extractMetadata(file.filePath, content);
    } catch {
      return null;
    }
  }

  /**
   * Parse a session from the appropriate source
   */
  async parseSession(
    metadata: SourcedSessionMetadata
  ): Promise<SourcedParsedSession | null> {
    const source = this.registry.get(metadata.source);
    if (!source) return null;

    try {
      // Handle SQLite-based sources (requires parseFromFile)
      if (metadata.source === 'cursor') {
        const cursorSource = source as CursorSource;
        return cursorSource.parseFromFile(metadata.filePath);
      }

      if (metadata.source === 'cursor-composer') {
        const composerSource = source as CursorComposerSource;
        return composerSource.parseFromFile(metadata.filePath);
      }

      // Standard path: read content and parse
      const content = await source.readSessionContent(metadata.filePath);
      return source.parseSessionContent(
        metadata.sessionId,
        metadata.projectPath,
        metadata.projectName,
        content
      );
    } catch {
      return null;
    }
  }

  /**
   * Get available source names
   */
  async getAvailableSources(): Promise<string[]> {
    const sources = await this.registry.getAvailable();
    return sources.map((s) => s.name);
  }

  /**
   * Check source availability status.
   * Triggers lazy Claude source init if not yet done.
   */
  async getSourceStatus(): Promise<Map<string, boolean>> {
    // Ensure Claude sources are discovered before checking status
    const available = await this.registry.getAvailable();
    const status = new Map<string, boolean>();

    for (const source of this.registry.getAll()) {
      status.set(source.name, available.some((s) => s === source));
    }

    return status;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private helpers
  // ─────────────────────────────────────────────────────────────────────────

  private async getFilteredSources(
    config?: MultiSourceScanConfig
  ): Promise<SessionSource[]> {
    let sources = await this.registry.getAvailable();

    // Apply include filter
    if (config?.includeSources && config.includeSources.length > 0) {
      sources = sources.filter((s) => config.includeSources!.includes(s.name));
    }

    // Apply exclude filter
    if (config?.excludeSources && config.excludeSources.length > 0) {
      sources = sources.filter((s) => !config.excludeSources!.includes(s.name));
    }

    return sources;
  }
}

// Default scanner instance
export const multiSourceScanner = new MultiSourceScanner();

// ─────────────────────────────────────────────────────────────────────────
// Convenience functions
// ─────────────────────────────────────────────────────────────────────────

/**
 * Check if any session sources are available
 */
export async function hasAnySources(): Promise<boolean> {
  const sources = await sourceRegistry.getAvailable();
  return sources.length > 0;
}

/**
 * Get display names for available sources
 */
export async function getAvailableSourceNames(): Promise<{ name: string; displayName: string }[]> {
  const sources = await sourceRegistry.getAvailable();
  return sources.map((s) => ({
    name: s.name,
    displayName: s.displayName,
  }));
}
