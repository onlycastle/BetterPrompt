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

import { useMemo, useState, useCallback } from 'react';
import type { AggregatedWorkerInsights, WorkerStrength, WorkerGrowth, EvidenceItem, ReferencedInsight } from '../../../../lib/models/worker-insights';
import React from 'react';
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
import { ProfessionalInsightSidebar } from './ProfessionalInsightSidebar';
import { InsightIndicator } from './InsightIndicator';
import styles from './WorkerInsightsSection.module.css';

// Type guards to check if a strength/growth has communication pattern metadata
function isCommunicationStrength(
  item: WorkerStrength
): item is CommunicationStrength {
  return '_meta' in item && (item as CommunicationStrength)._meta?.source === 'communication_pattern';
}

function isCommunicationGrowth(
  item: WorkerGrowth
): item is CommunicationGrowth {
  return '_meta' in item && (item as CommunicationGrowth)._meta?.source === 'communication_pattern';
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
  if (score >= 70) {
    return styles.scoreHigh;
  }
  if (score >= 40) {
    return styles.scoreMedium;
  }
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
function renderUrgencyLabel(severity: string | undefined): React.ReactNode {
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
 * - Shows InsightIndicator when referencedInsights are present
 * - Clicking opens ProfessionalInsightSidebar
 */
function GrowthCard({
  growth,
  utteranceLookup,
  referencedInsights,
  onInsightClick,
  onViewContext,
}: {
  growth: WorkerGrowth;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  referencedInsights?: ReferencedInsight[];
  onInsightClick?: (insight: ReferencedInsight, yOffset?: number) => void;
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
          {/* Professional Insight indicator */}
          {referencedInsights && referencedInsights.length > 0 && onInsightClick && (
            <InsightIndicator
              insights={referencedInsights}
              onClick={onInsightClick}
            />
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
          <span className={styles.recommendationLabel}>Recommendation</span>
          <p className={styles.recommendationText}>{growth.recommendation}</p>
        </div>
      ) : (
        <div className={`${styles.lockedRecommendation} ${getLockedRecommendationClass(growth.severity)}`}>
          {/* Severity-based urgency label */}
          {renderUrgencyLabel(growth.severity)}

          {/* Coaching Preview */}
          <div className={styles.coachingPreview}>
            <span className={styles.recommendationLabel}>Personalized coaching:</span>
          </div>

          <button className={styles.unlockCta} type="button">
            <span className={styles.lockIcon}>🔓</span>
            Unlock Coaching Tips
          </button>
        </div>
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
  /** Callback when insight indicator is clicked (includes Y offset for inline positioning) */
  onInsightClick?: (insight: ReferencedInsight, yOffset?: number) => void;
  /** Deduplicated insight allocation from TabbedReportContainer */
  insightAllocation?: InsightAllocation;
  /** Domain key for looking up allocated insights (e.g., 'thinkingQuality') */
  domainKey?: string;
  /** Callback to open the Source Context sidebar for a specific utterance */
  onViewContext?: (utteranceId: string) => void;
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
  onInsightClick,
  insightAllocation,
  domainKey,
  onViewContext,
}: WorkerDomainSectionProps) {
  // Professional Insight Sidebar state (for this domain)
  const [selectedInsight, setSelectedInsight] = useState<ReferencedInsight | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Handle insight indicator click - open sidebar with selected insight
  const handleInsightClick = useCallback((insight: ReferencedInsight, yOffset?: number) => {
    // Use provided callback or default to local sidebar
    if (onInsightClick) {
      onInsightClick(insight, yOffset);
    } else {
      setSelectedInsight(insight);
      setIsSidebarOpen(true);
    }
  }, [onInsightClick]);

  // Handle sidebar close
  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    // Clear selected insight after animation
    setTimeout(() => setSelectedInsight(null), 300);
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
    <section className={styles.domainSection}>
      <div className={styles.domainHeader}>
        <div className={styles.domainTitleRow}>
          <span className={styles.domainIcon}>{config.icon}</span>
          <div className={styles.domainTitleGroup}>
            <h3 className={styles.domainTitle}>{config.title}</h3>
            <p className={styles.domainSubtitle}>{config.subtitle}</p>
          </div>
        </div>
        {domainScore !== undefined && (
          <ScoreGauge score={domainScore} label={config.scoreLabel} />
        )}
      </div>

      <div className={styles.insightsGrid}>
        {/* Strengths Column */}
        {displayStrengths.length > 0 && (
          <div className={styles.insightsColumn}>
            <h4 className={styles.columnTitle}>Strengths</h4>
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
            <h4 className={styles.columnTitle}>Growth Areas</h4>
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
                    onInsightClick={handleInsightClick}
                    onViewContext={onViewContext}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Professional Insight Sidebar - only rendered if no external onInsightClick */}
      {!onInsightClick && (
        <ProfessionalInsightSidebar
          insight={selectedInsight}
          isOpen={isSidebarOpen}
          onClose={handleCloseSidebar}
        />
      )}
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
 * - Displays full insight details when InsightIndicator is clicked
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

  // Professional Insight Sidebar state
  const [selectedInsight, setSelectedInsight] = useState<ReferencedInsight | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Handle insight indicator click - open sidebar with selected insight
  const handleInsightClick = useCallback((insight: ReferencedInsight) => {
    setSelectedInsight(insight);
    setIsSidebarOpen(true);
  }, []);

  // Handle sidebar close
  const handleCloseSidebar = useCallback(() => {
    setIsSidebarOpen(false);
    // Clear selected insight after animation
    setTimeout(() => setSelectedInsight(null), 300);
  }, []);

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
              onInsightClick={handleInsightClick}
            />
          );
        })}
      </div>

      {/* Professional Insight Sidebar - rendered at section level */}
      <ProfessionalInsightSidebar
        insight={selectedInsight}
        isOpen={isSidebarOpen}
        onClose={handleCloseSidebar}
      />
    </div>
  );
}
