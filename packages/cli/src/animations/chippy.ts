/**
 * Chippy - The NoMoreAISlop Mascot
 *
 * ASCII art mascot with various expressions for different states.
 * Based on a friendly robot character to represent AI collaboration.
 */

export type ChippyExpression = 'neutral' | 'blink' | 'happy' | 'thinking' | 'excited' | 'wink';

/**
 * Chippy face configurations for different expressions
 */
const CHIPPY_FACES: Record<ChippyExpression, { leftEye: string; rightEye: string; mouth: string }> = {
  neutral: { leftEye: '◉', rightEye: '◉', mouth: '──' },
  blink: { leftEye: '─', rightEye: '─', mouth: '──' },
  happy: { leftEye: '◉', rightEye: '◉', mouth: '◡◡' },
  thinking: { leftEye: '◉', rightEye: '◉', mouth: '~~' },
  excited: { leftEye: '★', rightEye: '★', mouth: '◡◡' },
  wink: { leftEye: '◉', rightEye: '─', mouth: '◡◡' },
};

/**
 * Get a single-line Chippy face for inline display
 */
export function getChippyInline(expression: ChippyExpression = 'neutral'): string {
  const face = CHIPPY_FACES[expression];
  return `│ ${face.leftEye}    ${face.rightEye} │`;
}

/**
 * Get the full Chippy ASCII art
 */
export function getChippyFull(expression: ChippyExpression = 'neutral'): string[] {
  const face = CHIPPY_FACES[expression];
  return [
    '    ╭─────────╮',
    `    │ ${face.leftEye}    ${face.rightEye} │`,
    `    │   ${face.mouth}   │`,
    '    ╰─┬───┬──╯',
  ];
}

/**
 * Get Chippy with a speech indicator
 */
export function getChippyWithIndicator(
  expression: ChippyExpression,
  indicator: string
): string {
  const face = CHIPPY_FACES[expression];
  return `    │ ${face.leftEye}    ${face.rightEye} │ ${indicator}`;
}

/**
 * Get larger centered Chippy for welcome screen
 */
export function getChippyLarge(expression: ChippyExpression = 'happy'): string[] {
  const face = CHIPPY_FACES[expression];
  return [
    '      ╭─────────╮',
    `      │ ${face.leftEye}    ${face.rightEye} │`,
    `      │   ${face.mouth}   │`,
    '      ╰─┬───┬──╯',
  ];
}

/**
 * Thinking animation frames
 */
export const THINKING_FRAMES: ChippyExpression[] = ['thinking', 'neutral', 'thinking', 'blink'];

/**
 * Celebration animation frames
 */
export const CELEBRATION_FRAMES: ChippyExpression[] = ['excited', 'happy', 'wink', 'excited'];

/**
 * Get the next frame in a cyclic animation
 */
export function getAnimationFrame(
  frames: ChippyExpression[],
  tick: number
): ChippyExpression {
  return frames[tick % frames.length];
}
