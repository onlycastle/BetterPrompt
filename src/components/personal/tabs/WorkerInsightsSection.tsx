/**
 * WorkerInsightsSection Component
 *
 * Renders domain-specific insights from Phase 2 workers directly.
 * Each worker's strengths and growth areas are displayed in a dedicated section.
 *
 * This replaces the centralized StrengthGrowthSynthesizer approach with
 * direct worker-to-frontend data flow.
 *
 * Workers displayed:
 * - Trust & Verification (TrustVerificationWorker)
 * - Workflow & Planning (WorkflowHabitWorker)
 * - Knowledge & Learning (KnowledgeGapWorker)
 * - Context Efficiency (ContextEfficiencyWorker)
 */

import { useMemo } from 'react';
import type { AggregatedWorkerInsights, WorkerStrength, WorkerGrowth } from '../../../lib/models/worker-insights';
import { WORKER_DOMAIN_CONFIGS, type WorkerDomainConfig } from '../../../lib/models/worker-insights';
import styles from './WorkerInsightsSection.module.css';

interface WorkerInsightsSectionProps {
  /** Aggregated insights from all Phase 2 workers */
  workerInsights?: AggregatedWorkerInsights;
  /** Whether user has paid tier for full content */
  isPaid?: boolean;
}

/**
 * Badge to display domain score
 */
function ScoreBadge({ score, label }: { score: number; label: string }) {
  let scoreClass = styles.scoreLow;
  if (score >= 70) {
    scoreClass = styles.scoreHigh;
  } else if (score >= 40) {
    scoreClass = styles.scoreMedium;
  }

  return (
    <div className={`${styles.scoreBadge} ${scoreClass}`}>
      <span className={styles.scoreValue}>{score}</span>
      <span className={styles.scoreLabel}>{label}</span>
    </div>
  );
}

/**
 * Card component for a single strength
 */
function StrengthCard({ strength, isPaid }: { strength: WorkerStrength; isPaid: boolean }) {
  return (
    <div className={styles.insightCard}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>✅</span>
        <h4 className={styles.cardTitle}>{strength.title}</h4>
        {strength.frequency !== undefined && (
          <span className={styles.frequencyBadge}>{Math.round(strength.frequency)}%</span>
        )}
      </div>
      <p className={styles.cardDescription}>{strength.description}</p>
      {isPaid && strength.evidence.length > 0 && (
        <div className={styles.evidenceSection}>
          <span className={styles.evidenceLabel}>Evidence</span>
          <ul className={styles.evidenceList}>
            {strength.evidence.slice(0, 2).map((quote, idx) => (
              <li key={idx} className={styles.evidenceItem}>
                "{quote.length > 100 ? `${quote.slice(0, 97)}...` : quote}"
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * Card component for a single growth area
 */
function GrowthCard({ growth, isPaid }: { growth: WorkerGrowth; isPaid: boolean }) {
  const severityClass = growth.severity ? styles[`severity${growth.severity.charAt(0).toUpperCase() + growth.severity.slice(1)}`] : '';

  return (
    <div className={`${styles.insightCard} ${styles.growthCard}`}>
      <div className={styles.cardHeader}>
        <span className={styles.cardIcon}>🔧</span>
        <h4 className={styles.cardTitle}>{growth.title}</h4>
        {growth.severity && (
          <span className={`${styles.severityBadge} ${severityClass}`}>
            {growth.severity}
          </span>
        )}
      </div>
      <p className={styles.cardDescription}>{growth.description}</p>
      {isPaid && (
        <>
          {growth.evidence.length > 0 && (
            <div className={styles.evidenceSection}>
              <span className={styles.evidenceLabel}>Evidence</span>
              <ul className={styles.evidenceList}>
                {growth.evidence.slice(0, 2).map((quote, idx) => (
                  <li key={idx} className={styles.evidenceItem}>
                    "{quote.length > 100 ? `${quote.slice(0, 97)}...` : quote}"
                  </li>
                ))}
              </ul>
            </div>
          )}
          {growth.recommendation && (
            <div className={styles.recommendationSection}>
              <span className={styles.recommendationLabel}>💡 Recommendation</span>
              <p className={styles.recommendationText}>{growth.recommendation}</p>
            </div>
          )}
        </>
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
 */
function WorkerDomainSection({
  config,
  strengths,
  growthAreas,
  domainScore,
  isPaid,
}: {
  config: WorkerDomainConfig;
  strengths: WorkerStrength[];
  growthAreas: WorkerGrowth[];
  domainScore?: number;
  isPaid: boolean;
}) {
  const hasContent = strengths.length > 0 || growthAreas.length > 0;

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
          <ScoreBadge score={domainScore} label={config.scoreLabel} />
        )}
      </div>

      <div className={styles.insightsGrid}>
        {/* Strengths Column */}
        {strengths.length > 0 && (
          <div className={styles.insightsColumn}>
            <h4 className={styles.columnTitle}>
              <span className={styles.columnIcon}>✅</span> Strengths
            </h4>
            <div className={styles.cardsContainer}>
              {strengths.map((strength, idx) => (
                <StrengthCard key={idx} strength={strength} isPaid={isPaid} />
              ))}
            </div>
          </div>
        )}

        {/* Growth Areas Column */}
        {growthAreas.length > 0 && (
          <div className={styles.insightsColumn}>
            <h4 className={styles.columnTitle}>
              <span className={styles.columnIcon}>🔧</span> Areas to Improve
            </h4>
            <div className={styles.cardsContainer}>
              {growthAreas.map((growth, idx) => (
                <GrowthCard key={idx} growth={growth} isPaid={isPaid} />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * Main WorkerInsightsSection component
 */
export function WorkerInsightsSection({
  workerInsights,
  isPaid = false,
}: WorkerInsightsSectionProps) {
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

          return (
            <WorkerDomainSection
              key={config.key}
              config={config}
              strengths={domain.strengths}
              growthAreas={domain.growthAreas}
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
