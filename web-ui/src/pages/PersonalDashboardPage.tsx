/**
 * Personal Dashboard Page
 * Individual developer's growth journey and progress tracking
 */

import { Header } from '../components/layout';
import { Card } from '../components/ui/Card';
import { LoadingState } from '../components/ui';
import { TrendLineChart } from '../components/enterprise';
import {
  JourneyHeader,
  ScoreComparisonCard,
  DimensionBreakdown,
  RecommendationsList,
} from '../components/personal';
import { usePersonalAnalytics } from '../hooks/usePersonalAnalytics';
import { MOCK_PERSONAL_DATA } from '../data/mockPersonalData';
import styles from './PersonalDashboardPage.module.css';

export function PersonalDashboardPage() {
  const { data: analytics, isLoading } = usePersonalAnalytics();

  if (isLoading) {
    return <LoadingState message="Loading your growth journey..." />;
  }

  // Use mock data for MVP (hook already returns mock data)
  const personalData = analytics || MOCK_PERSONAL_DATA;

  return (
    <div className={styles.page}>
      <Header
        title="My Growth Journey"
        subtitle="Track your AI collaboration skills and personal development"
      />

      {/* Journey Header - Hero section */}
      <JourneyHeader analytics={personalData} />

      {/* Score Comparison + Trend Chart */}
      <div className={styles.statsGrid}>
        <ScoreComparisonCard analytics={personalData} />

        <Card padding="lg" className={styles.trendCard}>
          <h3 className={styles.chartTitle}>Your Progress Over Time</h3>
          <div className={styles.chartSubtitle}>Overall score trend</div>
          <div className={styles.chartContent}>
            <TrendLineChart data={personalData.history} height={280} />
          </div>
        </Card>
      </div>

      {/* Dimension Breakdown */}
      <DimensionBreakdown analytics={personalData} />

      {/* Recommendations */}
      <RecommendationsList recommendations={personalData.recommendations} />
    </div>
  );
}
