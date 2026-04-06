/**
 * CrossDeveloperPatterns Component
 *
 * Renders aggregated cross-developer patterns from PEA-format growth areas.
 * Each pattern shows:
 *   - "X of Y devs share this pattern" badge as primary metric
 *   - Freeform category tags (LLM-generated, frequency-ranked)
 *   - Expandable detail view with:
 *     - Actionable team-level recommendation (manager-directed)
 *     - Per-member severity breakdown
 *     - Representative evidence moments from sessions
 *     - Best-match KB tip (when available above relevance threshold)
 *
 * Patterns are sorted by member count (descending), then severity.
 */

'use client';

import { useState } from 'react';
import { Card, CardContent } from '../ui/Card';
import type { TeamGrowthAreaPEAAggregate } from '../../types/enterprise';
import styles from './CrossDeveloperPatterns.module.css';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface CrossDeveloperPatternsProps {
  /** Aggregated cross-developer patterns from aggregateGrowthAreasPEA() */
  patterns: TeamGrowthAreaPEAAggregate[];
  /** Total team members — used for "X of Y devs" badges */
  totalMembers: number;
  /** Optional callback when an affected member name is clicked — enables drill-down to member detail */
  onMemberClick?: (memberName: string) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DOMAIN_ICONS: Record<string, string> = {
  thinkingQuality: 'TQ',
  communicationPatterns: 'CP',
  learningBehavior: 'LB',
  contextEfficiency: 'CE',
  sessionOutcome: 'SO',
};

const DOMAIN_CLASS: Record<string, string> = {
  thinkingQuality: styles.domainTQ,
  communicationPatterns: styles.domainCP,
  learningBehavior: styles.domainLB,
  contextEfficiency: styles.domainCE,
  sessionOutcome: styles.domainSO,
};

const SEVERITY_CLASS: Record<string, string> = {
  critical: styles.severityCritical,
  high: styles.severityHigh,
  medium: styles.severityMedium,
  low: styles.severityLow,
};

const DOT_CLASS: Record<string, string> = {
  critical: styles.dotCritical,
  high: styles.dotHigh,
  medium: styles.dotMedium,
  low: styles.dotLow,
};

/** Max number of category tags to display in the collapsed row header */
const MAX_HEADER_TAGS = 4;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CrossDeveloperPatterns({ patterns, totalMembers, onMemberClick }: CrossDeveloperPatternsProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (patterns.length === 0) {
    return (
      <Card>
        <CardContent>
          <p className={styles.empty}>No cross-developer patterns detected yet</p>
        </CardContent>
      </Card>
    );
  }

  function toggleRow(key: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <Card>
      <CardContent>
        <div className={styles.container}>
          {patterns.map((pattern, idx) => {
            const rowKey = `${pattern.domain}-${pattern.title}-${idx}`;
            const isExpanded = expandedRows.has(rowKey);
            const isHighFrequency = totalMembers > 0 && pattern.memberCount / totalMembers > 0.5;

            return (
              <div key={rowKey} className={styles.row}>
                {/* ---- Collapsed row header ---- */}
                <button
                  type="button"
                  className={styles.rowHeader}
                  onClick={() => toggleRow(rowKey)}
                  aria-expanded={isExpanded}
                >
                  <span
                    className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                    aria-hidden="true"
                  >
                    &#9656;
                  </span>

                  <span
                    className={`${styles.domainBadge} ${DOMAIN_CLASS[pattern.domain] ?? ''}`}
                    title={pattern.domainLabel}
                  >
                    {DOMAIN_ICONS[pattern.domain] ?? '??'}
                  </span>

                  <div className={styles.rowInfo}>
                    <div className={styles.titleRow}>
                      <span className={styles.patternTitle}>{pattern.title}</span>

                      {/* Developer count badge — primary team metric */}
                      <span
                        className={`${styles.devCountBadge} ${isHighFrequency ? styles.devCountHigh : ''}`}
                        title={`${pattern.memberCount} of ${totalMembers} developers share this pattern`}
                      >
                        <span className={styles.devCountIcon} aria-hidden="true">
                          &#x1F465;
                        </span>
                        {pattern.memberCount} of {totalMembers} devs
                      </span>
                    </div>

                    {/* Category tags (collapsed view: show top N) */}
                    {pattern.categoryTags.length > 0 && (
                      <div className={styles.tagRow}>
                        {pattern.categoryTags.slice(0, MAX_HEADER_TAGS).map(tag => (
                          <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                        {pattern.categoryTags.length > MAX_HEADER_TAGS && (
                          <span className={styles.tag}>
                            +{pattern.categoryTags.length - MAX_HEADER_TAGS}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Severity + emerging badges */}
                  <div className={styles.badges}>
                    {pattern.hasLowConfidenceContributors && (
                      <span
                        className={styles.emergingBadge}
                        title="Some team members have limited evidence for this pattern"
                      >
                        Emerging
                      </span>
                    )}
                    <span
                      className={`${styles.severityBadge} ${SEVERITY_CLASS[pattern.predominantSeverity] ?? styles.severityLow}`}
                    >
                      {pattern.predominantSeverity}
                    </span>
                  </div>
                </button>

                {/* ---- Expanded detail view ---- */}
                {isExpanded && (
                  <div className={styles.expandedContent}>
                    {/* Team-level recommendation (manager-actionable) */}
                    {pattern.teamRecommendation && (
                      <div className={styles.recommendationCallout}>
                        <div className={styles.recommendationLabel}>Team Action</div>
                        {pattern.teamRecommendation}
                      </div>
                    )}

                    {/* Per-member severity breakdown */}
                    {pattern.memberSeverities.length > 0 && (
                      <div className={styles.memberBreakdown}>
                        <div className={styles.memberBreakdownTitle}>
                          Affected Developers ({pattern.memberCount})
                        </div>
                        <div className={styles.memberList}>
                          {pattern.memberSeverities.map(ms => (
                            onMemberClick ? (
                              <button
                                key={ms.memberName}
                                className={`${styles.memberChip} ${styles.memberChipClickable}`}
                                onClick={() => onMemberClick(ms.memberName)}
                                title={`View ${ms.memberName}'s detail report`}
                              >
                                <span
                                  className={`${styles.memberSeverityDot} ${DOT_CLASS[ms.severity] ?? styles.dotLow}`}
                                />
                                {ms.memberName}
                              </button>
                            ) : (
                              <span key={ms.memberName} className={styles.memberChip}>
                                <span
                                  className={`${styles.memberSeverityDot} ${DOT_CLASS[ms.severity] ?? styles.dotLow}`}
                                />
                                {ms.memberName}
                              </span>
                            )
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Representative evidence moments */}
                    {pattern.representativeEvidence && pattern.representativeEvidence.length > 0 && (
                      <div className={styles.evidenceSection}>
                        <div className={styles.evidenceTitle}>Evidence from Sessions</div>
                        {pattern.representativeEvidence.map((ev, evIdx) => (
                          <div key={`${ev.memberName}-${evIdx}`} className={styles.evidenceItem}>
                            <span className={styles.evidenceMember}>{ev.memberName}</span>
                            <span className={styles.evidenceQuote}>
                              &ldquo;{ev.moment.behaviorDescription}&rdquo;
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* KB tip (when available) — prefer structured knowledgeTip over deprecated flat fields */}
                    {(pattern.knowledgeTip || pattern.kbTipId) && (
                      <div className={styles.kbTip}>
                        <span className={styles.kbTipLabel}>Related Resource</span>
                        <span className={styles.kbTipTitle}>
                          {pattern.knowledgeTip ? pattern.knowledgeTip.title : pattern.kbTipTitle}
                        </span>
                        {pattern.knowledgeTip ? (
                          <span className={styles.kbTipMeta}>
                            {pattern.knowledgeTip.sourceAuthor && `by ${pattern.knowledgeTip.sourceAuthor}`}
                            {pattern.knowledgeTip.sourceAuthor && ' · '}
                            {`Relevance: ${Math.round(pattern.knowledgeTip.relevanceScore * 100)}%`}
                            {pattern.knowledgeTip.credibilityTier && pattern.knowledgeTip.credibilityTier !== 'standard' && (
                              <span className={`${styles.credibilityTier} ${styles[`credibility_${pattern.knowledgeTip.credibilityTier}`]}`}>
                                {' '}· {pattern.knowledgeTip.credibilityTier}
                              </span>
                            )}
                          </span>
                        ) : (
                          (pattern.kbTipSourceAuthor || pattern.kbTipRelevanceScore != null) && (
                            <span className={styles.kbTipMeta}>
                              {pattern.kbTipSourceAuthor && `by ${pattern.kbTipSourceAuthor}`}
                              {pattern.kbTipSourceAuthor && pattern.kbTipRelevanceScore != null && ' · '}
                              {pattern.kbTipRelevanceScore != null && `Relevance: ${Math.round(pattern.kbTipRelevanceScore * 100)}%`}
                            </span>
                          )
                        )}
                      </div>
                    )}

                    {/* All category tags (expanded — show full list) */}
                    {pattern.categoryTags.length > MAX_HEADER_TAGS && (
                      <div className={styles.tagRow}>
                        {pattern.categoryTags.map(tag => (
                          <span key={tag} className={styles.tag}>{tag}</span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
