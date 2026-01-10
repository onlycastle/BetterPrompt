/**
 * Evidence Component
 *
 * Renders evidence quotes with explanations.
 */

import pc from 'picocolors';
import type { Clue } from '../../../models/index.js';
import { icons, wrapText } from '../theme.js';

/**
 * Render a single evidence item
 */
export function renderEvidence(clue: Clue, width = 70): string {
  const lines: string[] = [];
  const icon = clue.type === 'positive' ? icons.positive : icons.negative;
  const quoteWidth = width - 8;

  // Wrap quote text
  const wrappedQuote = wrapText(`"${clue.quote}"`, quoteWidth);

  // First line with icon
  lines.push(`   ${icon}`);

  // Quote lines with left border
  for (const line of wrappedQuote) {
    lines.push(`    ${icons.quote} ${pc.italic(line)}`);
  }

  // Explanation
  const wrappedExplanation = wrapText(clue.explanation, quoteWidth);
  lines.push(`    ${pc.dim('└─→')} ${pc.dim(wrappedExplanation[0])}`);
  for (let i = 1; i < wrappedExplanation.length; i++) {
    lines.push(`        ${pc.dim(wrappedExplanation[i])}`);
  }

  return lines.join('\n');
}

/**
 * Render all evidence items
 */
export function renderEvidenceList(clues: Clue[], width = 70): string {
  if (clues.length === 0) {
    return pc.dim('   No evidence collected');
  }

  return clues.map((clue) => renderEvidence(clue, width)).join('\n\n');
}
