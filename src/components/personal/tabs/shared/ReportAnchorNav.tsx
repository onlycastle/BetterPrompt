/**
 * ReportAnchorNav Component
 *
 * Vertical sidebar navigation for the report page.
 * Appears after scrolling past the header section (controlled by parent grid's navColumn).
 * Provides quick access to Profile (top), analysis tabs, and Start (unlock section).
 *
 * Pure presentation component — all state and observers are managed by TabbedReportContainer.
 */

import { useEffect, useState, useCallback } from 'react';
import type { ReportTabId } from '../containers/TabbedReportContainer';
import styles from './ReportAnchorNav.module.css';

/** Short nav labels for each tab */
const NAV_LABELS: Record<ReportTabId, string> = {
  activity: 'Activity',
  thinking: 'Thinking',
  communication: 'Comm',
  learning: 'Learning',
  context: 'Context',
};

interface TabConfig {
  id: ReportTabId;
  label: string;
}

interface ReportAnchorNavProps {
  activeTab: ReportTabId;
  availableTabs: TabConfig[];
  onTabClick: (tabId: ReportTabId) => void;
  onProfileClick: () => void;
  visible: boolean;
}

export function ReportAnchorNav({
  activeTab,
  availableTabs,
  onTabClick,
  onProfileClick,
  visible,
}: ReportAnchorNavProps) {
  // Detect unlock section in DOM for conditional "Start" button
  const [hasUnlockSection, setHasUnlockSection] = useState(false);

  useEffect(() => {
    setHasUnlockSection(!!document.getElementById('unlock-section'));
  }, []);

  const handleStartClick = useCallback(() => {
    document.getElementById('unlock-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <nav
      className={`${styles.nav} ${visible ? styles.visible : ''}`}
      aria-label="Report section navigation"
    >
      <ul className={styles.navList}>
        {/* Profile — scroll to top */}
        <li>
          <button
            className={styles.navLink}
            onClick={onProfileClick}
            type="button"
          >
            Profile
          </button>
        </li>

        {/* Separator */}
        <li aria-hidden="true"><div className={styles.separator} /></li>

        {/* Analysis Tabs */}
        {availableTabs.map((tab) => (
          <li key={tab.id}>
            <button
              className={`${styles.navLink} ${activeTab === tab.id ? styles.active : ''}`}
              onClick={() => onTabClick(tab.id)}
              aria-current={activeTab === tab.id ? 'true' : undefined}
              type="button"
            >
              {NAV_LABELS[tab.id]}
            </button>
          </li>
        ))}

        {/* Separator + Start (only for free users with unlock section) */}
        {hasUnlockSection && (
          <>
            <li aria-hidden="true"><div className={styles.separator} /></li>
            <li>
              <button
                className={styles.navLink}
                onClick={handleStartClick}
                type="button"
              >
                Start
              </button>
            </li>
          </>
        )}
      </ul>
    </nav>
  );
}
