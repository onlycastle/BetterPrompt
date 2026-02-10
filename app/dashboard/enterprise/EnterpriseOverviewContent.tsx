/**
 * EnterpriseOverviewContent
 * Assembles the organization-wide overview dashboard
 */

'use client';

import { useOrganization, useTeams, useMembers } from '@/hooks';
import { StatCard } from '@/components/enterprise/StatCard';
import { TypeDistributionChart } from '@/components/enterprise/TypeDistributionChart';
import { TeamOverviewGrid } from '@/components/enterprise/TeamOverviewGrid';
import { SkillGapTable } from '@/components/enterprise/SkillGapTable';
import { TrendLineChart } from '@/components/enterprise/TrendLineChart';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import type { CodingStyleType } from '@/types/enterprise';
import styles from './EnterpriseOverviewContent.module.css';

export function EnterpriseOverviewContent() {
  const org = useOrganization();
  const teams = useTeams();
  const members = useMembers();

  // Aggregate type distribution across all members
  const orgTypeDistribution = members.reduce<Record<CodingStyleType, number>>(
    (acc, m) => { acc[m.primaryType]++; return acc; },
    { architect: 0, analyst: 0, conductor: 0, speedrunner: 0, trendsetter: 0 },
  );

  // Aggregate skill gaps from all teams
  const allGaps = teams.flatMap(t => t.skillGaps);
  // Deduplicate by dimension, keeping the worst
  const gapMap = new Map<string, typeof allGaps[number]>();
  for (const gap of allGaps) {
    const existing = gapMap.get(gap.dimension);
    if (!existing || gap.avgScore < existing.avgScore) {
      gapMap.set(gap.dimension, gap);
    }
  }
  const uniqueGaps = [...gapMap.values()];

  // Aggregate weekly trend (average across teams)
  const orgTrend = teams.length > 0 && teams[0].weeklyTrend.length > 0
    ? teams[0].weeklyTrend.map((entry, i) => ({
        date: entry.date,
        overallScore: Math.round(
          teams.reduce((s, t) => s + (t.weeklyTrend[i]?.overallScore ?? 0), 0) / teams.length
        ),
      }))
    : [];

  // WoW change
  const wowChange = teams.length > 0
    ? Math.round(teams.reduce((s, t) => s + t.weekOverWeekChange, 0) / teams.length * 10) / 10
    : 0;

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>{org.organizationName}</h1>
      <p className={styles.pageSubtitle}>Organization-wide AI development analytics</p>

      {/* Stat Cards Row */}
      <div className={styles.statsRow}>
        <StatCard label="Total Members" value={org.totalMembers} suffix=" members" />
        <StatCard label="Avg Score" value={org.overallAverageScore} />
        <StatCard label="WoW Change" value={wowChange > 0 ? `+${wowChange}` : String(wowChange)} suffix="%" change={wowChange} />
        <StatCard label="Skill Gaps" value={uniqueGaps.length} suffix={uniqueGaps.length === 1 ? ' gap' : ' gaps'} />
      </div>

      {/* Team Overview Grid */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Teams</h2>
        <TeamOverviewGrid teams={teams} />
      </section>

      {/* Charts Row */}
      <div className={styles.chartsRow}>
        <Card className={styles.chartCard}>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Type Distribution</h2>
          </CardHeader>
          <CardContent>
            <TypeDistributionChart distribution={orgTypeDistribution} total={members.length} />
          </CardContent>
        </Card>

        <Card className={styles.chartCard}>
          <CardHeader>
            <h2 className={styles.sectionTitle}>Score Trend</h2>
          </CardHeader>
          <CardContent>
            <TrendLineChart data={orgTrend} height={220} />
          </CardContent>
        </Card>
      </div>

      {/* Skill Gap Table */}
      {uniqueGaps.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Skill Gaps</h2>
          <SkillGapTable gaps={uniqueGaps} />
        </section>
      )}
    </div>
  );
}
