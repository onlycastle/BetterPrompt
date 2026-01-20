/**
 * TrendLineChart Component
 * SVG-based line chart for score progression
 */

import type { HistoryEntry } from '../../api/types';
import styles from './TrendLineChart.module.css';

export interface TrendLineChartProps {
  data: HistoryEntry[];
  height?: number;
}

export function TrendLineChart({ data, height = 200 }: TrendLineChartProps) {
  if (data.length === 0) {
    return (
      <div className={styles.empty}>
        <p>No history data available</p>
      </div>
    );
  }

  const width = 400;
  const padding = { top: 20, right: 20, bottom: 40, left: 40 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const scores = data.map((d) => d.overallScore);
  const minScore = Math.min(...scores, 0);
  const maxScore = Math.max(...scores, 100);
  const scoreRange = maxScore - minScore || 1;

  const xScale = (i: number) => padding.left + (i / Math.max(data.length - 1, 1)) * chartWidth;
  const yScale = (score: number) =>
    padding.top + chartHeight - ((score - minScore) / scoreRange) * chartHeight;

  // Generate path
  const pathD = data
    .map((d, i) => `${i === 0 ? 'M' : 'L'} ${xScale(i)} ${yScale(d.overallScore)}`)
    .join(' ');

  // Generate area path
  const areaD = `${pathD} L ${xScale(data.length - 1)} ${yScale(minScore)} L ${xScale(0)} ${yScale(minScore)} Z`;

  // Format date for labels
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  return (
    <div className={styles.container}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className={styles.svg}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Grid lines */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const y = yScale(tick);
          if (y < padding.top || y > height - padding.bottom) return null;
          return (
            <g key={tick}>
              <line
                x1={padding.left}
                y1={y}
                x2={width - padding.right}
                y2={y}
                className={styles.gridLine}
              />
              <text x={padding.left - 8} y={y + 4} className={styles.yLabel}>
                {tick}
              </text>
            </g>
          );
        })}

        {/* Area fill */}
        <path d={areaD} className={styles.area} />

        {/* Line */}
        <path d={pathD} className={styles.line} />

        {/* Data points */}
        {data.map((d, i) => (
          <g key={i}>
            <circle
              cx={xScale(i)}
              cy={yScale(d.overallScore)}
              r={4}
              className={styles.point}
            />
            {/* X-axis labels (show first, last, and middle) */}
            {(i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) && (
              <text
                x={xScale(i)}
                y={height - padding.bottom + 20}
                className={styles.xLabel}
              >
                {formatDate(d.date)}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}

export default TrendLineChart;
