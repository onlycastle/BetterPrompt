/**
 * WorkerInsightsSection Component
 *
 * Renders capability-specific insights from Phase 2 workers directly.
 * Each worker's strengths and growth areas are displayed in a dedicated section.
 *
 * Design: "Terminal Diagnostic Report" - A code editor/terminal aesthetic
 * that feels native to developers while being distinctive.
 *
 * Key visual elements:
 * - Dark header bars (terminal window style)
 * - Git diff style cards (+/! prefixes via CSS)
 * - Circular SVG score gauges
 * - Vertical flow layout
 * - Shimmer effect for locked content
 *
 * v3 Workers displayed (2026-02):
 * - Thinking Quality (ThinkingQualityWorker): Planning + Critical Thinking
 * - Communication Patterns (CommunicationPatternsWorker): Prompt patterns analysis
 * - Learning Behavior (LearningBehaviorWorker): Knowledge Gaps + Repeated Mistakes
 * - Context Efficiency (ContextEfficiencyWorker): Token efficiency patterns
 */

import { useCallback, useMemo, useRef, useState, useEffect, type ReactNode } from 'react';
import type { AggregatedWorkerInsights, WorkerStrength, WorkerGrowth, ReferencedInsight } from '../../../../lib/models/worker-insights';
import {
  WORKER_DOMAIN_CONFIGS,
  type WorkerDomainConfig,
  applyTranslatedStrengths,
  applyTranslatedGrowthAreas,
} from '../../../../lib/models/worker-insights';
import { createGrowthKey, type InsightAllocation } from '../../../../lib/utils/insight-deduplication';
import type { TranslatedAgentInsights, UtteranceLookupEntry } from '../../../../lib/models/verbose-evaluation';
import type { CommunicationStrength, CommunicationGrowth } from '../../../../lib/transformers/prompt-pattern-transformer';
import { ExpandableEvidence } from './ExpandableEvidence';
import styles from './WorkerInsightsSection.module.css';

function isCommunicationStrength(item: WorkerStrength): item is CommunicationStrength {
  return '_meta' in item && (item as CommunicationStrength)._meta?.source === 'communication_pattern';
}

function isCommunicationGrowth(item: WorkerGrowth): item is CommunicationGrowth {
  return '_meta' in item && (item as CommunicationGrowth)._meta?.source === 'communication_pattern';
}

/**
 * Detect if a domain is fully locked by ContentGateway.
 * Locked domains have description === '' on both strengths and growth areas.
 */
function isDomainLocked(strengths: WorkerStrength[], growthAreas: WorkerGrowth[]): boolean {
  return strengths.length > 0 && strengths[0].description === ''
    && growthAreas.length > 0 && growthAreas[0].description === '';
}

// Frequency badge labels
const FREQUENCY_LABELS: Record<string, string> = {
  frequent: 'Frequent',
  occasional: 'Occasional',
  rare: 'Rare',
};

// Effectiveness badge labels
const EFFECTIVENESS_LABELS: Record<string, string> = {
  highly_effective: 'Highly Effective',
  effective: 'Effective',
  could_improve: 'Opportunity',
};

interface WorkerInsightsSectionProps {
  /** Aggregated insights from all Phase 2 workers */
  workerInsights?: AggregatedWorkerInsights;
  /** Translated agent insights from Phase 4 Translator (non-English only) */
  translatedAgentInsights?: TranslatedAgentInsights;
  /** Utterance lookup for evidence linking (undefined = locked for free tier) */
  utteranceLookup?: UtteranceLookupEntry[];
}

/**
 * Circular score gauge with animated SVG ring
 */
const CIRCUMFERENCE = 2 * Math.PI * 25; // SVG circle circumference (radius = 25)

