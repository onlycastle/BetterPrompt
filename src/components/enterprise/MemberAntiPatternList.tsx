/**
 * MemberAntiPatternList Component
 * Horizontal bar chart showing individual member anti-pattern frequencies with impact badges.
 * Layout follows the same horizontal bar pattern as AntiPatternHeatmap.
 */

'use client';

import { CheckCircle } from 'lucide-react';
import { ANTI_PATTERN_LABELS } from '../../types/enterprise';
import type { MemberAntiPattern } from '../../types/enterprise';
import styles from './MemberAntiPatternList.module.css';

export interface MemberAntiPatternListProps {
  antiPatterns: MemberAntiPattern[];
}

const IMPACT_COLORS = {
  high: 'var(--sketch-red)',
  medium: 'var(--accent-amber)',
  low: 'var(--ink-muted)',
} as const;

const IMPACT_LABELS: Record<MemberAntiPattern['impact'], string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};

const IMPACT_STYLES: Record<MemberAntiPattern['impact'], string> = {
  high: styles.impactHigh,
  medium: styles.impactMedium,
  low: styles.impactLow,
};

export function MemberAntiPatternList({ antiPatterns }: MemberAntiPatternListProps) {
  if (antiPatterns.length === 0) {
    return (
      <div className={styles.empty}>
        <CheckCircle size={24} className={styles.checkIcon} />
        <span>No anti-patterns detected</span>
      </div>
    );
  }

  const sorted = [...antiPatterns].sort((a, b) => b.frequency - a.frequency);
  const maxFrequency = Math.max(...sorted.map(ap => ap.frequency), 1);

  return (
    <div className={styles.container}>
      {sorted.map(ap => {
        const barWidth = (ap.frequency / maxFrequency) * 100;
        const barColor = IMPACT_COLORS[ap.impact];

        return (
          <div key={ap.pattern} className={styles.row}>
            <div className={styles.labelCol}>
              <span className={styles.patternName}>
                {ANTI_PATTERN_LABELS[ap.pattern]}
              </span>
            </div>
            <div className={styles.barCol}>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${barWidth}%`, backgroundColor: barColor }}
                />
              </div>
            </div>
            <div className={styles.infoCol}>
              <span className={styles.frequency}>{ap.frequency}</span>
              <span className={`${styles.impactBadge} ${IMPACT_STYLES[ap.impact]}`}>
                {IMPACT_LABELS[ap.impact]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
