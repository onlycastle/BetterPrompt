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
 * Chip character frames (3 lines each)
 * Represents a microchip with pins extending outward
 */
const CHIP_FRAMES: Record<ChippyExpression, string[]> = {
  neutral: [
    '┬─┬─┬',
    '├○ ○├',
    '┴───┴',
  ],
  blink: [
    '┬─┬─┬',
    '├─ ─├',
    '┴───┴',
  ],
  happy: [
    '┬─┬─┬',
    '├◉ ◉├',
    '┴◡◡◡┴',
  ],
  thinking: [
    '┬─┬─┬',
    '├◉ ◉├',
    '┴~~~┴',
  ],
  excited: [
    '┬─┬─┬',
    '├✱ ✱├',
    '┴◡◡◡┴',
  ],
  wink: [
    '┬─┬─┬',
    '├◉ ─├',
    '┴◡◡◡┴',
  ],
};

/**
 * Pixel dust patterns for animation
 * Using only ASCII-safe characters for consistent terminal width
 */
const DUST_PATTERNS = ['.', '*', ':', '+', ' '];

/**
 * Fixed width for dust animation (ensures progress bar stability)
 */
const DUST_WIDTH = 8;

/**
 * Generate animated pixel dust around the character
 * Returns 3 strings (one for each line) with FIXED width to prevent progress bar jitter
 */
function generateDust(tick: number): string[] {
  // Create a deterministic but varied pattern based on tick
  const dustLine = (offset: number): string => {
    const idx1 = (tick + offset) % DUST_PATTERNS.length;
    const idx2 = (tick + offset + 2) % DUST_PATTERNS.length;
    // Fixed spacing pattern - animation comes from character changes, not position
    const raw = ` ${DUST_PATTERNS[idx1]}  ${DUST_PATTERNS[idx2]} `;
    // Pad to fixed width to prevent progress bar position jitter
    return raw.padEnd(DUST_WIDTH);
  };

  return [
    dustLine(0),
    dustLine(1),
    dustLine(2),
  ];
}

/**
 * Get the chip character with animated pixel dust
 * Returns 3-line array for multiline display
 */
export function getChipCharacter(expression: ChippyExpression, tick: number): string[] {
  const frame = CHIP_FRAMES[expression];
  const dust = generateDust(tick);
  return [
    frame[0] + dust[0],
    frame[1] + dust[1],
    frame[2] + dust[2],
  ];
}

/**
 * Fixed width for the bubble area (prevents terminal jitter).
 * Bubble text is truncated/padded to this width.
 */
const BUBBLE_WIDTH = 42;

/**
 * Get the chip character with a speech bubble on the first line.
 * Returns 3-line array with fixed-width bubble area to prevent jitter.
 *
 * Layout:
 *   ┬─┬─┬ . *    💭 "message text here"
 *   ├◉ ◉├  :
 *   ┴~~~┴ +
 */
export function getChipCharacterWithBubble(
  expression: ChippyExpression,
  tick: number,
  bubbleText: string,
): string[] {
  const frame = CHIP_FRAMES[expression];
  const dust = generateDust(tick);

  // Truncate bubble text if needed, then pad to fixed width
  const maxTextLen = BUBBLE_WIDTH - 6; // account for '💭 "' + '"'
  const truncated =
    bubbleText.length > maxTextLen
      ? bubbleText.slice(0, maxTextLen - 1) + '\u2026'
      : bubbleText;
  const bubble = `\uD83D\uDCAD "${truncated}"`;
  const paddedBubble = bubble.padEnd(BUBBLE_WIDTH);

  return [
    frame[0] + dust[0] + paddedBubble,
    frame[1] + dust[1] + ' '.repeat(BUBBLE_WIDTH),
    frame[2] + dust[2] + ' '.repeat(BUBBLE_WIDTH),
  ];
}

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
