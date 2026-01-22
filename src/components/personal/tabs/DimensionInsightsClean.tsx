/**
 * DimensionInsightsClean Component
 * Notion/Linear style dimension insights display
 */

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Card } from '../../ui/Card';
import type { PerDimensionInsight, DimensionName } from '../../../types/verbose';
import styles from './DimensionInsightsClean.module.css';

interface DimensionInsightsCleanProps {
  insights: PerDimensionInsight[];
  sessionsAnalyzed: number;
  isPaid?: boolean;
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
}

function DimensionCard({ insight }: DimensionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = DIMENSION_STYLES[insight.dimension] || DEFAULT_STYLE;

  const totalEvidence =
    insight.strengths.reduce((sum, s) => sum + s.evidence.length, 0) +
    insight.growthAreas.reduce((sum, g) => sum + g.evidence.length, 0);

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
                      {strength.evidence.length} instances
                    </span>
                  </div>
                  <p className={styles.itemDescription}>{strength.description}</p>
                  {/* Show up to MAX_EVIDENCE_QUOTES quotes for richer evidence display */}
                  {strength.evidence.length > 0 && (
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
              {insight.growthAreas.map((growth, idx) => (
                <div key={idx} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTitle}>{growth.title}</span>
                    <span className={styles.itemCountGrowth}>
                      {growth.evidence.length} instances
                    </span>
                  </div>
                  <p className={styles.itemDescription}>{growth.description}</p>
                  {/* Show up to MAX_EVIDENCE_QUOTES quotes for richer evidence display */}
                  {growth.evidence.length > 0 && (
                    <div className={styles.evidenceQuotes}>
                      {growth.evidence.slice(0, MAX_EVIDENCE_QUOTES).map((quote, qIdx) => (
                        <blockquote key={qIdx} className={styles.itemQuote}>
                          "{quote}"
                        </blockquote>
                      ))}
                    </div>
                  )}
                  {/* Prominent recommendation display */}
                  {growth.recommendation && (
                    <div className={styles.recommendation}>
                      <span className={styles.recommendationLabel}>Try this:</span>
                      <span className={styles.recommendationText}>{growth.recommendation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export function DimensionInsightsClean({ insights, sessionsAnalyzed, isPaid = false }: DimensionInsightsCleanProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  // Free users see only first 3 dimensions
  const displayInsights = isPaid ? insights : insights.slice(0, 3);
  const hiddenCount = insights.length - displayInsights.length;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3 className={styles.title}>Dimension Insights</h3>
        <span className={styles.subtitle}>
          Based on {sessionsAnalyzed} session{sessionsAnalyzed !== 1 ? 's' : ''} analyzed
        </span>
      </div>
      <div className={styles.list}>
        {displayInsights.map((insight, idx) => (
          <DimensionCard key={idx} insight={insight} />
        ))}
      </div>

      {/* Teaser for free users */}
      {!isPaid && hiddenCount > 0 && (
        <div className={styles.teaser}>
          <span className={styles.teaserIcon}>🔒</span>
          <span className={styles.teaserText}>+{hiddenCount} more dimensions in premium</span>
        </div>
      )}
    </div>
  );
}

export default DimensionInsightsClean;
