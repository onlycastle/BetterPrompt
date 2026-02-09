import styles from './TypeResultSection.module.css';
import type { CodingStyleType, TypeDistribution } from '../../types/report';
import { DualRadarCharts } from '../personal/tabs/type-result/DualRadarCharts';

interface TypeResult {
  primaryType: CodingStyleType;
  distribution: TypeDistribution;
  metrics: {
    avgPromptLength: number;
    avgFirstPromptLength: number;
    avgTurnsPerSession: number;
    questionFrequency: number;
    modificationRate: number;
    toolUsageHighlight: string;
  };
  sessionCount: number;
  analyzedAt: string;
}

interface TypeMetadata {
  emoji: string;
  name: string;
  tagline: string;
  description?: string;
}

interface TypeResultSectionProps {
  typeResult: TypeResult;
  typeMetadata: Record<CodingStyleType, TypeMetadata>;
  /** Control score 0-100 (optional, defaults to 50) */
  controlScore?: number;
}

/**
 * Main type result display with emoji, title, and distribution chart
 * The hero section showing "YOU ARE THE ARCHITECT"
 */
export function TypeResultSection({
  typeResult,
  typeMetadata,
  controlScore = 50,
}: TypeResultSectionProps) {
  const meta = typeMetadata[typeResult.primaryType];

  return (
    <div className={styles.resultBox}>
      {/* Main Type Display */}
      <div className={styles.resultEmoji}>{meta.emoji}</div>
      <div className={styles.resultTitle}>YOU ARE {meta.name.toUpperCase()}</div>
      <div className={styles.resultTagline}>"{meta.tagline}"</div>

      {/* Style DNA Radar */}
      <div className={styles.distribution}>
        <DualRadarCharts
          distribution={typeResult.distribution}
          primaryType={typeResult.primaryType}
          controlScore={controlScore}
        />
      </div>

      {/* Session Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{typeResult.sessionCount}</div>
          <div className={styles.metricLabel}>Sessions Analyzed</div>
        </div>
        {typeResult.metrics.avgTurnsPerSession > 0 && (
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>
              {Math.round(typeResult.metrics.avgTurnsPerSession)}
            </div>
            <div className={styles.metricLabel}>Avg Turns/Session</div>
          </div>
        )}
        {typeResult.metrics.avgPromptLength > 0 && (
          <div className={styles.metricCard}>
            <div className={styles.metricValue}>
              {Math.round(typeResult.metrics.avgPromptLength)}
            </div>
            <div className={styles.metricLabel}>Avg Prompt Length</div>
          </div>
        )}
      </div>
    </div>
  );
}
