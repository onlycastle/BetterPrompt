/**
 * CLI Output Renderer
 *
 * Main entry point for rendering CLI output.
 * Uses Verbose Mode as the default rendering approach.
 */

// Utility components
export { createSpinner, ProgressSpinner } from './components/index';
export * from './theme';

// Re-export Verbose Report renderer (default mode)
export { renderVerboseReport } from './components/index';

// Re-export Unified Report renderer
export { renderUnifiedReportCLI } from './components/index';

// Re-export v2.0 Style components
export {
  renderTypeResult,
  renderDistribution,
  renderMetricsSummary,
  renderStrengths,
  renderGrowthPoints,
  renderStyleEvidence,
  renderLockedTeaser,
  renderWebLink,
} from './components/index';

// Re-export utility components
export { renderRecommendations, renderFooter, confirmCost } from './components/index';

/**
 * Render options for verbose mode
 */
export interface RenderOptions {
  /** Whether premium content is unlocked */
  isUnlocked?: boolean;
  /** Disable colors */
  noColor?: boolean;
  /** Terminal width (auto-detected if not specified) */
  width?: number;
}
