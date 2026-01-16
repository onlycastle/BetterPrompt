/**
 * GrowthAreasSection Component
 * Displays growth areas extracted from analysis
 */

import { Card } from '../../ui/Card';
import type { DimensionGrowthArea } from '../../../types/verbose';
import styles from './GrowthAreasSection.module.css';

interface GrowthAreasSectionProps {
  areas: DimensionGrowthArea[];
}

export function GrowthAreasSection({ areas }: GrowthAreasSectionProps) {
  if (!areas || areas.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      {areas.map((area, idx) => (
        <Card key={idx} padding="md" className={styles.areaCard}>
          <h4 className={styles.title}>{area.title}</h4>
          <p className={styles.description}>{area.description}</p>

          {area.evidence.length > 0 && (
            <blockquote className={styles.quote}>
              "{area.evidence[0]}"
            </blockquote>
          )}

          {area.recommendation && (
            <div className={styles.recommendation}>
              <span className={styles.recommendationIcon}>💡</span>
              <span className={styles.recommendationText}>{area.recommendation}</span>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

export default GrowthAreasSection;
