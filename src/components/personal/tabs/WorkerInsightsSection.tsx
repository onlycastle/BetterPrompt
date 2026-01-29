/**
 * WorkerInsightsSection Component
 *
 * Renders domain-specific insights from Phase 2 workers directly.
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
 * Workers displayed:
 * - Trust & Verification (TrustVerificationWorker)
 * - Workflow & Planning (WorkflowHabitWorker)
 * - Knowledge & Learning (KnowledgeGapWorker)
 * - Context Efficiency (ContextEfficiencyWorker)
 */

import { useMemo } from 'react';
import type { AggregatedWorkerInsights, WorkerStrength, WorkerGrowth, EvidenceItem } from '../../../lib/models/worker-insights';
import {
  WORKER_DOMAIN_CONFIGS,
  type WorkerDomainConfig,
  applyTranslatedStrengths,
  applyTranslatedGrowthAreas,
} from '../../../lib/models/worker-insights';
import type { TranslatedAgentInsights, UtteranceLookupEntry } from '../../../lib/models/verbose-evaluation';
import { ExpandableEvidence } from './ExpandableEvidence';
import styles from './WorkerInsightsSection.module.css';

interface WorkerInsightsSectionProps {
  /** Aggregated insights from all Phase 2 workers */
  workerInsights?: AggregatedWorkerInsights;
  /** Translated agent insights from Phase 4 Translator (non-English only) */
  translatedAgentInsights?: TranslatedAgentInsights;
  /** Utterance lookup for evidence linking */
  utteranceLookup?: UtteranceLookupEntry[];
  /** Whether user has paid tier for full content */
  isPaid?: boolean;
}

/**
 * Circular score gauge with animated SVG ring
 */
function ScoreGauge({ score, label }: { score: number; label: string }) {
  // SVG circle circumference: 2 * PI * radius (radius = 25)
  const circumference = 2 * Math.PI * 25; // ≈ 157
  const offset = circumference - (circumference * score / 100);

  let scoreClass = styles.scoreLow;
  if (score >= 70) {
    scoreClass = styles.scoreHigh;
  } else if (score >= 40) {
    scoreClass = styles.scoreMedium;
  }

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
 */
function StrengthCard({
  strength,
  utteranceLookup,
  isPaid,
}: {
  strength: WorkerStrength;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  isPaid: boolean;
}) {
  return (
    <div className={styles.insightCard}>
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle}>{strength.title}</h4>
        {strength.frequency !== undefined && (
          <span className={styles.frequencyBadge}>{Math.round(strength.frequency)}%</span>
        )}
      </div>
      <p className={styles.cardDescription}>{strength.description}</p>
      {strength.evidence.length > 0 && (
        <ExpandableEvidence
          evidence={strength.evidence}
          utteranceLookup={utteranceLookup}
          isPaid={isPaid}
          maxItems={4}
        />
      )}
    </div>
  );
}

/**
 * Card component for a single growth area
 * CSS ::before pseudo-element handles the '!' prefix
 */
function GrowthCard({
  growth,
  utteranceLookup,
  isPaid,
}: {
  growth: WorkerGrowth;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  isPaid: boolean;
}) {
  const severityClass = growth.severity ? styles[`severity${growth.severity.charAt(0).toUpperCase() + growth.severity.slice(1)}`] : '';

  return (
    <div className={`${styles.insightCard} ${styles.growthCard}`}>
      <div className={styles.cardHeader}>
        <h4 className={styles.cardTitle}>{growth.title}</h4>
        {growth.severity && (
          <span className={`${styles.severityBadge} ${severityClass}`}>
            {growth.severity}
          </span>
        )}
      </div>
      <p className={styles.cardDescription}>{growth.description}</p>
      {growth.evidence.length > 0 && (
        <ExpandableEvidence
          evidence={growth.evidence}
          utteranceLookup={utteranceLookup}
          isPaid={isPaid}
          maxItems={4}
        />
      )}
      {isPaid && growth.recommendation && (
        <div className={styles.recommendationSection}>
          <span className={styles.recommendationLabel}>Recommendation</span>
          <p className={styles.recommendationText}>{growth.recommendation}</p>
        </div>
      )}
      {!isPaid && growth.recommendation && (
        <div className={styles.lockedContent}>
          <span className={styles.lockIcon}>🔒</span>
          <span>Unlock recommendations with Premium</span>
        </div>
      )}
    </div>
  );
}

/**
 * Single worker domain section
 *
 * Applies translation overlay when translatedStrengthsData/translatedGrowthAreasData
 * are provided. This overlays translated title/description/recommendation on top
 * of the original English data while preserving evidence quotes in source language.
 */
function WorkerDomainSection({
  config,
  strengths,
  growthAreas,
  translatedStrengthsData,
  translatedGrowthAreasData,
  utteranceLookup,
  domainScore,
  isPaid,
}: {
  config: WorkerDomainConfig;
  strengths: WorkerStrength[];
  growthAreas: WorkerGrowth[];
  translatedStrengthsData?: string;
  translatedGrowthAreasData?: string;
  utteranceLookup?: Map<string, UtteranceLookupEntry>;
  domainScore?: number;
  isPaid: boolean;
}) {
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
                  isPaid={isPaid}
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
              {displayGrowthAreas.map((growth, idx) => (
                <GrowthCard
                  key={idx}
                  growth={growth}
                  utteranceLookup={utteranceLookup}
                  isPaid={isPaid}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Map worker domain keys to TranslatedAgentInsights keys.
 *
 * The worker domain keys match the TranslatedAgentInsights keys directly
 * for v2 workers (trustVerification, workflowHabit, knowledgeGap, contextEfficiency).
 */
const DOMAIN_TO_TRANSLATION_KEY: Record<keyof AggregatedWorkerInsights, keyof TranslatedAgentInsights> = {
  trustVerification: 'trustVerification',
  workflowHabit: 'workflowHabit',
  knowledgeGap: 'knowledgeGap',
  contextEfficiency: 'contextEfficiency',
};

/**
 * Main WorkerInsightsSection component
 *
 * Renders domain-specific insights from Phase 2 workers with optional
 * translation overlay from Phase 4 Translator output.
 */
export function WorkerInsightsSection({
  workerInsights,
  translatedAgentInsights,
  utteranceLookup,
  isPaid = false,
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
          const translatedInsight = translatedAgentInsights?.[translationKey];

          return (
            <WorkerDomainSection
              key={config.key}
              config={config}
              strengths={domain.strengths}
              growthAreas={domain.growthAreas}
              translatedStrengthsData={translatedInsight?.strengthsData}
              translatedGrowthAreasData={translatedInsight?.growthAreasData}
              utteranceLookup={utteranceLookupMap}
              domainScore={domain.domainScore}
              isPaid={isPaid}
            />
          );
        })}
      </div>
    </div>
  );
}

export default WorkerInsightsSection;
