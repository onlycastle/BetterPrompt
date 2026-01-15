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
}

interface DimensionStyle {
  accent: string;
  bg: string;
}

const DIMENSION_STYLES: Record<DimensionName, DimensionStyle> = {
  aiCollaboration: { accent: 'var(--accent-emerald)', bg: 'var(--accent-emerald-soft)' },
  contextEngineering: { accent: 'var(--accent-primary)', bg: 'var(--accent-primary-soft)' },
  toolMastery: { accent: '#ff6b35', bg: 'rgba(255, 107, 53, 0.08)' },
  burnoutRisk: { accent: 'var(--accent-rose)', bg: 'var(--accent-rose-soft)' },
  aiControl: { accent: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.08)' },
  skillResilience: { accent: 'var(--accent-amber)', bg: 'var(--accent-amber-soft)' },
};

const DEFAULT_STYLE: DimensionStyle = { accent: 'var(--text-secondary)', bg: 'var(--surface-2)' };

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
                  {strength.evidence.length > 0 && (
                    <blockquote className={styles.itemQuote}>
                      "{strength.evidence[0].quote}"
                    </blockquote>
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
                  {growth.recommendation && (
                    <div className={styles.recommendation}>
                      <span className={styles.recommendationLabel}>Recommendation:</span>
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

export function DimensionInsightsClean({ insights, sessionsAnalyzed }: DimensionInsightsCleanProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

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
          <DimensionCard key={idx} insight={insight} />
        ))}
      </div>
    </div>
  );
}

export default DimensionInsightsClean;
