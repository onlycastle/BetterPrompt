/**
 * TeamDetailContent
 * Assembles team detail view: header, charts, type distribution, member table
 */

'use client';

import { useTeam, useTeamMembers } from '@/hooks';
import { TeamHeader } from '@/components/enterprise/TeamHeader';
import { StatCard } from '@/components/enterprise/StatCard';
import { TypeDistributionChart } from '@/components/enterprise/TypeDistributionChart';
import { MemberTable } from '@/components/enterprise/MemberTable';
import { TrendLineChart } from '@/components/enterprise/TrendLineChart';
import { RadarChart } from '@/components/personal/tabs/type-result/RadarChart';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { DIMENSION_METADATA } from '@/types/enterprise';
import type { DimensionScores } from '@/types/enterprise';
import styles from './TeamDetailContent.module.css';

export function TeamDetailContent({ teamId }: { teamId: string }) {
  const { data: team, isLoading: teamLoading, error: teamError } = useTeam(teamId);
  const { data: members, isLoading: membersLoading } = useTeamMembers(teamId);

  if (teamLoading || membersLoading) {
    return (
      <div className={styles.container}>
        <p>Loading team...</p>
      </div>
    );
  }

  if (teamError) {
    return (
      <div className={styles.container}>
        <p>Failed to load team: {teamError.message}</p>
      </div>
    );
  }

  if (!team) {
    return (
      <div className={styles.container}>
        <div className={styles.notFound}>Team not found</div>
      </div>
    );
  }

  // Radar chart data from team average dimensions
  const dimKeys = Object.keys(DIMENSION_METADATA) as (keyof DimensionScores)[];
  const radarLabels = dimKeys.map(k => DIMENSION_METADATA[k].label);
  const radarData = dimKeys.map(k =>
    k === 'burnoutRisk' ? 100 - team.averageDimensions[k] : team.averageDimensions[k]
  );

  return (
    <div className={styles.container}>
      <TeamHeader
        teamName={team.teamName}
        memberCount={team.memberCount}
        averageScore={team.averageOverallScore}
        weekOverWeekChange={team.weekOverWeekChange}
      />

      {/* Stat Cards */}
      <div className={styles.statsRow}>
        <StatCard label="Members" value={team.memberCount} />
        <StatCard label="Avg Score" value={team.averageOverallScore} />
        <StatCard label="WoW" value={team.weekOverWeekChange > 0 ? `+${team.weekOverWeekChange}` : String(team.weekOverWeekChange)} suffix="%" change={team.weekOverWeekChange} />
        <StatCard label="Skill Gaps" value={team.skillGaps.length} />
      </div>

      {/* Charts Row: Radar + Trend */}
      <div className={styles.chartsRow}>
        <Card className={styles.chartCard}>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Dimension Scores</h2>
          </CardHeader>
          <CardContent>
            <RadarChart
              data={radarData}
              labels={radarLabels}
              color="var(--sketch-cyan)"
              ariaLabel={`${team.teamName} dimension radar chart`}
              showValues
              valueFormatter={v => `${Math.round(v)}`}
            />
          </CardContent>
        </Card>

        <Card className={styles.chartCard}>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Weekly Trend</h2>
          </CardHeader>
          <CardContent>
            <TrendLineChart data={team.weeklyTrend} height={220} />
          </CardContent>
        </Card>
      </div>

      {/* Type Distribution */}
      <section className={styles.section}>
        <Card>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Type Distribution</h2>
          </CardHeader>
          <CardContent>
            <TypeDistributionChart distribution={team.typeDistribution} total={team.memberCount} />
          </CardContent>
        </Card>
      </section>

      {/* Member Table */}
      {members && members.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Members</h2>
          <MemberTable members={members} />
        </section>
      )}
    </div>
  );
}
