/**
 * Web Report Types
 *
 * Shared type definitions for the web report system.
 */

import { type TypeResult, type CodingStyleType, TYPE_METADATA } from '../models/index.js';
import { type FullAnalysisResult } from '../analyzer/dimensions/index.js';
import { type VerboseEvaluation } from '../models/verbose-evaluation.js';

/**
 * Extended analysis data for full report
 */
export interface ExtendedAnalysisData {
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
}

/**
 * Report options for customization
 */
export interface ReportOptions {
  reportId?: string;
  baseUrl?: string;
  enableSharing?: boolean;
  /** Show all premium content without blur (for paid users or testing) */
  unlocked?: boolean;
}

/**
 * CSS level class for score badges
 */
export type CssLevelClass = 'healthy' | 'balanced' | 'moderate' | 'warning';

/**
 * Maps a dimension level to its CSS class for score-level styling
 *
 * @param level - The dimension level string
 * @param positiveLevel - Level(s) that map to 'healthy' class
 * @param useWarning - If true, uses 'warning' instead of 'moderate' for lowest level
 */
export function getLevelClass(
  level: string,
  positiveLevel: string | string[],
  useWarning = false
): CssLevelClass {
  const positiveLevels = Array.isArray(positiveLevel) ? positiveLevel : [positiveLevel];

  if (positiveLevels.includes(level)) {
    return 'healthy';
  }
  if (level === 'developing') {
    return 'balanced';
  }
  return useWarning ? 'warning' : 'moderate';
}

// Re-export commonly used types for convenience
export type { TypeResult, CodingStyleType, FullAnalysisResult, VerboseEvaluation };
export { TYPE_METADATA };
