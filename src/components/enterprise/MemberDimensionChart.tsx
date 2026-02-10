/**
 * MemberDimensionChart Component
 * Horizontal bar chart showing 6 dimension scores for a team member.
 * Layout matches the AntiPatternHeatmap horizontal bar pattern.
 */

'use client';

import { DIMENSION_METADATA } from '../../types/enterprise';
import type { DimensionScores } from '../../types/enterprise';
import styles from './MemberDimensionChart.module.css';

export interface MemberDimensionChartProps {
  dimensions: DimensionScores;
}

const DIMENSION_KEYS: (keyof DimensionScores)[] = [
  'aiCollaboration',
  'contextEngineering',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
];

/**
 * Returns the CSS color variable for a dimension score.
 * burnoutRisk uses inverted logic: low score = good (green).
 */
function getBarColor(key: keyof DimensionScores, score: number): string {
  if (key === 'burnoutRisk') {
    if (score >= 60) return 'var(--accent-rose)';
    if (score >= 30) return 'var(--accent-amber)';
    return 'var(--accent-emerald)';
  }

  if (score >= 70) return 'var(--accent-emerald)';
  if (score >= 40) return 'var(--accent-amber)';
  return 'var(--accent-rose)';
}

export function MemberDimensionChart({ dimensions }: MemberDimensionChartProps) {
  return (
    <div className={styles.container}>
      {DIMENSION_KEYS.map(key => {
        const score = dimensions[key];
        const meta = DIMENSION_METADATA[key];
        const color = getBarColor(key, score);
        const clampedWidth = Math.max(0, Math.min(100, score));

        return (
          <div key={key} className={styles.row}>
            <div className={styles.labelCol}>
              <span className={styles.dimensionLabel}>{meta.label}</span>
            </div>
            <div className={styles.barCol}>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${clampedWidth}%`,
                    backgroundColor: color,
                  }}
                />
              </div>
            </div>
            <div className={styles.scoreCol}>{Math.round(score)}</div>
          </div>
        );
      })}
    </div>
  );
}
