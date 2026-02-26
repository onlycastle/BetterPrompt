/**
 * Personal Page
 * User's analysis history and growth journey
 */

import { Suspense } from 'react';
import { PersonalContent } from './PersonalContent';
import styles from './page.module.css';

export const metadata = {
  title: 'Personal | NoMoreAISlop',
  description: 'Your AI analysis and growth journey',
};

function LoadingFallback() {
  return (
    <div className={styles.container}>
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading...</p>
      </div>
    </div>
  );
}

export default function PersonalPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PersonalContent />
    </Suspense>
  );
}
