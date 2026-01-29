/**
 * GrowthAreasSection Component
 * Displays growth areas extracted from analysis
 * Recommendations locked for free users - "진단 무료, 처방 유료"
 * Now includes ResourceBubble for learning materials in 2-column layout
 */

import { Card } from '../../../ui/Card';
import { ResourceBubble } from '../resources/ResourceBubble';
import type { DimensionGrowthArea, Evidence } from '../../../../types/verbose';
import type { ParsedResource } from '../../../../lib/models/agent-outputs';
import styles from './GrowthAreasSection.module.css';

/** Extract display quote from evidence (handles both string and EvidenceItem formats) */
function getEvidenceQuote(evidence: Evidence): string {
  if (typeof evidence === 'string') return evidence;
  return evidence.quote;
}

interface GrowthAreasSectionProps {
  areas: DimensionGrowthArea[];
  isPaid?: boolean;
  resourcesMap?: Map<string, ParsedResource[]>;
}

export function GrowthAreasSection({ areas, isPaid = false, resourcesMap }: GrowthAreasSectionProps) {
  if (!areas || areas.length === 0) {
    return null;
  }

  // Count recommendations for teaser
  const recommendationCount = areas.filter(a => a.recommendation).length;

  return (
    <div className={styles.container}>
      {areas.map((area, idx) => {
        const resources = resourcesMap?.get(area.title) || [];

        return (
          <div key={idx} className={styles.areaRow}>
            {/* Left: Growth Area Card */}
            <Card padding="md" className={styles.areaCard}>
              <h4 className={styles.title}>{area.title}</h4>
              <p className={styles.description}>{area.description}</p>

              {area.evidence && area.evidence.length > 0 && (
                <blockquote className={styles.quote}>
                  &ldquo;{getEvidenceQuote(area.evidence[0])}&rdquo;
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

            {/* Right: Resource Bubble (if resources exist) */}
            {resources.length > 0 && (
              <ResourceBubble resources={resources} isPaid={isPaid} />
            )}
          </div>
        );
      })}

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
