/**
 * RadarChart - Pure SVG radar/spider chart component
 *
 * Renders a pentagon (5-axis) radar chart with concentric grid lines,
 * data polygon, and positioned labels. No chart library dependency.
 */

import styles from './RadarChart.module.css';

interface RadarChartProps {
  /** Data values for each axis (0-100 scale) */
  data: number[];
  /** Labels for each axis */
  labels: string[];
  /** Maximum data value (default 100) */
  maxValue?: number;
  /** Fill color for the data polygon */
  color: string;
  /** Fill opacity for the data polygon (default 0.25) */
  fillOpacity?: number;
  /** Accessible label for screen readers */
  ariaLabel: string;
  /** Show numerical values at each data point */
  showValues?: boolean;
  /** Custom formatter for values (e.g., v => `${v}%`) */
  valueFormatter?: (value: number) => string;
}

/** Number of concentric grid levels */
const GRID_LEVELS = 5;

/** SVG viewBox dimensions */
const SIZE = 200;
const CENTER = SIZE / 2;
const RADIUS = 72;
const LABEL_OFFSET = 18;

/** Extra viewBox padding so labels (e.g. "Communication") don't clip */
const PADDING_H = 30;
const PADDING_V = 5;

/**
 * Convert polar coordinates to cartesian, starting from 12 o'clock going clockwise.
 *
 * Standard math: angle 0 = 3 o'clock, counterclockwise
 * We want: angle 0 = 12 o'clock, clockwise
 * Transform: rotate -90° and reverse direction → θ = (index/total) * 2π - π/2
 */
function polarToCartesian(index: number, total: number, radius: number): [number, number] {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  return [
    CENTER + radius * Math.cos(angle),
    CENTER + radius * Math.sin(angle),
  ];
}

/** Build a polygon points string for a given radius */
function polygonPoints(total: number, radius: number): string {
  return Array.from({ length: total }, (_, i) => polarToCartesian(i, total, radius).join(','))
    .join(' ');
}

/**
 * Determine text-anchor based on vertex angle to prevent label overlap.
 * Left-side vertices → "end", right-side → "start", top → "middle"
 */
function getTextAnchor(index: number, total: number): 'start' | 'middle' | 'end' {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const x = Math.cos(angle);
  if (Math.abs(x) < 0.15) return 'middle';
  return x > 0 ? 'start' : 'end';
}

/** Determine vertical alignment offset based on position */
function getDominantBaseline(index: number, total: number): 'auto' | 'hanging' | 'central' {
  const angle = (index / total) * 2 * Math.PI - Math.PI / 2;
  const y = Math.sin(angle);
  if (y < -0.3) return 'auto'; // top vertex — text below anchor
  if (y > 0.3) return 'hanging'; // bottom vertex — text above anchor
  return 'central';
}

export function RadarChart({
  data,
  labels,
  maxValue = 100,
  color,
  fillOpacity = 0.25,
  ariaLabel,
  showValues = false,
  valueFormatter,
}: RadarChartProps) {
  const total = labels.length;
  const safeMax = maxValue || 100;

  // Build data polygon points
  const dataPoints = data.map((value, i) => {
    const ratio = Math.min(value, safeMax) / safeMax;
    return polarToCartesian(i, total, RADIUS * ratio);
  });
  const dataPolygonStr = dataPoints.map(([x, y]) => `${x},${y}`).join(' ');

  return (
    <div className={styles.container} role="img" aria-label={ariaLabel}>
      <svg viewBox={`-${PADDING_H} -${PADDING_V} ${SIZE + 2 * PADDING_H} ${SIZE + 2 * PADDING_V}`} className={styles.svg}>
        {/* Concentric pentagon grids */}
        {Array.from({ length: GRID_LEVELS }, (_, level) => {
          const r = RADIUS * ((level + 1) / GRID_LEVELS);
          return (
            <polygon
              key={`grid-${level}`}
              points={polygonPoints(total, r)}
              className={styles.gridLine}
            />
          );
        })}

        {/* Axis lines from center to each vertex */}
        {Array.from({ length: total }, (_, i) => {
          const [x, y] = polarToCartesian(i, total, RADIUS);
          return (
            <line
              key={`axis-${i}`}
              x1={CENTER}
              y1={CENTER}
              x2={x}
              y2={y}
              className={styles.axisLine}
            />
          );
        })}

        {/* Data polygon (fill + stroke) */}
        <polygon
          points={dataPolygonStr}
          className={styles.dataPolygon}
          style={{
            fill: color,
            fillOpacity,
            stroke: color,
          }}
        />

        {/* Data points at each vertex */}
        {dataPoints.map(([x, y], i) => (
          <circle
            key={`point-${i}`}
            cx={x}
            cy={y}
            r={3}
            className={styles.dataPoint}
            style={{ fill: color }}
          />
        ))}

        {/* Labels positioned outside the pentagon */}
        {labels.map((label, i) => {
          const [x, y] = polarToCartesian(i, total, RADIUS + LABEL_OFFSET);
          return (
            <text
              key={`label-${i}`}
              x={x}
              y={y}
              textAnchor={getTextAnchor(i, total)}
              dominantBaseline={getDominantBaseline(i, total)}
              className={styles.label}
            >
              {label}
            </text>
          );
        })}

        {/* Numerical values near each data point */}
        {showValues && dataPoints.map(([x, y], i) => {
          const angle = (i / total) * 2 * Math.PI - Math.PI / 2;
          const nudge = 10;
          return (
            <text
              key={`value-${i}`}
              x={x + nudge * Math.cos(angle)}
              y={y + nudge * Math.sin(angle)}
              textAnchor="middle"
              dominantBaseline="central"
              className={styles.valueLabel}
            >
              {valueFormatter ? valueFormatter(data[i]) : String(Math.round(data[i]))}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

export default RadarChart;
