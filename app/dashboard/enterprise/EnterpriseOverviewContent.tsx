/**
 * EnterpriseOverviewContent
 * Manager-actionable organization dashboard with 7 sections:
 * StatCards, GrowthLeaderboard, TokenUsagePanel, AntiPatternDeepDive,
 * CommonGrowthAreas, TeamKPTPanel, ProjectActivityFeed
 */

'use client';

import { useMemo } from 'react';
import { useOrganization, useMembers, useOrgAntiPatterns, useOrgGrowthAreas, useOrgKpt } from '@/hooks';
import { StatCard } from '@/components/enterprise/StatCard';
import { formatTokens, getTokenDelta } from '@/components/enterprise/format-utils';
import { GrowthLeaderboard } from '@/components/enterprise/GrowthLeaderboard';
import { TokenUsagePanel } from '@/components/enterprise/TokenUsagePanel';
import { AntiPatternDeepDive } from '@/components/enterprise/AntiPatternDeepDive';
import { CommonGrowthAreas } from '@/components/enterprise/CommonGrowthAreas';
import { TeamKPTPanel } from '@/components/enterprise/TeamKPTPanel';
import { ProjectActivityFeed } from '@/components/enterprise/ProjectActivityFeed';
import { Card, CardContent } from '@/components/ui/Card';
import styles from './EnterpriseOverviewContent.module.css';

export function EnterpriseOverviewContent() {
  const { data: org, isLoading: orgLoading, error: orgError } = useOrganization();
  const { data: members, isLoading: membersLoading } = useMembers();
  const { data: antiPatterns } = useOrgAntiPatterns();
  const { data: growthAreas } = useOrgGrowthAreas();
  const { data: kpt } = useOrgKpt();

  // Aggregate stats
  const totalSessions = useMemo(
    () => (members ?? []).reduce((s, m) => s + m.tokenUsage.totalSessions, 0),
    [members],
  );

  const avgTokenBurn = useMemo(() => {
    const m = members ?? [];
    if (m.length === 0) return 0;
    const total = m.reduce((s, mem) => {
      const trend = mem.tokenUsage.weeklyTokenTrend;
      const current = getTokenDelta(trend).current;
      return s + current;
    }, 0);
    return Math.round(total / m.length);
  }, [members]);

  const totalAntiPatterns = useMemo(
    () => (antiPatterns ?? []).reduce((s, a) => s + a.totalOccurrences, 0),
    [antiPatterns],
  );

  // WoW sessions change (rough estimate from token trends)
  const wowSessionsChange = useMemo(() => {
    const m = members ?? [];
    let thisWeek = 0;
    let lastWeek = 0;
    for (const mem of m) {
      const trend = mem.tokenUsage.weeklyTokenTrend;
      if (trend.length >= 2) {
        thisWeek += trend[trend.length - 1].sessions;
        lastWeek += trend[trend.length - 2].sessions;
      }
    }
    if (lastWeek === 0) return 0;
    return Math.round(((thisWeek - lastWeek) / lastWeek) * 100);
  }, [members]);

  if (orgLoading || membersLoading) {
    return (
      <div className={styles.container}>
        <p className={styles.pageSubtitle}>Loading dashboard...</p>
      </div>
    );
  }

  if (orgError) {
    return (
      <div className={styles.container}>
        <p className={styles.pageSubtitle}>Failed to load dashboard: {orgError.message}</p>
      </div>
    );
  }

  if (!org) {
    return (
      <div className={styles.container}>
        <p className={styles.pageSubtitle}>No organization found. Set up your organization first.</p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{org.organizationName}</h1>
      <p className={styles.pageSubtitle}>Manager Dashboard</p>

      {/* Stat Cards Row */}
      <div className={styles.statsRow}>
        <StatCard label="Active Members" value={org.totalMembers} suffix=" members" />
        <StatCard label="Sessions This Week" value={totalSessions} change={wowSessionsChange} />
        <StatCard label="Avg Token Burn" value={formatTokens(avgTokenBurn)} />
        <StatCard label="Anti-Patterns" value={totalAntiPatterns} suffix=" detected" />
      </div>

      {/* Growth Leaderboard */}
      {members && members.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Growth Leaderboard</h2>
          <Card>
            <CardContent>
              <GrowthLeaderboard members={members} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Token Usage Panel */}
      {members && members.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Token Usage</h2>
          <TokenUsagePanel members={members} />
        </section>
      )}

      {/* Anti-Pattern Deep Dive */}
      {antiPatterns && antiPatterns.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Anti-Pattern Deep Dive</h2>
          <Card>
            <CardContent>
              <AntiPatternDeepDive aggregates={antiPatterns} />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Common Growth Areas */}
      {growthAreas && growthAreas.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Common Growth Areas</h2>
          <CommonGrowthAreas areas={growthAreas} />
        </section>
      )}

      {/* Team KPT Retrospective */}
      {kpt && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Team KPT Retrospective</h2>
          <TeamKPTPanel kpt={kpt} />
        </section>
      )}

      {/* Project Activity Feed */}
      {members && members.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Project Activity</h2>
          <ProjectActivityFeed members={members} />
        </section>
      )}
    </div>
  );
}
