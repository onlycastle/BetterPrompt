/**
 * NextTabButton Component
 *
 * Smart navigation button that appears when user scrolls to bottom of tab content.
 * Guides users to the next tab for better content discovery.
 */

import { type RefObject } from 'react';
import { useTabScrollNavigation } from '../../../../hooks/useTabScrollNavigation';
import styles from './NextTabButton.module.css';

interface NextTabButtonProps {
  /** Ref to the scrollable content container */
  contentRef: RefObject<HTMLElement | null>;
  /** Label for the next tab */
  nextTabLabel: string;
  /** Callback when button is clicked */
  onNextTab: () => void;
}

export function NextTabButton({
  contentRef,
  nextTabLabel,
  onNextTab,
}: NextTabButtonProps) {
  const { isAtBottom, scrollProgress } = useTabScrollNavigation({
    contentRef,
    threshold: 0.85,
  });

  // Always render the button but control visibility with CSS
  // This enables smooth fade-in/fade-out animations
  return (
    <div
      className={`${styles.container} ${isAtBottom ? styles.visible : styles.hidden}`}
      aria-hidden={!isAtBottom}
    >
      <button
        className={styles.button}
        onClick={onNextTab}
        disabled={!isAtBottom}
        tabIndex={isAtBottom ? 0 : -1}
        type="button"
      >
        <span className={styles.buttonContent}>
          <span className={styles.label}>
            Next: {nextTabLabel}
          </span>
          <span className={styles.arrow}>→</span>
        </span>
      </button>

      {/* Visual progress indicator */}
      <div className={styles.progressBar}>
        <div
          className={styles.progressFill}
          style={{ width: `${Math.min(scrollProgress * 100, 100)}%` }}
        />
      </div>
    </div>
  );
}

export default NextTabButton;
