/**
 * Recommendations Component
 *
 * Renders the recommendations list.
 */

import pc from 'picocolors';
import { wrapText } from '../theme.js';

/**
 * Render the recommendations section
 */
export function renderRecommendations(
  recommendations: string[],
  width = 70
): string {
  const lines: string[] = [];

  lines.push(pc.bold('  RECOMMENDATIONS'));
  lines.push('');

  recommendations.forEach((rec, index) => {
    const num = pc.cyan(pc.bold((index + 1).toString()));
    const wrapped = wrapText(rec, width - 6);

    lines.push(`  ${num}  ${wrapped[0]}`);
    for (let i = 1; i < wrapped.length; i++) {
      lines.push(`      ${wrapped[i]}`);
    }
    lines.push('');
  });

  return lines.join('\n');
}
