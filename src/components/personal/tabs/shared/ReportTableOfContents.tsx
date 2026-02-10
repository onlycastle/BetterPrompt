/**
 * ReportTableOfContents Component
 *
 * Magazine-style table of contents showing all report sections at a glance.
 * Renders inline between the header (PersonalitySummary + TopFocusAreas) and
 * the scrollable content sections (Activity + Workers).
 *
 * Each item displays:
 * - Icon + label from SECTION_ICONS / REPORT_SECTIONS
 * - Subtitle from WORKER_DOMAIN_CONFIGS
 * - Domain score (Workers) or session count (Activity)
 * - Strength/growth area counts
 * - Locked recommendation count (free tier)
 *
 * Clicking an item smooth-scrolls to the corresponding section.
 */

import styles from './ReportTableOfContents.module.css';

export interface TocSection {
  id: string;
  label: string;
  icon: string;
  subtitle: string;
  /** Domain score (0-100) for worker sections */
  score?: number;
  strengthCount: number;
  growthCount: number;
  /** Number of locked recommendations (free tier) */
  lockedCount: number;
}

interface ReportTableOfContentsProps {
  sections: TocSection[];
  /** Number of sessions analyzed (shown for Activity section) */
  sessionsAnalyzed: number;
  onSectionClick: (sectionId: string) => void;
}

export function ReportTableOfContents({
  sections,
  sessionsAnalyzed,
  onSectionClick,
}: ReportTableOfContentsProps) {
  if (sections.length === 0) return null;

  return (
    <nav className={styles.container} aria-label="Report table of contents">
      <h2 className={styles.heading}>Your Report at a Glance</h2>
      <div className={styles.list}>
        {sections.map((section) => {
          const isActivity = section.id === 'activity';

          return (
            <button
              key={section.id}
              type="button"
              className={styles.item}
              onClick={() => onSectionClick(section.id)}
              aria-label={`Jump to ${section.label}`}
            >
              <span className={styles.icon} aria-hidden="true">{section.icon}</span>

              <div className={styles.content}>
                <p className={styles.label}>{section.label}</p>
                <p className={styles.subtitle}>{section.subtitle}</p>

                {!isActivity && (section.strengthCount > 0 || section.growthCount > 0) && (
                  <div className={styles.meta}>
                    {section.strengthCount > 0 && (
                      <span className={styles.metaStrengths}>
                        {section.strengthCount} strength{section.strengthCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {section.strengthCount > 0 && section.growthCount > 0 && (
                      <span className={styles.metaDivider}>·</span>
                    )}
                    {section.growthCount > 0 && (
                      <span className={styles.metaGrowth}>
                        {section.growthCount} growth area{section.growthCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {section.lockedCount > 0 && (
                      <>
                        <span className={styles.metaDivider}>·</span>
                        <span className={styles.locked}>
                          🔒 {section.lockedCount}
                        </span>
                      </>
                    )}
                  </div>
                )}
              </div>

              {isActivity ? (
                <span className={styles.activityTeaser}>
                  {sessionsAnalyzed} session{sessionsAnalyzed !== 1 ? 's' : ''}
                </span>
              ) : (
                section.score !== undefined && (
                  <span className={styles.score}>{section.score}</span>
                )
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
