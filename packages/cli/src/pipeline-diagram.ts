/**
 * Pipeline Progress Diagram
 *
 * Renders a horizontal pipeline status showing analysis phases.
 * Two modes:
 *  - Box diagram (4 lines): for terminals >= 76 columns wide
 *  - Flat diagram (2 lines): narrow terminal fallback
 *
 * Inserted between the bear mascot and Live Results in the chat display.
 */

import pc from 'picocolors';

export type PhaseState = 'pending' | 'active' | 'completed';

export interface PipelineState {
  /** [Scan, Phase1, Phase2, Phase3, Done] */
  phases: PhaseState[];
  /** Sub-progress for active phase, e.g. "3/8" */
  activeSubProgress?: string;
}

/** Phase labels */
const PHASE_LABELS = ['Scan', 'Phase 1', 'Phase 2', 'Phase 3', 'Done'];

/** Phase descriptions (shown on line 3 of box diagram) */
const PHASE_DESCS = ['parse', 'extract', 'analyze', 'write', ''];

/** Box inner width (content area) */
const BOX_INNER_WIDTH = 10;

/** Connector between phases (flat diagram) */
const CONNECTOR = '\u2500\u2500';

/** Box connector: ──▸ */
const BOX_CONNECTOR = '\u2500\u2500\u25B8';

/** Total expected Phase 2 sub-tasks: 5 workers + projectSummarizer + weeklyInsight + typeClassifier */
export const PHASE2_TOTAL = 8;

/** Minimum terminal width for box diagram */
export const BOX_DIAGRAM_MIN_WIDTH = 76;

/**
 * Create initial pipeline state (all pending)
 */
export function createInitialPipelineState(): PipelineState {
  return {
    phases: ['pending', 'pending', 'pending', 'pending', 'pending'],
  };
}

/**
 * Center text within a given width, padding with spaces.
 */
function centerText(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  const totalPad = width - text.length;
  const leftPad = Math.floor(totalPad / 2);
  const rightPad = totalPad - leftPad;
  return ' '.repeat(leftPad) + text + ' '.repeat(rightPad);
}

/**
 * Pad text to width (left-aligned).
 */
function padRight(text: string, width: number): string {
  if (text.length >= width) return text.slice(0, width);
  return text + ' '.repeat(width - text.length);
}

/**
 * Apply color to a full box (borders + content).
 */
function colorize(text: string, state: PhaseState, tick: number): string {
  if (state === 'completed') return pc.green(text);
  if (state === 'active') return tick % 4 < 2 ? pc.yellow(pc.bold(text)) : pc.yellow(text);
  return pc.dim(text);
}

/**
 * Get the status icon for a phase.
 */
function getIcon(state: PhaseState): string {
  if (state === 'completed') return '\u2713';
  if (state === 'active') return '\u25CF';
  return '\u25CB';
}

/**
 * Render the pipeline diagram as a 4-line box diagram.
 *
 * ╭──────────╮   ╭──────────╮   ╭──────────╮   ╭──────────╮   ╭──────────╮
 * │ ✓ Scan   │──▸│ ✓ Phase 1│──▸│ ● Phase 2│──▸│ ○ Phase 3│──▸│ ○ Done   │
 * │  parse   │   │ extract  │   │   3/8    │   │  write   │   │          │
 * ╰──────────╯   ╰──────────╯   ╰──────────╯   ╰──────────╯   ╰──────────╯
 */
