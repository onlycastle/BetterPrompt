/**
 * Validation barrel export
 *
 * @module @betterprompt/shared/validation
 */

export {
  validateGrowthAreaQuality,
  validateGrowthAreaBatch,
  scoreDistinctMoments,
  scoreVerifiableAction,
  scorePatternSpecificity,
  scoreToolFileNaming,
  flagGenericArea,
  flagIsolatedQuotes,
  flagArbitraryScores,
  flagMissingPatterns,
  detectGenericTitle,
  detectGenericDescription,
  detectBehavioralMarkers,
  analyzeEvidenceIsolation,
  validateSeverityJustification,
  hasSessionLogSpecificity,
} from './growth-area-quality-checker.js';
export type {
  CriterionScore,
  ProblemFlag,
  QualityValidationResult,
  BatchValidationSummary,
} from './growth-area-quality-checker.js';
