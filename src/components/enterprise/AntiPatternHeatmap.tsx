/**
 * AntiPatternHeatmap Component
 * Horizontal bar chart showing anti-pattern distribution across team members
 * Layout adapted from TypeDistributionChart
 */

'use client';

import type { AntiPatternAggregate } from '../../types/enterprise';
import styles from './AntiPatternHeatmap.module.css';

export interface AntiPatternHeatmapProps {
  aggregates: AntiPatternAggregate[];
}

const IMPACT_COLORS = {
  high: 'var(--sketch-red)',
  medium: 'var(--accent-amber)',
  low: 'var(--ink-muted)',
} as const;

export function AntiPatternHeatmap({ aggregates }: AntiPatternHeatmapProps) {
  if (aggregates.length === 0) {
    return <div className={styles.empty}>No anti-patterns detected</div>;
  }

  const maxOccurrences = Math.max(...aggregates.map(a => a.totalOccurrences), 1);

  return (
    <div className={styles.container}>
      {aggregates.map(agg => {
        const barWidth = (agg.totalOccurrences / maxOccurrences) * 100;
        const color = IMPACT_COLORS[agg.predominantImpact];

        return (
          <div key={agg.pattern} className={styles.row}>
            <div className={styles.labelCol}>
              <span className={styles.patternName}>{agg.label}</span>
            </div>
            <div className={styles.barCol}>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${barWidth}%`, backgroundColor: color }}
                />
              </div>
            </div>
            <div className={styles.infoCol}>
              <span className={styles.count}>{agg.totalOccurrences}</span>
              <span className={styles.meta}>{agg.memberCount} {agg.memberCount === 1 ? 'member' : 'members'}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
