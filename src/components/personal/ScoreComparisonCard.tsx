/**
 * ScoreComparisonCard Component
 * Side-by-side comparison of first vs latest analysis scores
 */

import { ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProgressRing } from '../dashboard/ProgressRing';
import type { PersonalAnalytics } from '../../types/personal';
import styles from './ScoreComparisonCard.module.css';

export interface ScoreComparisonCardProps {
  analytics: PersonalAnalytics;
}

export function ScoreComparisonCard({ analytics }: ScoreComparisonCardProps) {
  const { firstAnalysis, latestAnalysis, totalImprovement } = analytics;

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getImprovementIcon = () => {
    if (totalImprovement > 0) return <ArrowUp size={16} />;
    if (totalImprovement < 0) return <ArrowDown size={16} />;
    return <Minus size={16} />;
  };

  const getImprovementClass = () => {
    if (totalImprovement > 0) return styles.positive;
    if (totalImprovement < 0) return styles.negative;
    return styles.neutral;
  };

  return (
    <Card padding="lg" className={styles.card}>
      <h3 className={styles.title}>Score Comparison</h3>

      <div className={styles.comparison}>
        {/* First Analysis */}
        <div className={styles.scoreSection}>
          <div className={styles.label}>First Analysis</div>
          <ProgressRing value={firstAnalysis.score} size={120} showValue={true} />
          <div className={styles.date}>{formatDate(firstAnalysis.date)}</div>
        </div>

        {/* Improvement Indicator */}
        <div className={styles.improvement}>
          <div className={`${styles.improvementBadge} ${getImprovementClass()}`}>
            {getImprovementIcon()}
            <span className={styles.improvementValue}>
              {totalImprovement > 0 ? '+' : ''}
              {totalImprovement}
            </span>
          </div>
          <div className={styles.improvementLabel}>points</div>
        </div>

        {/* Latest Analysis */}
        <div className={styles.scoreSection}>
          <div className={styles.label}>Latest Analysis</div>
          <ProgressRing value={latestAnalysis.score} size={120} showValue={true} />
          <div className={styles.date}>{formatDate(latestAnalysis.date)}</div>
        </div>
      </div>
    </Card>
  );
}
