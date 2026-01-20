/**
 * ScoreComparisonCard Component
 * Side-by-side comparison of first vs latest analysis scores
 */

import { ProgressRing } from './ProgressRing';
import type { PersonalAnalyticsExtended } from '../../api/types';
import styles from './ScoreComparisonCard.module.css';

export interface ScoreComparisonCardProps {
  analytics: PersonalAnalyticsExtended;
}

export function ScoreComparisonCard({ analytics }: ScoreComparisonCardProps) {
  const { firstAnalysis, latestAnalysis, totalImprovement } = analytics;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  };

  const getImprovementIcon = () => {
    if (totalImprovement > 0) return '↑';
    if (totalImprovement < 0) return '↓';
    return '→';
  };

  const getImprovementClass = () => {
    if (totalImprovement > 0) return styles.positive;
    if (totalImprovement < 0) return styles.negative;
    return styles.neutral;
  };

  return (
    <div className={styles.card}>
      <h3 className={styles.title}>Score Comparison</h3>

      <div className={styles.comparison}>
        {/* First Analysis */}
        <div className={styles.scoreSection}>
          <div className={styles.label}>First</div>
          <ProgressRing value={firstAnalysis.score} size={100} showValue />
          <div className={styles.date}>{formatDate(firstAnalysis.date)}</div>
        </div>

        {/* Improvement Indicator */}
        <div className={styles.improvement}>
          <div className={`${styles.improvementBadge} ${getImprovementClass()}`}>
            <span className={styles.arrow}>{getImprovementIcon()}</span>
            <span className={styles.value}>
              {totalImprovement > 0 ? '+' : ''}
              {totalImprovement}
            </span>
          </div>
          <div className={styles.improvementLabel}>points</div>
        </div>

        {/* Latest Analysis */}
        <div className={styles.scoreSection}>
          <div className={styles.label}>Latest</div>
          <ProgressRing value={latestAnalysis.score} size={100} showValue />
          <div className={styles.date}>{formatDate(latestAnalysis.date)}</div>
        </div>
      </div>
    </div>
  );
}

export default ScoreComparisonCard;
