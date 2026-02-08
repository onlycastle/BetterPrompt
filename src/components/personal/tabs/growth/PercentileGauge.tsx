/**
 * PercentileGauge Component
 *
 * Inline horizontal gauge showing a user's percentile rank within a domain.
 * "Top 28%" style display with a colored bar indicator.
 *
 * Used in WorkerDomainSection headers to show benchmarking data.
 */

import styles from './PercentileGauge.module.css';

interface PercentileGaugeProps {
  /** Percentile rank (0-100). 85 means the user scored higher than 85% of users. */
  percentile: number;
  /** Optional label override. Default: "Top X%" */
  label?: string;
}

function getPercentileColor(percentile: number): string {
  if (percentile >= 90) return 'var(--sketch-cyan)';
  if (percentile >= 75) return 'var(--sketch-green)';
  if (percentile >= 50) return 'var(--sketch-blue)';
  if (percentile >= 25) return 'var(--sketch-orange)';
  return 'var(--sketch-red)';
}

function getPercentileLabel(percentile: number): string {
  const topPercent = 100 - percentile;
  if (topPercent <= 1) return 'Top 1%';
  return `Top ${topPercent}%`;
}

export function PercentileGauge({ percentile, label }: PercentileGaugeProps) {
  const color = getPercentileColor(percentile);
  const displayLabel = label || getPercentileLabel(percentile);

  return (
    <div className={styles.gauge} role="meter" aria-valuenow={percentile} aria-valuemin={0} aria-valuemax={100} aria-label={displayLabel}>
      <div className={styles.barTrack}>
        <div
          className={styles.barFill}
          style={{
            width: `${Math.max(percentile, 3)}%`,
            backgroundColor: color,
          }}
        />
        <div
          className={styles.marker}
          style={{
            left: `${percentile}%`,
            borderColor: color,
          }}
        />
      </div>
      <span className={styles.label} style={{ color }}>
        {displayLabel}
      </span>
    </div>
  );
}
