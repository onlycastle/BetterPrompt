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
  | 'learn'
  | 'personal'
  | 'report'
  | 'comparison';

interface SidebarProps {
  currentRoute: AppRoute;
  onNavigate: (route: AppRoute) => void;
  onSignOut: () => void;
  userName?: string;
}

const NAV_ITEMS: Array<{ route: AppRoute; label: string; icon: string }> = [
  { route: 'analyze', label: 'Analyze', icon: '🔍' },
  { route: 'dashboard', label: 'Dashboard', icon: '📊' },
  { route: 'browse', label: 'Knowledge', icon: '📚' },
  { route: 'learn', label: 'Learn', icon: '🎓' },
  { route: 'personal', label: 'Personal', icon: '👤' },
];

export function Sidebar({ currentRoute, onNavigate, onSignOut, userName }: SidebarProps) {
  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <span className={styles.logoIcon}>🎯</span>
        <span className={styles.logoText}>NoMoreAISlop</span>
      </div>

      <div className={styles.nav}>
        {NAV_ITEMS.map(({ route, label, icon }) => (
          <button
            key={route}
            className={`${styles.navItem} ${currentRoute === route ? styles.active : ''}`}
            onClick={() => onNavigate(route)}
          >
            <span className={styles.navIcon}>{icon}</span>
            <span className={styles.navLabel}>{label}</span>
          </button>
        ))}
      </div>

      <div className={styles.footer}>
        {userName && (
          <div className={styles.user}>
            <span className={styles.userIcon}>👋</span>
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
