import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { BookOpen, GraduationCap, LayoutDashboard, ChevronLeft, ChevronRight, Building2, User } from 'lucide-react';
import styles from './Sidebar.module.css';

const NAV_ITEMS = [
  { to: '/personal', icon: User, label: 'My Profile' },
  { to: '/browse', icon: BookOpen, label: 'Knowledge Base' },
  { to: '/learn', icon: GraduationCap, label: 'Learn' },
  { to: '/dashboard', icon: LayoutDashboard, label: 'KB Dashboard' },
  { to: '/enterprise', icon: Building2, label: 'Enterprise' },
];

export interface SidebarProps {
  onCollapseChange?: (collapsed: boolean) => void;
}

export function Sidebar({ onCollapseChange }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  const handleToggle = () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    onCollapseChange?.(newCollapsed);
  };

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <img src="/public/logo.png" alt="No More AI Slop" className={styles.logoIcon} />
          {!collapsed && <span className={styles.logoText}>No More AI Slop</span>}
        </div>
        <button
          className={styles.collapseButton}
          onClick={handleToggle}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className={styles.nav}>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `${styles.navItem} ${isActive ? styles.active : ''}`
            }
            title={collapsed ? label : undefined}
          >
            <Icon size={20} className={styles.navIcon} />
            {!collapsed && <span className={styles.navLabel}>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className={styles.footer}>
        {!collapsed && <p className={styles.version}>NoMoreAISlop v1.0</p>}
      </div>
    </aside>
  );
}
