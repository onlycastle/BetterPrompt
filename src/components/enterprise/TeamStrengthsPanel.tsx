/**
 * TeamStrengthsPanel Component
 * Grid of 5 cards showing team avg score per worker domain
 */

'use client';

import { useMemo } from 'react';
import { ProgressRing } from '../dashboard/ProgressRing';
import { Card } from '../ui/Card';
import type { TeamMemberAnalysis } from '../../types/enterprise';
import styles from './TeamStrengthsPanel.module.css';

export interface TeamStrengthsPanelProps {
  members: TeamMemberAnalysis[];
}

const DOMAIN_META = [
  { key: 'thinkingQuality', icon: '\u{1F9E0}', title: 'Thinking Quality' },
  { key: 'communicationPatterns', icon: '\u{1F4AC}', title: 'Communication' },
  { key: 'learningBehavior', icon: '\u{1F4C8}', title: 'Learning Behavior' },
  { key: 'contextEfficiency', icon: '\u26A1', title: 'Context Efficiency' },
  { key: 'sessionOutcome', icon: '\u{1F3AF}', title: 'Session Outcome' },
] as const;

export function TeamStrengthsPanel({ members }: TeamStrengthsPanelProps) {
  const domainCards = useMemo(() => {
    return DOMAIN_META.map(({ key, icon, title }) => {
      // Gather scores for this domain across all members
      const scores = members.map(m => {
        const summary = m.strengthSummaries.find(s => s.domain === key);
        return { name: m.name, score: summary?.domainScore ?? 0, strength: summary?.topStrength ?? '-' };
      });

      const avgScore = scores.length > 0
        ? Math.round(scores.reduce((s, x) => s + x.score, 0) / scores.length)
        : 0;

      const topPerformer = scores.reduce(
        (best, curr) => curr.score > best.score ? curr : best,
        scores[0],
      );

      // Most common strength
      const strengthCounts = new Map<string, number>();
      for (const s of scores) {
        strengthCounts.set(s.strength, (strengthCounts.get(s.strength) ?? 0) + 1);
      }
      let commonStrength = '-';
      let maxCount = 0;
      for (const [str, count] of strengthCounts) {
        if (count > maxCount) {
          maxCount = count;
          commonStrength = str;
        }
      }

      return { key, icon, title, avgScore, topPerformer, commonStrength };
    });
  }, [members]);

  return (
    <div className={styles.grid}>
      {domainCards.map(card => (
        <Card key={card.key} className={styles.card}>
          <div className={styles.cardHeader}>
            <span className={styles.icon}>{card.icon}</span>
            <span className={styles.title}>{card.title}</span>
          </div>
          <div className={styles.scoreRow}>
            <ProgressRing value={card.avgScore} size={48} strokeWidth={4} />
            <span className={styles.avgLabel}>Team Avg</span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Top:</span>
            <span className={styles.detailValue}>{card.topPerformer?.name} ({card.topPerformer?.score})</span>
          </div>
          <div className={styles.detail}>
            <span className={styles.detailLabel}>Common:</span>
            <span className={styles.detailValue}>{card.commonStrength}</span>
          </div>
        </Card>
      ))}
    </div>
  );
}
