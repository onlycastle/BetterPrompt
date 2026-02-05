/**
 * TopFocusAreasSection Component (Web App)
 *
 * Displays the top 3 personalized focus areas with:
 * - Free tier: #1 fully visible, #2 and #3 locked (narrative='')
 * - Paid tier: All 3 fully visible
 *
 * Lock detection: area.narrative === '' triggers locked UI.
 * This follows the existing data-driven lock pattern used throughout the codebase.
 */

import type { TopFocusAreas } from '../../../../types/verbose';
import type { DimensionName } from '../../../../lib/models/verbose-evaluation';
import { PremiumValueSummary } from '../shared/PremiumValueSummary';
import styles from './TopFocusAreasSection.module.css';

interface TopFocusAreasSectionProps {
  focusAreas: TopFocusAreas;
}

const DIMENSION_LABELS: Record<DimensionName, string> = {
  aiCollaboration: 'AI Collaboration',
  contextEngineering: 'Context Engineering',
  toolMastery: 'Tool Mastery',
  burnoutRisk: 'Burnout Risk',
  aiControl: 'AI Control',
  skillResilience: 'Skill Resilience',
};

const RANK_STYLES: Record<number, string> = {
  1: styles.rank1,
  2: styles.rank2,
  3: styles.rank3,
};

export function TopFocusAreasSection({ focusAreas }: TopFocusAreasSectionProps) {
  const { areas, summary } = focusAreas;

  if (!areas || areas.length === 0) {
    return null;
  }

  const lockedCount = areas.filter((a) => a.narrative === '').length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>Your Top Focus Areas</h2>
        {summary && (
          <p className={styles.subtitle}>{summary}</p>
        )}
      </div>

      <div className={styles.areasList}>
        {areas.map((area) => {
          const isLocked = area.narrative === '';

          return (
            <div
              key={area.rank}
              className={`${styles.areaCard} ${RANK_STYLES[area.rank] || ''} ${isLocked ? styles.locked : ''}`}
            >
              {/* Rank Badge */}
              <div className={styles.rankBadge}>
                <span className={styles.rankNumber}>#{area.rank}</span>
              </div>

              {/* Content */}
              <div className={styles.areaContent}>
                {/* Header */}
                <div className={styles.areaHeader}>
                  <h3 className={styles.areaTitle}>{area.title}</h3>
                  <span className={styles.dimensionTag}>
                    {DIMENSION_LABELS[area.dimension] || area.dimension}
                  </span>
                </div>

                {isLocked ? (
                  /* Locked state */
                  <div className={styles.lockedOverlay}>
                    <div className={styles.lockedContent}>
                      <span className={styles.lockIcon}>&#128274;</span>
                      <span className={styles.lockText}>Unlock detailed analysis</span>
                    </div>
                    <div className={styles.blurredPlaceholder} />
                  </div>
                ) : (
                  /* Unlocked state - full content */
                  <>
                    {/* Narrative - WHY this matters */}
                    <p className={styles.narrative}>{area.narrative}</p>

                    {/* Expected Impact */}
                    {area.expectedImpact && (
                      <div className={styles.impactBox}>
                        <span className={styles.impactIcon}>&#128200;</span>
                        <span className={styles.impactText}>{area.expectedImpact}</span>
                      </div>
                    )}

                    {/* Actions: START / STOP / CONTINUE */}
                    {area.actions && (
                      <div className={styles.actionsBox}>
                        {area.actions.start && (
                          <div className={styles.actionItem}>
                            <span className={`${styles.actionLabel} ${styles.actionStart}`}>
                              START
                            </span>
                            <span className={styles.actionText}>{area.actions.start}</span>
                          </div>
                        )}
                        {area.actions.stop && (
                          <div className={styles.actionItem}>
                            <span className={`${styles.actionLabel} ${styles.actionStop}`}>
                              STOP
                            </span>
                            <span className={styles.actionText}>{area.actions.stop}</span>
                          </div>
                        )}
                        {area.actions.continue && (
                          <div className={styles.actionItem}>
                            <span className={`${styles.actionLabel} ${styles.actionContinue}`}>
                              CONTINUE
                            </span>
                            <span className={styles.actionText}>{area.actions.continue}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Priority Score Bar */}
                    {area.priorityScore > 0 && (
                      <div className={styles.scoreBar}>
                        <div
                          className={styles.scoreFill}
                          style={{ width: `${area.priorityScore}%` }}
                        />
                        <span className={styles.scoreLabel}>
                          Priority: {area.priorityScore}/100
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Premium CTA for locked areas */}
      {lockedCount > 0 && (
        <PremiumValueSummary
          lockedCount={lockedCount}
          domainName="Focus Areas"
        />
      )}
    </div>
  );
}

export default TopFocusAreasSection;
