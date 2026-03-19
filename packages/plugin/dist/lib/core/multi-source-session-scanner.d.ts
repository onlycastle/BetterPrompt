/**
 * Multi-source session scanner wrapper for the plugin.
 *
 * Uses the plugin's scanner library to discover and parse sessions from
 * multiple AI coding assistant sources (Claude Code, Cursor) into a
 * canonical parsed-session format.
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
