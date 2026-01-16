import { useState, type ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import styles from './Layout.module.css';

export interface LayoutProps {
  children: ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <div className={styles.layout}>
      <Sidebar onCollapseChange={setSidebarCollapsed} />
      <main className={`${styles.main} ${sidebarCollapsed ? styles.mainCollapsed : ''}`}>
        <div className={styles.content}>{children}</div>
      </main>
    </div>
  );
}
