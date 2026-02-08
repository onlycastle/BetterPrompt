/**
 * PremiumValueSummary Component
 *
 * Displays a summary of locked premium content at the bottom of each tab.
 * Only renders when there are locked recommendations (1+).
 *
 * Design: Terminal box-drawing aesthetic with clear value proposition.
 * - Shows locked recommendation count
 * - Shows total action steps locked (avg 5 per growth area)
 * - CTA button to unlock
 */

import styles from './PremiumValueSummary.module.css';

interface PremiumValueSummaryProps {
  /** Number of locked recommendations in this tab */
  lockedCount: number;
  /** Domain name for context (e.g., "Thinking Quality") */
  domainName: string;
}

/**
 * Premium value summary shown at the bottom of each tab.
 * Only renders when lockedCount > 0.
 */
export function PremiumValueSummary({ lockedCount, domainName }: PremiumValueSummaryProps) {
  if (lockedCount === 0) return null;

  const handleUnlockClick = () => {
    const unlockSection = document.getElementById('unlock-section');
    if (unlockSection) {
      unlockSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Average 5 action steps per recommendation
  const totalSteps = lockedCount * 5;

  return (
    <div className={styles.container}>
      {/* Terminal-style header */}
      <div className={styles.header}>
        <span className={styles.headerIcon}>🔒</span>
        <span className={styles.headerTitle}>LOCKED IN THIS SECTION</span>
      </div>

      {/* Value items */}
      <div className={styles.content}>
        <div className={styles.valueItem}>
          <span className={styles.valueIcon}>🔒</span>
          <span className={styles.valueText}>
            {lockedCount} personalized recommendation{lockedCount !== 1 ? 's' : ''}
          </span>
        </div>
        <div className={styles.valueItem}>
          <span className={styles.valueIcon}>🔒</span>
          <span className={styles.valueText}>
            {totalSteps} actionable steps (avg 5 per growth area)
          </span>
        </div>
        <div className={styles.valueItem}>
          <span className={styles.valueIcon}>🔒</span>
          <span className={styles.valueText}>
            Evidence-backed improvement strategies
          </span>
        </div>
      </div>

      {/* CTA Button */}
      <button
        className={styles.ctaButton}
        type="button"
        onClick={handleUnlockClick}
      >
        Unlock All Recommendations - $4.99
      </button>
    </div>
  );
}

export default PremiumValueSummary;
