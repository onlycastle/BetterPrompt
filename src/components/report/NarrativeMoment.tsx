/**
 * NarrativeMoment Component
 *
 * Full-screen sticky section for chapter transitions in scrollytelling report.
 * Uses CSS sticky positioning so it naturally scrolls away when next content appears.
 * Scroll-driven animations via useScrollProgress: elements scale/blur/parallax
 * continuously as the user scrolls, creating cinematic depth.
 */

'use client';

import { useScrollProgress } from '../../hooks/useScrollProgress';
import styles from './NarrativeMoment.module.css';

interface NarrativeMomentProps {
  /** Chapter title text */
  title: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Visual variant */
  variant?: 'default' | 'dramatic';
  /** Motion density preset */
  density?: 'regular' | 'cinematic';
  /** Motion style intensity */
  motionStyle?: 'subtle' | 'cinematic';
  /** Section ID for scroll tracking */
  sectionId?: string;
  /** Backward-compatible toggle for cinematic cover transition. */
  immersive?: boolean;
}

export function NarrativeMoment({
  title,
  subtitle,
  variant = 'default',
  density = 'regular',
  motionStyle,
  sectionId,
  immersive = false,
}: NarrativeMomentProps) {
  const { ref } = useScrollProgress();
  const cinematic = immersive || density === 'cinematic';
  const resolvedMotionStyle = motionStyle ?? 'subtle';

  return (
    <div
      ref={ref}
      className={`${styles.container} ${cinematic ? styles.cinematic : ''}`}
      data-section-id={sectionId}
      data-variant={variant}
      data-density={density}
      data-motion-style={resolvedMotionStyle}
    >
      <div className={styles.sticky}>
        <div className={styles.content}>
          <h2 className={`${styles.title} ${variant === 'dramatic' ? styles.dramatic : ''}`}>
            {title}
          </h2>
          {subtitle && (
            <p className={styles.subtitle}>{subtitle}</p>
          )}
        </div>
      </div>
    </div>
  );
}
