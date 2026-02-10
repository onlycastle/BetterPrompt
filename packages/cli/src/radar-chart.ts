/**
 * Terminal Radar Chart Renderer
 *
 * Renders pentagon-based radar charts in the terminal using character grids.
 * Supports dual side-by-side layout with automatic stacking for narrow terminals.
 *
 * Coordinate system: 12 o'clock start, clockwise, with aspect ratio correction (x × 2.0)
 * for monospace characters where width ≈ height/2.
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
  /** picocolors color function for the data polygon */
  colorFn: (s: string) => string;
  /** Optional value formatter (e.g., v => `${v}%`) */
  valueFormatter?: (v: number) => string;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const ASPECT_RATIO = 2.0;  // Terminal char width ≈ half height
const CHART_WIDTH = 41;
const CHART_HEIGHT = 21;
const RADIUS = 7;          // Grid units for the outer pentagon
const GAP = 4;             // Gap between dual charts

// Characters for rendering
const DOT_CHAR = '\u00b7'; // Middle dot for reference ring/axes
const FILL_CHAR = '\u2591'; // Light shade for polygon fill
const EDGE_CHAR = '\u2593'; // Dark shade for polygon edge
const AXIS_CHAR = '\u00b7'; // Axis line character

// ── Grid Helpers ──────────────────────────────────────────────────────────────

/** Create an empty character grid */
function createGrid(width: number, height: number): string[][] {
  return Array.from({ length: height }, () => Array(width).fill(' '));
}

/** Safely set a character in the grid */
function setChar(grid: string[][], x: number, y: number, ch: string): void {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    grid[y][x] = ch;
  }
}

/** Get character from grid */
function getChar(grid: string[][], x: number, y: number): string {
  if (y >= 0 && y < grid.length && x >= 0 && x < grid[0].length) {
    return grid[y][x];
  }
  return ' ';
}

// ── Coordinate Math ───────────────────────────────────────────────────────────

/**
 * Convert polar index to grid coordinates.
 * Index 0 = 12 o'clock (top), clockwise.
 * Applies aspect ratio correction on x-axis.
 */
function polarToGrid(
  index: number,
  total: number,
  radius: number,
  cx: number,
  cy: number
): { x: number; y: number } {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const x = Math.round(cx + radius * Math.cos(angle) * ASPECT_RATIO);
  const y = Math.round(cy + radius * Math.sin(angle));
  return { x, y };
}

/**
 * Get fractional polar coordinates (for line drawing precision).
 */
function polarToFloat(
  index: number,
  total: number,
  radius: number,
  cx: number,
  cy: number
): { x: number; y: number } {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return {
    x: cx + radius * Math.cos(angle) * ASPECT_RATIO,
    y: cy + radius * Math.sin(angle),
  };
}

// ── Drawing Primitives ────────────────────────────────────────────────────────

/**
 * Bresenham's line algorithm adapted for character grid
 */
function drawLine(
  grid: string[][],
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  ch: string
): void {
  let dx = Math.abs(x1 - x0);
  let dy = Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx - dy;
  let cx = x0;
  let cy = y0;

  while (true) {
    setChar(grid, cx, cy, ch);
    if (cx === x1 && cy === y1) break;
    const e2 = 2 * err;
    if (e2 > -dy) {
      err -= dy;
      cx += sx;
    }
    if (e2 < dx) {
      err += dx;
      cy += sy;
    }
  }
}

/**
 * Draw a polygon outline by connecting vertices
 */
function drawPolygon(grid: string[][], vertices: { x: number; y: number }[], ch: string): void {
  for (let i = 0; i < vertices.length; i++) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    drawLine(grid, from.x, from.y, to.x, to.y, ch);
  }
}

/**
 * Scanline fill a polygon interior.
 * Uses y+0.5 offset to avoid vertex boundary ambiguity in odd-even rule.
 * Uses ceil/floor instead of round to prevent fill leaking outside polygon.
 */
function fillPolygon(grid: string[][], vertices: { x: number; y: number }[], ch: string): void {
  if (vertices.length < 3) return;

  // Find bounding box
  let minY = Infinity, maxY = -Infinity;
  for (const v of vertices) {
    minY = Math.min(minY, v.y);
    maxY = Math.max(maxY, v.y);
  }

  minY = Math.max(0, Math.floor(minY));
  maxY = Math.min(grid.length - 1, Math.ceil(maxY));

  for (let y = minY; y <= maxY; y++) {
    // Use y+0.5 offset so scanline never hits exact vertex y-coordinates
    const scanY = y + 0.5;
    const intersections: number[] = [];
    for (let i = 0; i < vertices.length; i++) {
      const v0 = vertices[i];
      const v1 = vertices[(i + 1) % vertices.length];

      // Check if edge crosses this scanline (strict inequality avoids double-counting)
      if ((v0.y < scanY && v1.y >= scanY) || (v1.y < scanY && v0.y >= scanY)) {
        const t = (scanY - v0.y) / (v1.y - v0.y);
        intersections.push(v0.x + t * (v1.x - v0.x));
      }
    }

    intersections.sort((a, b) => a - b);

    // Fill between pairs of intersections (ceil start, floor end to stay inside polygon)
    for (let i = 0; i < intersections.length - 1; i += 2) {
      const xStart = Math.max(0, Math.ceil(intersections[i]));
      const xEnd = Math.min(grid[0].length - 1, Math.floor(intersections[i + 1]));
      for (let x = xStart; x <= xEnd; x++) {
        setChar(grid, x, y, ch);
      }
    }
  }
}

