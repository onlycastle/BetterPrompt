/**
 * TypeDistributionChart Component
 * Donut chart showing distribution of coding style types
 */

import type { CodingStyleType } from '../../types/enterprise';
import { TYPE_METADATA } from '../../types/enterprise';
import styles from './TypeDistributionChart.module.css';

export interface TypeDistributionChartProps {
  distribution: Record<CodingStyleType, number>;
}

export function TypeDistributionChart({ distribution }: TypeDistributionChartProps) {
  const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

  if (total === 0) {
    return (
      <div className={styles.empty}>
        No type data available
      </div>
    );
  }

  // Calculate percentages and cumulative values for conic-gradient
  const entries = Object.entries(distribution) as [CodingStyleType, number][];
  const segments = entries
    .filter(([, count]) => count > 0)
    .map(([type, count]) => ({
      type,
      count,
      percentage: (count / total) * 100,
      metadata: TYPE_METADATA[type],
    }));

  // Build conic-gradient string
  let currentAngle = 0;
  const gradientStops = segments.map(segment => {
    const startAngle = currentAngle;
    currentAngle += segment.percentage;
    const endAngle = currentAngle;
    return `${segment.metadata.color} ${startAngle}% ${endAngle}%`;
  });

  const conicGradient = `conic-gradient(from 0deg, ${gradientStops.join(', ')})`;

  return (
    <div className={styles.container}>
      {/* Donut Chart */}
      <div className={styles.chartWrapper}>
        <div
          className={styles.donut}
          style={{ background: conicGradient }}
        >
          <div className={styles.donutHole}>
            <div className={styles.totalLabel}>Total</div>
            <div className={styles.totalValue}>{total}</div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className={styles.legend}>
        {segments.map(segment => (
          <div key={segment.type} className={styles.legendItem}>
            <div
              className={styles.legendColor}
              style={{ backgroundColor: segment.metadata.color }}
            />
            <div className={styles.legendContent}>
              <div className={styles.legendLabel}>
                <span className={styles.legendEmoji}>{segment.metadata.emoji}</span>
                <span>{segment.metadata.label}</span>
              </div>
              <div className={styles.legendStats}>
                <span className={styles.legendCount}>{segment.count}</span>
                <span className={styles.legendPercent}>
                  ({segment.percentage.toFixed(0)}%)
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
