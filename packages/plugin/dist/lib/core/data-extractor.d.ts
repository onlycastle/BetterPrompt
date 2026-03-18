/**
 * Data Extractor - Deterministic Phase 1 extraction from parsed sessions
 *
 * Accepts canonical parsed sessions and produces the plugin Phase 1 artifact.
 * Full parsed sessions are preserved on the output so downstream stages keep
 * transcript access while the extracted utterance layer remains deterministic.
 *
 * @module plugin/lib/core/data-extractor
 */
import type { Phase1Output, ParsedSession } from './types.js';
/**
 * Extract Phase 1 output from parsed sessions.
 */
export declare function extractPhase1DataFromParsedSessions(sessions: ParsedSession[]): Promise<Phase1Output>;
