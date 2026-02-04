/**
 * ProfessionalInsightSidebar Component
 *
 * Notion-style slide-in sidebar that displays full Professional Insight details
 * when a user clicks on an insight indicator in Growth Areas.
 *
 * Features:
 * - Slide-in animation from right
 * - Backdrop overlay with click-to-close
 * - Category badge with color coding
 * - Key takeaway and actionable advice sections
 * - Source attribution with external link
 * - Keyboard accessible (Escape to close)
 * - Mobile responsive (full-width overlay)
 */

import { useEffect, useCallback } from 'react';
import type { ReferencedInsight } from '../../../../lib/models/thinking-quality-data';
import styles from './ProfessionalInsightSidebar.module.css';

interface ProfessionalInsightSidebarProps {
  /** The insight to display, or null if sidebar is closed */
  insight: ReferencedInsight | null;
  /** Whether the sidebar is open */
  isOpen: boolean;
  /** Callback to close the sidebar */
  onClose: () => void;
}

/**
 * Get category display config (label and color class)
 */
const CATEGORY_CONFIGS: Record<string, { label: string; className: string }> = {
  diagnosis: { label: 'Diagnosis', className: styles.categoryDiagnosis },
  trend: { label: 'Trend', className: styles.categoryTrend },
  tool: { label: 'Tool', className: styles.categoryTool },
  'type-specific': { label: 'Type-Specific', className: styles.categoryTypeSpecific },
};

const DEFAULT_CATEGORY_CONFIG = { label: '', className: styles.categoryDefault };

function getCategoryConfig(category: string): { label: string; className: string } {
  return CATEGORY_CONFIGS[category] || { ...DEFAULT_CATEGORY_CONFIG, label: category };
}

export function ProfessionalInsightSidebar({
  insight,
  isOpen,
  onClose,
}: ProfessionalInsightSidebarProps) {
  // Handle Escape key to close sidebar
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    },
    [isOpen, onClose]
  );

  // Add/remove event listener for Escape key
  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
      };
    }
  }, [isOpen, handleKeyDown]);

  // Don't render anything if closed and no insight
  if (!isOpen || !insight) {
    return null;
  }

  const categoryConfig = getCategoryConfig(insight.category);

  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <aside
        className={styles.sidebar}
        onClick={(e) => e.stopPropagation()}
        aria-label="Professional Insight Details"
      >
        {/* Header */}
        <header className={styles.header}>
          <button
            className={styles.closeButton}
            onClick={onClose}
            aria-label="Close sidebar"
            type="button"
          >
            <span className={styles.closeIcon}>&times;</span>
          </button>
          <span className={styles.headerLabel}>Professional Insight</span>
        </header>

        {/* Content */}
        <div className={styles.content}>
          {/* Category Badge */}
          <span className={`${styles.categoryBadge} ${categoryConfig.className}`}>
            {categoryConfig.label}
          </span>

          {/* Title */}
          <h2 className={styles.title}>{insight.title}</h2>

          {/* Key Takeaway Section */}
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Key Takeaway</h3>
            <blockquote className={styles.keyTakeaway}>
              {insight.keyTakeaway}
            </blockquote>
          </section>

          {/* Actionable Advice Section */}
          {insight.actionableAdvice.length > 0 && (
            <section className={styles.section}>
              <h3 className={styles.sectionTitle}>Actionable Advice</h3>
              <ul className={styles.adviceList}>
                {insight.actionableAdvice.map((advice, index) => (
                  <li key={index} className={styles.adviceItem}>
                    {advice}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* Footer - Source Attribution */}
        <footer className={styles.footer}>
          <div className={styles.sourceSection}>
            <span className={styles.sourceLabel}>Source</span>
            <span className={styles.sourceAuthor}>{insight.sourceAuthor}</span>
          </div>
          {insight.url && (
            <a
              href={insight.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sourceLink}
            >
              Open Source
              <span className={styles.externalIcon}>&rarr;</span>
            </a>
          )}
        </footer>
      </aside>
    </div>
  );
}

export default ProfessionalInsightSidebar;
