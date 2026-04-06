/**
 * MemberDetailContent
 * Manager diagnostic view: continuous scroll through member's full profile.
 * Supports contextual back navigation when accessed via team drill-down.
 *
 * Navigation:
 *   Team drill-down:  Enterprise / [TeamName] / [MemberName]
 *   Members list:     Members / [MemberName]
 *
 * The breadcrumb trail is driven by `backTo` props derived from URL search params
 * (`?from=team&teamId=xxx&teamName=yyy`) — no extra API fetch required.
 */

'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowLeft, ChevronRight, FolderOpen } from 'lucide-react';
import { useMember } from '@/hooks';
import { MemberProfileHeader } from '@/components/enterprise/MemberProfileHeader';
import { MemberDimensionChart } from '@/components/enterprise/MemberDimensionChart';
import { MemberAntiPatternList } from '@/components/enterprise/MemberAntiPatternList';
import { MemberGrowthAreaList } from '@/components/enterprise/MemberGrowthAreaList';
import { StatCard } from '@/components/enterprise/StatCard';
import { TrendLineChart } from '@/components/enterprise/TrendLineChart';
import { ProgressRing } from '@/components/dashboard/ProgressRing';
import { Card } from '@/components/ui/Card';
import type { HistoryEntry } from '@/types/enterprise';
import styles from './MemberDetailContent.module.css';

const DOMAIN_ICONS: Record<string, string> = {
  thinkingQuality: '\u{1F9E0}',
  communicationPatterns: '\u{1F4AC}',
  learningBehavior: '\u{1F4C8}',
  contextEfficiency: '\u26A1',
  sessionOutcome: '\u{1F3AF}',
};

interface MemberDetailContentProps {
  memberId: string;
  /** Navigation context: where the user came from (enables contextual back link) */
  backTo?: {
    /** Source view: 'team' for team detail, 'members' for org member list (default) */
    from: 'team' | 'members';
    /** Team ID when navigating from team view */
    teamId?: string;
    /** Team name for display in the back link */
    teamName?: string;
  };
}

