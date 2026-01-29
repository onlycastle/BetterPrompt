import styles from './TypeResultSection.module.css';
import type { CodingStyleType, AIControlLevel, TypeDistribution, MatrixDistribution } from '../../types/report';
import { MatrixDistributionDisplay } from '../personal/tabs';

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
  /** User's control level (optional, defaults to 'developing') */
  controlLevel?: AIControlLevel;
  /** Control score 0-100 (optional, defaults to 50) */
  controlScore?: number;
  /** Pre-computed matrix distribution (optional) */
  matrixDistribution?: MatrixDistribution;
}

/**
 * Main type result display with emoji, title, and distribution chart
 * The hero section showing "YOU ARE THE ARCHITECT"
 */
export function TypeResultSection({
  typeResult,
  typeMetadata,
  controlLevel = 'navigator',
  controlScore = 50,
  matrixDistribution,
}: TypeResultSectionProps) {
  const meta = typeMetadata[typeResult.primaryType];

  return (
    <div className={styles.resultBox}>
      {/* Main Type Display */}
      <div className={styles.resultEmoji}>{meta.emoji}</div>
      <div className={styles.resultTitle}>YOU ARE {meta.name.toUpperCase()}</div>
      <div className={styles.resultTagline}>"{meta.tagline}"</div>

      {/* Matrix Distribution (5×3) */}
      <div className={styles.distribution}>
        <div className={styles.subsectionTitle}>📊 Style Matrix</div>
        <MatrixDistributionDisplay
          distribution={typeResult.distribution}
          primaryType={typeResult.primaryType}
          controlLevel={controlLevel}
          controlScore={controlScore}
          matrixDistribution={matrixDistribution}
          compact
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
