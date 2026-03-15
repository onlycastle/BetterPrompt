/**
 * Session Scanner - Scans Claude Code session logs
 *
 * Extracted from src/lib/parser/jsonl-reader.ts for plugin self-sufficiency.
 * Pure filesystem operations with Zod validation.
 *
 * @module plugin/lib/core/session-scanner
 */
import { type JSONLLine, type SessionMetadata } from './types.js';
/** Claude Code session log directory */
export declare const CLAUDE_PROJECTS_DIR: string;
/** Plugin data directory */
export declare const PLUGIN_DATA_DIR: string;
/** Scan cache directory */
export declare const SCAN_CACHE_DIR: string;
/** Parse a single line of JSONL. Returns null for invalid/empty lines. */
export declare function parseJSONLLine(line: string): JSONLLine | null;
/** Read and parse a JSONL file */
export declare function readJSONLFile(filePath: string): Promise<JSONLLine[]>;
/**
 * Decode project path from Claude's encoding.
 * '-Users-dev-projects-myapp' -> '/Users/dev/projects/myapp'
 * 'C--alphacut' -> 'C:/alphacut'
 */
export declare function decodeProjectPath(encoded: string): string;
/** Get project name from path */
export declare function getProjectName(projectPath: string): string;
/** List all project directories in Claude's projects folder */
export declare function listProjectDirs(): Promise<string[]>;
/** List JSONL session files in a directory */
export declare function listSessionFiles(projectDir: string): Promise<string[]>;
/** Get metadata for a session file */
export declare function getSessionMetadata(filePath: string): Promise<SessionMetadata | null>;
/** List all sessions across all projects, sorted by recency */
export declare function listAllSessions(): Promise<SessionMetadata[]>;
/** Store parsed sessions in scan cache for subsequent tools */
export declare function cacheParsedSessions(sessions: SessionMetadata[]): Promise<string>;
/** Read cached session metadata */
export declare function readCachedSessions(): Promise<SessionMetadata[]>;