function getScoreClass(score: number): string {
  if (score >= 70) return styles.scoreHigh;
  if (score >= 40) return styles.scoreMedium;
  return styles.scoreLow;
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const offset = CIRCUMFERENCE - (CIRCUMFERENCE * score / 100);
  const scoreClass = getScoreClass(score);

  return (
    <div className={`${styles.scoreGauge} ${scoreClass}`} title={label}>
      <svg viewBox="0 0 60 60" className={styles.scoreSvg}>
        <circle cx="30" cy="30" r="25" className={styles.scoreCircleBg} />
        <circle
          cx="30"
          cy="30"
          r="25"
          className={styles.scoreCircle}
          style={{ strokeDashoffset: offset }}
        />
      </svg>
      <span className={styles.scoreValue}>{score}</span>
    </div>
  );
}

/**
 * Card component for a single strength
 * CSS ::before pseudo-element handles the '+' prefix
 *
 * Supports Communication Pattern metadata (_meta) for showing
 * frequency/effectiveness badges when present.
 */
function StrengthCard({
  strength,
  utteranceLookup,
  onViewContext,
}: {
  strength: WorkerStrength;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  onViewContext?: (utteranceId: string) => void;
}) {
  const isCommunication = isCommunicationStrength(strength);

  return (
    <div className={styles.insightCard}>
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle}>{strength.title}</h4>
        {/* Communication Pattern badges (frequency + effectiveness) */}
        {isCommunication && (
          <div className={styles.patternBadges}>
            <span className={styles.frequencyBadge}>
              {FREQUENCY_LABELS[strength._meta.frequency]}
            </span>
            <span className={styles.effectivenessBadge}>
              {EFFECTIVENESS_LABELS[strength._meta.effectiveness]}
            </span>
          </div>
        )}
      </div>
      <p className={styles.cardDescription}>{strength.description}</p>
      {strength.evidence.length > 0 && (
        <ExpandableEvidence
          evidence={strength.evidence}
          utteranceLookup={utteranceLookup}
          maxItems={4}
          onViewContext={onViewContext}
        />
      )}
    </div>
  );
}

/**
 * Get severity display label for localization
 */
function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };
  return labels[severity] || severity;
}

/**
 * Get locked recommendation CSS class based on severity
 */
function getLockedRecommendationClass(severity: string | undefined): string {
  if (severity === 'critical') {
    return styles.lockedCritical;
  }
  if (severity === 'high') {
    return styles.lockedHigh;
  }
  return '';
}

/**
 * Render urgency label based on severity
 */
function renderUrgencyLabel(severity: string | undefined): ReactNode {
  if (severity === 'critical') {
    return (
      <div className={styles.urgencyLabel} data-severity="critical">
        ⚡ Critical Fix Available
      </div>
    );
  }

  if (severity === 'high') {
    return (
      <div className={styles.urgencyLabel} data-severity="high">
        🔥 High-Impact Solution
      </div>
    );
  }

  return null;
}

/**
 * Card component for a single growth area
 * CSS ::before pseudo-element handles the '!' prefix
 *
 * Data-driven UI: recommendation presence determines what to show
 * - recommendation exists & non-empty: show recommendation
 * - recommendation empty/missing: show locked UI with blur effect
 *
 * FREE tier enhancements:
 * - Evidence count: "Found in N sessions" - shows data-driven specificity
 * - Severity badge: Visual urgency indicator
 * - Blur + partial reveal: Teases recommendation content
 *
 * Supports Communication Pattern metadata (_meta) for showing
 * frequency/effectiveness badges when present.
 *
 * Professional Insights:
 * - Shows inline insight content when referencedInsights are present
 */
