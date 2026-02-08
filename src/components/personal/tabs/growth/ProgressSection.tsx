/**
 * ProgressSection Component
 *
 * Displays growth tracking data within the continuous scroll report layout.
 * Adapted from ProgressTab for inline rendering (not a standalone tab).
 *
 * Shows:
 * - Score comparison (first vs latest) for returning users
 * - Trend line chart (bezier curve, limited for free users)
 * - Dimension improvement highlights
 *
 * For first-time users, shows a placeholder with "your growth curve will appear here".
 */

import { Lock, TrendingUp, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { TrendLineChart } from '../../../enterprise';
import type { PersonalAnalytics, DimensionScores } from '../../../../types/personal';
import styles from './ProgressSection.module.css';

interface ProgressSectionProps {
  analytics: PersonalAnalytics | null;
  isPaid?: boolean;
}

const DIMENSION_LABELS: Record<keyof DimensionScores, { label: string; icon: string }> = {
  aiCollaboration: { label: 'AI Collaboration', icon: '🤝' },
  contextEngineering: { label: 'Context Engineering', icon: '⚡' },
  burnoutRisk: { label: 'Sustainability', icon: '🔋' },
  toolMastery: { label: 'Tool Mastery', icon: '🛠️' },
  aiControl: { label: 'AI Control', icon: '🎯' },
  skillResilience: { label: 'Skill Resilience', icon: '💪' },
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getDeltaStyle(delta: number): string {
  if (delta > 0) return styles.deltaPositive;
  if (delta < 0) return styles.deltaNegative;
  return styles.deltaNeutral;
}

function DeltaIcon({ delta }: { delta: number }) {
  if (delta > 0) return <ArrowUp size={16} />;
  if (delta < 0) return <ArrowDown size={16} />;
  return <Minus size={16} />;
}

function getDimDeltaStyle(delta: number): string {
  if (delta > 0) return styles.dimUp;
  if (delta < 0) return styles.dimDown;
  return styles.dimFlat;
}

export function ProgressSection({ analytics, isPaid = false }: ProgressSectionProps) {
  // First-time user placeholder
  if (!analytics || analytics.analysisCount <= 1) {
    return (
      <div className={styles.container}>
        <div className={styles.sectionHeader}>
          <TrendingUp size={18} className={styles.headerIcon} />
          <h3 className={styles.title}>Growth Tracking</h3>
        </div>
        <div className={styles.placeholder}>
          <div className={styles.placeholderChart}>
            <svg width="100%" height="80" viewBox="0 0 400 80" preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="placeholderGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="var(--sketch-cyan)" stopOpacity="0.1" />
                  <stop offset="100%" stopColor="var(--sketch-cyan)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M 20,60 Q 100,55 200,40 Q 300,25 380,20"
                fill="none"
                stroke="var(--ink-light)"
                strokeWidth="2"
                strokeDasharray="6 4"
              />
              <path
                d="M 20,60 Q 100,55 200,40 Q 300,25 380,20 L 380,80 L 20,80 Z"
                fill="url(#placeholderGrad)"
              />
            </svg>
          </div>
          <p className={styles.placeholderText}>
            Your growth curve will appear here after your next analysis.
          </p>
        </div>
      </div>
    );
  }

  // Returning user — show actual progress data
  const chartData = isPaid ? analytics.history : analytics.history.slice(-3);
  const showFullHistoryUpsell = !isPaid && analytics.history.length > 3;

  // Build dimension change list
  const dimensionChanges = (Object.entries(analytics.dimensionImprovements) as [keyof DimensionScores, number][])
    .map(([key, rawDelta]) => ({
      key,
      delta: key === 'burnoutRisk' ? -rawDelta : rawDelta,
      ...DIMENSION_LABELS[key],
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <TrendingUp size={18} className={styles.headerIcon} />
        <h3 className={styles.title}>Growth Tracking</h3>
        <span className={styles.subtitle}>
          {analytics.analysisCount} analyses since {formatDate(analytics.firstAnalysisDate)}
        </span>
      </div>

      {/* Score comparison cards */}
      <div className={styles.scoreRow}>
        <div className={styles.scoreCard}>
          <div className={styles.scoreLabel}>First</div>
          <div className={styles.scoreValue}>{analytics.firstAnalysis.overallScore}</div>
          <div className={styles.scoreDate}>{formatDate(analytics.firstAnalysis.date)}</div>
        </div>

        <div className={`${styles.deltaCard} ${
          getDeltaStyle(analytics.totalImprovement)
        }`}>
          <DeltaIcon delta={analytics.totalImprovement} />
          <span className={styles.deltaValue}>
            {analytics.totalImprovement > 0 ? '+' : ''}{analytics.totalImprovement}
          </span>
        </div>

        <div className={styles.scoreCard}>
          <div className={styles.scoreLabel}>Latest</div>
          <div className={styles.scoreValue}>{analytics.latestAnalysis.overallScore}</div>
          <div className={styles.scoreDate}>{formatDate(analytics.latestAnalysis.date)}</div>
        </div>
      </div>

      {/* Trend chart */}
      <div className={styles.chartContainer}>
        <div className={styles.chartLabel}>
          {isPaid ? 'Score trend' : `Last ${chartData.length} analyses`}
        </div>
        <TrendLineChart data={chartData} height={200} />
        {showFullHistoryUpsell && (
          <div className={styles.upsell}>
            <Lock size={12} />
            <span>Full history ({analytics.history.length} analyses) available with Premium</span>
          </div>
        )}
      </div>

      {/* Dimension changes grid */}
      {dimensionChanges.some(d => d.delta !== 0) && (
        <div className={styles.dimensionGrid}>
          <h4 className={styles.dimensionTitle}>Dimension Changes</h4>
          <div className={styles.dimensionList}>
            {dimensionChanges.map(({ key, delta, label, icon }) => (
              <div key={key} className={styles.dimensionItem}>
                <span className={styles.dimIcon}>{icon}</span>
                <span className={styles.dimLabel}>{label}</span>
                <span className={`${styles.dimDelta} ${getDimDeltaStyle(delta)}`}>
                  {delta > 0 ? '+' : ''}{delta}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Streak info */}
      {analytics.journey.currentStreak > 1 && (
        <div className={styles.streakBadge}>
          <span className={styles.streakFlame}>&#128293;</span>
          <span>{analytics.journey.currentStreak}-analysis streak</span>
          {analytics.journey.longestStreak > analytics.journey.currentStreak && (
            <span className={styles.streakRecord}>
              (best: {analytics.journey.longestStreak})
            </span>
          )}
        </div>
      )}
    </div>
  );
}
