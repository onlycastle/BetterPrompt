/**
 * TypeDistributionChart Component
 * Horizontal bar chart showing coding style type distribution
 * Uses TYPE_METADATA colors from enterprise types
 */

'use client';

import { TYPE_METADATA } from '../../types/enterprise';
import type { CodingStyleType } from '../../types/enterprise';
import styles from './TypeDistributionChart.module.css';

export interface TypeDistributionChartProps {
  distribution: Record<CodingStyleType, number>;
  total: number;
}

export function TypeDistributionChart({ distribution, total }: TypeDistributionChartProps) {
  const types = Object.entries(distribution) as [CodingStyleType, number][];
  // Sort by count descending
  types.sort((a, b) => b[1] - a[1]);

  const maxCount = Math.max(...types.map(([, count]) => count), 1);

  return (
    <div className={styles.container}>
      {types.map(([type, count]) => {
        const meta = TYPE_METADATA[type];
        const pct = total > 0 ? Math.round((count / total) * 100) : 0;
        const barWidth = maxCount > 0 ? (count / maxCount) * 100 : 0;

        return (
          <div key={type} className={styles.row}>
            <div className={styles.labelCol}>
              <span className={styles.emoji}>{meta.emoji}</span>
              <span className={styles.typeName}>{meta.label}</span>
            </div>
            <div className={styles.barCol}>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${barWidth}%`, backgroundColor: meta.color }}
                />
              </div>
            </div>
            <div className={styles.countCol}>
              <span className={styles.count}>{count}</span>
              <span className={styles.pct}>({pct}%)</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
