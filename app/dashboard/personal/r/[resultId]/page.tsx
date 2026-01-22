/**
 * Dashboard Report Detail Page
 * Shows full report within dashboard layout (with sidebar)
 */

import { Suspense } from 'react';
import { DashboardReportContent } from './DashboardReportContent';
import styles from './page.module.css';

interface PageProps {
  params: Promise<{ resultId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { resultId } = await params;
  return {
    title: `Report ${resultId.slice(0, 8)} | NoMoreAISlop`,
    description: 'Your AI coding style analysis report',
  };
}

function LoadingFallback() {
  return (
    <div className={styles.container}>
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Loading your analysis...</p>
      </div>
    </div>
  );
}

export default async function DashboardReportPage({ params }: PageProps) {
  const { resultId } = await params;
  return (
    <Suspense fallback={<LoadingFallback />}>
      <DashboardReportContent resultId={resultId} />
    </Suspense>
  );
}
