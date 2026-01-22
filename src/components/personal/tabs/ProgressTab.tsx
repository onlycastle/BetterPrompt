/**
 * ProgressTab Component
 * Displays growth tracking and progress data with streak tracking
 */

import { Lock } from 'lucide-react';
import { Card } from '../../ui/Card';
import { TrendLineChart } from '../../enterprise';
import {
  JourneyHeader,
  ScoreComparisonCard,
  DimensionBreakdown,
  StreakCard,
} from '../';
import { EmptyStatePrompt } from './EmptyStatePrompt';
import type { PersonalAnalytics } from '../../../types/personal';
import styles from './ProgressTab.module.css';

interface ProgressTabProps {
  analytics: PersonalAnalytics | null;
  isPremium?: boolean;
}

export function ProgressTab({ analytics, isPremium = false }: ProgressTabProps) {
  if (!analytics) {
    return (
      <EmptyStatePrompt
        title="No Progress Data"
        message="Run multiple analyses over time to see your growth journey."
        showCommand
      />
    );
  }

  // For free users, limit trend chart to last 3 data points
  const chartData = isPremium ? analytics.history : analytics.history.slice(-3);
  const showFullHistoryUpsell = !isPremium && analytics.history.length > 3;

  return (
    <div className={styles.container}>
      {/* Journey Overview */}
      <JourneyHeader analytics={analytics} />

      {/* Activity & Streak Card */}
      <StreakCard analytics={analytics} />

      {/* Score Comparison + Trend Chart */}
      <div className={styles.statsRow}>
        <ScoreComparisonCard analytics={analytics} />

        <Card padding="lg" className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Progress Over Time</h3>
          <p className={styles.chartSubtitle}>
            {isPremium
              ? 'Overall score trend'
              : `Showing last ${chartData.length} analyses`}
          </p>
          <div className={styles.chartWrapper}>
            <TrendLineChart data={chartData} height={280} />
          </div>
          {showFullHistoryUpsell && (
            <div className={styles.upsellBanner}>
              <Lock size={14} />
              <span>
                Unlock full history ({analytics.history.length} analyses) with Premium
              </span>
            </div>
          )}
        </Card>
      </div>

      {/* Dimension Breakdown */}
      <DimensionBreakdown analytics={analytics} />

      {/* Premium Evolution Timeline Teaser (Premium only) */}
      {!isPremium && analytics.history.length >= 3 && (
        <Card padding="lg" className={styles.premiumTeaser}>
          <div className={styles.premiumTeaserHeader}>
            <Lock size={20} />
            <h3>Skill Evolution Timeline</h3>
          </div>
          <p className={styles.premiumTeaserText}>
            See how your coding style has evolved over time, including key
            milestones and type transitions.
          </p>
          <div className={styles.premiumTeaserBlur}>
            <div className={styles.fakeTl}>
              <span className={styles.fakeDot} />
              <span className={styles.fakeLine} />
              <span className={styles.fakeDot} />
              <span className={styles.fakeLine} />
              <span className={styles.fakeDot} />
            </div>
          </div>
          <button className={styles.premiumBtn}>Unlock with Premium</button>
        </Card>
      )}
    </div>
  );
}

export default ProgressTab;
