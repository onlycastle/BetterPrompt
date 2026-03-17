/**
 * Multi-source session scanner wrapper for the plugin.
 *
 * Reuses the CLI's mature source discovery and parsing so the plugin can
 * analyze Claude Code and Cursor sessions with one canonical parsed-session
 * format instead of maintaining a Claude-only scanner.
 *
 * @module plugin/lib/core/multi-source-session-scanner
 */
import type { ParsedSession } from './types.js';
export declare const SCAN_CACHE_DIR: string;
/**
 * Discover, parse, normalize, and cache sessions from all available sources.
 */
export declare function scanAndCacheParsedSessions(): Promise<ParsedSession[]>;
export declare function cacheParsedSessions(sessions: ParsedSession[]): Promise<string>;
export declare function readCachedParsedSessions(): Promise<ParsedSession[]>;
