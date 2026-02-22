/**
 * ImmersiveReportContent
 * Client component for the full-screen immersive report experience.
 * No sidebar, no progress dots, no resource sidebar — just the story.
 */

'use client';

import Link from 'next/link';
import { CheckCircle } from 'lucide-react';
import { useReportPage } from '@/hooks/useReportPage';
import { TabbedReportContainer } from '@/components/personal/tabs';
import { UnlockSection } from '@/components/report/UnlockSection';
import { ReportShareBar } from '@/components/report/ReportShareBar';
import { ReportErrorCard } from '@/components/report/ReportErrorCard';
import { ReportLoadingSpinner } from '@/components/report/ReportLoadingSpinner';
import { ReportPreviewBanner } from '@/components/report/ReportPreviewBanner';
import { FloatingBackButton } from '@/components/report/FloatingBackButton';
import styles from './page.module.css';

interface ErrorCardConfig {
  title: string;
  message: string;
  icon: string;
  showRetry: boolean;
}

function getErrorCardConfig(errorStatus: number | null | undefined, errorMessage?: string): ErrorCardConfig {
  if (errorStatus === 404) {
    return {
      title: 'Report Not Found',
      message: "This analysis report doesn't exist or the link may be incorrect.",
      icon: '🔍',
      showRetry: false,
    };
  }

  if (errorStatus === 410) {
    return {
      title: 'Report Expired',
      message: 'This analysis report has expired. Run a new analysis to generate a fresh report.',
      icon: '⏳',
      showRetry: false,
    };
  }

  return {
    title: 'Something Went Wrong',
    message: errorMessage || 'Failed to load the analysis. Please try again.',
    icon: '⚠️',
    showRetry: true,
  };
}

interface ImmersiveReportContentProps {
  resultId: string;
}

export function ImmersiveReportContent({ resultId }: ImmersiveReportContentProps) {
  const { data, isPaid, preview, credits, isLoading, error, errorStatus, refetch, showSuccessToast } =
    useReportPage(resultId);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <FloatingBackButton resultId={resultId} />
        <div className={styles.loading}>
          <ReportLoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    const errorConfig = getErrorCardConfig(errorStatus, error.message);
    return (
      <div className={styles.container}>
        <FloatingBackButton resultId={resultId} />
        <ReportErrorCard
          title={errorConfig.title}
          message={errorConfig.message}
          icon={errorConfig.icon}
        >
          {errorConfig.showRetry && (
            <button onClick={refetch} className={styles.primaryButton}>
              Try Again
            </button>
          )}
          <Link href="/dashboard/personal" className={styles.secondaryButton}>
            Back to Profile
          </Link>
        </ReportErrorCard>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.container}>
        <FloatingBackButton resultId={resultId} />
        <ReportErrorCard
          title="No Data Available"
          message="Unable to load the analysis data."
          icon="📋"
        >
          <button onClick={refetch} className={styles.primaryButton}>
            Try Again
          </button>
          <Link href="/dashboard/personal" className={styles.secondaryButton}>
            Back to Profile
          </Link>
        </ReportErrorCard>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <FloatingBackButton resultId={resultId} />

      {/* Success Toast */}
      {showSuccessToast && (
        <div className={styles.successToast}>
          <CheckCircle size={20} />
          <span>Payment successful! Your full report is now available.</span>
        </div>
      )}

      {/* Preview Banner */}
      {!isPaid && preview && (
        <ReportPreviewBanner title="Preview Mode">
          You&apos;re viewing a preview. Unlock to see all {preview.totalPromptPatterns} patterns
          and personalized insights.
        </ReportPreviewBanner>
      )}

      {/* Main Report — no frame, no sidebar, no progress dots */}
      <TabbedReportContainer
        analysis={data}
        agentOutputs={data.agentOutputs}
        analysisMetadata={data.analysisMetadata}
        isPaid={isPaid}
        reportId={resultId}
        credits={credits}
        onCreditsUsed={refetch}
        showProgressDots={false}
        showResourceSidebar={false}
        experience="immersive-apple"
      />

      {/* Share buttons */}
      {data.primaryType && (
        <div className={styles.shareWrapper}>
          <ReportShareBar primaryType={data.primaryType} reportId={resultId} />
        </div>
      )}

      {/* Unlock Section */}
      <div className={styles.unlockWrapper}>
        <UnlockSection
          isUnlocked={isPaid}
          resultId={resultId}
          credits={credits}
          onCreditsUsed={refetch}
        />
      </div>
    </div>
  );
}
