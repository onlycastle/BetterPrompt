/**
 * GrowthInsightsSection Component
 *
 * Aggregates growth areas from ALL agents (both free and premium tiers)
 * and displays them in card format.
 *
 * Free users see growth areas from Pattern Detective + Metacognition
 * Premium users see growth areas from all 7 agents
 *
 * Learning resources are displayed inline within each card when matched,
 * using a 2-column layout with the resource bubble on the right side.
 */

import { useMemo } from 'react';
import { Card } from '../../ui/Card';
import { ResourceBubble } from './ResourceBubble';
import type { AgentOutputs, AgentGrowthArea, ParsedResource } from '../../../lib/models/agent-outputs';
import { getAllAgentGrowthAreas, getAllTranslatedGrowthAreas, hasTranslatedInsights } from '../../../lib/models/agent-outputs';
import type { TranslatedAgentInsights } from '../../../lib/models/verbose-evaluation';
import styles from './GrowthInsightsSection.module.css';

/**
 * Severity level type for growth areas
 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Calculate severity level based on frequency (evidence count or frequency percentage)
 * - Critical: 70%+ occurrence or 5+ evidence instances
 * - High: 40-70% or 3-4 evidence instances
 * - Medium: 20-40% or 2 evidence instances
 * - Low: <20% or 0-1 evidence instances
 */
export function calculateSeverity(
  frequencyPercent?: number,
  evidenceCount?: number
): SeverityLevel {
  // If frequency percentage is provided, use it
  if (frequencyPercent !== undefined) {
    if (frequencyPercent >= 70) return 'critical';
    if (frequencyPercent >= 40) return 'high';
    if (frequencyPercent >= 20) return 'medium';
    return 'low';
  }

  // Otherwise use evidence count as a proxy
  const count = evidenceCount ?? 0;
  if (count >= 5) return 'critical';
  if (count >= 3) return 'high';
  if (count >= 2) return 'medium';
  return 'low';
}

/**
 * Get severity badge configuration
 */
export function getSeverityBadge(severity: SeverityLevel): {
  emoji: string;
  label: string;
  className: string;
} {
  switch (severity) {
    case 'critical':
      return { emoji: '🔴', label: 'Critical', className: styles.severityCritical };
    case 'high':
      return { emoji: '🟠', label: 'High', className: styles.severityHigh };
    case 'medium':
      return { emoji: '🟡', label: 'Medium', className: styles.severityMedium };
    case 'low':
      return { emoji: '⚪', label: 'Low', className: styles.severityLow };
  }
}

interface GrowthInsightsSectionProps {
  agentOutputs?: AgentOutputs;
  isPaid?: boolean;
  /** Map of topic -> resources for inline matching */
  resourcesMap?: Map<string, ParsedResource[]>;
  /** Translated agent insights (for non-English output) - uses when available */
  translatedAgentInsights?: TranslatedAgentInsights;
}

/** Maximum number of evidence quotes to display per growth area */
const MAX_EVIDENCE_QUOTES = 2;

/**
 * Find matching resources for a growth area title
 * Uses fuzzy matching - checks if topic appears in title or vice versa
 */
function findMatchingResources(
  title: string,
  resourcesMap?: Map<string, ParsedResource[]>
): ParsedResource[] {
  if (!resourcesMap || resourcesMap.size === 0) return [];

  const titleLower = title.toLowerCase();
  const matchedResources: ParsedResource[] = [];

  resourcesMap.forEach((resources, topic) => {
    // Check if topic appears in title or title appears in topic
    if (titleLower.includes(topic) || topic.includes(titleLower)) {
      matchedResources.push(...resources);
    }
  });

  return matchedResources;
}

interface GrowthAreaCardProps {
  area: AgentGrowthArea;
  isPaid: boolean;
  isFirstItem: boolean;
  resourcesMap?: Map<string, ParsedResource[]>;
}

