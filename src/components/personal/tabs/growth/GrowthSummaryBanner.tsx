/**
 * GrowthSummaryBanner Component
 *
 * Displays a growth summary at the top of the report:
 * - First-time users: "First analysis" badge + CTA for re-analysis
 * - Returning users: "Nth analysis | +X% growth" summary with key dimension changes
 *
 * Placed in the header section of TabbedReportContainer, below TopFocusAreas.
 */

import { ArrowUp, ArrowDown, Minus, TrendingUp } from 'lucide-react';
import type { PersonalAnalytics, DimensionScores } from '../../../../types/personal';
import styles from './GrowthSummaryBanner.module.css';

interface GrowthSummaryBannerProps {
  analytics: PersonalAnalytics | null;
  isLoading?: boolean;
}

/** Dimension display config for growth highlights */
const DIMENSION_LABELS: Record<keyof DimensionScores, string> = {
  aiCollaboration: 'AI Collaboration',
  contextEngineering: 'Context Engineering',
  burnoutRisk: 'Burnout Risk',
  toolMastery: 'Tool Mastery',
  aiControl: 'AI Control',
  skillResilience: 'Skill Resilience',
};

/** Get top N dimension changes sorted by absolute delta */
function getTopChanges(
  improvements: DimensionScores,
  limit: number
): { key: keyof DimensionScores; delta: number; label: string }[] {
  return (Object.entries(improvements) as [keyof DimensionScores, number][])
    .filter(([, delta]) => delta !== 0)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, limit)
    .map(([key, delta]) => ({
      key,
      delta: key === 'burnoutRisk' ? -delta : delta, // Invert burnoutRisk (lower is better)
      label: DIMENSION_LABELS[key],
    }));
}

export function GrowthSummaryBanner({ analytics, isLoading }: GrowthSummaryBannerProps) {
  if (isLoading) return null;

  // First-time user or no analytics
  if (!analytics || analytics.analysisCount <= 1) {
    return (
      <div className={styles.banner}>
        <div className={styles.firstTimeBadge}>
          <span className={styles.badgeIcon}>&#127793;</span>
          <span className={styles.badgeText}>First Analysis</span>
        </div>
        <p className={styles.firstTimeMessage}>
          Run another analysis later to track your growth over time.
        </p>
      </div>
    );
  }

  // Returning user — show growth summary
  const { analysisCount, totalImprovement, dimensionImprovements } = analytics;
  const topChanges = getTopChanges(dimensionImprovements, 3);
  let improvementStyle: string;
  let ImprovementIcon: typeof ArrowUp;
  if (totalImprovement > 0) {
    improvementStyle = styles.positive;
    ImprovementIcon = ArrowUp;
  } else if (totalImprovement === 0) {
    improvementStyle = styles.neutral;
    ImprovementIcon = Minus;
  } else {
    improvementStyle = styles.negative;
    ImprovementIcon = ArrowDown;
  }

  return (
    <div className={`${styles.banner} ${styles.returning}`}>
      <div className={styles.summaryRow}>
        {/* Analysis count badge */}
        <div className={styles.countBadge}>
          <TrendingUp size={14} />
          <span>Analysis #{analysisCount}</span>
        </div>

        {/* Overall improvement */}
        <div className={`${styles.improvementChip} ${improvementStyle}`}>
          <ImprovementIcon size={14} />
          <span>
            {totalImprovement > 0 ? '+' : ''}{totalImprovement}% overall
          </span>
        </div>
      </div>

      {/* Top dimension changes */}
      {topChanges.length > 0 && (
        <div className={styles.changesRow}>
          {topChanges.map(({ key, delta, label }) => (
            <div
              key={key}
              className={`${styles.changeChip} ${delta > 0 ? styles.chipUp : styles.chipDown}`}
            >
              <span className={styles.changeLabel}>{label}</span>
              <span className={styles.changeDelta}>
                {delta > 0 ? '+' : ''}{delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
