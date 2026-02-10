/**
 * TeamOverviewGrid Component
 * Grid of clickable team summary cards linking to team detail pages
 */

'use client';

import Link from 'next/link';
import type { TeamAnalytics } from '../../types/enterprise';
import { TYPE_METADATA } from '../../types/enterprise';
import type { CodingStyleType } from '../../types/enterprise';
import styles from './TeamOverviewGrid.module.css';

export interface TeamOverviewGridProps {
  teams: TeamAnalytics[];
}

export function TeamOverviewGrid({ teams }: TeamOverviewGridProps) {
  return (
    <div className={styles.grid}>
      {teams.map(team => {
        // Find the dominant type
        const dominantType = (Object.entries(team.typeDistribution) as [CodingStyleType, number][])
          .sort((a, b) => b[1] - a[1])[0];
        const dominantMeta = dominantType ? TYPE_METADATA[dominantType[0]] : null;

        return (
          <Link
            key={team.teamId}
            href={`/dashboard/enterprise/team/${team.teamId}`}
            className={styles.card}
          >
            <div className={styles.cardHeader}>
              <h3 className={styles.teamName}>{team.teamName}</h3>
              <span className={styles.memberCount}>{team.memberCount} members</span>
            </div>

            <div className={styles.scoreRow}>
              <span className={styles.scoreLabel}>Avg Score</span>
              <span className={styles.scoreValue}>{team.averageOverallScore}</span>
            </div>

            <div className={styles.changeRow}>
              <span className={`${styles.change} ${team.weekOverWeekChange >= 0 ? styles.positive : styles.negative}`}>
                {team.weekOverWeekChange >= 0 ? '↑' : '↓'} {Math.abs(team.weekOverWeekChange)}% WoW
              </span>
            </div>

            {dominantMeta && (
              <div className={styles.dominantType}>
                <span>{dominantMeta.emoji}</span>
                <span className={styles.dominantLabel}>
                  Mostly {dominantMeta.label}s
                </span>
              </div>
            )}

            {team.skillGaps.length > 0 && (
              <div className={styles.gapBadge}>
                {team.skillGaps.length} skill gap{team.skillGaps.length > 1 ? 's' : ''}
              </div>
            )}
          </Link>
        );
      })}
    </div>
  );
}
