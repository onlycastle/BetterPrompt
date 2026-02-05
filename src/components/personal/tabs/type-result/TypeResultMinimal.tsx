/**
 * TypeResultMinimal Component
 * Notion/Linear style minimal type result display
 */

import { useMemo } from 'react';
import { VERBOSE_TYPE_METADATA } from '../../../../types/verbose';
import type { CodingStyleType, AIControlLevel, TypeDistribution, MatrixDistribution } from '../../../../types/verbose';
import { MATRIX_NAMES, MATRIX_METADATA, deriveMatrixDistribution } from '../../../../lib/models/coding-style';
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

  // Derive the final matrix type (the user's specific 5×3 personality type)
  const matrixType = useMemo(() => {
    const matrix = matrixDistribution
      ?? deriveMatrixDistribution(distribution, controlLevel, controlScore);
    const levels: AIControlLevel[] = ['cartographer', 'navigator', 'explorer'];
    let dominantLevel: AIControlLevel = controlLevel;
    let maxPct = 0;
    for (const level of levels) {
      const key = `${primaryType}_${level}` as keyof MatrixDistribution;
      const pct = matrix[key] || 0;
      if (pct > maxPct) { maxPct = pct; dominantLevel = level; }
    }
    return {
      name: MATRIX_NAMES[primaryType][dominantLevel],
      ...MATRIX_METADATA[primaryType][dominantLevel],
    };
  }, [primaryType, controlLevel, controlScore, distribution, matrixDistribution]);

  return (
    <div className={styles.container}>
      {/* Hero Section - shows specific matrix type (e.g., "The Strategist") */}
      <div className={styles.hero}>
        <div className={styles.emoji}>{matrixType.emoji}</div>
        <div className={styles.typeInfo}>
          <h2 className={styles.typeName}>The {matrixType.name}</h2>
          <p className={styles.tagline}>{meta.tagline}</p>
        </div>
      </div>

      {/* Description from matrix type */}
      <p className={styles.description}>{matrixType.description}</p>

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
