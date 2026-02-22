/**
 * Terminal Bar Chart Renderer
 *
 * Renders horizontal bar charts for Style DNA and Skill Scores.
 * Replaces the previous pentagon radar chart which had rendering issues
 * across different terminals (aspect ratio, Unicode shade characters, resolution).
 */

import pc from 'picocolors';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RadarChartData {
  /** Values for each axis */
  values: number[];
  /** Axis labels (e.g., ['Architect', 'Analyst', ...]) */
  labels: string[];
  /** Maximum scale value (default: 100) */
  maxValue?: number;
  /** Chart title (e.g., "Style DNA") */
  title: string;
  /** picocolors color function for the filled portion */
  colorFn: (s: string) => string;
  /** Optional value formatter (e.g., v => `${v}%`) */
  valueFormatter?: (v: number) => string;
  /** Index of the label to highlight (e.g., primary type) */
  highlightIndex?: number;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const BAR_WIDTH = 20;
const LABEL_WIDTH = 12;
// NBSP keeps padding stable in renderers that may collapse normal spaces.
const LABEL_PAD_CHAR = '\u00A0';

function padLabelEnd(label: string, width: number): string {
  if (label.length >= width) return label;
  return label + LABEL_PAD_CHAR.repeat(width - label.length);
}

// ── Bar Chart Rendering ──────────────────────────────────────────────────────

/**
 * Render a single bar chart section (title + bars).
 * Returns an array of terminal-colored lines.
 */
function renderBarSection(chart: RadarChartData): string[] {
  const lines: string[] = [];
  const maxVal = chart.maxValue ?? 100;
  const fmt = chart.valueFormatter ?? ((v: number) => String(Math.round(v)));

  // Section title
  const titleStr = `── ${chart.title} `;
  const ruleLen = Math.max(0, 42 - titleStr.length);
  lines.push(pc.dim(titleStr + '─'.repeat(ruleLen)));

  for (let i = 0; i < chart.values.length; i++) {
    const value = chart.values[i];
    const label = chart.labels[i];
    const normalized = Math.max(0, Math.min(1, value / maxVal));
    const filled = Math.round(normalized * BAR_WIDTH);
    const empty = BAR_WIDTH - filled;

    const isHighlighted = chart.highlightIndex === i;
    const marker = isHighlighted ? '*' : ' ';

    // Left-align label with stable padding so the bar start column stays fixed.
    const paddedLabel = padLabelEnd(label, LABEL_WIDTH);
    const labelStr = isHighlighted ? chart.colorFn(paddedLabel) : pc.dim(paddedLabel);
    const markerStr = isHighlighted ? pc.bold(marker) : marker;

    const bar = chart.colorFn('█'.repeat(filled)) + pc.dim('░'.repeat(empty));
    const valueStr = fmt(value);
    const valuePad = valueStr.length < 4 ? ' '.repeat(4 - valueStr.length) : '';

    lines.push(`${labelStr}${markerStr} ${bar}  ${valuePad}${pc.white(valueStr)}`);
  }

  return lines;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render two bar chart sections stacked vertically.
 * If right is null, renders only left chart.
 */
export function renderDualRadarCharts(
  left: RadarChartData,
  right: RadarChartData | null
): string[] {
  const leftLines = renderBarSection(left);

  if (!right) {
    return leftLines;
  }

  return [...leftLines, '', ...renderBarSection(right)];
}

/**
 * Compute dynamic max value for Style DNA chart.
 * Matches web DualRadarCharts.tsx logic (line 52-55).
 */
export function computeStyleMaxValue(values: number[]): number {
  const maxVal = Math.max(...values);
  return Math.max(Math.ceil((maxVal * 1.2) / 5) * 5, 25);
}
