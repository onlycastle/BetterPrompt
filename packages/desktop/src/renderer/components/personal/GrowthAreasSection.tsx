/**
 * GrowthAreasSection Component
 * Displays growth areas from the latest analysis
 */

import type { GrowthArea } from '../../api/types';
import styles from './GrowthAreasSection.module.css';

export interface GrowthAreasSectionProps {
  areas: GrowthArea[];
}

export function GrowthAreasSection({ areas }: GrowthAreasSectionProps) {
  if (!areas || areas.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <h3 className={styles.title}>Areas for Growth</h3>
      <div className={styles.list}>
        {areas.map((area, idx) => (
          <div key={idx} className={styles.card}>
            <h4 className={styles.areaTitle}>{area.title}</h4>
            <p className={styles.description}>{area.description}</p>

            {area.evidence && area.evidence.length > 0 && (
              <blockquote className={styles.quote}>
                &quot;{area.evidence[0]}&quot;
              </blockquote>
            )}

            {area.recommendation && (
              <div className={styles.recommendation}>
                <span className={styles.tipIcon}>💡</span>
                <span className={styles.tipText}>{area.recommendation}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default GrowthAreasSection;
