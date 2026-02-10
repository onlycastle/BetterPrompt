/**
 * DimensionBreakdown Component
 * Grid of 6 dimensions with progress rings and improvements
 */

import { ProgressRing } from './ProgressRing';
import type { PersonalAnalyticsExtended, DimensionScores } from '../../api/types';
import styles from './DimensionBreakdown.module.css';

export interface DimensionBreakdownProps {
  analytics: PersonalAnalyticsExtended;
}

interface DimensionConfig {
  key: keyof DimensionScores;
  label: string;
  emoji: string;
  description: string;
}

const DIMENSIONS: DimensionConfig[] = [
  {
    key: 'aiCollaboration',
    label: 'AI Collaboration',
    emoji: '🤝',
    description: 'How effectively you work with AI',
  },
  {
    key: 'contextEngineering',
    label: 'Context Engineering',
    emoji: '🎯',
    description: 'Quality of context you provide',
  },
  {
    key: 'burnoutRisk',
    label: 'Burnout Risk',
    emoji: '🔥',
    description: 'Lower is better for sustainability',
  },
{
    key: 'aiControl',
    label: 'AI Control',
    emoji: '🎛️',
    description: 'How well you guide AI outputs',
  },
  {
    key: 'skillResilience',
    label: 'Skill Resilience',
    emoji: '💪',
    description: 'Maintaining core skills with AI',
  },
];

export function DimensionBreakdown({ analytics }: DimensionBreakdownProps) {
  const { currentDimensions, dimensionImprovements } = analytics;

  if (!currentDimensions) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Dimension Scores</h3>
      <div className={styles.grid}>
        {DIMENSIONS.map((dim) => {
          const score = currentDimensions[dim.key];
          const improvement = dimensionImprovements?.[dim.key];

          return (
            <div key={dim.key} className={styles.card}>
              <div className={styles.header}>
                <span className={styles.emoji}>{dim.emoji}</span>
                <span className={styles.label}>{dim.label}</span>
              </div>

              <div className={styles.ringWrapper}>
                <ProgressRing value={score} size={70} showValue />
              </div>

              {improvement !== undefined && improvement !== 0 && (
                <div
                  className={`${styles.change} ${
                    // For burnout risk, lower is better
                    dim.key === 'burnoutRisk'
                      ? improvement < 0
                        ? styles.positive
                        : styles.negative
                      : improvement > 0
                      ? styles.positive
                      : styles.negative
                  }`}
                >
                  {improvement > 0 ? '+' : ''}
                  {improvement}
                </div>
              )}

              <p className={styles.description}>{dim.description}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DimensionBreakdown;
