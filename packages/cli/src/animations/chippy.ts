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
 * Get the full Chippy ASCII art (compact bear face for inline display)
 */
export function getChippyFull(expression: ChippyExpression = 'neutral'): string[] {
  const face = CHIPPY_FACES[expression];
  return [
    '    ╭──╮    ╭──╮',
    '    │  ╰────╯  │',
    `    │  ${face.leftEye}    ${face.rightEye}  │`,
    `    │    ${face.mouth}    │`,
    '    ╰──────────╯',
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
 * Get larger centered Chippy for welcome screen (compact bear face, extra indent)
 */
export function getChippyLarge(expression: ChippyExpression = 'happy'): string[] {
  const face = CHIPPY_FACES[expression];
  return [
    '      ╭──╮    ╭──╮',
    '      │  ╰────╯  │',
    `      │  ${face.leftEye}    ${face.rightEye}  │`,
    `      │    ${face.mouth}    │`,
    '      ╰──────────╯',
  ];
}

// ============================================================================
// Large Bear-Robot Character (8-line art for progress display)
// ============================================================================

/** Fixed visual width of the bear character area (padded) */
export const BEAR_LINE_WIDTH = 22;

/** Fixed visual width of the bubble area beside the bear */
export const LARGE_BUBBLE_WIDTH = 52;

/** Gap between bear and bubble */
const GAP_WIDTH = 2;

/**
 * Large bear-robot face parts — only eyes and mouth change per expression
 */
const LARGE_FACES: Record<ChippyExpression, { leftEye: string; rightEye: string; mouth: string }> = {
  neutral:  { leftEye: '●', rightEye: '●', mouth: '──' },
  blink:    { leftEye: '─', rightEye: '─', mouth: '──' },
  happy:    { leftEye: '●', rightEye: '●', mouth: 'w ' },
  thinking: { leftEye: '●', rightEye: '●', mouth: '~~' },
  excited:  { leftEye: '★', rightEye: '★', mouth: 'w ' },
  wink:     { leftEye: '●', rightEye: '─', mouth: 'w ' },
};

/** Ear wiggle interval (in ticks) */
const EAR_WIGGLE_INTERVAL = 30;

/**
 * Build 8-line bear-robot art for the given expression and tick.
 * Ears wiggle on slow intervals. Lines are padded to BEAR_LINE_WIDTH.
 */
function buildBearLines(expression: ChippyExpression, tick: number): string[] {
  const face = LARGE_FACES[expression];
  const wiggle = Math.floor(tick / EAR_WIGGLE_INTERVAL) % 2 === 1;
  const earConnect = wiggle ? '│  ╰── ── ──╯  │' : '│  ╰────────╯  │';

  const lines = [
    '  ╭──╮        ╭──╮',    // 0: ears
    `  ${earConnect}`,        // 1: ear connection (animated)
    '  │              │',     // 2: padding
    `  │   ${face.leftEye}      ${face.rightEye}   │`,  // 3: eyes
    '  │              │',     // 4: padding
    `  │      ${face.mouth}      │`,  // 5: mouth
    '  │              │',     // 6: padding
    '  ╰──────────────╯',     // 7: bottom
  ];

  return lines.map(l => l.padEnd(BEAR_LINE_WIDTH));
}

/**
 * Get the large bear-robot character (8-line array).
 * Each line is padded to BEAR_LINE_WIDTH for stable layout.
 */
export function getLargeChipCharacter(expression: ChippyExpression, tick: number): string[] {
  return buildBearLines(expression, tick);
}

/**
 * Build speech bubble lines (8 lines to match bear height).
 * The bubble appears on lines 1-5 (vertically centered).
 */
function buildBubbleLines(bubbleText: string): string[] {
  const innerWidth = LARGE_BUBBLE_WIDTH - 4; // borders + padding
  const MAX_CONTENT_LINES = 3;

  // Word-wrap FIRST, then limit lines (not the other way around)
  const words = bubbleText.split(' ');
  const textLines: string[] = [];
  let current = '';
  for (const word of words) {
    if (current.length + (current ? 1 : 0) + word.length > innerWidth) {
      if (current) textLines.push(current);
      current = word;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current) textLines.push(current);

  // Truncate excess lines, adding … to the last visible line
  if (textLines.length > MAX_CONTENT_LINES) {
    textLines.length = MAX_CONTENT_LINES;
    const last = textLines[MAX_CONTENT_LINES - 1];
    textLines[MAX_CONTENT_LINES - 1] =
      last.length >= innerWidth ? last.slice(0, innerWidth - 1) + '\u2026' : last + '\u2026';
  }

  // Build bubble box (content lines + top/bottom border)
  const top    = `╭${'─'.repeat(innerWidth + 2)}╮`;
  const bottom = `╰${'─'.repeat(innerWidth + 2)}╯`;
  const contentLines = textLines.map(t => `│ ${t.padEnd(innerWidth)} │`);

  // Assemble 8-line array with bubble vertically centered
  const empty = ' '.repeat(LARGE_BUBBLE_WIDTH);
  const result: string[] = new Array(8).fill(empty);

  // Place bubble starting at line 1
  const bubbleLines = [top, ...contentLines, bottom];
  const startRow = 1;
  for (let i = 0; i < bubbleLines.length && startRow + i < 8; i++) {
    result[startRow + i] = bubbleLines[i].padEnd(LARGE_BUBBLE_WIDTH);
  }

  return result;
}

/**
 * Compose bear character and bubble side-by-side.
 * Returns 8-line array with consistent total width.
 */
function composeSideBySide(bearLines: string[], bubbleLines: string[]): string[] {
  const gap = ' '.repeat(GAP_WIDTH);
  return bearLines.map((bl, i) => bl + gap + bubbleLines[i]);
}

/**
 * Get the large bear-robot character with a speech bubble composed side-by-side.
 * Returns 8-line array. If no bubbleText, right side is blank-padded.
 */
export function getLargeChipCharacterWithBubble(
  expression: ChippyExpression,
  tick: number,
  bubbleText: string | null,
): string[] {
  const bearLines = buildBearLines(expression, tick);
  if (bubbleText) {
    const bubble = buildBubbleLines(bubbleText);
    return composeSideBySide(bearLines, bubble);
  }
  const emptyBubble = new Array(8).fill(' '.repeat(LARGE_BUBBLE_WIDTH));
  return composeSideBySide(bearLines, emptyBubble);
}

// ============================================================================
// Animation Frames
// ============================================================================

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
