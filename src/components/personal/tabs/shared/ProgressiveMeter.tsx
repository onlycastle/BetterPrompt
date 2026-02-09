/**
 * ProgressiveMeter Component
 *
 * Circular SVG gauge showing what percentage of content is unlocked.
 * Displayed above FloatingProgressDots for free users.
 *
 * - Background: dashed circle (muted)
 * - Foreground: solid cyan arc (animated stroke-dashoffset)
 * - Center: percentage number
 * - Below: lock badge with locked count
 */

import styles from './ProgressiveMeter.module.css';

interface ProgressiveMeterProps {
  /** 0-100, percentage of content unlocked */
  percentage: number;
  /** Total number of locked items */
  lockedCount: number;
}

// SVG circle geometry (radius = 15, center = 20)
const RADIUS = 15;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressiveMeter({ percentage, lockedCount }: ProgressiveMeterProps) {
  if (lockedCount <= 0) return null;

  const clampedPct = Math.max(0, Math.min(100, percentage));
  const offset = CIRCUMFERENCE - (clampedPct / 100) * CIRCUMFERENCE;

  return (
    <div className={styles.meter}>
      <div className={styles.gauge}>
        <svg className={styles.gaugeSvg} viewBox="0 0 40 40" aria-label={`${clampedPct}% content unlocked`} role="img">
          <title>{`${clampedPct}% of content unlocked, ${lockedCount} items locked`}</title>
          {/* Background track */}
          <circle
            className={styles.trackCircle}
            cx="20"
            cy="20"
            r={RADIUS}
          />
          {/* Foreground fill */}
          <circle
            className={styles.fillCircle}
            cx="20"
            cy="20"
            r={RADIUS}
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={offset}
          />
        </svg>
        <span className={styles.percentText}>{clampedPct}%</span>
      </div>
      <span className={styles.badge}>
        <span className={styles.badgeIcon}>&#128274;</span>
        {lockedCount}
      </span>
      <hr className={styles.divider} />
    </div>
  );
}
