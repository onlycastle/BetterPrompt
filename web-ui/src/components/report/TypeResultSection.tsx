import styles from './TypeResultSection.module.css';
import type { CodingStyleType, TypeDistribution } from '../../types/report';

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
}

/**
 * Main type result display with emoji, title, and distribution chart
 * The hero section showing "YOU ARE THE ARCHITECT"
 */
export function TypeResultSection({ typeResult, typeMetadata }: TypeResultSectionProps) {
  const meta = typeMetadata[typeResult.primaryType];
  const types: CodingStyleType[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];

  return (
    <div className={styles.resultBox}>
      {/* Main Type Display */}
      <div className={styles.resultEmoji}>{meta.emoji}</div>
      <div className={styles.resultTitle}>YOU ARE {meta.name.toUpperCase()}</div>
      <div className={styles.resultTagline}>"{meta.tagline}"</div>

      {/* Distribution Chart */}
      <div className={styles.distribution}>
        <div className={styles.subsectionTitle}>📊 Style Distribution</div>
        {types.map((type) => {
          const typeMeta = typeMetadata[type];
          const pct = typeResult.distribution[type] || 0;
          const isPrimary = type === typeResult.primaryType;

          return (
            <div
              key={type}
              className={`${styles.distributionRow} ${isPrimary ? styles.primary : ''}`}
            >
              <span className={styles.distributionEmoji}>{typeMeta.emoji}</span>
              <span className={styles.distributionName}>{typeMeta.name}</span>
              <div className={styles.distributionBar}>
                <div
                  className={styles.distributionFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={styles.distributionPct}>{pct}%</span>
              <span className={styles.distributionMarker}>{isPrimary ? '◀' : ''}</span>
            </div>
          );
        })}
      </div>

      {/* Session Metrics */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>{typeResult.sessionCount}</div>
          <div className={styles.metricLabel}>Sessions Analyzed</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>
            {Math.round(typeResult.metrics.avgTurnsPerSession)}
          </div>
          <div className={styles.metricLabel}>Avg Turns/Session</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricValue}>
            {Math.round(typeResult.metrics.avgPromptLength)}
          </div>
          <div className={styles.metricLabel}>Avg Prompt Length</div>
        </div>
      </div>
    </div>
  );
}
