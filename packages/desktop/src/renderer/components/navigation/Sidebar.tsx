/**
 * Sidebar Navigation Component
 * Main navigation for authenticated users
 */

import styles from './Sidebar.module.css';

export type AppRoute =
  | 'login'
  | 'quick-fix'
  | 'analyze'
  | 'results'
  | 'dashboard'
  | 'browse'
  | 'personal'
  | 'report'
  | 'comparison';

interface SidebarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onSignOut: () => void;
  userName?: string;
  credits?: number | null;
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string }> = [
  { route: 'quick-fix', label: 'Solve Issue' },
  { route: 'analyze', label: 'Full Profile' },
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'browse', label: 'Knowledge' },
  { route: 'personal', label: 'Personal' },
];

export function Sidebar({ currentRoute, onNavigate, onSignOut, userName, credits }: SidebarProps) {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <img
          src="/images/logo.png"
          alt="NoMoreAISlop"
          className={styles.logoIcon}
        />
        <span className={styles.logoText}>No More AI Slop</span>
      </div>

      <div className={styles.nav}>
        {NAV_ITEMS.map(({ route, label }) => (
          <button
            key={route}
            className={`${styles.navItem} ${currentRoute === route ? styles.active : ''}`}
            onClick={() => onNavigate(route)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        {userName && (
          <div className={styles.user}>
            <span className={styles.userName}>{userName}</span>
            {credits !== null && credits !== undefined && (
              <span className={styles.credits}>
                🟡 {credits} credit{credits !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        )}
        <button className={styles.signOut} onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </nav>
  );
}