function GrowthCard({
  growth,
  utteranceLookup,
  referencedInsights,
  onViewContext,
}: {
  growth: WorkerGrowth;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  referencedInsights?: ReferencedInsight[];
  onViewContext?: (utteranceId: string) => void;
}) {
  const severityClass = growth.severity
    ? styles[`severity${growth.severity[0].toUpperCase()}${growth.severity.slice(1)}`]
    : '';

  // Data-driven: recommendation presence indicates paid tier
  const hasRecommendation = Boolean(growth.recommendation);

  // Check if this is a Communication Pattern (has _meta)
  const isCommunication = isCommunicationGrowth(growth);

  // Count unique sessions from evidence (for "Found in N sessions" display)
  // Note: EvidenceItem is a union type (string | InsightEvidence), so runtime type check
  // is required. Legacy/cached data may contain plain strings without utteranceId.
  const sessionCount = useMemo(() => {
    const sessions = new Set<string>();
    for (const ev of growth.evidence) {
      if (typeof ev === 'object' && 'utteranceId' in ev) {
        // Extract sessionId from utteranceId (format: sessionId_turnIndex)
        const sessionId = ev.utteranceId.split('_')[0];
        if (sessionId) sessions.add(sessionId);
      }
    }
    return sessions.size;
  }, [growth.evidence]);

  return (
    <div className={`${styles.insightCard} ${styles.growthCard}`}>
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle}>{growth.title}</h4>
        {/* Communication Pattern badges (frequency + effectiveness) */}
        {isCommunication && (
          <div className={styles.patternBadges}>
            <span className={styles.frequencyBadge}>
              {FREQUENCY_LABELS[growth._meta.frequency]}
            </span>
            <span className={styles.effectivenessBadgeOpportunity}>
              {EFFECTIVENESS_LABELS[growth._meta.effectiveness]}
            </span>
          </div>
        )}
        {/* Worker Insights severity badge */}
        {!isCommunication && growth.severity && (
          <span className={`${styles.severityBadge} ${severityClass}`}>
            {growth.severity}
          </span>
        )}
      </div>

      {/* Growth metadata: evidence count + severity level + insight indicator (Worker Insights only) */}
      {!isCommunication && (
        <div className={styles.growthMeta}>
          {sessionCount > 0 && (
            <span className={styles.evidenceCount}>
              📊 Found in {sessionCount} session{sessionCount !== 1 ? 's' : ''}
            </span>
          )}
          {growth.severity && (
            <span className={styles.severityLevel} data-severity={growth.severity}>
              Severity: {getSeverityLabel(growth.severity)}
            </span>
          )}
        </div>
      )}

      <p className={styles.cardDescription}>{growth.description}</p>
      {growth.evidence.length > 0 && (
        <ExpandableEvidence
          evidence={growth.evidence}
          utteranceLookup={utteranceLookup}
          maxItems={4}
          onViewContext={onViewContext}
        />
      )}
      {hasRecommendation ? (
        <div className={styles.recommendationSection}>
          <span className={styles.recommendationLabel}>{'💡'} The Fix</span>
          <p className={styles.recommendationText}>{growth.recommendation}</p>
        </div>
      ) : (
        <div className={`${styles.lockedRecommendation} ${getLockedRecommendationClass(growth.severity)}`}>
          {/* Severity-based urgency label */}
          {renderUrgencyLabel(growth.severity)}

          {/* Coaching Preview with optional blurred recommendation teaser */}
          <div className={styles.coachingPreview}>
            <span className={styles.recommendationLabel}>{'💡'} The Fix</span>
            {growth.recommendationPreview && (
              <div className={styles.blurredPreview}>
                <p className={styles.blurredText}>
                  {growth.recommendationPreview}...
                </p>
              </div>
            )}
          </div>

          <button
            className={styles.unlockCta}
            type="button"
            onClick={() => {
              document.getElementById('unlock-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
          >
            <span className={styles.lockIcon}>{'🔓'}</span>
            Unlock the Fix
          </button>
        </div>
      )}

      {/* Expert Knowledge — bridge + card redesign */}
      {referencedInsights && referencedInsights.length > 0 && (
        <>
          {/* Bridge element: ── MATCHED TO THIS FINDING ── */}
          <div className={styles.expertBridge}>
            <span className={styles.bridgeLine} />
            <span className={styles.bridgeLabel}>{'>'} Matched to this finding</span>
            <span className={styles.bridgeLine} />
          </div>

          {/* Expert Knowledge Card */}
          <div className={styles.expertKnowledgeCard}>
            {/* Header: 📖 EXPERT KNOWLEDGE | [CATEGORY] */}
            <div className={styles.expertHeader}>
              <div className={styles.expertHeaderLeft}>
                <span>{'📖'}</span>
                <span className={styles.expertLabel}>Expert Knowledge</span>
              </div>
              <span className={styles.expertCategoryBadge}>{referencedInsights[0].category}</span>
            </div>

            <h5 className={styles.expertTitle}>{referencedInsights[0].title}</h5>

            {referencedInsights[0].keyTakeaway ? (
              <>
                <blockquote className={styles.expertTakeaway}>
                  {referencedInsights[0].keyTakeaway}
                </blockquote>

                {/* Author attribution (conditional) */}
                {referencedInsights[0].sourceAuthor && (
                  <p className={styles.expertAuthorAttribution}>
                    — {referencedInsights[0].sourceAuthor}
                  </p>
                )}

                {/* Actionable advice with > prefix */}
                {referencedInsights[0].actionableAdvice?.slice(0, 2).map((advice, i) => (
                  <div key={i} className={styles.expertAdviceItem}>
                    <span className={styles.expertAdvicePrefix}>{'>'}</span>
                    <span className={styles.expertAdviceText}>{advice}</span>
                  </div>
                ))}

                {/* Source CTA button */}
                {referencedInsights[0].url && (
                  <div className={styles.expertSourceFooter}>
                    <a
                      href={referencedInsights[0].url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.expertSourceButton}
                    >
                      Read Full Article <span className={styles.expertSourceArrow}>&rarr;</span>
                    </a>
                  </div>
                )}
              </>
            ) : (
              <span className={styles.expertLocked}>{'🔓'} Unlock Full Insight</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Props for WorkerDomainSection component.
 *
 * Exported for reuse in TabbedReportContainer's 3-tab structure.
 */
export interface WorkerDomainSectionProps {
  config: WorkerDomainConfig;
  strengths: WorkerStrength[];
  growthAreas: WorkerGrowth[];
  translatedStrengthsData?: Array<{ title: string; description: string }> | string;
  translatedGrowthAreasData?: Array<{ title: string; description: string; recommendation: string }> | string;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  domainScore?: number;
  /** Referenced insights from this domain for sidebar display (legacy - prefer insightAllocation) */
  referencedInsights?: ReferencedInsight[];
  /** Deduplicated insight allocation from TabbedReportContainer */
  insightAllocation?: InsightAllocation;
  /** Domain key for looking up allocated insights (e.g., 'thinkingQuality') */
  domainKey?: string;
  /** Callback to open the Source Context sidebar for a specific utterance */
  onViewContext?: (utteranceId: string) => void;
  /** Whether this section starts expanded (default: false — collapsed) */
  initialExpanded?: boolean;
}

/**
 * Single worker domain section
 *
 * Applies translation overlay when translatedStrengthsData/translatedGrowthAreasData
 * are provided. This overlays translated title/description/recommendation on top
 * of the original English data while preserving evidence quotes in source language.
 *
 * Exported for reuse in TabbedReportContainer's individual tabs.
 */
export function WorkerDomainSection({
  config,
  strengths,
  growthAreas,
  translatedStrengthsData,
  translatedGrowthAreasData,
  utteranceLookup,
  domainScore,
  referencedInsights,
  insightAllocation,
  domainKey,
  onViewContext,
  initialExpanded,
}: WorkerDomainSectionProps) {

  // Accordion toggle state (collapsed by default)
  const [isExpanded, setIsExpanded] = useState(initialExpanded ?? false);
  const toggleExpanded = useCallback(() => setIsExpanded(prev => !prev), []);
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleExpanded();
    }
  }, [toggleExpanded]);

  // Scroll-triggered reveal: IntersectionObserver fires once when section enters viewport
  const sectionRef = useRef<HTMLElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;

    // Respect prefers-reduced-motion — show immediately
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      setRevealed(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Apply translations if available
  const displayStrengths = useMemo(
    () => applyTranslatedStrengths(strengths, translatedStrengthsData),
    [strengths, translatedStrengthsData]
  );

  const displayGrowthAreas = useMemo(
    () => applyTranslatedGrowthAreas(growthAreas, translatedGrowthAreasData),
    [growthAreas, translatedGrowthAreasData]
  );

  const hasContent = displayStrengths.length > 0 || displayGrowthAreas.length > 0;

  if (!hasContent) {
    return null;
  }

  // Locked domain: show teaser with header + score + first titles only
  const domainLocked = isDomainLocked(displayStrengths, displayGrowthAreas);

  if (domainLocked) {
    return (
      <section ref={sectionRef} className={styles.domainSection} data-revealed={revealed || undefined}>
        <div
          className={styles.domainHeader}
          role="presentation"
        >
          <div className={styles.domainTitleRow}>
            <span className={styles.domainIcon}>{config.icon}</span>
            <div className={styles.domainTitleGroup}>
              <h3 className={styles.domainTitle}>{config.title}</h3>
              <p className={styles.domainSubtitle}>{config.subtitle}</p>
            </div>
          </div>
          <div className={styles.domainHeaderRight}>
            {domainScore !== undefined && (
              <ScoreGauge score={domainScore} label={config.scoreLabel} />
            )}
          </div>
        </div>

        <div className={styles.lockedDomainBody}>
          {displayStrengths.length > 0 && (
            <div className={styles.lockedTeaser}>
              <span className={styles.teaserStrengthLabel}>Top Strength</span>
              <span className={styles.teaserTitle}>{displayStrengths[0]?.title}</span>
              {displayStrengths[0]?.descriptionPreview && (
                <p className={styles.teaserBlurredText}>
                  {displayStrengths[0].descriptionPreview}...
                </p>
              )}
            </div>
          )}
          {displayGrowthAreas.length > 0 && (
            <div className={styles.lockedTeaser} data-type="growth">
              <span className={styles.teaserGrowthLabel}>Top Growth Area</span>
              <span className={styles.teaserTitle}>{displayGrowthAreas[0]?.title}</span>
              {displayGrowthAreas[0]?.descriptionPreview && (
                <p className={styles.teaserBlurredText}>
                  {displayGrowthAreas[0].descriptionPreview}...
                </p>
              )}
            </div>
          )}
          <div className={styles.lockedDomainOverlay}>
            <p>Unlock to see full {config.title} analysis</p>
            {displayGrowthAreas.length > 0 && (
              <p className={styles.lockedDomainCount}>
                {displayGrowthAreas.length} growth area{displayGrowthAreas.length !== 1 ? 's' : ''} with detailed action plans
              </p>
            )}
            <button
              className={styles.unlockDomainCta}
              type="button"
              onClick={() => {
                document.getElementById('unlock-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >
              Unlock Full Analysis
            </button>
          </div>
        </div>
      </section>
    );
  }

  /**
   * Get insight for a specific growth area from the deduplication allocation.
   * Falls back to referencedInsights prop for backward compatibility.
   *
   * @param growth - Growth area to find insight for
   * @returns Allocated insight, or undefined if none allocated
   */
  const getInsightForGrowth = (growth: WorkerGrowth): ReferencedInsight | undefined => {
    // Prefer deduplicated allocation
    if (insightAllocation && domainKey) {
      const key = createGrowthKey(domainKey, growth.title);
      const allocated = insightAllocation.get(key);
      // Check for undefined only - null means "intentionally no insight" (don't fallback)
      if (allocated !== undefined) {
        return allocated ?? undefined; // Convert null to undefined for consistent return type
      }
    }
    // Fallback to legacy referencedInsights (first one)
    if (referencedInsights && referencedInsights.length > 0) {
      return referencedInsights[0];
    }
    return undefined;
  };

  return (
    <section
      ref={sectionRef}
      className={styles.domainSection}
      data-revealed={revealed || undefined}
    >
      <div
        className={styles.domainHeader}
        onClick={toggleExpanded}
        onKeyDown={handleKeyDown}
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
      >
        <div className={styles.domainTitleRow}>
          <span className={styles.domainIcon}>{config.icon}</span>
          <div className={styles.domainTitleGroup}>
            <h3 className={styles.domainTitle}>{config.title}</h3>
            <p className={styles.domainSubtitle}>{config.subtitle}</p>
            {!isExpanded && (displayStrengths.length > 0 || displayGrowthAreas.length > 0) && (
              <p className={styles.insightPreview}>
                {displayStrengths.length > 0 && `${displayStrengths.length} strength${displayStrengths.length !== 1 ? 's' : ''}`}
                {displayStrengths.length > 0 && displayGrowthAreas.length > 0 && ' \u00B7 '}
                {displayGrowthAreas.length > 0 && `${displayGrowthAreas.length} growth area${displayGrowthAreas.length !== 1 ? 's' : ''}`}
              </p>
            )}
          </div>
        </div>
        <div className={styles.domainHeaderRight}>
          {domainScore !== undefined && (
            <ScoreGauge score={domainScore} label={config.scoreLabel} />
          )}
          <span className={styles.expandPill} aria-hidden="true">
            {isExpanded ? '\u25B4 Hide' : '\u25BE View'}
          </span>
        </div>
      </div>

      <div className={styles.contentWrapper} data-expanded={isExpanded || undefined}>
      <div className={styles.contentInner}>

      {/* Section Context Block — explains what this section analyzed */}
      <div className={styles.sectionContext}>
        <span className={styles.sectionContextIcon}>{'📋'}</span>
        <span>{config.contextDescription}</span>
      </div>

      <div className={styles.insightsGrid}>
        {/* Summary Count Banner */}
        <div className={styles.summaryBanner}>
          {displayStrengths.length > 0 && (
            <span className={styles.summaryStrengths}>
              {'●'} {displayStrengths.length} strength{displayStrengths.length !== 1 ? 's' : ''}
            </span>
          )}
          {displayStrengths.length > 0 && displayGrowthAreas.length > 0 && (
            <span className={styles.summaryDivider}>{'·'}</span>
          )}
          {displayGrowthAreas.length > 0 && (
            <span className={styles.summaryGrowth}>
              {'▲'} {displayGrowthAreas.length} growth area{displayGrowthAreas.length !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Strengths Column */}
        {displayStrengths.length > 0 && (
          <div className={styles.insightsColumn}>
            <h4 className={`${styles.columnTitle} ${styles.columnTitleStrength}`}>
              <span className={styles.columnIcon} data-type="strength">{'✓'}</span>
              <span>What You Do Well</span>
              <span className={`${styles.columnCount} ${styles.columnCountStrength}`}>
                {displayStrengths.length}
              </span>
            </h4>
            <div className={styles.cardsContainer}>
              {displayStrengths.map((strength, idx) => (
                <StrengthCard
                  key={idx}
                  strength={strength}
                  utteranceLookup={utteranceLookup}
                  onViewContext={onViewContext}
                />
              ))}
            </div>
          </div>
        )}

        {/* Growth Areas Column */}
        {displayGrowthAreas.length > 0 && (
          <div className={styles.insightsColumn}>
            <h4 className={`${styles.columnTitle} ${styles.columnTitleGrowth}`}>
              <span className={styles.columnIcon} data-type="growth">{'↑'}</span>
              <span>Where to Improve</span>
              <span className={`${styles.columnCount} ${styles.columnCountGrowth}`}>
                {displayGrowthAreas.length}
              </span>
            </h4>
            <div className={styles.cardsContainer}>
              {displayGrowthAreas.map((growth, idx) => {
                // Use original (English) growthAreas for insight lookup key matching
                // displayGrowthAreas has translated titles which don't match insightAllocation keys
                const originalGrowth = growthAreas[idx];
                const insight = originalGrowth ? getInsightForGrowth(originalGrowth) : undefined;
                return (
                  <GrowthCard
                    key={idx}
                    growth={growth}
                    utteranceLookup={utteranceLookup}
                    referencedInsights={insight ? [insight] : undefined}
                    onViewContext={onViewContext}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      </div>
      </div>

    </section>
  );
}

/**
 * Map worker domain keys to TranslatedAgentInsights keys.
 *
 * v3 workers (thinkingQuality, learningBehavior, contextEfficiency) are processed
 * by the Phase 4 Translator stage which populates TranslatedAgentInsights with
 * matching keys. This mapping enables the frontend to look up translated data
 * for each domain when rendering non-English reports.
 *
 * Legacy keys (knowledgeGap, temporalAnalysis) are kept for cached data compatibility.
 */
const DOMAIN_TO_TRANSLATION_KEY: Partial<Record<keyof AggregatedWorkerInsights, keyof TranslatedAgentInsights>> = {
  // v3 workers (2026-02)
  thinkingQuality: 'thinkingQuality',
  communicationPatterns: 'communicationPatterns',
  learningBehavior: 'learningBehavior',
  contextEfficiency: 'contextEfficiency',
  sessionOutcome: 'sessionOutcome',
  // Legacy workers (kept for cached data)
  knowledgeGap: 'knowledgeGap',
};

/**
 * Main WorkerInsightsSection component
 *
 * Renders domain-specific insights from Phase 2 workers with optional
 * translation overlay from Phase 4 Translator output.
 *
 * Data-driven UI: No isPaid prop needed.
 * - recommendation presence in growth areas indicates paid tier
 * - utteranceLookup presence enables "View original" feature
 *
 * Professional Insights Sidebar:
 * - Displays insights inline within growth cards
 * - Managed at section level to avoid multiple sidebar instances
 */
export function WorkerInsightsSection({
  workerInsights,
  translatedAgentInsights,
  utteranceLookup,
}: WorkerInsightsSectionProps) {
  // Debug logging: Frontend data flow tracking (dev only)
  if (process.env.NODE_ENV === 'development') {
    console.log('[WorkerInsightsSection] translatedAgentInsights:', translatedAgentInsights);
    console.log('[WorkerInsightsSection] translatedAgentInsights keys:',
      translatedAgentInsights ? Object.keys(translatedAgentInsights) : 'undefined');
    console.log('[WorkerInsightsSection] utteranceLookup count:', utteranceLookup?.length ?? 0);
  }

  // Build utterance lookup map for O(1) access
  const utteranceLookupMap = useMemo(() => {
    if (!utteranceLookup || utteranceLookup.length === 0) return undefined;
    const map = new Map<string, UtteranceLookupEntry>();
    for (const entry of utteranceLookup) {
      map.set(entry.id, entry);
    }
    return map;
  }, [utteranceLookup]);

  // Count total insights for empty state
  const totalInsights = useMemo(() => {
    if (!workerInsights) return 0;
    let count = 0;
    for (const key of Object.keys(workerInsights)) {
      const domain = workerInsights[key as keyof AggregatedWorkerInsights];
      if (domain) {
        count += domain.strengths.length + domain.growthAreas.length;
      }
    }
    return count;
  }, [workerInsights]);

  if (!workerInsights || totalInsights === 0) {
    return (
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📊</span>
        <p className={styles.emptyText}>
          No domain insights available yet. Run more analysis sessions to see personalized insights.
        </p>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Your Insights</h2>
        <p className={styles.sectionSubtitle}>
          Domain-specific strengths and growth areas based on your AI collaboration patterns
        </p>
      </div>

      <div className={styles.domainsContainer}>
        {WORKER_DOMAIN_CONFIGS.map((config) => {
          const domain = workerInsights[config.key];
          if (!domain) return null;

          // Get translated data for this domain if available
          const translationKey = DOMAIN_TO_TRANSLATION_KEY[config.key];
          const translatedInsight = translationKey ? translatedAgentInsights?.[translationKey] : undefined;

          return (
            <WorkerDomainSection
              key={config.key}
              config={config}
              strengths={domain.strengths}
              growthAreas={domain.growthAreas}
              translatedStrengthsData={translatedInsight?.strengths ?? translatedInsight?.strengthsData}
              translatedGrowthAreasData={translatedInsight?.growthAreas ?? translatedInsight?.growthAreasData}
              utteranceLookup={utteranceLookupMap}
              domainScore={domain.domainScore}
              referencedInsights={domain.referencedInsights}
            />
          );
        })}
      </div>
    </div>
  );
}
