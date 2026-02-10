/**
 * Welcome Banner
 *
 * Creates an eye-catching welcome banner using figlet and gradient-string.
 * Falls back gracefully if terminal doesn't support the styling.
 */

import figlet from 'figlet';
import gradient from 'gradient-string';
import pc from 'picocolors';
import { getChippyLarge } from './chippy.js';

/**
 * Custom gradient for NoMoreAISlop branding
 * Solid cyan matching brand primary color
 */
const brandGradient = gradient(['#00BCD4', '#00BCD4']);

/**
 * Generate the welcome banner with ASCII art title
 */
export function generateWelcomeBanner(): string {
  const lines: string[] = [];

  try {
    // Generate figlet text with a compact font
    const figletText = figlet.textSync('No-Slop', {
      font: 'Small',
      horizontalLayout: 'default',
    });

    // Apply gradient to the figlet text
    const gradientText = brandGradient(figletText);

    lines.push('');
    lines.push(gradientText);

    // Add Chippy mascot
    const chippy = getChippyLarge('happy');
    lines.push('');
    lines.push(...chippy);
    lines.push('');

    // Tagline
    lines.push(pc.dim('    Spot anti-patterns. Ship better.'));
    lines.push('');
  } catch {
    // Fallback for environments where figlet fails
    lines.push('');
    lines.push(pc.bold(pc.cyan('  ╔═══════════════════════════════════════╗')));
    lines.push(pc.bold(pc.cyan('  ║        ') + pc.magenta('NO-AI-SLOP') + pc.cyan('                  ║')));
    lines.push(pc.bold(pc.cyan('  ╚═══════════════════════════════════════╝')));
    lines.push('');
    lines.push(pc.dim('  Spot anti-patterns. Ship better.'));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate a compact header (for non-welcome screens)
 */
export function generateCompactHeader(): string {
  return pc.bold(pc.cyan('🚀 no-ai-slop')) + pc.dim(' - Spot anti-patterns. Ship better.');
}

/**
 * Generate a celebration banner for results
 */
export function generateCelebrationBanner(): string {
  const lines: string[] = [];

  try {
    const chippy = getChippyLarge('excited');
    lines.push('');
    lines.push(...chippy);
    lines.push('');
  } catch {
    lines.push('');
    lines.push(pc.bold(pc.yellow('  🎉 Analysis Complete!')));
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Generate waiting animation messages
 */
export const WAITING_MESSAGES = [
  'Waiting for authorization...',
  'Take your time...',
  'Still waiting...',
  'Almost there?',
  'Patiently waiting...',
  'No rush...',
];

/**
 * Get a waiting message for the current tick
 */
export function getWaitingMessage(tick: number): string {
  return WAITING_MESSAGES[tick % WAITING_MESSAGES.length];
}
