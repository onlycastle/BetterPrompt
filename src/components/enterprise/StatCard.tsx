/**
 * StatCard Component
 * Displays a single summary metric with label, value, and optional change indicator
 */

import styles from './StatCard.module.css';

export interface StatCardProps {
  label: string;
  value: string | number;
  change?: number;  // Positive = improvement, negative = decline
  suffix?: string;  // e.g., '%', ' members'
}

export function StatCard({ label, value, change, suffix = '' }: StatCardProps) {
  const changeClass = change !== undefined
    ? change > 0 ? styles.positive : change < 0 ? styles.negative : styles.neutral
    : '';

  return (
    <div className={styles.card}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value}>
        {value}{suffix}
      </span>
      {change !== undefined && (
        <span className={`${styles.change} ${changeClass}`}>
          {change > 0 ? '↑' : change < 0 ? '↓' : '→'} {Math.abs(change)}%
        </span>
      )}
    </div>
  );
}
