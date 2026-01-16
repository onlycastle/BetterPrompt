/**
 * TypeResultMinimal Component
 * Notion/Linear style minimal type result display
 */

import { Card } from '../../ui/Card';
import { VERBOSE_TYPE_METADATA } from '../../../types/verbose';
import type { CodingStyleType, TypeDistribution } from '../../../types/verbose';
import styles from './TypeResultMinimal.module.css';

interface TypeResultMinimalProps {
  primaryType: CodingStyleType;
  distribution: TypeDistribution;
  sessionsAnalyzed: number;
}

const STYLE_TYPES: CodingStyleType[] = [
  'architect',
  'scientist',
  'collaborator',
  'speedrunner',
  'craftsman',
];

export function TypeResultMinimal({
  primaryType,
  distribution,
  sessionsAnalyzed,
}: TypeResultMinimalProps) {
  const meta = VERBOSE_TYPE_METADATA[primaryType];

  return (
    <Card padding="lg" className={styles.container}>
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

      {/* Distribution */}
      <div className={styles.distributionSection}>
        <h4 className={styles.sectionLabel}>Style Distribution</h4>
        <div className={styles.distributionList}>
          {STYLE_TYPES.map((type) => {
            const typeMeta = VERBOSE_TYPE_METADATA[type];
            const pct = distribution[type] || 0;
            const isPrimary = type === primaryType;

            return (
              <div
                key={type}
                className={`${styles.distributionRow} ${isPrimary ? styles.primary : ''}`}
              >
                <span className={styles.distEmoji}>{typeMeta.emoji}</span>
                <span className={styles.distName}>{typeMeta.name}</span>
                <div className={styles.distBar}>
                  <div
                    className={styles.distFill}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={styles.distPct}>{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Sessions analyzed */}
      <div className={styles.footer}>
        <span className={styles.sessionsLabel}>
          Based on {sessionsAnalyzed} session{sessionsAnalyzed !== 1 ? 's' : ''} analyzed
        </span>
      </div>
    </Card>
  );
}

export default TypeResultMinimal;