// ── Chart Rendering ───────────────────────────────────────────────────────────

/**
 * Render a single radar chart to a character grid.
 * Returns array of plain strings (no color) - color is applied later.
 */
function renderChartToGrid(
  chart: RadarChartData,
  width: number,
  height: number
): { grid: string[][]; cx: number; cy: number } {
  const grid = createGrid(width, height);
  const total = chart.values.length;
  const maxVal = chart.maxValue ?? 100;

  // Center of chart area (leave room for labels)
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2) + 1; // Shift down slightly for top label

  // Compute outer reference pentagon vertices
  const outerVertices = Array.from({ length: total }, (_, i) =>
    polarToGrid(i, total, RADIUS, cx, cy)
  );

  // Compute data polygon vertices
  const dataVertices = chart.values.map((val, i) => {
    const normalizedRadius = Math.max((val / maxVal) * RADIUS, 0.8); // Min distance from center
    return polarToGrid(i, total, normalizedRadius, cx, cy);
  });

  // Drawing order: fill first on empty grid, then overlay structural elements
  // 1. Fill data polygon (on empty grid — no axis dots to block fill)
  fillPolygon(grid, dataVertices, FILL_CHAR);

  // 2. Draw data polygon edges on top of fill
  drawPolygon(grid, dataVertices, EDGE_CHAR);

  // 3. Draw reference pentagon (visible through/over fill area)
  drawPolygon(grid, outerVertices, DOT_CHAR);

  // 4. Draw axis lines from center to each vertex
  for (let i = 0; i < total; i++) {
    const v = outerVertices[i];
    drawLine(grid, cx, cy, v.x, v.y, AXIS_CHAR);
  }

  // 5. Mark center
  setChar(grid, cx, cy, '+');

  return { grid, cx, cy };
}

/**
 * Place labels around the chart.
 * Returns a map of grid positions to label text and color info.
 */
interface LabelPlacement {
  row: number;
  text: string;       // Label text (possibly with value)
  startCol: number;   // Starting column in the line
}

/**
 * Pentagon label placement strategy.
 * For a 5-axis radar (12 o'clock start, clockwise):
 *   Index 0: top-center
 *   Index 1: upper-right
 *   Index 2: lower-right
 *   Index 3: lower-left
 *   Index 4: upper-left
 */
function computeLabels(
  chart: RadarChartData,
  cx: number,
  cy: number,
  width: number,
  height: number
): LabelPlacement[] {
  const placements: LabelPlacement[] = [];
  const fmt = chart.valueFormatter ?? ((v: number) => String(Math.round(v)));

  for (let i = 0; i < chart.values.length; i++) {
    const label = chart.labels[i];
    const value = fmt(chart.values[i]);
    const text = `${label} ${value}`;

    let row: number;
    let startCol: number;

    // Pentagon vertex angles (12 o'clock, clockwise): 0=top, 1=upper-right, 2=lower-right, 3=lower-left, 4=upper-left
    // Use actual vertex positions + offset for label placement
    const vtx = polarToFloat(i, chart.values.length, RADIUS, cx, cy);

    switch (i) {
      case 0: // Top center - above chart
        row = 0;
        startCol = cx - Math.floor(text.length / 2);
        break;
      case 1: // Upper right - to the right of vertex
        row = Math.round(vtx.y) - 1;
        startCol = Math.round(vtx.x) + 2;
        break;
      case 2: // Lower right - bottom row, right of center
        row = height - 1;
        startCol = cx + 4;
        break;
      case 3: // Lower left - bottom row, left of center
        row = height - 1;
        startCol = cx - text.length - 4;
        break;
      case 4: // Upper left - to the left of vertex
        row = Math.round(vtx.y) - 1;
        startCol = Math.round(vtx.x) - text.length - 1;
        break;
      default: {
        const outerPt = polarToFloat(i, chart.values.length, RADIUS + 2.5, cx, cy);
        row = Math.round(outerPt.y);
        startCol = Math.round(outerPt.x) - Math.floor(text.length / 2);
      }
    }

    // Clamp to grid bounds
    startCol = Math.max(0, Math.min(width - text.length, startCol));
    row = Math.max(0, Math.min(height - 1, row));

    placements.push({ row, text, startCol });
  }

  return placements;
}

// ── Colorize ──────────────────────────────────────────────────────────────────

/**
 * Convert a plain grid + labels into colored terminal lines
 */
