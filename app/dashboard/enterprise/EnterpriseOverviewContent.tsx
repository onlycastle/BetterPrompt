/**
 * EnterpriseOverviewContent
 * Manager-actionable organization dashboard with 5 sections:
 * GrowthLeaderboard, TokenUsagePanel, AntiPatternHeatmap,
 * TeamStrengthsPanel, ProjectActivityFeed
 */

'use client';

import { useMemo } from 'react';
import { useOrganization, useMembers, useOrgAntiPatterns } from '@/hooks';
import { StatCard } from '@/components/enterprise/StatCard';
import { GrowthLeaderboard } from '@/components/enterprise/GrowthLeaderboard';
import { TokenUsagePanel } from '@/components/enterprise/TokenUsagePanel';
import { AntiPatternHeatmap } from '@/components/enterprise/AntiPatternHeatmap';
import { TeamStrengthsPanel } from '@/components/enterprise/TeamStrengthsPanel';
import { ProjectActivityFeed } from '@/components/enterprise/ProjectActivityFeed';
import { Card, CardContent } from '@/components/ui/Card';
import styles from './EnterpriseOverviewContent.module.css';

export function EnterpriseOverviewContent() {
  const org = useOrganization();
  const members = useMembers();
  const antiPatterns = useOrgAntiPatterns();

  // Aggregate stats
  const totalSessions = useMemo(
    () => members.reduce((s, m) => s + m.tokenUsage.totalSessions, 0),
    [members],
  );

  const avgContextFill = useMemo(
    () => members.length > 0
      ? Math.round(members.reduce((s, m) => s + m.tokenUsage.avgContextFillPercent, 0) / members.length)
      : 0,
    [members],
  );

  const totalAntiPatterns = useMemo(
    () => antiPatterns.reduce((s, a) => s + a.totalOccurrences, 0),
    [antiPatterns],
  );

  // WoW sessions change (rough estimate from token trends)
  const wowSessionsChange = useMemo(() => {
    let thisWeek = 0;
    let lastWeek = 0;
    for (const m of members) {
      const trend = m.tokenUsage.weeklyTokenTrend;
      if (trend.length >= 2) {
        thisWeek += trend[trend.length - 1].sessions;
        lastWeek += trend[trend.length - 2].sessions;
      }
    }
    if (lastWeek === 0) return 0;
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  }, [members]);

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{org.organizationName}</h1>
      <p className={styles.pageSubtitle}>Manager Dashboard</p>

      {/* Stat Cards Row */}
      <div className={styles.statsRow}>
        <StatCard label="Active Members" value={org.totalMembers} suffix=" members" />
        <StatCard label="Sessions This Week" value={totalSessions} change={wowSessionsChange} />
        <StatCard label="Avg Context Fill" value={`${avgContextFill}`} suffix="%" />
        <StatCard label="Anti-Patterns" value={totalAntiPatterns} suffix=" detected" />
      </div>

      {/* Growth Leaderboard */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Growth Leaderboard</h2>
        <Card>
          <CardContent>
            <GrowthLeaderboard members={members} />
          </CardContent>
        </Card>
      </section>

      {/* Token Usage Panel */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Token Usage</h2>
        <TokenUsagePanel members={members} />
      </section>

      {/* Anti-Pattern Heatmap */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Anti-Pattern Distribution</h2>
        <Card>
          <CardContent>
            <AntiPatternHeatmap aggregates={antiPatterns} />
          </CardContent>
        </Card>
      </section>

      {/* Team Strengths Panel */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Team Strengths</h2>
        <TeamStrengthsPanel members={members} />
      </section>

      {/* Project Activity Feed */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Project Activity</h2>
        <ProjectActivityFeed members={members} />
      </section>
    </div>
  );
}
