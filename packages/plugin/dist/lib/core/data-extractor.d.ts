/**
 * Data Extractor - Deterministic Phase 1 extraction from JSONL sessions
 *
 * Simplified version of DataExtractorWorker for plugin use.
 * Works directly with JSONL files (no ParsedSession abstraction).
 * Skips LLM-based content classification (host LLM handles raw data).
 *
 * @module plugin/lib/core/data-extractor
 */
import type { Phase1Output, SessionMetadata } from './types.js';
/**
 * Extract Phase 1 output from session files.
 *
 * Deterministic extraction (no LLM calls):
 * 1. Parses JSONL files
 * 2. Extracts developer utterances with structural metadata
 * 3. Computes session metrics (friction signals, context fill, etc.)
 * 4. Extracts AI insight blocks
 *
 * @param sessionFiles - Array of session file paths or {sessionId, filePath} objects
 * @returns Phase1Output ready for scoring and analysis
 */
export declare function extractPhase1Data(sessionFiles: Array<string | SessionMetadata>): Promise<Phase1Output>;
