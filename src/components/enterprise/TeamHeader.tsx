/**
 * TeamHeader Component
 * Displays team name, member count, average score, and back navigation
 */

'use client';

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './TeamHeader.module.css';

export interface TeamHeaderProps {
  teamName: string;
  memberCount: number;
  averageScore: number;
  weekOverWeekChange: number;
}

export function TeamHeader({ teamName, memberCount, averageScore, weekOverWeekChange }: TeamHeaderProps) {
  return (
    <div className={styles.header}>
      <Link href="/dashboard/enterprise" className={styles.backLink}>
        <ArrowLeft size={16} />
        <span>Back to Overview</span>
      </Link>

      <div className={styles.titleRow}>
        <h1 className={styles.teamName}>{teamName}</h1>
        <div className={styles.badges}>
          <span className={styles.badge}>{memberCount} members</span>
          <span className={styles.badge}>Avg {averageScore}</span>
          <span className={`${styles.badge} ${weekOverWeekChange >= 0 ? styles.positive : styles.negative}`}>
            {weekOverWeekChange >= 0 ? '↑' : '↓'} {Math.abs(weekOverWeekChange)}% WoW
          </span>
        </div>
      </div>
    </div>
  );
}
