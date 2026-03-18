/**
 * Plugin Evaluation Assembler
 *
 * Shared canonical run/evaluation assembly now lives in @betterprompt/shared.
 * This module remains as the plugin-local facade so existing imports do not change.
 *
 * @module plugin/lib/evaluation-assembler
 */

export {
  applyEvidenceVerification,
  assembleCanonicalAnalysisRun,
  buildCanonicalEvaluation,
  buildReportActivitySessions,
  mergeTranslatedEvaluationFields,
} from '@betterprompt/shared/evaluation';
