/**
 * ProgressTab Component
 * Displays growth tracking and progress data
 */

import { Card } from '../../ui/Card';
import { TrendLineChart } from '../../enterprise';
import {
  JourneyHeader,
  ScoreComparisonCard,
  DimensionBreakdown,
} from '../';
import { EmptyStatePrompt } from './EmptyStatePrompt';
import type { PersonalAnalytics } from '../../../types/personal';
import styles from './ProgressTab.module.css';

interface ProgressTabProps {
  analytics: PersonalAnalytics | null;
}

export function ProgressTab({ analytics }: ProgressTabProps) {
  if (!analytics) {
    return (
      <EmptyStatePrompt
        title="No Progress Data"
        message="Run multiple analyses over time to see your growth journey."
        showCommand={false}
      />
    );
  }

  return (
    <div className={styles.container}>
      {/* Journey Overview */}
      <JourneyHeader analytics={analytics} />

      {/* Score Comparison + Trend Chart */}
      <div className={styles.statsRow}>
        <ScoreComparisonCard analytics={analytics} />

        <Card padding="lg" className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Progress Over Time</h3>
          <p className={styles.chartSubtitle}>Overall score trend</p>
          <div className={styles.chartWrapper}>
            <TrendLineChart data={analytics.history} height={280} />
          </div>
        </Card>
      </div>

      {/* Dimension Breakdown */}
      <DimensionBreakdown analytics={analytics} />
    </div>
  );
}

export default ProgressTab;
