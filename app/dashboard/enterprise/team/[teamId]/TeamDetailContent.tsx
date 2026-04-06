/**
 * TeamDetailContent
 * Assembles team detail view: header, charts, type distribution, member table,
 * and growth areas — all with drill-down navigation to individual member detail reports.
 *
 * Cross-developer pattern detection and manager recommendations are fetched
 * from the server-side analysis endpoint (GET /api/teams/[teamId]/analysis)
 * via useTeamAnalysis(). This ensures patterns and recommendations are always
 * derived from the same member dataset and co-located in a single response.
 */

'use client';

import { useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTeam, useTeamMembers, useTeamAnalysis } from '@/hooks';
import { aggregateGrowthAreas } from '@/lib/enterprise/aggregation';
import { TeamHeader } from '@/components/enterprise/TeamHeader';
import { StatCard } from '@/components/enterprise/StatCard';
import { TypeDistributionChart } from '@/components/enterprise/TypeDistributionChart';
import { MemberTable } from '@/components/enterprise/MemberTable';
import { CommonGrowthAreas } from '@/components/enterprise/CommonGrowthAreas';
import { CrossDeveloperPatterns } from '@/components/enterprise/CrossDeveloperPatterns';
import { TeamRecommendations } from '@/components/enterprise/TeamRecommendations';
import { GrowthLeaderboard } from '@/components/enterprise/GrowthLeaderboard';
import { TrendLineChart } from '@/components/enterprise/TrendLineChart';
import { RadarChart } from '@/components/personal/tabs/type-result/RadarChart';
import { Card, CardHeader, CardContent } from '@/components/ui/Card';
import { DIMENSION_METADATA } from '@/types/enterprise';
import type { DimensionScores, TeamMemberAnalysis } from '@/types/enterprise';
import styles from './TeamDetailContent.module.css';

export function TeamDetailContent({ teamId }: { teamId: string }) {
  const { data: team, isLoading: teamLoading, error: teamError } = useTeam(teamId);
  const { data: members, isLoading: membersLoading } = useTeamMembers(teamId);
  const {
    data: analysis,
    isLoading: analysisLoading,
    error: analysisError,
  } = useTeamAnalysis(teamId);
  const router = useRouter();

  // Navigate to individual member detail report with team context for back navigation
  const handleMemberClick = useCallback((member: TeamMemberAnalysis) => {
    router.push(`/dashboard/enterprise/members/${member.id}?from=team&teamId=${teamId}&teamName=${encodeURIComponent(team?.teamName ?? '')}`);
  }, [router, teamId, team?.teamName]);

  // Resolve member name → member detail navigation (used by CommonGrowthAreas drill-down)
  const handleMemberNameClick = useCallback((memberName: string) => {
    const member = members?.find(m => m.name === memberName);
    if (member) {
      handleMemberClick(member);
    }
  }, [members, handleMemberClick]);

  // Base (title-exact) growth areas for the CommonGrowthAreas section.
  // These are computed client-side from the members array (fast, synchronous).
  // Cross-developer PEA patterns with tag clustering live in `analysis.patterns`
  // (fetched server-side alongside LLM recommendations).
  const teamGrowthAreas = (members && members.length > 0)
    ? aggregateGrowthAreas(members)
    : [];

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

      {/* Growth Leaderboard — clickable rows navigate to member detail */}
      {members && members.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Growth Leaderboard</h2>
          <Card>
            <CardContent>
              <GrowthLeaderboard
                members={members}
                onMemberClick={handleMemberClick}
                getHref={(member) =>
                  `/dashboard/enterprise/members/${member.id}?from=team&teamId=${teamId}&teamName=${encodeURIComponent(team?.teamName ?? '')}`
                }
              />
            </CardContent>
          </Card>
        </section>
      )}

      {/* Team Action Plan — LLM-powered or deterministic recommendations.
          Both patterns and recommendations come from the same server-side
          analysis response (useTeamAnalysis). analysisError propagates visibly. */}
      {analysisError ? (
        <section className={styles.section}>
          <p className={styles.errorText}>
            Failed to load team analysis: {analysisError.message}
          </p>
        </section>
      ) : analysisLoading ? (
        <section className={styles.section}>
          <p>Loading team analysis...</p>
        </section>
      ) : (
        <>
          {analysis && analysis.recommendations.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>
                Team Action Plan
                {analysis.recommendationSource === 'llm' && (
                  <span className={styles.llmBadge} title="AI-generated recommendations">
                    AI
                  </span>
                )}
              </h2>
              <TeamRecommendations
                items={analysis.recommendations}
                onMemberClick={handleMemberNameClick}
              />
            </section>
          )}

          {/* Cross-Developer Patterns — PEA format with "X of Y devs" count badges and category tags */}
          {analysis && analysis.patterns.length > 0 && members && (
            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Cross-Developer Patterns</h2>
              <CrossDeveloperPatterns
                patterns={analysis.patterns}
                totalMembers={analysis.totalMembers}
                onMemberClick={handleMemberNameClick}
              />
            </section>
          )}
        </>
      )}

      {/* Common Growth Areas — exact-title aggregates, clickable member names */}
      {teamGrowthAreas.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Common Growth Areas</h2>
          <CommonGrowthAreas areas={teamGrowthAreas} onMemberClick={handleMemberNameClick} />
        </section>
      )}

      {/* Member Table — clickable rows navigate to individual member detail report */}
      {members && members.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Members</h2>
          <MemberTable
            members={members}
            onRowClick={handleMemberClick}
            getHref={(member) =>
              `/dashboard/enterprise/members/${member.id}?from=team&teamId=${teamId}&teamName=${encodeURIComponent(team?.teamName ?? '')}`
            }
          />
        </section>
      )}
    </div>
  );
}
