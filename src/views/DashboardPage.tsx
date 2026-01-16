import { BarChart3, TrendingUp, Users, Clock } from 'lucide-react';
import { Header } from '@/components/layout';
import { Card, CardContent } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui';
import { useQualityMetrics, useKnowledgeStats } from '@/hooks/useKnowledge';
import { AnimatedNumber, ProgressRing, BarChart } from '@/components/dashboard';
import styles from './DashboardPage.module.css';

const PLATFORM_COLORS: Record<string, string> = {
  youtube: 'var(--platform-youtube)',
  twitter: 'var(--platform-twitter)',
  reddit: 'var(--platform-reddit)',
  linkedin: 'var(--platform-linkedin)',
  web: 'var(--platform-web)',
};

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

export function DashboardPage() {
  const { data: metrics, isLoading: metricsLoading } = useQualityMetrics();
  const { isLoading: statsLoading } = useKnowledgeStats();

  const isLoading = metricsLoading || statsLoading;

  if (isLoading) {
    return <LoadingState message="Loading dashboard..." />;
  }

  const avgScore = metrics?.averageRelevanceScore ?? 0;
  const scorePercent = Math.round(avgScore * 100);

  // Calculate platform distribution for BarChart
  const platformData = Object.entries(metrics?.platformDistribution || {})
    .map(([platform, count]) => ({
      label: platform.charAt(0).toUpperCase() + platform.slice(1),
      value: count as number,
      color: PLATFORM_COLORS[platform] || 'var(--text-tertiary)',
    }))
    .sort((a, b) => b.value - a.value);

  // Calculate category distribution for BarChart
  const categoryData = Object.entries(metrics?.categoryDistribution || {})
    .map(([category, count]) => ({
      label: CATEGORY_LABELS[category] || category,
      value: count as number,
      color: 'var(--accent-primary)',
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  return (
    <div className={styles.page}>
      <Header
        title="Dashboard"
        subtitle="Knowledge base analytics and insights"
      />

      {/* Stat Cards */}
      <div className={styles.statsGrid}>
        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-primary-soft)' }}>
                <BarChart3 size={24} color="var(--accent-primary)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  <AnimatedNumber value={metrics?.totalItems || 0} />
                </div>
                <p className={styles.statLabel}>Total Items</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-emerald-soft)' }}>
                <TrendingUp size={24} color="var(--accent-emerald)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  <AnimatedNumber value={metrics?.highQualityCount || 0} />
                </div>
                <p className={styles.statLabel}>High Quality (≥70%)</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-amber-soft)' }}>
                <Users size={24} color="var(--accent-amber)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  <AnimatedNumber value={metrics?.influencerContentCount || 0} />
                </div>
                <p className={styles.statLabel}>From Influencers</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-primary-soft)' }}>
                <Clock size={24} color="var(--accent-primary)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  <AnimatedNumber value={metrics?.recentItemsCount || 0} />
                </div>
                <p className={styles.statLabel}>Last 7 Days</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className={styles.chartsGrid}>
        {/* Average Score */}
        <Card padding="lg" className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Average Relevance</h3>
          <div className={styles.scoreDisplay}>
            <ProgressRing value={scorePercent} size={160} strokeWidth={10} />
          </div>
        </Card>

        {/* Platform Distribution */}
        <Card padding="lg" className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Platform Distribution</h3>
          <div className={styles.chartContent}>
            <BarChart data={platformData} />
          </div>
        </Card>

        {/* Category Distribution */}
        <Card padding="lg" className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Top Categories</h3>
          <div className={styles.chartContent}>
            <BarChart data={categoryData} />
          </div>
        </Card>
      </div>
    </div>
  );
}
