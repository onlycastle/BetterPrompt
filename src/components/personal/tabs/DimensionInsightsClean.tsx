/**
 * DimensionInsightsClean Component
 * Notion/Linear style dimension insights display
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../../ui/Card';
import { ResourceBubble } from './ResourceBubble';
import type { PerDimensionInsight, DimensionName } from '../../../types/verbose';
import type { ParsedResource } from '../../../lib/models/agent-outputs';
import styles from './DimensionInsightsClean.module.css';

interface DimensionInsightsCleanProps {
  insights: PerDimensionInsight[];
  sessionsAnalyzed: number;
  isPaid?: boolean;
  resourcesMap?: Map<string, ParsedResource[]>;
}

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

interface DimensionStyle {
  accent: string;
  bg: string;
}

// Unified cyan accent for visual consistency
// Color differentiation now only for semantic states (score gauges)
const DIMENSION_STYLES: Record<DimensionName, DimensionStyle> = {
  aiCollaboration: { accent: 'var(--sketch-cyan)', bg: 'var(--sketch-cyan-soft)' },
  contextEngineering: { accent: 'var(--sketch-cyan)', bg: 'var(--sketch-cyan-soft)' },
  toolMastery: { accent: 'var(--sketch-cyan)', bg: 'var(--sketch-cyan-soft)' },
  burnoutRisk: { accent: 'var(--sketch-cyan)', bg: 'var(--sketch-cyan-soft)' },
  aiControl: { accent: 'var(--sketch-cyan)', bg: 'var(--sketch-cyan-soft)' },
  skillResilience: { accent: 'var(--sketch-cyan)', bg: 'var(--sketch-cyan-soft)' },
};

const DEFAULT_STYLE: DimensionStyle = { accent: 'var(--text-secondary)', bg: 'var(--surface-2)' };

/** Maximum number of evidence quotes to display per item */
const MAX_EVIDENCE_QUOTES = 3;

interface DimensionCardProps {
  insight: PerDimensionInsight;
  isPaid: boolean;
  resourcesMap?: Map<string, ParsedResource[]>;
}

function DimensionCard({ insight, isPaid, resourcesMap }: DimensionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = DIMENSION_STYLES[insight.dimension] || DEFAULT_STYLE;

  const totalEvidence =
    insight.strengths.reduce((sum, s) => sum + (s.evidence?.length ?? 0), 0) +
    insight.growthAreas.reduce((sum, g) => sum + (g.evidence?.length ?? 0), 0);

  return (
    <Card padding="md" className={styles.dimensionCard}>
      <button
        className={styles.cardHeader}
        onClick={() => setExpanded(!expanded)}
        type="button"
      >
        <div className={styles.headerLeft}>
          <div
            className={styles.indicator}
            style={{ backgroundColor: style.accent }}
          />
          <div>
            <h4 className={styles.dimensionName}>{insight.dimensionDisplayName}</h4>
            <span className={styles.evidenceCount}>{totalEvidence} quotes analyzed</span>
          </div>
        </div>
        <div className={styles.headerRight}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </div>
      </button>

      {expanded && (
        <div className={styles.cardContent}>
          {/* Strengths */}
          {insight.strengths.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Strengths</div>
              {insight.strengths.map((strength, idx) => (
                <div key={idx} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTitle}>{strength.title}</span>
                    <span
                      className={styles.itemCount}
                      style={{ color: style.accent, backgroundColor: style.bg }}
                    >
                      {strength.evidence?.length ?? 0} instances
                    </span>
                  </div>
                  <p className={styles.itemDescription}>{strength.description}</p>
                  {/* Show up to MAX_EVIDENCE_QUOTES quotes for richer evidence display */}
                  {strength.evidence && strength.evidence.length > 0 && (
                    <div className={styles.evidenceQuotes}>
                      {strength.evidence.slice(0, MAX_EVIDENCE_QUOTES).map((quote, qIdx) => (
                        <blockquote key={qIdx} className={styles.itemQuote}>
                          "{quote}"
                        </blockquote>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Growth Areas */}
          {insight.growthAreas.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>Growth Areas</div>
              {insight.growthAreas.map((growth, idx) => {
                const matchedResources = findMatchingResources(growth.title, resourcesMap);

                return (
                  <div key={idx} className={styles.growthRow}>
                    <div className={styles.item}>
                      <div className={styles.itemHeader}>
                        <span className={styles.itemTitle}>{growth.title}</span>
                        <span className={styles.itemCountGrowth}>
                          {growth.evidence?.length ?? 0} instances
                        </span>
                      </div>
                      <p className={styles.itemDescription}>{growth.description}</p>
                      {/* Show up to MAX_EVIDENCE_QUOTES quotes for richer evidence display */}
                      {growth.evidence && growth.evidence.length > 0 && (
                        <div className={styles.evidenceQuotes}>
                          {growth.evidence.slice(0, MAX_EVIDENCE_QUOTES).map((quote, qIdx) => (
                            <blockquote key={qIdx} className={styles.itemQuote}>
                              "{quote}"
                            </blockquote>
                          ))}
                        </div>
                      )}
                      {/* Prominent recommendation display - locked for free users */}
                      {growth.recommendation && (
                        <div className={`${styles.recommendation} ${!isPaid ? styles.recommendationLocked : ''}`}>
                          <span className={styles.recommendationLabel}>💡 Try this:</span>
                          {isPaid ? (
                            <span className={styles.recommendationText}>{growth.recommendation}</span>
                          ) : (
                            <span className={styles.lockedContent}>
                              <span className={styles.blurredText}>{growth.recommendation.slice(0, 25)}...</span>
                              <span className={styles.unlockBadge}>🔒 See recommendation</span>
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    {matchedResources.length > 0 && (
                      <ResourceBubble resources={matchedResources} isPaid={isPaid} />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function DimensionInsightsClean({ insights, sessionsAnalyzed, isPaid = false, resourcesMap }: DimensionInsightsCleanProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  // All dimensions visible - "진단 무료, 처방 유료"
  // Count recommendations that would be unlocked
  const recommendationCount = insights.reduce(
    (sum, i) => sum + i.growthAreas.filter(g => g.recommendation).length,
    0
  );

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Dimension Insights</h3>
        <span className={styles.subtitle}>
          Based on {sessionsAnalyzed} session{sessionsAnalyzed !== 1 ? 's' : ''} analyzed
        </span>
      </div>
      <div className={styles.list}>
        {insights.map((insight, idx) => (
          <DimensionCard key={idx} insight={insight} isPaid={isPaid} resourcesMap={resourcesMap} />
        ))}
      </div>

      {/* Teaser for free users - shows recommendations count */}
      {!isPaid && recommendationCount > 0 && (
        <div className={styles.teaser}>
          <span className={styles.teaserIcon}>🔓</span>
          <span className={styles.teaserText}>{recommendationCount} personalized improvement recommendations</span>
        </div>
      )}
    </div>
  );
}

export default DimensionInsightsClean;
