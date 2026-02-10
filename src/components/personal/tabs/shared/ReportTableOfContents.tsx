/**
 * ReportTableOfContents Component
 *
 * Book-style table of contents with pure typography.
 * Renders chapter numbers + titles + subtitles — no emojis, no scores, no counts.
 * Clicking an item smooth-scrolls to the corresponding section.
 */

import styles from './ReportTableOfContents.module.css';

export interface TocSection {
  id: string;
  label: string;
  icon?: string;
  subtitle: string;
  /** Domain score (0-100) for worker sections */
  score?: number;
  strengthCount?: number;
  growthCount?: number;
  /** Number of locked recommendations (free tier) */
  lockedCount?: number;
}

interface ReportTableOfContentsProps {
  sections: TocSection[];
  /** Number of sessions analyzed (kept for API compat, not rendered) */
  sessionsAnalyzed: number;
  onSectionClick: (sectionId: string) => void;
}

export function ReportTableOfContents({
  sections,
  onSectionClick,
}: ReportTableOfContentsProps) {
  if (sections.length === 0) return null;

  return (
    <nav className={styles.tocContainer} aria-label="Report table of contents">
      <div className={styles.tocHeading}>
        <hr className={styles.tocHeadingRule} />
        <span className={styles.tocHeadingText}>Table of Contents</span>
        <hr className={styles.tocHeadingRule} />
      </div>

      <ol className={styles.tocList}>
        {sections.map((section, index) => (
          <li key={section.id} className={styles.tocEntry}>
            <button
              type="button"
              className={styles.tocButton}
              onClick={() => onSectionClick(section.id)}
              aria-label={`Jump to ${section.label}`}
            >
              <span className={styles.chapterNumber} aria-hidden="true">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div className={styles.titleBlock}>
                <p className={styles.entryTitle}>{section.label}</p>
                {section.subtitle && (
                  <p className={styles.entrySubtitle}>{section.subtitle}</p>
                )}
              </div>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