function GrowthAreaCard({ area, isPaid, isFirstItem, resourcesMap }: GrowthAreaCardProps) {
  // Show full recommendation if isPaid OR first item (free preview)
  const showFullRecommendation = isPaid || isFirstItem;
  const matchedResources = findMatchingResources(area.title, resourcesMap);

  // Calculate severity based on evidence count (or frequency if available)
  const severity = calculateSeverity(area.frequency, area.evidence.length);
  const severityBadge = getSeverityBadge(severity);

  const hasResources = matchedResources.length > 0;

  return (
    <Card padding="md" className={styles.growthCard}>
      <div className={hasResources ? styles.cardInnerLayout : undefined}>
        <div className={styles.cardMainContent}>
          <div className={styles.cardHeader}>
            <div className={styles.titleWithBadge}>
              <span className={`${styles.severityBadge} ${severityBadge.className}`}>
                {severityBadge.emoji}
              </span>
              <h4 className={styles.growthTitle}>{area.title}</h4>
            </div>
            {area.evidence.length > 0 && (
              <span className={styles.evidenceCount}>{area.evidence.length} instances</span>
            )}
          </div>

          <p className={styles.growthDescription}>{area.description}</p>

          {/* Evidence quotes */}
          {area.evidence.length > 0 && (
            <div className={styles.evidenceQuotes}>
              {area.evidence.slice(0, MAX_EVIDENCE_QUOTES).map((quote, qIdx) => (
                <blockquote key={qIdx} className={styles.quote}>
                  "{quote}"
                </blockquote>
              ))}
            </div>
          )}

          {/* Recommendation - locked for free users EXCEPT first item */}
          {area.recommendation && (
            <div className={`${styles.recommendation} ${!showFullRecommendation ? styles.recommendationLocked : ''}`}>
              <span className={styles.recommendationLabel}>💡 Try this:</span>
              {showFullRecommendation ? (
                <span className={styles.recommendationText}>{area.recommendation}</span>
              ) : (
                <span className={styles.lockedContent}>
                  <span className={styles.blurredText}>{area.recommendation.slice(0, 25)}...</span>
                  <span className={styles.unlockBadge}>🔒 See recommendation</span>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Inline resource bubble - inside the card */}
        {hasResources && (
          <ResourceBubble resources={matchedResources} isPaid={isPaid} inline />
        )}
      </div>
    </Card>
  );
}

export function GrowthInsightsSection({
  agentOutputs,
  isPaid = false,
  resourcesMap,
  translatedAgentInsights,
}: GrowthInsightsSectionProps) {
  // Collect ALL growth areas from all agents
  // Use translated data when available, fallback to original agentOutputs
  const allGrowthAreas = useMemo(() => {
    // Prefer translated insights if available
    if (hasTranslatedInsights(translatedAgentInsights)) {
      return getAllTranslatedGrowthAreas(translatedAgentInsights);
    }
    // Fallback to original agent outputs
    if (!agentOutputs) return [];
    return getAllAgentGrowthAreas(agentOutputs);
  }, [agentOutputs, translatedAgentInsights]);

  if (allGrowthAreas.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Growth Insights</h3>
        <p className={styles.subtitle}>
          Areas for improvement identified from your coding sessions
        </p>
      </div>

      <div className={styles.list}>
        {allGrowthAreas.map((area, idx) => (
          <GrowthAreaCard
            key={idx}
            area={area}
            isPaid={isPaid}
            isFirstItem={idx === 0}
            resourcesMap={resourcesMap}
          />
        ))}
      </div>

      {/* Premium teaser for free users */}
      {!isPaid && (
        <div className={styles.premiumTeaser}>
          <span className={styles.premiumIcon}>✨</span>
          <span className={styles.premiumText}>
            Unlock all growth insights from 7 AI agents + personalized learning resources
          </span>
        </div>
      )}
    </div>
  );
}

export default GrowthInsightsSection;
