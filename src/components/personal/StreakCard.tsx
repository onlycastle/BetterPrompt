/**
 * StreakCard Component
 * Displays current streak, longest streak, and monthly analysis activity
 */

import { Flame, Trophy, Target } from 'lucide-react';
import { Card } from '../ui/Card';
import type { PersonalAnalytics } from '../../types/personal';
import styles from './StreakCard.module.css';

export interface StreakCardProps {
  analytics: PersonalAnalytics;
}

export function StreakCard({ analytics }: StreakCardProps) {
  const { journey, history } = analytics;
  const { currentStreak, longestStreak, totalAnalyses } = journey;

  // Calculate this month's analyses
  const now = new Date();
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();

  const thisMonthAnalyses = history.filter((entry) => {
    const entryDate = new Date(entry.date);
    return entryDate.getMonth() === currentMonth && entryDate.getFullYear() === currentYear;
  }).length;

  // Monthly goal (arbitrary: 3 analyses per month)
  const monthlyGoal = 3;
  const progress = Math.min((thisMonthAnalyses / monthlyGoal) * 100, 100);
  const remaining = Math.max(monthlyGoal - thisMonthAnalyses, 0);

  return (
    <Card padding="lg" className={styles.card}>
      <h3 className={styles.title}>Activity</h3>

      <div className={styles.streakRow}>
        {/* Current Streak */}
        <div className={styles.streakItem}>
          <div className={styles.streakIcon}>
            <Flame size={24} />
          </div>
          <div className={styles.streakInfo}>
            <span className={styles.streakValue}>{currentStreak}</span>
            <span className={styles.streakLabel}>Current Streak</span>
          </div>
        </div>

        {/* Longest Streak */}
        <div className={styles.streakItem}>
          <div className={styles.streakIconGold}>
            <Trophy size={24} />
          </div>
          <div className={styles.streakInfo}>
            <span className={styles.streakValue}>{longestStreak}</span>
            <span className={styles.streakLabel}>Best Streak</span>
          </div>
        </div>
      </div>

      {/* Monthly Progress */}
      <div className={styles.monthlySection}>
        <div className={styles.monthlyHeader}>
          <Target size={16} />
          <span>This Month</span>
          <span className={styles.monthlyCount}>
            {thisMonthAnalyses}/{monthlyGoal}
          </span>
        </div>

        <div className={styles.progressBar}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress}%` }}
          />
        </div>

        {remaining > 0 ? (
          <p className={styles.encouragement}>
            {remaining === 1
              ? 'Just 1 more to hit your monthly goal!'
              : `${remaining} more to hit your monthly goal!`}
          </p>
        ) : (
          <p className={styles.encouragementSuccess}>
            Monthly goal achieved! Keep it up!
          </p>
        )}
      </div>

      {/* Total count */}
      <div className={styles.totalRow}>
        <span className={styles.totalLabel}>Total Analyses</span>
        <span className={styles.totalValue}>{totalAnalyses}</span>
      </div>
    </Card>
  );
}
