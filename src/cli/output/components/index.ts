/**
 * CLI Components
 *
 * Re-exports all CLI components for rendering reports.
 */

// Utility components
export { ProgressSpinner, createSpinner } from './spinner.js';
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
} from './type-result.js';

// Verbose Report Component (default mode)
export { renderVerboseReport } from './verbose-report.js';

// Unified Report Component
export { renderUnifiedReportCLI } from './unified-report-cli.js';

// Cost Confirmation
export { confirmCost } from './cost-confirmation.js';