export function renderPipelineDiagram(state: PipelineState, tick: number): string[] {
  const { phases, activeSubProgress } = state;
  const indent = '    ';

  // Build each of the 4 lines as arrays of parts
  const topParts: string[] = [];
  const midParts: string[] = [];
  const descParts: string[] = [];
  const botParts: string[] = [];

  for (let i = 0; i < PHASE_LABELS.length; i++) {
    const phase = phases[i];
    const label = PHASE_LABELS[i];
    const icon = getIcon(phase);

    // Status line content: " ✓ Scan   " (padded to BOX_INNER_WIDTH)
    const statusContent = padRight(` ${icon} ${label}`, BOX_INNER_WIDTH);

    // Description line content: centered text or sub-progress
    let descText: string;
    if (phase === 'active' && i === 2 && activeSubProgress) {
      descText = centerText(activeSubProgress, BOX_INNER_WIDTH);
    } else {
      descText = centerText(PHASE_DESCS[i], BOX_INNER_WIDTH);
    }

    // Build raw box parts (no color yet)
    const topRaw = `\u256D${'─'.repeat(BOX_INNER_WIDTH)}\u256E`;
    const midRaw = `\u2502${statusContent}\u2502`;
    const descRaw = `\u2502${descText}\u2502`;
    const botRaw = `\u2570${'─'.repeat(BOX_INNER_WIDTH)}\u256F`;

    // Apply colors
    const coloredTop = colorize(topRaw, phase, tick);
    const coloredBot = colorize(botRaw, phase, tick);

    // Mid line: border colored, content has icon + label colored separately
    const borderColor = (t: string) => colorize(t, phase, tick);
    const iconColored = colorize(icon, phase, tick);
    const labelColored = colorize(label, phase, tick);
    const labelPadLen = BOX_INNER_WIDTH - 1 - icon.length - 1 - label.length;
    const labelPad = labelPadLen > 0 ? ' '.repeat(labelPadLen) : '';
    const coloredMid = `${borderColor('\u2502')} ${iconColored} ${labelColored}${labelPad}${borderColor('\u2502')}`;

    // Desc line: border colored, text colored
    const descTextColored = colorize(descText, phase, tick);
    const coloredDesc = `${borderColor('\u2502')}${descTextColored}${borderColor('\u2502')}`;

    // Connector between boxes (on mid line: ──▸, others: spaces)
    if (i > 0) {
      const prevPhase = phases[i - 1];
      const connectorColored = prevPhase === 'completed' ? pc.green(BOX_CONNECTOR) : pc.dim(BOX_CONNECTOR);
      topParts.push('   ');  // 3 spaces above connector
      midParts.push(connectorColored);
      descParts.push('   ');  // 3 spaces below connector
      botParts.push('   ');  // 3 spaces below connector
    }

    topParts.push(coloredTop);
    midParts.push(coloredMid);
    descParts.push(coloredDesc);
    botParts.push(coloredBot);
  }

  return [
    `${indent}${topParts.join('')}`,
    `${indent}${midParts.join('')}`,
    `${indent}${descParts.join('')}`,
    `${indent}${botParts.join('')}`,
  ];
}

/**
 * Render the pipeline diagram as 2 lines (narrow terminal fallback).
 *
 * Line 1: Labels with connectors
 *   Scan ── Phase 1 ── Phase 2 ── Phase 3 ── Done
 * Line 2: Status indicators
 *   ✓       ✓        ● 3/8                   ○
 */
export function renderFlatPipelineDiagram(state: PipelineState, tick: number): string[] {
  const { phases, activeSubProgress } = state;

  // Build label line
  const labelParts: string[] = [];
  for (let i = 0; i < PHASE_LABELS.length; i++) {
    const label = PHASE_LABELS[i];
    const phase = phases[i];

    let coloredLabel: string;
    if (phase === 'completed') {
      coloredLabel = pc.green(label);
    } else if (phase === 'active') {
      coloredLabel = tick % 4 < 2 ? pc.yellow(pc.bold(label)) : pc.yellow(label);
    } else {
      coloredLabel = pc.dim(label);
    }

    if (i > 0) {
      const prevPhase = phases[i - 1];
      const connector = prevPhase === 'completed' ? pc.green(CONNECTOR) : pc.dim(CONNECTOR);
      labelParts.push(` ${connector} `);
    }

    labelParts.push(coloredLabel);
  }

  // Build indicator line (aligned under labels)
  const indicatorParts: string[] = [];
  for (let i = 0; i < PHASE_LABELS.length; i++) {
    const phase = phases[i];
    const label = PHASE_LABELS[i];

    let indicator: string;
    if (phase === 'completed') {
      indicator = pc.green('\u2713');
    } else if (phase === 'active') {
      const bullet = tick % 4 < 2 ? pc.yellow(pc.bold('\u25CF')) : pc.yellow('\u25CF');
      if (i === 2 && activeSubProgress) {
        indicator = `${bullet} ${pc.yellow(activeSubProgress)}`;
      } else {
        indicator = bullet;
      }
    } else {
      indicator = pc.dim('\u25CB');
    }

    if (i > 0) {
      indicatorParts.push('    ');
    }

    const labelWidth = label.length;
    if (phase === 'active' && i === 2 && activeSubProgress) {
      const rawIndicatorLen = 1 + 1 + activeSubProgress.length;
      const padNeeded = Math.max(0, labelWidth - rawIndicatorLen);
      indicatorParts.push(indicator + ' '.repeat(padNeeded));
    } else {
      const padNeeded = Math.max(0, labelWidth - 1);
      indicatorParts.push(indicator + ' '.repeat(padNeeded));
    }
  }

  return [
    `    ${labelParts.join('')}`,
    `    ${indicatorParts.join('')}`,
  ];
}
