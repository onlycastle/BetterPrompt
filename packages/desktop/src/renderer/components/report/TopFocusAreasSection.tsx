/**
 * TopFocusAreasSection Component
 *
 * Displays the top 3 personalized focus areas with:
 * - Priority ranking (1, 2, 3)
 * - Narrative explaining WHY this matters
 * - Expected impact
 * - START/STOP/CONTINUE action framework
 *
 * This is the MOST ACTIONABLE section of the report.
 */

import type { TopFocusAreas, DimensionName } from '../../types/report';
import { FormattedText } from '../../utils/textFormatting';
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

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>🎯 Your Top 3 Focus Areas</h2>
        {summary && (
          <p className={styles.subtitle}>{summary}</p>
        )}
      </div>

      <div className={styles.areasList}>
        {areas.map((area) => (
          <div
            key={area.rank}
            className={`${styles.areaCard} ${RANK_STYLES[area.rank] || ''}`}
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

              {/* Narrative - WHY this matters */}
              <FormattedText
                text={area.narrative}
                as="p"
                className={styles.narrative}
              />

              {/* Expected Impact */}
              {area.expectedImpact && (
                <div className={styles.impactBox}>
                  <span className={styles.impactIcon}>📈</span>
                  <span className={styles.impactText}>{area.expectedImpact}</span>
                </div>
              )}

              {/* Actions: START / STOP / CONTINUE */}
              {area.actions && (
                <div className={styles.actionsBox}>
                  {area.actions.start && (
                    <div className={styles.actionItem}>
                      <span className={styles.actionLabel + ' ' + styles.actionStart}>
                        ▶ START
                      </span>
                      <span className={styles.actionText}>{area.actions.start}</span>
                    </div>
                  )}
                  {area.actions.stop && (
                    <div className={styles.actionItem}>
                      <span className={styles.actionLabel + ' ' + styles.actionStop}>
                        ■ STOP
                      </span>
                      <span className={styles.actionText}>{area.actions.stop}</span>
                    </div>
                  )}
                  {area.actions.continue && (
                    <div className={styles.actionItem}>
                      <span className={styles.actionLabel + ' ' + styles.actionContinue}>
                        ↻ CONTINUE
                      </span>
                      <span className={styles.actionText}>{area.actions.continue}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Priority Score */}
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
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
