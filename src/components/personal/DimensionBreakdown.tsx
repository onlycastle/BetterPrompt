/**
 * DimensionBreakdown Component
 * Grid of dimension cards showing current scores and improvements
 */

import { ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '../ui/Card';
import { ProgressRing } from '../dashboard/ProgressRing';
import { WORKER_DOMAIN_CONFIGS } from '../../lib/models/worker-insights';
import type { PersonalAnalytics, WorkerDomainScores } from '../../types/personal';
import styles from './DimensionBreakdown.module.css';

export interface DimensionBreakdownProps {
  analytics: PersonalAnalytics;
}

export function DimensionBreakdown({ analytics }: DimensionBreakdownProps) {
  const { currentDimensions, dimensionImprovements } = analytics;

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Dimension Breakdown</h3>
      <div className={styles.grid}>
        {WORKER_DOMAIN_CONFIGS.map((config) => {
          const key = config.key as keyof WorkerDomainScores;
          const currentScore = currentDimensions[key];
          const improvement = dimensionImprovements[key] || 0;
          const isImprovement = improvement > 0;
          const absoluteImprovement = Math.abs(improvement);

          return (
            <Card key={key} padding="lg" className={styles.dimensionCard}>
              <div className={styles.cardHeader}>
                <span className={styles.emoji} role="img" aria-label={config.title}>
                  {config.icon}
                </span>
                <h4 className={styles.dimensionLabel}>{config.title}</h4>
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
        })}
      </div>
    </div>
  );
}
