/**
 * TrendLineChart Component
 * Line chart showing trend data over time with gradient fill
 */

import type { HistoryEntry } from '../../types/enterprise';
import styles from './TrendLineChart.module.css';

export interface TrendLineChartProps {
  data: HistoryEntry[];
  height?: number;
}

export function TrendLineChart({ data, height = 200 }: TrendLineChartProps) {
  if (!data || data.length === 0) {
    return (
      <div className={styles.empty} style={{ height }}>
        No trend data available
      </div>
    );
  }

  const width = 800;
  const padding = { top: 20, right: 20, bottom: 40, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxScore = Math.max(...data.map(d => d.overallScore), 100);
  const minScore = Math.min(...data.map(d => d.overallScore), 0);
  const scoreRange = maxScore - minScore;
  const scoreScale = (score: number) =>
    chartHeight - ((score - minScore) / (scoreRange || 1)) * chartHeight;

  // X-axis positioning
  const xStep = chartWidth / Math.max(data.length - 1, 1);
  const getX = (index: number) => index * xStep;

  // Generate path
  const pathPoints = data.map((d, i) => ({
    x: getX(i) + padding.left,
    y: scoreScale(d.overallScore) + padding.top,
  }));

  // SVG path with smooth bezier curves
  let path = `M ${pathPoints[0].x},${pathPoints[0].y}`;

  for (let i = 1; i < pathPoints.length; i++) {
    const prev = pathPoints[i - 1];
    const curr = pathPoints[i];

    // Control points for smooth curves
    const cpx1 = prev.x + (curr.x - prev.x) / 3;
    const cpy1 = prev.y;
    const cpx2 = prev.x + (2 * (curr.x - prev.x)) / 3;
    const cpy2 = curr.y;

    path += ` C ${cpx1},${cpy1} ${cpx2},${cpy2} ${curr.x},${curr.y}`;
  }

  // Gradient fill path (close to bottom)
  const fillPath =
    path +
    ` L ${pathPoints[pathPoints.length - 1].x},${chartHeight + padding.top} L ${pathPoints[0].x},${chartHeight + padding.top} Z`;

  // Format date labels
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Y-axis labels
  const yAxisLabels = [
    { score: maxScore, y: padding.top },
    { score: (maxScore + minScore) / 2, y: chartHeight / 2 + padding.top },
    { score: minScore, y: chartHeight + padding.top },
  ];

  return (
    <div className={styles.container}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className={styles.svg}
      >
        <defs>
          {/* Gradient fill */}
          <linearGradient id="trendGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--accent-primary)" stopOpacity="0.2" />
            <stop offset="100%" stopColor="var(--accent-primary)" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Grid lines */}
        {yAxisLabels.map((label, i) => (
          <line
            key={i}
            x1={padding.left}
            y1={label.y}
            x2={width - padding.right}
            y2={label.y}
            className={styles.gridLine}
          />
        ))}

        {/* Gradient fill */}
        <path d={fillPath} fill="url(#trendGradient)" />

        {/* Line */}
        <path d={path} className={styles.line} />

        {/* Data points */}
        {pathPoints.map((point, i) => (
          <g key={i}>
            <circle cx={point.x} cy={point.y} r={4} className={styles.point} />
            <title>{`${formatDate(data[i].date)}: ${data[i].overallScore}%`}</title>
          </g>
        ))}

        {/* Y-axis labels */}
        {yAxisLabels.map((label, i) => (
          <text
            key={i}
            x={padding.left - 10}
            y={label.y}
            className={styles.yLabel}
            textAnchor="end"
            alignmentBaseline="middle"
          >
            {Math.round(label.score)}
          </text>
        ))}

        {/* X-axis labels */}
        {data.map((d, i) => {
          // Show labels for first, middle, and last points
          if (i === 0 || i === data.length - 1 || i === Math.floor(data.length / 2)) {
            return (
              <text
                key={i}
                x={getX(i) + padding.left}
                y={height - padding.bottom + 20}
                className={styles.xLabel}
                textAnchor="middle"
              >
                {formatDate(d.date)}
              </text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
