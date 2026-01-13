import React, { useEffect, useState } from 'react';
import styles from './ProgressRing.module.css';

export interface ProgressRingProps {
  value: number; // 0-100
  size?: number;
  strokeWidth?: number;
  color?: string;
  showValue?: boolean;
}

export const ProgressRing: React.FC<ProgressRingProps> = ({
  value,
  size = 120,
  strokeWidth = 8,
  color,
  showValue = true,
}) => {
  const [animatedValue, setAnimatedValue] = useState(0);

  // Clamp value between 0 and 100
  const clampedValue = Math.min(Math.max(value, 0), 100);

  // Animate from 0 to value on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedValue(clampedValue);
    }, 50); // Small delay to trigger CSS transition

    return () => clearTimeout(timer);
  }, [clampedValue]);

  // Calculate circle properties
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (animatedValue / 100) * circumference;

  // Determine color based on value if not explicitly provided
  const getColor = (): string => {
    if (color) return color;

    if (clampedValue >= 70) {
      return 'var(--accent-emerald)';
    } else if (clampedValue >= 50) {
      return 'var(--accent-amber)';
    } else {
      return 'var(--accent-rose)';
    }
  };

  const progressColor = getColor();
  const center = size / 2;

  return (
    <div className={styles.container} style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className={styles.svg}
      >
        {/* Background track */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="var(--surface-3)"
          strokeWidth={strokeWidth}
          className={styles.track}
        />

        {/* Progress circle */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={progressColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className={styles.progress}
          style={{
            '--circumference': circumference,
            '--stroke-dashoffset': strokeDashoffset,
          } as React.CSSProperties}
        />
      </svg>

      {showValue && (
        <div className={styles.value}>
          <span className={styles.number}>{Math.round(clampedValue)}</span>
          <span className={styles.percent}>%</span>
        </div>
      )}
    </div>
  );
};
