/**
 * Category Detail Component
 *
 * Renders detailed analysis for each category.
 */

import pc from 'picocolors';
import type { CategoryEvaluation } from '../../../models/index.js';
import { formatRatingLabel, wrapText, box } from '../theme.js';
import { renderEvidenceList } from './evidence.js';

/**
 * Render a category detail section
 */
export function renderCategory(
  name: string,
  evaluation: CategoryEvaluation,
  width = 70
): string {
  const lines: string[] = [];

  // Header with rating
  const ratingLabel = formatRatingLabel(evaluation.rating);
  const headerText = ` ${name} `;
  const dashCount = Math.max(0, width - headerText.length - 20);
  const headerLine = `${box.single.topLeft}${headerText}${box.single.horizontal.repeat(dashCount)} ${ratingLabel} ${box.single.horizontal}${box.single.topRight}`;

  lines.push(pc.dim(headerLine));
  lines.push('');

  // Summary
  const wrappedSummary = wrapText(evaluation.summary, width - 4);
  for (const line of wrappedSummary) {
    lines.push(`  ${line}`);
  }
  lines.push('');

  // Evidence
  lines.push(`  ${pc.bold('Evidence')}`);
  lines.push('');
  lines.push(renderEvidenceList(evaluation.clues, width - 4));
  lines.push('');

  return lines.join('\n');
}
