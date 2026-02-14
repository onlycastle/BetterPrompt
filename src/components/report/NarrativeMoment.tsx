/**
 * NarrativeMoment Component
 *
 * Full-screen sticky section for chapter transitions in scrollytelling report.
 * Uses CSS sticky positioning so it naturally scrolls away when next content appears.
 */

import styles from './NarrativeMoment.module.css';

interface NarrativeMomentProps {
  /** Chapter title text */
  title: string;
  /** Optional subtitle or description */
  subtitle?: string;
  /** Visual variant */
  variant?: 'default' | 'dramatic';
  /** Section ID for scroll tracking */
  sectionId?: string;
}

export function NarrativeMoment({
  title,
  subtitle,
  variant = 'default',
  sectionId,
}: NarrativeMomentProps) {
  return (
    <div
      className={styles.container}
      data-section-id={sectionId}
      data-variant={variant}
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
