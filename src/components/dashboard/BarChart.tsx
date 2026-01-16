import React, { useEffect, useState } from 'react';
import styles from './BarChart.module.css';

export interface BarDataPoint {
  label: string;
  value: number;
  color?: string;
}

export interface BarChartProps {
  data: BarDataPoint[];
  maxValue?: number;
}

export function BarChart({ data, maxValue }: BarChartProps) {
  const [isAnimating, setIsAnimating] = useState(false);

  // Calculate max value if not provided
  const computedMaxValue = maxValue ?? Math.max(...data.map(d => d.value), 1);

  // Trigger animation on mount
  useEffect(() => {
    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => setIsAnimating(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className={styles.barChart}>
      {data.map((item, index) => {
        const percentage = (item.value / computedMaxValue) * 100;

        return (
          <div
            key={item.label}
            className={styles.barItem}
            style={{ '--bar-delay': `${index * 100}ms` } as React.CSSProperties}
          >
            <div className={styles.barHeader}>
              <span className={styles.barLabel}>{item.label}</span>
              <span className={styles.barValue}>{item.value}</span>
            </div>
            <div className={styles.barTrack}>
              <div
                className={`${styles.barFill} ${isAnimating ? styles.animated : ''}`}
                style={{
                  width: `${percentage}%`,
                  backgroundColor: item.color || 'var(--accent-primary)',
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
