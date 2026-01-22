/**
 * TypeResultMinimal Component
 * Notion/Linear style minimal type result display
 */

import { VERBOSE_TYPE_METADATA } from '../../../types/verbose';
import type { CodingStyleType, AIControlLevel, TypeDistribution, MatrixDistribution } from '../../../types/verbose';
import { MatrixDistributionDisplay } from './MatrixDistributionDisplay';
import styles from './TypeResultMinimal.module.css';

interface TypeResultMinimalProps {
  primaryType: CodingStyleType;
  distribution: TypeDistribution;
  sessionsAnalyzed: number;
  /** User's control level (optional, defaults to 'developing') */
  controlLevel?: AIControlLevel;
  /** Control score 0-100 (optional, defaults to 50) */
  controlScore?: number;
  /** Pre-computed matrix distribution (optional, will derive if not provided) */
  matrixDistribution?: MatrixDistribution;
}

export function TypeResultMinimal({
  primaryType,
  distribution,
  sessionsAnalyzed,
  controlLevel = 'navigator',
  controlScore = 50,
  matrixDistribution,
}: TypeResultMinimalProps) {
  const meta = VERBOSE_TYPE_METADATA[primaryType];

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.emoji}>{meta.emoji}</div>
        <div className={styles.typeInfo}>
          <h2 className={styles.typeName}>{meta.name}</h2>
          <p className={styles.tagline}>{meta.tagline}</p>
        </div>
      </div>

      {/* Description */}
      <p className={styles.description}>{meta.description}</p>

      {/* Strengths */}
      <div className={styles.strengths}>
        {meta.strengths.map((strength, idx) => (
          <span key={idx} className={styles.strengthBadge}>
            {strength}
          </span>
        ))}
      </div>

      {/* Matrix Distribution (5×3) */}
      <MatrixDistributionDisplay
        distribution={distribution}
        primaryType={primaryType}
        controlLevel={controlLevel}
        controlScore={controlScore}
        matrixDistribution={matrixDistribution}
      />

      {/* Sessions analyzed */}
      <div className={styles.footer}>
        <span className={styles.sessionsLabel}>
          Based on {sessionsAnalyzed} session{sessionsAnalyzed !== 1 ? 's' : ''} analyzed
        </span>
      </div>
    </div>
  );
}

export default TypeResultMinimal;
