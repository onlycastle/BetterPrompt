/**
 * Assessment Component
 *
 * Renders the overall assessment in a styled box.
 */

import pc from 'picocolors';
import boxen from 'boxen';
import wrapAnsi from 'wrap-ansi';

/**
 * Render the overall assessment box
 */
export function renderAssessment(overallSummary: string, width?: number): string {
  const boxWidth = Math.min(width || process.stdout.columns || 80, 80) - 4;

  // Wrap the summary text
  const wrapped = wrapAnsi(overallSummary, boxWidth - 4);

  const content = `${pc.bold(' ASSESSMENT ')}\n\n${wrapped}`;

  return boxen(content, {
    padding: { left: 1, right: 1, top: 0, bottom: 1 },
    margin: { left: 1, right: 1, top: 0, bottom: 0 },
    borderStyle: 'round',
    borderColor: 'gray',
  });
}
