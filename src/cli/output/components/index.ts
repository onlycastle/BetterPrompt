/**
 * CLI Components
 *
 * Re-exports all CLI components.
 */

export { ProgressSpinner, createSpinner } from './spinner.js';
export { renderRatings, renderCompactRatings } from './ratings.js';
export { renderEvidence, renderEvidenceList } from './evidence.js';
export { renderHeader } from './header.js';
export { renderCategory } from './category.js';
export { renderAssessment } from './assessment.js';
export { renderRecommendations } from './recommendations.js';
export { renderFooter } from './footer.js';

// v2.0 AI Coding Style Components
export {
  renderTypeResult,
  renderDistribution,
  renderMetricsSummary,
  renderStrengths,
  renderGrowthPoints,
  renderEvidence as renderStyleEvidence,
  renderLockedTeaser,
  renderWebLink,
  renderFullTypeResult,
  renderDimensionSummary,
} from './type-result.js';

// Verbose Report Component
export { renderVerboseReport } from './verbose-report.js';
