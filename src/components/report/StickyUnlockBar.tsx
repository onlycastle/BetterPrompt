/**
 * StickyUnlockBar Component
 *
 * Terminal-style sticky CTA bar fixed to viewport bottom.
 * Follows the user through the report to increase conversion.
 *
 * - Shows locked recommendation count + price
 * - CTA scrolls smoothly to #unlock-section
 * - Slide-up/down animation via CSS transform
 */

import styles from './StickyUnlockBar.module.css';

interface StickyUnlockBarProps {
  lockedCount: number;
  visible: boolean;
}

export function StickyUnlockBar({ lockedCount, visible }: StickyUnlockBarProps) {
  if (lockedCount <= 0) return null;

  const handleClick = () => {
    const el = document.getElementById('unlock-section');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className={`${styles.bar} ${visible ? styles.visible : ''}`} role="complementary" aria-label="Unlock premium content">
      <div className={styles.inner}>
        <div className={styles.statusText}>
          <span className={styles.prompt}>$</span>
          <span className={styles.lockIcon}>&#128274;</span>
          <span><span className={styles.count}>{lockedCount}</span> recommendation{lockedCount !== 1 ? 's' : ''} locked</span>
          <span className={styles.separator}>──</span>
          <span className={styles.price}>unlock all &middot; $4.99</span>
        </div>
        <button className={styles.cta} onClick={handleClick} type="button">
          Unlock &rarr;
        </button>
      </div>
    </div>
  );
}
