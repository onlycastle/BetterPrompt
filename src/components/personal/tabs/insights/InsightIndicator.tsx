/**
 * InsightIndicator Component
 *
 * Small clickable badge displayed in Growth Areas when referenced insights exist.
 * Clicking opens the ProfessionalInsightSidebar.
 *
 * Visual design:
 * - Cyan color scheme (matching Terminal Diagnostic Report)
 * - Book/document icon
 * - Count badge showing number of insights
 * - Hover animation
 */

import type { ReferencedInsight } from '../../../../lib/models/thinking-quality-data';
import styles from './InsightIndicator.module.css';

interface InsightIndicatorProps {
  /** Referenced insights array */
  insights: ReferencedInsight[];
  /** Callback when indicator is clicked (includes Y offset for inline positioning) */
  onClick: (insight: ReferencedInsight, yOffset?: number) => void;
}

export function InsightIndicator({ insights, onClick }: InsightIndicatorProps) {
  // Don't render if no insights
  if (!insights || insights.length === 0) {
    return null;
  }

  // Show first insight on click (sidebar will show full details)
  // Calculate Y offset relative to viewport for inline sidebar positioning
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click event
    const element = e.currentTarget as HTMLElement;
    // Get element's position relative to viewport (not document)
    const rect = element.getBoundingClientRect();
    onClick(insights[0], rect.top);
  };

  return (
    <button
      className={styles.indicator}
      onClick={handleClick}
      data-insight-indicator
      type="button"
      aria-label={`View ${insights.length} professional insight${insights.length > 1 ? 's' : ''}`}
      title="Click to view professional insight"
    >
      <span className={styles.icon}>📚</span>
      <span className={styles.count}>
        {insights.length} insight{insights.length > 1 ? 's' : ''}
      </span>
    </button>
  );
}

export default InsightIndicator;
