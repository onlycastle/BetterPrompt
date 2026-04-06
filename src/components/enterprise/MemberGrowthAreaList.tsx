/**
 * MemberGrowthAreaList Component
 *
 * Renders an individual developer's growth areas in Pattern→Evidence→Action format.
 * Used in the member detail drill-down view accessible from the team view.
 *
 * Each card shows:
 *   - Pattern title + domain badge + severity
 *   - Evidence moments from actual sessions (up to 3)
 *   - Low-confidence badge when evidence is sparse
 *   - Goal relevance (why this matters for the builder's goals)
 *   - Specific tools / files / APIs referenced
 *   - Action recommendation for next session
 *   - Best-match KB tip (when attached above relevance threshold)
 */

'use client';

import type { MemberGrowthArea } from '../../types/enterprise';
import styles from './MemberGrowthAreaList.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface MemberGrowthAreaListProps {
  growthAreas: MemberGrowthArea[];
}

// ---------------------------------------------------------------------------
// Domain config
// ---------------------------------------------------------------------------

const DOMAIN_ICONS: Record<string, string> = {
  thinkingQuality: '\u{1F9E0}',
  communicationPatterns: '\u{1F4AC}',
  learningBehavior: '\u{1F4C8}',
  contextEfficiency: '\u26A1',
  sessionOutcome: '\u{1F3AF}',
};

const DOMAIN_LABELS: Record<string, string> = {
  thinkingQuality: 'Thinking',
  communicationPatterns: 'Communication',
  learningBehavior: 'Learning',
  contextEfficiency: 'Context',
  sessionOutcome: 'Session',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MemberGrowthAreaList({ growthAreas }: MemberGrowthAreaListProps) {
  if (growthAreas.length === 0) {
    return (
      <div className={styles.empty}>
        No growth areas identified yet. More sessions will help surface patterns.
      </div>
    );
  }

  return (
    <div className={styles.list}>
      {growthAreas.map((area, idx) => {
        const icon = DOMAIN_ICONS[area.domain] ?? '\u{1F4CA}';
        const domainLabel = DOMAIN_LABELS[area.domain] ?? area.domain;
        const tip = area.knowledgeTip ?? area.kbTip;

        return (
          <div
            key={`${area.domain}-${area.title}-${idx}`}
            className={`${styles.card} ${styles[`severity_${area.severity}`] ?? ''}`}
          >
            {/* Card header: domain badge + title + severity */}
            <div className={styles.header}>
              <span className={styles.domainBadge} title={domainLabel}>
                {icon} {domainLabel}
              </span>
              <h4 className={styles.title}>{area.title}</h4>
              <div className={styles.badges}>
                {area.lowConfidence && (
                  <span className={styles.lowConfidenceBadge} title="Limited evidence — emerging pattern">
                    Emerging
                  </span>
                )}
                <span className={`${styles.severityBadge} ${styles[`sev_${area.severity}`] ?? ''}`}>
                  {area.severity}
                </span>
              </div>
            </div>

            {/* Evidence moments (Pattern→Evidence section) */}
            {area.evidenceMoments && area.evidenceMoments.length > 0 && (
              <div className={styles.evidenceSection}>
                <div className={styles.evidenceLabel}>Evidence from sessions</div>
                {area.evidenceMoments.slice(0, 3).map((ev, evIdx) => (
                  <div key={`${ev.sessionId}-${evIdx}`} className={styles.evidenceItem}>
                    <span className={styles.evidenceQuote}>
                      &ldquo;{ev.behaviorDescription}&rdquo;
                    </span>
                  </div>
                ))}
                {area.evidenceMoments.length > 3 && (
                  <div className={styles.evidenceMore}>
                    +{area.evidenceMoments.length - 3} more instances
                  </div>
                )}
              </div>
            )}

            {/* Goal relevance — why this matters for the builder */}
            {area.goalRelevance && (
              <div className={styles.goalRelevance}>
                <span className={styles.goalRelevanceLabel}>Why this matters</span>
                <span className={styles.goalRelevanceText}>{area.goalRelevance}</span>
              </div>
            )}

            {/* Tools / files / APIs tag pills (tool_file_naming rubric) */}
            {area.toolsFilesApis && area.toolsFilesApis.length > 0 && (
              <div className={styles.toolPills}>
                {area.toolsFilesApis.map(tool => (
                  <span key={tool} className={styles.toolPill}>{tool}</span>
                ))}
              </div>
            )}

            {/* Action recommendation (→ Action section) */}
            <div className={styles.action}>
              <span className={styles.actionLabel}>Next-session action</span>
              <span className={styles.actionText}>{area.recommendation}</span>
            </div>

            {/* KB tip (when attached above relevance threshold) */}
            {tip && (
              <div className={styles.kbTip}>
                <span className={styles.kbTipLabel}>Related resource</span>
                <span className={styles.kbTipTitle}>{tip.title}</span>
                {(tip.sourceAuthor || tip.relevanceScore) && (
                  <span className={styles.kbTipMeta}>
                    {tip.sourceAuthor && `by ${tip.sourceAuthor}`}
                    {tip.sourceAuthor && tip.relevanceScore != null && ' · '}
                    {tip.relevanceScore != null && `${Math.round(tip.relevanceScore * 100)}% match`}
                    {tip.credibilityTier === 'high' && ' · Verified expert'}
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