function colorizeChart(
  grid: string[][],
  labels: LabelPlacement[],
  colorFn: (s: string) => string,
  title: string,
  width: number
): string[] {
  const lines: string[] = [];

  // Title line (centered, dim)
  const titleStr = `── ${title} ──`;
  const titlePad = Math.max(0, Math.floor((width - titleStr.length) / 2));
  lines.push(' '.repeat(titlePad) + pc.dim(titleStr));

  // Build label lookup: row → labels on that row (supports multiple labels per row)
  const labelsByRow = new Map<number, LabelPlacement[]>();
  for (const lp of labels) {
    const existing = labelsByRow.get(lp.row) ?? [];
    existing.push(lp);
    labelsByRow.set(lp.row, existing);
  }

  for (let y = 0; y < grid.length; y++) {
    const rowLabels = labelsByRow.get(y);

    if (rowLabels && rowLabels.length > 0) {
      // Build a set of columns occupied by labels
      const labelRanges: Array<{ start: number; end: number; text: string }> = [];
      for (const lp of rowLabels) {
        labelRanges.push({ start: lp.startCol, end: lp.startCol + lp.text.length, text: lp.text });
      }
      labelRanges.sort((a, b) => a.start - b.start);

      const chars: string[] = [];
      let labelIdx = 0;
      for (let x = 0; x < grid[0].length; x++) {
        // Check if we're at the start of a label
        if (labelIdx < labelRanges.length && x === labelRanges[labelIdx].start) {
          chars.push(pc.dim(labelRanges[labelIdx].text));
          x = labelRanges[labelIdx].end - 1; // Skip label chars (loop increments x)
          labelIdx++;
          continue;
        }
        // Skip chars inside a label range
        if (labelIdx < labelRanges.length && x > labelRanges[labelIdx]?.start && x < labelRanges[labelIdx]?.end) {
          continue;
        }
        chars.push(colorizeChar(grid[y][x], colorFn));
      }
      lines.push(chars.join(''));
    } else {
      const chars: string[] = [];
      for (let x = 0; x < grid[0].length; x++) {
        chars.push(colorizeChar(grid[y][x], colorFn));
      }
      lines.push(chars.join(''));
    }
  }

  return lines;
}

function colorizeChar(ch: string, colorFn: (s: string) => string): string {
  switch (ch) {
    case FILL_CHAR:
      return colorFn(FILL_CHAR);
    case EDGE_CHAR:
      return colorFn(EDGE_CHAR);
    case DOT_CHAR:
    case AXIS_CHAR:
      return pc.dim(ch);
    case '+':
      return pc.dim('+');
    default:
      return ch;
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Render a single radar chart as colored terminal lines
 */
export function renderRadarChart(chart: RadarChartData, width?: number, height?: number): string[] {
  const w = width ?? CHART_WIDTH;
  const h = height ?? CHART_HEIGHT;
  const { grid, cx, cy } = renderChartToGrid(chart, w, h);
  const labels = computeLabels(chart, cx, cy, w, h);
  return colorizeChart(grid, labels, chart.colorFn, chart.title, w);
}

/**
 * Render two radar charts side-by-side (or stacked for narrow terminals).
 * If right is null, renders only left chart centered.
 */
export function renderDualRadarCharts(
  left: RadarChartData,
  right: RadarChartData | null
): string[] {
  const cols = process.stdout.columns || 80;

  // Single chart mode (no skill scores)
  if (!right) {
    return renderRadarChart(left, CHART_WIDTH, CHART_HEIGHT);
  }

  // Narrow terminal: stack vertically
  if (cols < 90) {
    const leftLines = renderRadarChart(left, CHART_WIDTH, CHART_HEIGHT);
    const rightLines = renderRadarChart(right, CHART_WIDTH, CHART_HEIGHT);
    return [...leftLines, '', ...rightLines];
  }

  // Wide terminal: side-by-side
  const leftLines = renderRadarChart(left, CHART_WIDTH, CHART_HEIGHT);
  const rightLines = renderRadarChart(right, CHART_WIDTH, CHART_HEIGHT);
  const gap = ' '.repeat(GAP);

  const maxLines = Math.max(leftLines.length, rightLines.length);
  const merged: string[] = [];

  for (let i = 0; i < maxLines; i++) {
    const lLine = i < leftLines.length ? leftLines[i] : '';
    const rLine = i < rightLines.length ? rightLines[i] : '';
    // Pad left line to consistent width (accounting for ANSI escape codes)
    const lVisible = stripAnsi(lLine);
    const padNeeded = Math.max(0, CHART_WIDTH - lVisible.length);
    merged.push(lLine + ' '.repeat(padNeeded) + gap + rLine);
  }

  return merged;
}

/**
 * Compute dynamic max value for Style DNA chart.
 * Matches web DualRadarCharts.tsx logic (line 52-55).
 */
export function computeStyleMaxValue(values: number[]): number {
  const maxVal = Math.max(...values);
  return Math.max(Math.ceil((maxVal * 1.2) / 5) * 5, 25);
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Strip ANSI escape codes for width calculation */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}
