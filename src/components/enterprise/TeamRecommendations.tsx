/**
 * TeamRecommendations Component
 *
 * Displays prioritized, manager-actionable team-level recommendations
 * generated from cross-developer pattern analysis. Each recommendation
 * is a concrete directive a manager can implement immediately:
 *   - Urgency-coded: immediate / this-sprint / next-sprint
 *   - Includes specific action, rationale, and affected developers
 *   - Sorted by impact (urgency x severity x frequency)
 *
 * Maximum 7 recommendations displayed to respect manager attention budget.
 */

'use client';

import { Card, CardContent } from '../ui/Card';
import type { TeamActionItem } from '@/types/enterprise';
import styles from './TeamRecommendations.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface TeamRecommendationsProps {
  /** Prioritized action items from generateTeamActionItems() */
  items: TeamActionItem[];
  /** Optional callback when an affected member name is clicked */
  onMemberClick?: (memberName: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  immediate: { label: 'Immediate', className: 'urgencyImmediate' },
  'this-sprint': { label: 'This Sprint', className: 'urgencyThisSprint' },
  'next-sprint': { label: 'Next Sprint', className: 'urgencyNextSprint' },
};

const DOMAIN_ICONS: Record<string, string> = {
  thinkingQuality: 'TQ',
  communicationPatterns: 'CP',
  learningBehavior: 'LB',
  contextEfficiency: 'CE',
  sessionOutcome: 'SO',
};

/** Domain badge color class — matches CrossDeveloperPatterns visual language */
const DOMAIN_BADGE_CLASS: Record<string, string> = {
  thinkingQuality: styles.domainTQ,
  communicationPatterns: styles.domainCP,
  learningBehavior: styles.domainLB,
  contextEfficiency: styles.domainCE,
  sessionOutcome: styles.domainSO,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamRecommendations({ items, onMemberClick }: TeamRecommendationsProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className={styles.empty}>
            No team-level recommendations — all developers are performing well across analyzed dimensions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent>
        <div className={styles.container}>
          {/* Summary header */}
          <div className={styles.summaryHeader}>
            <span className={styles.summaryCount}>{items.length} action items</span>
            <span className={styles.summaryBreakdown}>
              {items.filter(i => i.urgency === 'immediate').length > 0 && (
                <span className={styles.urgencyCountImmediate}>
                  {items.filter(i => i.urgency === 'immediate').length} immediate
                </span>
              )}
              {items.filter(i => i.urgency === 'this-sprint').length > 0 && (
                <span className={styles.urgencyCountSprint}>
                  {items.filter(i => i.urgency === 'this-sprint').length} this sprint
                </span>
              )}
            </span>
          </div>

          {/* Recommendation list */}
          <ol className={styles.list}>
            {items.map(item => {
              const urgencyConf = URGENCY_CONFIG[item.urgency] ?? URGENCY_CONFIG['next-sprint'];

              return (
                <li key={`${item.domain}-${item.pattern}-${item.priority}`} className={styles.item}>
                  {/* Priority number + urgency badge */}
                  <div className={styles.itemHeader}>
                    <span className={styles.priorityNumber}>#{item.priority}</span>
                    <span className={`${styles.urgencyBadge} ${styles[urgencyConf.className]}`}>
                      {urgencyConf.label}
                    </span>
                    <span
                      className={`${styles.domainBadge} ${DOMAIN_BADGE_CLASS[item.domain] ?? ''}`}
                      title={item.domainLabel}
                    >
                      {DOMAIN_ICONS[item.domain] ?? '??'}
                    </span>
                  </div>

                  {/* Source pattern context — links recommendation back to its originating
                      cross-developer pattern. Makes the manager-facing action traceable:
                      "This is what we found → this is what you should do about it." */}
                  {item.pattern && (
                    <div className={styles.sourcePattern}>
                      <span className={styles.sourcePatternLabel}>From pattern</span>
                      <span className={styles.sourcePatternTitle}>&ldquo;{item.pattern}&rdquo;</span>
                      <span className={styles.sourcePatternDomain}>· {item.domainLabel}</span>
                    </div>
                  )}

                  {/* Action directive — the key manager-actionable content */}
                  <p className={styles.action}>{item.action}</p>

                  {/* Rationale — why this matters */}
                  <p className={styles.rationale}>{item.rationale}</p>

                  {/* Affected members */}
                  {item.affectedMembers.length > 0 && (
                    <div className={styles.memberRow}>
                      <span className={styles.memberLabel}>Involves:</span>
                      <span className={styles.memberNames}>
                        {onMemberClick
                          ? item.affectedMembers.map((name, mi) => (
                              <span key={name}>
                                {mi > 0 && ', '}
                                <button
                                  className={styles.memberLink}
                                  onClick={() => onMemberClick(name)}
                                  title={`View ${name}'s detail report`}
                                >
                                  {name}
                                </button>
                              </span>
                            ))
                          : item.affectedMembers.join(', ')
                        }
                      </span>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </CardContent>
    </Card>
  );
}
