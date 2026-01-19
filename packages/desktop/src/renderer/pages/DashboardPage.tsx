/**
 * Dashboard Page
 * Knowledge base analytics and insights
 */

import { useQualityMetrics, useKnowledgeStats } from '../hooks';
import styles from './DashboardPage.module.css';

const CATEGORY_LABELS: Record<string, string> = {
  'prompt-engineering': 'Prompt Engineering',
  'context-engineering': 'Context Engineering',
  'claude-code-skills': 'Claude Code Skills',
  'tool-use': 'Tool Use',
  'subagents': 'Subagents',
  'workflow-automation': 'Workflow',
  'best-practices': 'Best Practices',
  'memory-management': 'Memory',
  'other': 'Other',
};

export default function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useQualityMetrics();
  const { isLoading: statsLoading } = useKnowledgeStats();

  const isLoading = metricsLoading || statsLoading;

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const avgScore = metrics?.averageRelevanceScore ?? 0;
  const scorePercent = Math.round(avgScore * 100);

  // Calculate platform distribution
  const platformData = Object.entries(metrics?.platformDistribution || {})
    .map(([platform, count]) => ({
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      value: count as number,
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate category distribution
  const categoryData = Object.entries(metrics?.categoryDistribution || {})
    .map(([category, count]) => ({
      label: CATEGORY_LABELS[category] || category,
      value: count as number,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const maxPlatformValue = Math.max(...platformData.map(d => d.value), 1);
  const maxCategoryValue = Math.max(...categoryData.map(d => d.value), 1);

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1 className={styles.title}>Dashboard</h1>
        <p className={styles.subtitle}>Knowledge base analytics and insights</p>
      </header>

      {/* Stat Cards */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{metrics?.totalItems || 0}</div>
            <p className={styles.statLabel}>Total Items</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>📈</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{metrics?.highQualityCount || 0}</div>
            <p className={styles.statLabel}>High Quality (≥70%)</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>👥</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{metrics?.influencerContentCount || 0}</div>
            <p className={styles.statLabel}>From Influencers</p>
          </div>
        </div>

        <div className={styles.statCard}>
          <div className={styles.statIcon}>🕐</div>
          <div className={styles.statContent}>
            <div className={styles.statValue}>{metrics?.recentItemsCount || 0}</div>
            <p className={styles.statLabel}>Last 7 Days</p>
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className={styles.chartsGrid}>
        {/* Average Score */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Average Relevance</h3>
          <div className={styles.scoreDisplay}>
            <div className={styles.progressRing}>
              <svg viewBox="0 0 100 100">
                <circle
                  className={styles.ringBg}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="10"
                />
                <circle
                  className={styles.ringFg}
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  strokeWidth="10"
                  strokeDasharray={`${scorePercent * 2.51} 251`}
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <span className={styles.scoreValue}>{scorePercent}%</span>
            </div>
          </div>
        </div>

        {/* Platform Distribution */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Platform Distribution</h3>
          <div className={styles.barChart}>
            {platformData.map(({ label, value }) => (
              <div key={label} className={styles.barRow}>
                <span className={styles.barLabel}>{label}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(value / maxPlatformValue) * 100}%` }}
                  />
                </div>
                <span className={styles.barValue}>{value}</span>
              </div>
            ))}
            {platformData.length === 0 && (
              <p className={styles.emptyChart}>No data available</p>
            )}
          </div>
        </div>

        {/* Category Distribution */}
        <div className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Top Categories</h3>
          <div className={styles.barChart}>
            {categoryData.map(({ label, value }) => (
              <div key={label} className={styles.barRow}>
                <span className={styles.barLabel}>{label}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${(value / maxCategoryValue) * 100}%` }}
                  />
                </div>
                <span className={styles.barValue}>{value}</span>
              </div>
            ))}
            {categoryData.length === 0 && (
              <p className={styles.emptyChart}>No data available</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
