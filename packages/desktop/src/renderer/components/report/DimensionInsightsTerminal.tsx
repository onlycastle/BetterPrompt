/**
 * DimensionInsightsTerminal Component
 *
 * Displays per-dimension insights (strengths and growth areas) in a terminal aesthetic.
 * Adapted from web app's DimensionInsightsClean component.
 */

import { useState } from 'react';
import type { PerDimensionInsight, DimensionName } from '../../types/report';
import styles from './DimensionInsightsTerminal.module.css';

interface DimensionInsightsTerminalProps {
  insights: PerDimensionInsight[];
  sessionsAnalyzed: number;
}

interface DimensionStyle {
  accent: string;
  bg: string;
}

const DIMENSION_STYLES: Record<DimensionName, DimensionStyle> = {
  aiCollaboration: { accent: 'var(--sketch-green)', bg: 'var(--sketch-green-light)' },
  contextEngineering: { accent: 'var(--sketch-cyan)', bg: 'var(--sketch-cyan-soft)' },
  toolMastery: { accent: 'var(--sketch-orange)', bg: 'var(--sketch-orange-light)' },
  burnoutRisk: { accent: 'var(--sketch-red)', bg: 'var(--sketch-red-light)' },
  aiControl: { accent: 'var(--sketch-purple)', bg: 'var(--sketch-purple-light)' },
  skillResilience: { accent: 'var(--sketch-yellow)', bg: 'var(--sketch-yellow-light)' },
};

const DEFAULT_STYLE: DimensionStyle = { accent: 'var(--text-secondary)', bg: 'var(--surface-2)' };

interface DimensionCardProps {
  insight: PerDimensionInsight;
}

/** Expandable evidence list component */
function EvidenceList({ evidence, accentColor }: { evidence: string[]; accentColor?: string }) {
  const [showAll, setShowAll] = useState(false);
  const hasMore = evidence.length > 4;
  const displayedEvidence = showAll ? evidence : evidence.slice(0, 4);

  return (
    <div className={styles.evidenceList}>
      {displayedEvidence.map((quote, idx) => (
        <blockquote
          key={idx}
          className={styles.itemQuote}
          style={accentColor ? { borderLeftColor: accentColor } : undefined}
        >
          "{quote}"
        </blockquote>
      ))}
      {hasMore && (
        <button
          className={styles.showMoreButton}
          onClick={() => setShowAll(!showAll)}
          type="button"
        >
          {showAll ? 'Show less' : `Show ${evidence.length - 2} more...`}
        </button>
      )}
    </div>
  );
}

function DimensionCard({ insight }: DimensionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const style = DIMENSION_STYLES[insight.dimension] || DEFAULT_STYLE;

  const totalEvidence =
    insight.strengths.reduce((sum, s) => sum + (s.evidence?.length || 0), 0) +
    insight.growthAreas.reduce((sum, g) => sum + (g.evidence?.length || 0), 0);

  return (
    <div className={styles.dimensionCard}>
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
          <span className={styles.chevron}>{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className={styles.cardContent}>
          {/* Strengths */}
          {insight.strengths.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>✨ Strengths</div>
              {insight.strengths.map((strength, idx) => (
                <div key={idx} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTitle}>{strength.title}</span>
                    {strength.evidence && strength.evidence.length > 0 && (
                      <span
                        className={styles.itemCount}
                        style={{ color: style.accent, borderColor: style.accent }}
                      >
                        {strength.evidence.length} instances
                      </span>
                    )}
                  </div>
                  <p className={styles.itemDescription}>{strength.description}</p>
                  {strength.evidence && strength.evidence.length > 0 && (
                    <EvidenceList evidence={strength.evidence} accentColor={style.accent} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Growth Areas */}
          {insight.growthAreas.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionLabel}>🌱 Growth Areas</div>
              {insight.growthAreas.map((growth, idx) => (
                <div key={idx} className={styles.item}>
                  <div className={styles.itemHeader}>
                    <span className={styles.itemTitle}>{growth.title}</span>
                    {growth.evidence && growth.evidence.length > 0 && (
                      <span className={styles.itemCountGrowth}>
                        {growth.evidence.length} instances
                      </span>
                    )}
                  </div>
                  <p className={styles.itemDescription}>{growth.description}</p>
                  {/* Evidence for growth areas */}
                  {growth.evidence && growth.evidence.length > 0 && (
                    <EvidenceList evidence={growth.evidence} accentColor="var(--sketch-yellow)" />
                  )}
                  {growth.recommendation && (
                    <div className={styles.recommendation}>
                      <span className={styles.recommendationLabel}>💡 Recommendation:</span>
                      <span className={styles.recommendationText}>{growth.recommendation}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function DimensionInsightsTerminal({ insights, sessionsAnalyzed }: DimensionInsightsTerminalProps) {
  if (!insights || insights.length === 0) {
    return null;
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h2 className={styles.title}>📊 Dimension Insights</h2>
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

export default DimensionInsightsTerminal;
