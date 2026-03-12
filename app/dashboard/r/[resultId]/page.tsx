/**
 * Immersive Report Page
 * Full-screen storytelling experience — sidebar hidden via CSS :has()
 */

import { Suspense } from 'react';
import { ImmersiveReportContent } from './ImmersiveReportContent';

interface PageProps {
  params: Promise<{ resultId: string }>;
}

export async function generateMetadata({ params }: PageProps) {
  const { resultId } = await params;
  return {
    title: `Report ${resultId.slice(0, 8)} | NoMoreAISlop`,
    description: 'Your NoMoreAISlop analysis report',
  };
}

function LoadingFallback() {
  return (
    <div data-immersive-report style={{ padding: '80px 24px 24px', minHeight: '50vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <p style={{ color: 'var(--text-secondary)' }}>Loading your analysis...</p>
    </div>
  );
}

export default async function ImmersiveReportPage({ params }: PageProps) {
  const { resultId } = await params;
  return (
    <div data-immersive-report>
      <Suspense fallback={<LoadingFallback />}>
        <ImmersiveReportContent resultId={resultId} />
      </Suspense>
    </div>
  );
}
