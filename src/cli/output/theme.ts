/**
 * CLI Theme System
 *
 * Defines colors, icons, and styling constants for CLI output.
 */

import pc from 'picocolors';
import type { Rating } from '../../models/index.js';

/**
 * Semantic color functions
 */
export const colors = {
  // Rating colors
  strong: pc.green,
  developing: pc.yellow,
  needsWork: pc.red,

  // Semantic colors
  success: pc.green,
  warning: pc.yellow,
  error: pc.red,
  info: pc.cyan,
  muted: pc.dim,
  accent: pc.magenta,

  // Typography
  heading: (s: string) => pc.bold(pc.white(s)),
  subheading: pc.bold,
  body: pc.white,
  secondary: pc.dim,
};

/**
 * Icons with color
 */
export const icons = {
  strong: pc.green('●'),
  developing: pc.yellow('◐'),
  needsWork: pc.red('○'),
  positive: pc.green('✓'),
  negative: pc.red('✗'),
  bullet: pc.dim('•'),
  arrow: pc.dim('→'),
  quote: pc.dim('│'),
};

/**
 * Rating to icon mapping
 */
export const ratingIcon: Record<Rating, string> = {
  Strong: icons.strong,
  Developing: icons.developing,
  'Needs Work': icons.needsWork,
};

/**
 * Rating to color function mapping
 */
export const ratingColor: Record<Rating, (s: string) => string> = {
  Strong: colors.strong,
  Developing: colors.developing,
  'Needs Work': colors.needsWork,
};

/**
 * Format a rating with icon and label
 */
export function formatRatingLabel(rating: Rating): string {
  const icon = ratingIcon[rating];
  const color = ratingColor[rating];
  return `${icon} ${color(rating.toUpperCase())}`;
}

/**
 * Get fill percentage for a rating
 */
function getRatingFillPercent(rating: Rating): number {
  switch (rating) {
    case 'Strong':
      return 1.0;
    case 'Developing':
      return 0.6;
    case 'Needs Work':
      return 0.35;
  }
}

/**
 * Generate a visual rating bar
 */
export function ratingBar(rating: Rating, width = 20): string {
  const filled = Math.floor(width * getRatingFillPercent(rating));
  const empty = width - filled;

  const color = ratingColor[rating];
  return color('█'.repeat(filled)) + pc.dim('░'.repeat(empty));
}

/**
 * Box drawing characters
 */
export const box = {
  // Double line (for main header)
  double: {
    topLeft: '╔',
    topRight: '╗',
    bottomLeft: '╚',
    bottomRight: '╝',
    horizontal: '═',
    vertical: '║',
  },
  // Round corners (for sections)
  round: {
    topLeft: '╭',
    topRight: '╮',
    bottomLeft: '╰',
    bottomRight: '╯',
    horizontal: '─',
    vertical: '│',
  },
  // Single line
  single: {
    topLeft: '┌',
    topRight: '┐',
    bottomLeft: '└',
    bottomRight: '┘',
    horizontal: '─',
    vertical: '│',
  },
};

/**
 * Draw a simple box around text
 */
export function drawBox(
  content: string,
  options: {
    style?: 'double' | 'round' | 'single';
    padding?: number;
    width?: number;
    borderColor?: (s: string) => string;
  } = {}
): string {
  const {
    style = 'round',
    padding = 1,
    width = process.stdout.columns || 80,
    borderColor = pc.dim,
  } = options;

  const chars = box[style];
  const innerWidth = width - 4; // Account for borders and padding
  const lines = content.split('\n');

  const paddedLines = lines.map((line) => {
    const stripped = stripAnsi(line);
    const padRight = Math.max(0, innerWidth - stripped.length);
    return ` ${line}${' '.repeat(padRight)} `;
  });

  const horizontalLine = chars.horizontal.repeat(width - 2);
  const emptyLine = ` ${' '.repeat(innerWidth)} `;

  const result: string[] = [];

  // Top border
  result.push(borderColor(chars.topLeft + horizontalLine + chars.topRight));

  // Top padding
  for (let i = 0; i < padding; i++) {
    result.push(borderColor(chars.vertical) + emptyLine + borderColor(chars.vertical));
  }

  // Content
  for (const line of paddedLines) {
    result.push(borderColor(chars.vertical) + line + borderColor(chars.vertical));
  }

  // Bottom padding
  for (let i = 0; i < padding; i++) {
    result.push(borderColor(chars.vertical) + emptyLine + borderColor(chars.vertical));
  }

  // Bottom border
  result.push(borderColor(chars.bottomLeft + horizontalLine + chars.bottomRight));

  return result.join('\n');
}

/**
 * Strip ANSI codes from a string (for length calculation)
 */
export function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
}

/**
 * Wrap text to a given width, preserving ANSI codes
 */
export function wrapText(text: string, width: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';
  let currentLength = 0;

  for (const word of words) {
    const wordLength = stripAnsi(word).length;

    if (currentLength + wordLength + 1 > width && currentLine) {
      lines.push(currentLine);
      currentLine = word;
      currentLength = wordLength;
    } else {
      currentLine = currentLine ? `${currentLine} ${word}` : word;
      currentLength += wordLength + (currentLine ? 1 : 0);
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Create a horizontal divider
 */
export function divider(width?: number, char = '─'): string {
  const w = width || process.stdout.columns || 80;
  return pc.dim(char.repeat(w));
}
