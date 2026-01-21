import styles from './TypeResultSection.module.css';
import type {
  CodingStyleType,
  TypeDistribution,
  AIControlLevel,
  TypeSynthesisOutput,
} from '../../types/report';
import { MATRIX_NAMES, MATRIX_METADATA, CONTROL_LEVEL_METADATA } from '../../types/report';

interface TypeResult {
  primaryType: CodingStyleType;
  controlLevel: AIControlLevel;
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
  /** Optional TypeSynthesis output for refined classification */
  typeSynthesis?: TypeSynthesisOutput;
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

// TypeSynthesis was introduced on 2025-01-20
// Results analyzed before this date don't have typeSynthesis and should use fallback
const TYPE_SYNTHESIS_RELEASE_DATE = '2025-01-20T00:00:00Z';

/**
 * Main type result display with 15-type matrix classification
 * Shows matrix name (e.g., "Systems Architect") instead of just base type
 */
export function TypeResultSection({ typeResult, typeMetadata }: TypeResultSectionProps) {
  const { primaryType, controlLevel, typeSynthesis, analyzedAt } = typeResult;

  // Check if this is legacy data (analyzed before TypeSynthesis was introduced)
  const isLegacyData = new Date(analyzedAt) < new Date(TYPE_SYNTHESIS_RELEASE_DATE);

  // For NEW data (post-release), typeSynthesis is REQUIRED
  // This ensures consistent 15-type matrix classification
  if (!isLegacyData && !typeSynthesis) {
    throw new Error(
      'TypeSynthesis data is missing for new analysis result. ' +
      'This indicates a backend error - analysis should have failed if TypeSynthesis was unavailable.'
    );
  }

  // Use TypeSynthesis output if available, otherwise fall back to static mapping (legacy data only)
  const matrixName = typeSynthesis?.matrixName ?? MATRIX_NAMES[primaryType][controlLevel];
  const matrixEmoji = typeSynthesis?.matrixEmoji ?? MATRIX_METADATA[primaryType][controlLevel].emoji;
  const matrixDescription = MATRIX_METADATA[primaryType][controlLevel].description;
  const controlMeta = CONTROL_LEVEL_METADATA[controlLevel];

  const types: CodingStyleType[] = ['architect', 'scientist', 'collaborator', 'speedrunner', 'craftsman'];

  return (
    <div className={styles.resultBox}>
      {/* Main Type Display - 15-Type Matrix */}
      <div className={styles.resultEmoji}>{matrixEmoji}</div>
      <div className={styles.resultTitle}>YOU ARE THE {matrixName.toUpperCase()}</div>
      <div className={styles.controlBadge} data-level={controlLevel}>
        {controlMeta.name}
      </div>
      <div className={styles.resultTagline}>"{matrixDescription}"</div>

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
