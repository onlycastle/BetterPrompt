/**
 * WeeklyInsightsCard Component
 *
 * "This Week" insights dashboard for the Activity tab.
 * Displays a focused view of the user's recent 7-day AI collaboration activity:
 * - StatsBar: 4 metric cards with delta badges (vs previous week)
 * - Narrative: LLM-generated 2-3 sentence summary
 * - ProjectFocusChart: horizontal bar chart showing per-project time allocation
 * - Highlights: LLM-generated bullet list of key accomplishments
 *
 * Hidden entirely when weeklyInsights is undefined (no activity data at all).
 */

import { useMemo } from 'react';
import type { WeeklyInsights } from '../../../../lib/models/weekly-insights';
import styles from './WeeklyInsightsCard.module.css';

// ============================================================================
// Types
// ============================================================================

interface WeeklyInsightsCardProps {
  weeklyInsights?: WeeklyInsights;
}

// ============================================================================
// Formatting Helpers
// ============================================================================

/**
 * Format minutes as human-readable duration (e.g., "8.5h" or "45m")
 */
function formatDuration(minutes: number): string {
  if (minutes >= 60) {
    const hours = Math.round(minutes / 60 * 10) / 10;
    return `${hours}h`;
  }
  return `${Math.round(minutes)}m`;
}

/**
 * Format token count as compact string (e.g., "45K", "1.2M")
 */
function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(1)}M`;
  }
  if (tokens >= 1_000) {
    return `${Math.round(tokens / 1_000)}K`;
  }
  return String(tokens);
}

/**
 * Format a date range label from ISO dates (e.g., "Feb 1 – Feb 7")
 */
function formatWeekRange(start: string, end: string): string {
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const s = new Date(start);
  const e = new Date(end);
  return `${months[s.getMonth()]} ${s.getDate()} \u2013 ${months[e.getMonth()]} ${e.getDate()}`;
}

/**
 * Format a delta value as a display string with arrow indicator
 */
function formatDelta(value: number, isAbsolute = false): { text: string; className: string } {
  if (isAbsolute) {
    if (value > 0) return { text: `+${value}`, className: styles.deltaUp };
    if (value < 0) return { text: `${value}`, className: styles.deltaDown };
    return { text: '0', className: styles.deltaFlat };
  }
  if (value >= 999) return { text: 'New', className: styles.deltaUp };
  if (value > 0) return { text: `\u2191 ${value}%`, className: styles.deltaUp };
  if (value < 0) return { text: `\u2193 ${Math.abs(value)}%`, className: styles.deltaDown };
  return { text: '\u2014', className: styles.deltaFlat };
}

// ============================================================================
// Sub-components
// ============================================================================

function StatCard({
  value,
  label,
  delta,
  isAbsoluteDelta = false,
}: {
  value: string;
  label: string;
  delta?: number;
  isAbsoluteDelta?: boolean;
}) {
  const deltaDisplay = delta !== undefined ? formatDelta(delta, isAbsoluteDelta) : null;

  return (
    <div className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {deltaDisplay && (
        <span className={deltaDisplay.className}>{deltaDisplay.text}</span>
      )}
    </div>
  );
}

function ProjectBar({
  projectName,
  percentage,
  sessionCount,
}: {
  projectName: string;
  percentage: number;
  sessionCount: number;
}) {
  return (
    <div className={styles.projectRow}>
      <span className={styles.projectName} title={projectName}>
        {projectName}
      </span>
      <div className={styles.barContainer}>
        <div
          className={styles.barFill}
          style={{ width: `${Math.max(percentage, 2)}%` }}
        />
      </div>
      <span className={styles.projectMeta}>
        {percentage}% &middot; {sessionCount} {sessionCount === 1 ? 'session' : 'sessions'}
      </span>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function WeeklyInsightsCard({ weeklyInsights }: WeeklyInsightsCardProps) {
  // useMemo must be called unconditionally (Rules of Hooks)
  const weekRangeLabel = useMemo(
    () => weeklyInsights ? formatWeekRange(weeklyInsights.weekRange.start, weeklyInsights.weekRange.end) : '',
    [weeklyInsights?.weekRange.start, weeklyInsights?.weekRange.end]
  );

  // Hide entirely when no data
  if (!weeklyInsights) return null;

  const { stats, comparison, projects, narrative, highlights } = weeklyInsights;
  const hasComparison = comparison !== undefined;

  return (
    <div className={styles.weeklyCard}>
      {/* Header */}
      <div className={styles.header}>
        <h3 className={styles.title}>This Week</h3>
        <span className={styles.dateRange}>{weekRangeLabel}</span>
        {!hasComparison && stats.totalSessions > 0 && (
          <span className={styles.firstWeekBadge}>First week!</span>
        )}
      </div>

      {/* Stats Bar */}
      <div className={styles.statsBar}>
        <StatCard
          value={String(stats.totalSessions)}
          label="sessions"
          delta={hasComparison ? comparison.sessionsDelta : undefined}
        />
        <StatCard
          value={formatDuration(stats.totalMinutes)}
          label="active"
          delta={hasComparison ? comparison.minutesDelta : undefined}
        />
        <StatCard
          value={formatTokens(stats.totalTokens)}
          label="tokens"
          delta={hasComparison ? comparison.tokensDelta : undefined}
        />
        <StatCard
          value={`${stats.activeDays}/7`}
          label="days"
          delta={hasComparison ? comparison.activeDaysDelta : undefined}
          isAbsoluteDelta
        />
      </div>

      {/* Narrative */}
      {narrative && narrative !== 'No AI collaboration activity this week.' && (
        <p className={styles.narrative}>{narrative}</p>
      )}

      {/* Project Focus Chart */}
      {projects.length > 0 && (
        <div className={styles.projectsSection}>
          {projects.map((project) => (
            <ProjectBar
              key={project.projectName}
              projectName={project.projectName}
              percentage={project.percentage}
              sessionCount={project.sessionCount}
            />
          ))}
        </div>
      )}

      {/* Highlights */}
      {highlights.length > 0 && (
        <div className={styles.highlightsSection}>
          <h4 className={styles.highlightsTitle}>Highlights</h4>
          <ul className={styles.highlightList}>
            {highlights.map((highlight, index) => (
              <li key={index} className={styles.highlightItem}>
                <span className={styles.highlightBullet}>&bull;</span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
