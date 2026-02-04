/**
 * InsightPreviewCard Component
 *
 * Notion-style inline preview card for Professional Insights.
 * Displayed in the sidebar column instead of a full-screen overlay.
 *
 * Features:
 * - Compact card layout (not full-screen)
 * - Category badge with color coding
 * - Key takeaway preview
 * - Source attribution with external link
 * - Close button
 * - Sticky positioning in sidebar
 */

import type { ReferencedInsight } from '../../../../lib/models/worker-insights';
import styles from './InsightPreviewCard.module.css';

interface InsightPreviewCardProps {
  /** The insight to display */
  insight: ReferencedInsight;
  /** Callback to close the card */
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

export function InsightPreviewCard({ insight, onClose }: InsightPreviewCardProps) {
  const categoryConfig = getCategoryConfig(insight.category);

  return (
    <article className={styles.card} aria-label="Professional Insight Preview">
      {/* Header with close button */}
      <header className={styles.header}>
        <span className={styles.headerLabel}>Professional Insight</span>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close insight preview"
          type="button"
        >
          <span className={styles.closeIcon}>&times;</span>
        </button>
      </header>

      {/* Content */}
      <div className={styles.content}>
        {/* Category Badge */}
        <span className={`${styles.categoryBadge} ${categoryConfig.className}`}>
          {categoryConfig.label}
        </span>

        {/* Title */}
        <h3 className={styles.title}>{insight.title}</h3>

        {/* Key Takeaway */}
        <blockquote className={styles.keyTakeaway}>
          {insight.keyTakeaway}
        </blockquote>

        {/* Actionable Advice (first 2 items only for preview) */}
        {insight.actionableAdvice.length > 0 && (
          <ul className={styles.adviceList}>
            {insight.actionableAdvice.slice(0, 2).map((advice, index) => (
              <li key={index} className={styles.adviceItem}>
                {advice}
              </li>
            ))}
            {insight.actionableAdvice.length > 2 && (
              <li className={styles.moreAdvice}>
                +{insight.actionableAdvice.length - 2} more tips
              </li>
            )}
          </ul>
        )}
      </div>

      {/* Footer - Source */}
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
            Open
            <span className={styles.externalIcon}>&rarr;</span>
          </a>
        )}
      </footer>
    </article>
  );
}

export default InsightPreviewCard;
