/**
 * DimensionBreakdown Component
 * Grid of dimension cards showing current scores and improvements
 */

import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProgressRing } from '../dashboard/ProgressRing';
import { DIMENSION_METADATA } from '../../types/enterprise';
import type { PersonalAnalytics } from '../../types/personal';
import type { DimensionScores } from '../../types/enterprise';
import styles from './DimensionBreakdown.module.css';

// Emoji mappings for each dimension
const DIMENSION_EMOJIS: Record<keyof DimensionScores, string> = {
  aiCollaboration: '🤝',
  contextEngineering: '🎯',
  burnoutRisk: '🔥',
  toolMastery: '🛠️',
  aiControl: '🎮',
  skillResilience: '💪',
};

export interface DimensionBreakdownProps {
  analytics: PersonalAnalytics;
}

export function DimensionBreakdown({ analytics }: DimensionBreakdownProps) {
  const { currentDimensions, dimensionImprovements } = analytics;

  const renderDimensionCard = (key: keyof DimensionScores) => {
    const metadata = DIMENSION_METADATA[key];
    const currentScore = currentDimensions[key];
    const improvement = dimensionImprovements[key] || 0;
    const emoji = DIMENSION_EMOJIS[key];

    // For burnoutRisk, lower is better
    const isBurnout = key === 'burnoutRisk';
    const isImprovement = isBurnout ? improvement < 0 : improvement > 0;
    const absoluteImprovement = Math.abs(improvement);

    return (
      <Card key={key} padding="lg" className={styles.dimensionCard}>
        <div className={styles.cardHeader}>
          <span className={styles.emoji} role="img" aria-label={metadata.label}>
            {emoji}
          </span>
          <h4 className={styles.dimensionLabel}>{metadata.label}</h4>
        </div>

        <div className={styles.cardContent}>
          <ProgressRing value={currentScore} size={100} showValue={true} />

          {improvement !== 0 && (
            <div className={`${styles.change} ${isImprovement ? styles.positive : styles.negative}`}>
              {isImprovement ? <ArrowUp size={14} /> : <ArrowDown size={14} />}
              <span>{absoluteImprovement}</span>
            </div>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Dimension Breakdown</h3>
      <div className={styles.grid}>
        {(Object.keys(currentDimensions) as (keyof DimensionScores)[]).map(renderDimensionCard)}
      </div>
    </div>
  );
}
