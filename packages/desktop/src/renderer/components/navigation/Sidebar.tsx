/**
 * Sidebar Navigation Component
 * Main navigation for authenticated users
 */

import styles from './Sidebar.module.css';

export type AppRoute =
  | 'login'
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
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string }> = [
  { route: 'analyze', label: 'Analyze' },
  { route: 'dashboard', label: 'Dashboard' },
  { route: 'browse', label: 'Knowledge' },
  { route: 'personal', label: 'Personal' },
];

export function Sidebar({ currentRoute, onNavigate, onSignOut, userName }: SidebarProps) {
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
          </div>
        )}
        <button className={styles.signOut} onClick={onSignOut}>
          Sign Out
        </button>
      </div>
    </nav>
  );
}
