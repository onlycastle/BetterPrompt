/**
 * CLI Components
 *
 * Re-exports all CLI components for rendering reports.
 */

// Utility components
export { ProgressSpinner, createSpinner } from './spinner';
export { renderRecommendations } from './recommendations';
export { renderFooter } from './footer';

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
} from './type-result';

// Verbose Report Component (default mode)
export { renderVerboseReport } from './verbose-report';

// Unified Report Component
export { renderUnifiedReportCLI } from './unified-report-cli';

// Cost Confirmation
export { confirmCost } from './cost-confirmation';
