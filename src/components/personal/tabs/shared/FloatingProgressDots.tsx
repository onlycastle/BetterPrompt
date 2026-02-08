/**
 * FloatingProgressDots Component
 *
 * Vertical floating navigation dots fixed on the right side of the viewport.
 * Replaces the tab bar and ReportAnchorNav for continuous scroll layout.
 *
 * Features:
 * - Fixed position on right side of viewport
 * - Each dot represents one section
 * - Active dot highlighted (cyan, scaled)
 * - Hover shows section label tooltip
 * - Click scrolls to section
 * - Hidden when header is fully visible
 * - Responsive: smaller on mobile
 */

import { useState } from 'react';
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
}

export function FloatingProgressDots({
  sections,
  activeSection,
  onSectionClick,
  visible,
}: FloatingProgressDotsProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  if (sections.length === 0) return null;

  return (
    <nav
      className={`${styles.container} ${visible ? styles.visible : ''}`}
      aria-label="Section navigation"
    >
      <ul className={styles.dotList}>
        {sections.map((section) => {
          const isActive = activeSection === section.id;
          const isHovered = hoveredId === section.id;
          return (
            <li key={section.id} className={styles.dotItem}>
              <button
                className={`${styles.dot} ${isActive ? styles.dotActive : ''}`}
                onClick={() => onSectionClick(section.id)}
                onMouseEnter={() => setHoveredId(section.id)}
                onMouseLeave={() => setHoveredId(null)}
                type="button"
                aria-label={section.label}
                aria-current={isActive ? 'true' : undefined}
              >
                <span className={styles.dotInner} />
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
      </ul>
    </nav>
  );
}

export default FloatingProgressDots;
