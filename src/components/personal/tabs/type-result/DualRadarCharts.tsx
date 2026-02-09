/**
 * DualRadarCharts - Side-by-side radar charts for Style DNA and Skill Scores
 *
 * Left pentagon: 5 coding style distribution (architect, analyst, conductor, speedrunner, trendsetter)
 * Right pentagon: 5 capability scores (Thinking, Communication, Learning, Context, Control)
 *
 * When workerInsights is unavailable, only the left chart is shown centered.
 */

import { useMemo } from 'react';
import type { TypeDistribution, CodingStyleType } from '../../../../types/verbose';
import type { AggregatedWorkerInsights } from '../../../../lib/models/worker-insights';
import { TYPE_METADATA } from '../../../../lib/models/coding-style';
import { RadarChart } from './RadarChart';
import styles from './DualRadarCharts.module.css';

interface DualRadarChartsProps {
  /** 5-value type distribution (architect/analyst/conductor/speedrunner/trendsetter) */
  distribution: TypeDistribution;
  /** Primary coding style type */
  primaryType: CodingStyleType;
  /** Control score (0-100) */
  controlScore?: number;
  /** Aggregated worker insights (may be undefined for cached/legacy data) */
  workerInsights?: AggregatedWorkerInsights;
}

/** Style axis order matching the pentagon layout */
const STYLE_KEYS: CodingStyleType[] = ['architect', 'analyst', 'conductor', 'speedrunner', 'trendsetter'];

/** Style axis labels derived from metadata */
const STYLE_LABELS = STYLE_KEYS.map(key => TYPE_METADATA[key].name);

/** Skill axis labels */
const SKILL_LABELS = ['Thinking', 'Communication', 'Learning', 'Context', 'Control'];

export function DualRadarCharts({
  distribution,
  primaryType,
  controlScore = 50,
  workerInsights,
}: DualRadarChartsProps) {
  // Transform distribution to ordered array matching STYLE_KEYS
  const styleData = useMemo(
    () => STYLE_KEYS.map(key => distribution[key] || 0),
    [distribution],
  );

  // Transform worker insights to skill scores array
  const skillData = useMemo(() => {
    if (!workerInsights) return null;

    const thinking = workerInsights.thinkingQuality?.domainScore;
    const communication = workerInsights.communicationPatterns?.domainScore;
    const learning = workerInsights.learningBehavior?.domainScore;
    const context = workerInsights.contextEfficiency?.domainScore;

    // Need at least one score to render the skills radar
    if (thinking == null && communication == null && learning == null && context == null) {
      return null;
    }

    return [
      thinking ?? 0,
      communication ?? 0,
      learning ?? 0,
      context ?? 0,
      controlScore,
    ];
  }, [workerInsights, controlScore]);

  const hasSkills = skillData !== null;

  return (
    <div className={styles.container}>
      <div className={`${styles.chartsGrid} ${!hasSkills ? styles.singleChart : ''}`}>
        {/* Left: Style DNA */}
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h4 className={styles.chartTitle}>Style DNA</h4>
            <span className={styles.chartSubtitle}>
              {TYPE_METADATA[primaryType].emoji} {TYPE_METADATA[primaryType].name}
            </span>
          </div>
          <RadarChart
            data={styleData}
            labels={STYLE_LABELS}
            color="var(--sketch-cyan)"
            ariaLabel={`Style DNA radar chart. Primary type: ${primaryType}`}
          />
        </div>

        {/* Right: Skill Scores (conditional) */}
        {hasSkills && (
          <div className={styles.chartCard}>
            <div className={styles.chartHeader}>
              <h4 className={styles.chartTitle}>Skill Scores</h4>
              <span className={styles.chartSubtitle}>5 capability axes</span>
            </div>
            <RadarChart
              data={skillData}
              labels={SKILL_LABELS}
              color="var(--sketch-green)"
              ariaLabel="Skill Scores radar chart showing thinking, communication, learning, context, and control scores"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export default DualRadarCharts;
