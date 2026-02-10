/**
 * AntiPatternDeepDive Component
 * Expandable horizontal bar chart showing anti-pattern distribution with
 * descriptions, affected members, and actionable insights.
 * Replaces AntiPatternHeatmap on the overview page.
 */

'use client';

import { useState } from 'react';
import { pluralizeMembers } from './format-utils';
import type { EnhancedAntiPatternAggregate } from '../../types/enterprise';
import styles from './AntiPatternDeepDive.module.css';

export interface AntiPatternDeepDiveProps {
  aggregates: EnhancedAntiPatternAggregate[];
}

const IMPACT_COLORS = {
  high: 'var(--sketch-red)',
  medium: 'var(--accent-amber)',
  low: 'var(--ink-muted)',
} as const;

export function AntiPatternDeepDive({ aggregates }: AntiPatternDeepDiveProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  if (aggregates.length === 0) {
    return <div className={styles.empty}>No anti-patterns detected</div>;
  }

  const maxOccurrences = Math.max(...aggregates.map(a => a.totalOccurrences), 1);

  function toggleRow(pattern: string) {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(pattern)) {
        next.delete(pattern);
      } else {
        next.add(pattern);
      }
      return next;
    });
  }

  return (
    <div className={styles.container}>
      {aggregates.map(agg => {
        const barWidth = (agg.totalOccurrences / maxOccurrences) * 100;
        const color = IMPACT_COLORS[agg.predominantImpact];
        const isExpanded = expandedRows.has(agg.pattern);

        return (
          <div key={agg.pattern} className={styles.row}>
            <button
              type="button"
              className={styles.rowHeader}
              onClick={() => toggleRow(agg.pattern)}
              aria-expanded={isExpanded}
            >
              <span
                className={`${styles.chevron} ${isExpanded ? styles.chevronOpen : ''}`}
                aria-hidden="true"
              >
                &#9656;
              </span>
              <div className={styles.labelCol}>
                <span className={styles.patternName}>{agg.label}</span>
              </div>
              <div className={styles.barCol}>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${barWidth}%`, backgroundColor: color }}
                  />
                </div>
              </div>
              <div className={styles.infoCol}>
                <span className={styles.count}>{agg.totalOccurrences}</span>
                <span className={styles.meta}>
                  {pluralizeMembers(agg.memberCount)}
                </span>
              </div>
            </button>

            {isExpanded && (
              <div className={styles.expandedContent}>
                <p className={styles.description}>{agg.description}</p>
                {agg.affectedMembers.length > 0 && (
                  <p className={styles.affectedMembers}>
                    <strong>Affected:</strong> {agg.affectedMembers.join(', ')}
                  </p>
                )}
                <div className={styles.insightCallout}>
                  {agg.actionableInsight}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
