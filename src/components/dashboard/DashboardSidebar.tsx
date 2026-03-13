/**
 * Dashboard Sidebar Component
 * Main navigation for authenticated dashboard users
 */

'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Search, BookOpen, User, BarChart2, Building2 } from 'lucide-react';
import styles from './DashboardSidebar.module.css';

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/dashboard/analyze', label: 'Analyze', icon: <Search size={20} /> },
  { path: '/dashboard/knowledge', label: 'Knowledge', icon: <BookOpen size={20} /> },
  { path: '/dashboard/personal', label: 'Personal', icon: <User size={20} /> },
  { path: '/dashboard/enterprise', label: 'Enterprise', icon: <Building2 size={20} /> },
];

export function DashboardSidebar() {
  const pathname = usePathname();
  const { user, isLoading } = useAuth();

  // Get user display name
  const displayName = user?.email?.split('@')[0] || 'User';

  const isActive = (itemPath: string) => {
    if (itemPath === '/dashboard/personal') {
      return pathname === itemPath || pathname.startsWith('/dashboard/personal/');
    }
    if (itemPath === '/dashboard/enterprise') {
      return pathname === itemPath || pathname.startsWith('/dashboard/enterprise/');
    }
    return pathname === itemPath;
  };

  return (
    <nav className={styles.sidebar}>
      {/* Logo */}
      <Link href="/" className={styles.logo}>
        <BarChart2 size={24} className={styles.logoIcon} />
        <span className={styles.logoText}>BetterPrompt</span>
      </Link>

      {/* Navigation */}
      <div className={styles.nav}>
        {NAV_ITEMS.map(({ path, label, icon }) => (
          <Link
            key={path}
            href={path}
            className={`${styles.navItem} ${isActive(path) ? styles.active : ''}`}
          >
            <span className={styles.navIcon}>{icon}</span>
            <span className={styles.navLabel}>{label}</span>
          </Link>
        ))}
      </div>

      {/* Footer with user info */}
      <div className={styles.footer}>
        {!isLoading && user && (
          <div className={styles.user}>
            <div className={styles.avatar}>
              {displayName.charAt(0).toUpperCase()}
            </div>
            <span className={styles.userName}>{displayName}</span>
          </div>
        )}
      </div>
    </nav>
  );
}
