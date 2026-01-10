/**
 * Ratings Component
 *
 * Renders the skill assessment summary with visual bars.
 */

import pc from 'picocolors';
import type { Evaluation, Rating } from '../../../models/index.js';
import { formatRatingLabel, ratingBar } from '../theme.js';

/**
 * Render the ratings summary section
 */
export function renderRatings(evaluation: Evaluation): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold('  SKILL ASSESSMENT'));
  lines.push('');

  const categories: Array<{ name: string; rating: Rating }> = [
    { name: 'Planning', rating: evaluation.planning.rating },
    { name: 'Critical Thinking', rating: evaluation.criticalThinking.rating },
    { name: 'Code Understanding', rating: evaluation.codeUnderstanding.rating },
  ];

  for (const { name, rating } of categories) {
    const paddedName = name.padEnd(20);
    const ratingLabel = formatRatingLabel(rating).padEnd(25);
    const bar = ratingBar(rating);
    lines.push(`  ${pc.white(paddedName)} ${ratingLabel} ${bar}`);
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Render a compact one-line ratings summary
 */
export function renderCompactRatings(evaluation: Evaluation): string {
  const icons = {
    Strong: pc.green('●'),
    Developing: pc.yellow('◐'),
    'Needs Work': pc.red('○'),
  };

  const p = icons[evaluation.planning.rating];
  const c = icons[evaluation.criticalThinking.rating];
  const u = icons[evaluation.codeUnderstanding.rating];

  return `${p} Planning  ${c} Critical  ${u} Code`;
}
