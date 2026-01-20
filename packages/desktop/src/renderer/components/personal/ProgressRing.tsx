/**
 * ProgressRing Component
 * SVG-based circular progress indicator
 */

import styles from './ProgressRing.module.css';

export interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  showValue?: boolean;
  label?: string;
}

export function ProgressRing({
  value,
  size = 80,
  strokeWidth = 6,
  showValue = true,
  label,
}: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.min(Math.max(value, 0), 100) / 100);

  // Color based on score
  const getColor = () => {
    if (value >= 80) return 'var(--sketch-green)';
    if (value >= 60) return 'var(--sketch-cyan)';
    if (value >= 40) return 'var(--sketch-yellow)';
    return 'var(--sketch-red)';
  };

  return (
    <div className={styles.container} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.svg}
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={getColor()}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className={styles.progress}
        />
      </svg>
      {showValue && (
        <div className={styles.value}>
          <span className={styles.number}>{Math.round(value)}</span>
          {label && <span className={styles.label}>{label}</span>}
        </div>
      )}
    </div>
  );
}

export default ProgressRing;
