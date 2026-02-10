/**
 * SkillGapTable Component
 * Table displaying skill gaps across teams with dimension, avg score,
 * members below threshold, and visual indicator
 */

import type { SkillGap } from '../../types/enterprise';
import styles from './SkillGapTable.module.css';

export interface SkillGapTableProps {
  gaps: SkillGap[];
}

export function SkillGapTable({ gaps }: SkillGapTableProps) {
  if (gaps.length === 0) {
    return (
      <div className={styles.empty}>
        No skill gaps detected — all dimensions above threshold.
      </div>
    );
  }

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th className={styles.th}>Dimension</th>
            <th className={styles.th}>Avg Score</th>
            <th className={styles.th}>Below Threshold</th>
            <th className={styles.th}>Gap</th>
          </tr>
        </thead>
        <tbody>
          {gaps.map(gap => {
            const gapSize = gap.threshold - gap.avgScore;
            return (
              <tr key={gap.dimension} className={styles.row}>
                <td className={styles.td}>
                  <span className={styles.dimLabel}>{gap.label}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.score}>{gap.avgScore}</span>
                  <span className={styles.threshold}>/ {gap.threshold}</span>
                </td>
                <td className={styles.td}>
                  <span className={styles.memberCount}>
                    {gap.membersBelowThreshold} member{gap.membersBelowThreshold !== 1 ? 's' : ''}
                  </span>
                </td>
                <td className={styles.td}>
                  <div className={styles.gapBar}>
                    <div
                      className={styles.gapFill}
                      style={{ width: `${Math.min(gapSize * 3, 100)}%` }}
                    />
                  </div>
                  <span className={styles.gapValue}>-{gapSize}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
