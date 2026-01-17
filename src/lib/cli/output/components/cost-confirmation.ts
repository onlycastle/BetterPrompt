/**
 * Cost Confirmation Component
 *
 * Displays cost estimate and prompts user for confirmation before analysis
 */

import pc from 'picocolors';
import { createInterface } from 'readline';
import { type CostEstimate } from '../../../analyzer/cost-estimator';

/**
 * Render the cost estimate box
 */
export function renderCostEstimate(
  estimate: CostEstimate,
  sessionCount: number
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold(pc.cyan('  💰 Analysis Cost Estimate')));
  lines.push('');
  lines.push(`  ${pc.dim('Sessions to analyze:')} ${pc.white(sessionCount.toString())}`);
  lines.push(`  ${pc.dim('Model:')} ${pc.white(estimate.modelName)}`);
  lines.push('');
  lines.push(`  ${pc.dim('Input tokens:')} ${pc.white(estimate.totalInputTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('├─ Data Analyst:')} ${estimate.breakdown.dataAnalystInput.toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ Personality Analyst:')} ${estimate.breakdown.personalityAnalystInput.toLocaleString()}`);
  lines.push(`    ${pc.dim('└─ Content Writer:')} ${estimate.breakdown.contentWriterInput.toLocaleString()}`);
  lines.push(`  ${pc.dim('Output tokens (est):')} ${pc.white(estimate.estimatedOutputTokens.toLocaleString())}`);
  lines.push('');

  // Cost box
  const costStr = `$${estimate.totalCost.toFixed(4)}`;
  lines.push(pc.green(`  ╔══════════════════════════════════╗`));
  lines.push(pc.green(`  ║  ${pc.bold('Estimated Cost:')} ${pc.bold(pc.yellow(costStr.padEnd(15)))} ║`));
  lines.push(pc.green(`  ╚══════════════════════════════════╝`));
  lines.push('');
  lines.push(pc.dim('  This uses your Google Gemini API key.'));
  lines.push('');

  return lines.join('\n');
}

/**
 * Prompt user for cost confirmation
 * Returns true if user confirms, false otherwise
 */
export async function confirmCost(
  estimate: CostEstimate,
  sessionCount: number
): Promise<boolean> {
  // Display estimate
  console.log(renderCostEstimate(estimate, sessionCount));

  // Use readline for confirmation
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(pc.cyan('  Proceed with analysis? [Y/n] '), (answer) => {
      rl.close();
      const confirmed = answer.toLowerCase() !== 'n';
      resolve(confirmed);
    });
  });
}

/**
 * Display cost without confirmation (for dry-run mode)
 */
export function displayCostDryRun(
  estimate: CostEstimate,
  sessionCount: number
): void {
  console.log(renderCostEstimate(estimate, sessionCount));
  console.log(pc.yellow('  [DRY RUN] No analysis performed.'));
  console.log('');
}

/**
 * Display a compact cost summary (single line)
 */
export function renderCostSummary(estimate: CostEstimate): string {
  return `${pc.dim('Cost:')} ${pc.yellow('$' + estimate.totalCost.toFixed(4))} ${pc.dim('|')} ${pc.dim('Tokens:')} ${estimate.totalInputTokens.toLocaleString()} in / ${estimate.estimatedOutputTokens.toLocaleString()} out`;
}
