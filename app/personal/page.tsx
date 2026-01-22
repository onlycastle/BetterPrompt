/**
 * Personal Dashboard Page
 *
 * Shows user's analysis history and profile.
 * Requires authentication - redirects to login if not authenticated.
 */

import { Suspense } from 'react';
import type { Metadata } from 'next';
import { PersonalDashboardContent } from './PersonalDashboardContent';
import styles from './page.module.css';

export const metadata: Metadata = {
  title: 'My Dashboard | NoMoreAISlop',
  description: 'View your AI coding analysis history and track your growth journey.',
};

function LoadingFallback() {
  return (
    <div className={styles.page}>
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Loading your dashboard...</p>
      </div>
    </div>
  );
}

export default function PersonalPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PersonalDashboardContent />
    </Suspense>
  );
}
