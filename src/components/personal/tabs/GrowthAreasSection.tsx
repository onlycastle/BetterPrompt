/**
 * GrowthAreasSection Component
 * Displays growth areas extracted from analysis
 * Recommendations locked for free users - "진단 무료, 처방 유료"
 */

import { Card } from '../../ui/Card';
import type { DimensionGrowthArea } from '../../../types/verbose';
import styles from './GrowthAreasSection.module.css';

interface GrowthAreasSectionProps {
  areas: DimensionGrowthArea[];
  isPaid?: boolean;
}

export function GrowthAreasSection({ areas, isPaid = false }: GrowthAreasSectionProps) {
  if (!areas || areas.length === 0) {
    return null;
  }

  // Count recommendations for teaser
  const recommendationCount = areas.filter(a => a.recommendation).length;

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
            <div className={`${styles.recommendation} ${!isPaid ? styles.recommendationLocked : ''}`}>
              <span className={styles.recommendationIcon}>💡</span>
              {isPaid ? (
                <span className={styles.recommendationText}>{area.recommendation}</span>
              ) : (
                <span className={styles.lockedContent}>
                  <span className={styles.blurredText}>{area.recommendation.slice(0, 25)}...</span>
                  <span className={styles.unlockBadge}>🔒 See recommendation</span>
                </span>
              )}
            </div>
          )}
        </Card>
      ))}

      {/* Teaser for free users */}
      {!isPaid && recommendationCount > 0 && (
        <div className={styles.teaser}>
          <span className={styles.teaserIcon}>🔓</span>
          <span className={styles.teaserText}>{recommendationCount} personalized recommendations</span>
        </div>
      )}
    </div>
  );
}

export default GrowthAreasSection;
