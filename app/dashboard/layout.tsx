/**
 * Dashboard Layout
 * Shared layout with sidebar for all dashboard pages
 * Requires authentication
 */

import { DashboardSidebar } from '@/components/dashboard/DashboardSidebar';
import { AuthProvider } from '@/contexts/AuthContext';
import styles from './layout.module.css';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AuthProvider>
      <div className={styles.dashboard}>
        <DashboardSidebar />
        <main className={styles.content}>
          {children}
        </main>
      </div>
    </AuthProvider>
  );
}
