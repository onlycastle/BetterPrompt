/**
 * FloatingProgressDots Component
 *
 * Vertical floating navigation dots fixed on the right side of the viewport.
 * Replaces the tab bar and ReportAnchorNav for continuous scroll layout.
 *
 * Features:
 * - Fixed position on right side of viewport
 * - Three-state dots: visited (green), active (cyan+glow), upcoming (muted)
 * - Subtle pulse on the next upcoming dot to draw eye downward
 * - "More below" bouncing arrow when more sections remain
 * - Hover shows section label tooltip
 * - Click scrolls to section
 * - Hidden when header is fully visible
 * - Responsive: smaller on mobile
 */

import { useState, useMemo } from 'react';
import { ProgressiveMeter } from './ProgressiveMeter';
import styles from './FloatingProgressDots.module.css';

interface SectionConfig {
  id: string;
  label: string;
  icon: string;
}

interface FloatingProgressDotsProps {
  sections: SectionConfig[];
  activeSection: string | null;
  onSectionClick: (id: string) => void;
  visible: boolean;
  visitedSections?: Set<string>;
  /** Percentage of content unlocked (0-100). Only shown for free users. */
  unlockPercentage?: number;
  /** Total locked items. Only shown for free users. */
  lockedCount?: number;
}

type DotStatus = 'visited' | 'active' | 'upcoming';

export function FloatingProgressDots({
  sections,
  activeSection,
  onSectionClick,
  visible,
  visitedSections,
  unlockPercentage,
  lockedCount,
}: FloatingProgressDotsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  // Compute status for each dot
  const dotStatuses = useMemo(() => {
    const statuses = new Map<string, DotStatus>();
    const activeIdx = sections.findIndex(s => s.id === activeSection);

    for (let i = 0; i < sections.length; i++) {
      const section = sections[i];
      if (section.id === activeSection) {
        statuses.set(section.id, 'active');
      } else if (visitedSections?.has(section.id) && i < activeIdx) {
        statuses.set(section.id, 'visited');
      } else {
        statuses.set(section.id, 'upcoming');
      }
    }
    return statuses;
  }, [sections, activeSection, visitedSections]);

  // Find the first upcoming dot (next section after active)
  const nextUpId = useMemo(() => {
    const activeIdx = sections.findIndex(s => s.id === activeSection);
    if (activeIdx === -1 || activeIdx >= sections.length - 1) return null;
    return sections[activeIdx + 1].id;
  }, [sections, activeSection]);

  const isLastSectionReached = useMemo(() => {
    if (sections.length === 0) return true;
    const lastId = sections[sections.length - 1].id;
    return activeSection === lastId || visitedSections?.has(lastId);
  }, [sections, activeSection, visitedSections]);

  if (sections.length === 0) return null;

  return (
    <nav
      className={`${styles.container} ${visible ? styles.visible : ''}`}
      aria-label="Section navigation"
    >
      <ul className={styles.dotList}>
        {/* Progressive Meter — unlock gauge for free users */}
        {lockedCount != null && lockedCount > 0 && unlockPercentage != null && (
          <li>
            <ProgressiveMeter percentage={unlockPercentage} lockedCount={lockedCount} />
          </li>
        )}
        {sections.map((section) => {
          const status = dotStatuses.get(section.id) ?? 'upcoming';
          const isActive = status === 'active';
          const isHovered = hoveredId === section.id;
          const isNextUp = section.id === nextUpId;
          return (
            <li key={section.id} className={`${styles.dotItem} ${isNextUp ? styles.dotNextUp : ''}`}>
              <button
                className={`${styles.dot} ${isActive ? styles.dotActive : ''}`}
                onClick={() => onSectionClick(section.id)}
                onMouseEnter={() => setHoveredId(section.id)}
                onMouseLeave={() => setHoveredId(null)}
                type="button"
                aria-label={section.label}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className={styles.dotInner} data-status={status} />
              </button>
              {/* Tooltip label */}
              {isHovered && (
                <span className={styles.tooltip}>
                  <span className={styles.tooltipIcon}>{section.icon}</span>
                  {section.label}
                </span>
              )}
            </li>
          );
        })}
        {/* "More below" nudge indicator */}
        {!isLastSectionReached && (
          <li className={styles.moreBelow} aria-hidden="true">
            <span className={styles.moreBelowArrow}>&#x2193;</span>
          </li>
        )}
      </ul>
    </nav>
  );
}

export default FloatingProgressDots;
