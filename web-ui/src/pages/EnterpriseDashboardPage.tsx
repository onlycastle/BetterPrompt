/**
 * Enterprise Dashboard Page
 * Team performance overview and analytics for B2B customers
 */

import { Users, TrendingUp, Trophy, Calendar } from 'lucide-react';
import { Header } from '../components/layout';
import { Card, CardContent } from '../components/ui/Card';
import { LoadingState } from '../components/ui';
import { AnimatedNumber, BarChart } from '../components/dashboard';
import { TrendLineChart, TypeDistributionChart, MemberTable } from '../components/enterprise';
import { useTeamAnalytics, useTeamMembers } from '../hooks/useEnterprise';
import { MOCK_TEAM_ANALYTICS, MOCK_TEAM_MEMBERS } from '../data/mockEnterpriseData';
import { TYPE_METADATA, DIMENSION_METADATA } from '../types/enterprise';
import styles from './EnterpriseDashboardPage.module.css';

export function EnterpriseDashboardPage() {
  const { data: analytics, isLoading: analyticsLoading } = useTeamAnalytics();
  const { data: membersData, isLoading: membersLoading } = useTeamMembers();

  const isLoading = analyticsLoading || membersLoading;

  if (isLoading) {
    return <LoadingState message="Loading enterprise dashboard..." />;
  }

  // Use mock data for MVP (hooks already return mock data)
  const teamAnalytics = analytics || MOCK_TEAM_ANALYTICS;
  const members = membersData?.members || MOCK_TEAM_MEMBERS;

  // Find most common type
  const topType = Object.entries(teamAnalytics.typeDistribution)
    .sort(([, a], [, b]) => b - a)[0];
  const topTypeMetadata = topType ? TYPE_METADATA[topType[0] as keyof typeof TYPE_METADATA] : null;

  // Prepare skill gaps data for bar chart
  const skillGapsData = teamAnalytics.skillGaps
    .slice(0, 6)
    .map(gap => ({
      label: DIMENSION_METADATA[gap.dimension].label,
      value: gap.membersBelowThreshold,
      color: gap.dimension === 'burnoutRisk' ? 'var(--accent-rose)' : 'var(--accent-amber)',
    }));

  return (
    <div className={styles.page}>
      <Header
        title="Enterprise Dashboard"
        subtitle="Team performance overview and skill development tracking"
      />

      {/* Stats Grid */}
      <div className={styles.statsGrid}>
        {/* Member Count */}
        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-primary-soft)' }}>
                <Users size={24} color="var(--accent-primary)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  <AnimatedNumber value={teamAnalytics.memberCount} />
                </div>
                <p className={styles.statLabel}>Team Members</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Average Score */}
        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-emerald-soft)' }}>
                <TrendingUp size={24} color="var(--accent-emerald)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  <AnimatedNumber value={teamAnalytics.averageOverallScore} suffix="%" />
                </div>
                <p className={styles.statLabel}>Avg Team Score</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Type */}
        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-amber-soft)' }}>
                <Trophy size={24} color="var(--accent-amber)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  {topTypeMetadata && (
                    <>
                      <span className={styles.emoji}>{topTypeMetadata.emoji}</span>
                      <span>{topTypeMetadata.label}</span>
                    </>
                  )}
                </div>
                <p className={styles.statLabel}>Most Common Type</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Week over Week Change */}
        <Card padding="lg" className={styles.statCard}>
          <CardContent>
            <div className={styles.stat}>
              <div className={styles.statIcon} style={{ backgroundColor: 'var(--accent-primary-soft)' }}>
                <Calendar size={24} color="var(--accent-primary)" />
              </div>
              <div>
                <div className={styles.statValue}>
                  <AnimatedNumber
                    value={teamAnalytics.weekOverWeekChange}
                    prefix={teamAnalytics.weekOverWeekChange > 0 ? '+' : ''}
                    suffix="%"
                  />
                </div>
                <p className={styles.statLabel}>Week over Week</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className={styles.chartsGrid}>
        {/* Type Distribution */}
        <Card padding="lg" className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Type Distribution</h3>
          <div className={styles.chartContent}>
            <TypeDistributionChart distribution={teamAnalytics.typeDistribution} />
          </div>
        </Card>

        {/* Skill Gaps */}
        <Card padding="lg" className={styles.chartCard}>
          <h3 className={styles.chartTitle}>Skill Gaps</h3>
          <div className={styles.chartSubtitle}>Members below threshold</div>
          <div className={styles.chartContent}>
            {skillGapsData.length > 0 ? (
              <BarChart data={skillGapsData} />
            ) : (
              <div className={styles.emptyState}>No skill gaps detected</div>
            )}
          </div>
        </Card>
      </div>

      {/* Historical Trend */}
      <Card padding="lg" className={styles.trendSection}>
        <h3 className={styles.chartTitle}>Team Performance Trend</h3>
        <div className={styles.chartSubtitle}>Average team score over time</div>
        <div className={styles.chartContent}>
          <TrendLineChart data={teamAnalytics.weeklyTrend} height={240} />
        </div>
      </Card>

      {/* Team Members Table */}
      <Card padding="lg" className={styles.membersSection}>
        <h3 className={styles.chartTitle}>Team Members</h3>
        <div className={styles.chartSubtitle}>
          {members.length} developer{members.length !== 1 ? 's' : ''} • Click column headers to sort
        </div>
        <div className={styles.tableContent}>
          <MemberTable members={members} />
        </div>
      </Card>
    </div>
  );
}
