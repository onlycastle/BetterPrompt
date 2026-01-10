/**
 * CLI Output Renderer
 *
 * Main entry point for rendering CLI output.
 */

import pc from 'picocolors';
import type { Evaluation, ParsedSession } from '../../models/index.js';
import {
  renderHeader,
  renderRatings,
  renderAssessment,
  renderCategory,
  renderRecommendations,
  renderFooter,
} from './components/index.js';

export { createSpinner, ProgressSpinner } from './components/index.js';
export * from './theme.js';

/**
 * Render options
 */
export interface RenderOptions {
  /** Output mode: full, summary, or verbose */
  mode: 'full' | 'summary' | 'verbose';
  /** Disable colors */
  noColor: boolean;
  /** Terminal width (auto-detected if not specified) */
  width?: number;
}

/**
 * Default render options
 */
export const defaultRenderOptions: RenderOptions = {
  mode: 'full',
  noColor: false,
};

/**
 * Render the full analysis report to console
 */
export function renderReport(
  evaluation: Evaluation,
  session: ParsedSession,
  savePath: string,
  options: Partial<RenderOptions> = {}
): void {
  const opts = { ...defaultRenderOptions, ...options };
  const width = opts.width || process.stdout.columns || 80;

  // Header
  console.log(renderHeader(evaluation, session));

  // Ratings summary
  console.log(renderRatings(evaluation));

  // Overall assessment
  console.log(renderAssessment(evaluation.overallSummary, width));
  console.log('');

  // In summary mode, skip detailed analysis
  if (opts.mode === 'summary') {
    console.log(renderFooter(savePath));
    return;
  }

  // Detailed analysis
  console.log('');
  console.log(pc.bold('  DETAILED ANALYSIS'));
  console.log('');

  console.log(renderCategory('Planning', evaluation.planning, width - 4));
  console.log(
    renderCategory('Critical Thinking', evaluation.criticalThinking, width - 4)
  );
  console.log(
    renderCategory('Code Understanding', evaluation.codeUnderstanding, width - 4)
  );

  // Recommendations
  console.log(renderRecommendations(evaluation.recommendations, width - 4));

  // Footer
  console.log(renderFooter(savePath));
}

/**
 * Render a compact summary (for listing)
 */
export function renderCompactSummary(evaluation: Evaluation): string {
  const date = new Date(evaluation.analyzedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const icons = {
    Strong: pc.green('●'),
    Developing: pc.yellow('◐'),
    'Needs Work': pc.red('○'),
  };

  const p = icons[evaluation.planning.rating];
  const c = icons[evaluation.criticalThinking.rating];
  const u = icons[evaluation.codeUnderstanding.rating];

  return `${date} │ ${p} ${c} ${u} │ ${pc.dim(evaluation.sessionId.slice(0, 8))}...`;
}

/**
 * Render JSON output (for piping)
 */
export function renderJson(
  evaluation: Evaluation,
  session: ParsedSession,
  savePath: string
): void {
  const output = {
    evaluation,
    session: {
      sessionId: session.sessionId,
      projectPath: session.projectPath,
      durationSeconds: session.durationSeconds,
      stats: session.stats,
    },
    savePath,
  };

  console.log(JSON.stringify(output, null, 2));
}

/**
 * Render an error message
 */
export function renderError(title: string, message: string, hints?: string[]): void {
  console.log('');
  console.log(`  ${pc.bgRed(pc.white(' ERROR '))} ${pc.red(title)}`);
  console.log('');
  console.log(`  ${message}`);

  if (hints && hints.length > 0) {
    console.log('');
    console.log(pc.dim('  Possible solutions:'));
    for (const hint of hints) {
      console.log(`  ${pc.dim('•')} ${hint}`);
    }
  }

  console.log('');
}