export function MemberDetailContent({ memberId, backTo }: MemberDetailContentProps) {
  const { data: member, isLoading, error } = useMember(memberId);

  // Immediate parent href/label for the back-arrow button
  const backHref = backTo?.from === 'team' && backTo.teamId
    ? `/dashboard/enterprise/team/${backTo.teamId}`
    : '/dashboard/enterprise/members';
  const backLabel = backTo?.from === 'team' && backTo.teamName
    ? `Back to ${backTo.teamName}`
    : 'Back to Members';

  // The member name shown in the breadcrumb trail's final segment.
  // Falls back to '…' while loading so the breadcrumb renders immediately.
  const memberCrumbLabel = isLoading ? '…' : (member?.name ?? memberId);

  /**
   * Team-context breadcrumb — renders in ALL states (loading, error, data).
   *
   * Team drill-down:  Enterprise  ›  [TeamName]  ›  [MemberName]
   * Members list:     Members  ›  [MemberName]
   *
   * The back-arrow at the left navigates to the immediate parent
   * (matches the deepest clickable ancestor in the trail).
   */
  const breadcrumb = (
    <nav className={styles.breadcrumb} aria-label="Breadcrumb">
      <Link href={backHref} className={styles.breadcrumbBack} aria-label={backLabel}>
        <ArrowLeft size={14} />
      </Link>
      <ol className={styles.breadcrumbTrail}>
        {backTo?.from === 'team' && backTo.teamId ? (
          <>
            <li className={styles.breadcrumbItem}>
              <Link href="/dashboard/enterprise" className={styles.breadcrumbLink}>
                Enterprise
              </Link>
            </li>
            <li className={styles.breadcrumbSep} aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li className={styles.breadcrumbItem}>
              <Link
                href={`/dashboard/enterprise/team/${backTo.teamId}`}
                className={styles.breadcrumbLink}
              >
                {backTo.teamName ?? 'Team'}
              </Link>
            </li>
            <li className={styles.breadcrumbSep} aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li className={styles.breadcrumbItem}>
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {memberCrumbLabel}
              </span>
            </li>
          </>
        ) : (
          <>
            <li className={styles.breadcrumbItem}>
              <Link href="/dashboard/enterprise/members" className={styles.breadcrumbLink}>
                Members
              </Link>
            </li>
            <li className={styles.breadcrumbSep} aria-hidden="true">
              <ChevronRight size={12} />
            </li>
            <li className={styles.breadcrumbItem}>
              <span className={styles.breadcrumbCurrent} aria-current="page">
                {memberCrumbLabel}
              </span>
            </li>
          </>
        )}
      </ol>
    </nav>
  );

  // Convert weeklyTokenTrend to HistoryEntry format for TrendLineChart
  const tokenTrendData: HistoryEntry[] = useMemo(() => {
    if (!member) return [];
    return member.tokenUsage.weeklyTokenTrend.map(wt => ({
      date: wt.weekStart,
      overallScore: Math.round(wt.totalTokens / 1000), // Show in K units for chart scale
    }));
  }, [member]);

  if (isLoading) {
    return (
      <div className={styles.container}>
        {breadcrumb}
        <p>Loading member...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        {breadcrumb}
        <p>Failed to load member: {error.message}</p>
      </div>
    );
  }

  if (!member) {
    return (
      <div className={styles.container}>
        {breadcrumb}
        <div className={styles.notFound}>
          <h2>Member not found</h2>
          <p>The member you are looking for does not exist or has been removed.</p>
        </div>
      </div>
    );
  }

  const formatDelta = (value: number) => (value > 0 ? `+${value}` : String(value));
  const getDeltaClass = (value: number) =>
    value > 0 ? styles.deltaPositive : value < 0 ? styles.deltaNegative : styles.deltaNeutral;

  return (
    <div className={styles.container}>
      {/* Team-context breadcrumb — full hierarchy path with back-arrow */}
      {breadcrumb}

      {/* Section 0: Member Profile Header */}
      <MemberProfileHeader member={member} />

      {/* Stat Cards */}
      <div className={styles.statsRow}>
        <StatCard label="Total Sessions" value={member.tokenUsage.totalSessions} />
        <StatCard label="Avg Context Fill" value={member.tokenUsage.avgContextFillPercent} suffix="%" />
        <StatCard label="Anti-Patterns" value={member.antiPatterns.length} />
        <StatCard label="Projects Active" value={member.projects.length} />
      </div>

      {/* Section 1: Score History */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Score History</h3>
        <Card>
          <TrendLineChart data={member.history} height={220} />
        </Card>
        <div className={styles.dimensionChartWrapper}>
          <MemberDimensionChart dimensions={member.dimensions} />
        </div>
      </section>

      {/* Section 1b: Growth Areas — PEA format */}
      {member.growthAreas.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Growth Areas</h3>
          <MemberGrowthAreaList growthAreas={member.growthAreas} />
        </section>
      )}

      {/* Section 2: Strengths Overview */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Strengths Overview</h3>
        <div className={styles.strengthsGrid}>
          {member.strengthSummaries.map(s => (
            <Card key={s.domain} className={styles.strengthCard}>
              <div className={styles.strengthHeader}>
                <span className={styles.strengthIcon}>{DOMAIN_ICONS[s.domain] ?? '\u{1F4CA}'}</span>
                <span className={styles.strengthLabel}>{s.domainLabel}</span>
              </div>
              <div className={styles.strengthScore}>
                <ProgressRing value={s.domainScore} size={48} strokeWidth={4} />
              </div>
              <p className={styles.strengthText}>{s.topStrength}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Section 3: Token Usage */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Token Usage</h3>
        <Card>
          <TrendLineChart data={tokenTrendData} height={200} />
        </Card>
        <div className={styles.tokenMetrics}>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Total Messages</span>
            <span className={styles.metricValue}>{member.tokenUsage.totalMessages.toLocaleString()}</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Max Context Fill</span>
            <span className={styles.metricValue}>{member.tokenUsage.maxContextFillPercent}%</span>
          </div>
          <div className={styles.metricItem}>
            <span className={styles.metricLabel}>Exceeded 90%</span>
            <span className={styles.metricValue}>{member.tokenUsage.contextFillExceeded90Count} times</span>
          </div>
          {/* Context fill bar */}
          <div className={styles.contextFillBar}>
            <span className={styles.metricLabel}>Avg / Max Fill</span>
            <div className={styles.fillBarTrack}>
              <div
                className={styles.fillBarAvg}
                style={{ width: `${member.tokenUsage.avgContextFillPercent}%` }}
              />
              <div
                className={styles.fillBarMax}
                style={{ left: `${member.tokenUsage.maxContextFillPercent}%` }}
              />
              <div className={styles.fillBarThreshold} />
            </div>
          </div>
        </div>
      </section>

      {/* Section 4: Anti-Patterns */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Anti-Patterns</h3>
        <Card>
          <MemberAntiPatternList antiPatterns={member.antiPatterns} />
        </Card>
      </section>

      {/* Section 5: Project Activity */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Project Activity</h3>
        <div className={styles.projectsGrid}>
          {member.projects
            .sort((a, b) => b.sessionCount - a.sessionCount)
            .map(p => (
              <Card key={p.projectName} className={styles.projectCard}>
                <div className={styles.projectHeader}>
                  <FolderOpen size={16} className={styles.projectIcon} />
                  <span className={styles.projectName}>{p.projectName}</span>
                </div>
                <div className={styles.projectMeta}>
                  <span>{p.sessionCount} sessions</span>
                  <span className={styles.projectDate}>Last: {p.lastActiveDate}</span>
                </div>
                {p.summaryLines.slice(0, 2).map((line, i) => (
                  <p key={i} className={styles.projectSummary}>{line}</p>
                ))}
              </Card>
            ))}
        </div>
      </section>

      {/* Section 6: Growth Tracking */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>Growth Tracking</h3>
        <Card>
          <div className={styles.growthComparison}>
            <div className={styles.growthColumn}>
              <span className={styles.growthLabel}>Current</span>
              <ProgressRing value={member.growth.currentScore} size={56} strokeWidth={4} />
            </div>
            <div className={styles.growthColumn}>
              <span className={styles.growthLabel}>Prev Week</span>
              <ProgressRing value={member.growth.previousWeekScore} size={56} strokeWidth={4} />
              <span className={getDeltaClass(member.growth.weekOverWeekDelta)}>
                {formatDelta(member.growth.weekOverWeekDelta)} WoW
              </span>
            </div>
            <div className={styles.growthColumn}>
              <span className={styles.growthLabel}>Prev Month</span>
              <ProgressRing value={member.growth.previousMonthScore} size={56} strokeWidth={4} />
              <span className={getDeltaClass(member.growth.monthOverMonthDelta)}>
                {formatDelta(member.growth.monthOverMonthDelta)} MoM
              </span>
            </div>
          </div>
        </Card>
      </section>
    </div>
  );
}
