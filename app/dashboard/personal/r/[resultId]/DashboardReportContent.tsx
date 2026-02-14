'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRemoteResult } from '@/hooks/useRemoteResult';
import { TabbedReportContainer } from '@/components/personal/tabs';
import { UnlockSection } from '@/components/report/UnlockSection';
import { ReportShareBar } from '@/components/report/ReportShareBar';
import { ReportErrorCard } from '@/components/report/ReportErrorCard';
import { ReportLoadingSpinner } from '@/components/report/ReportLoadingSpinner';
import { ReportPreviewBanner } from '@/components/report/ReportPreviewBanner';
import { ArrowLeft, CheckCircle } from 'lucide-react';
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

interface DashboardReportContentProps {
  resultId: string;
}

export function DashboardReportContent({ resultId }: DashboardReportContentProps) {
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('payment') === 'success';

  const { data, isPaid, preview, credits, isLoading, error, errorStatus, refetch } = useRemoteResult(resultId);
  const [showSuccessToast, setShowSuccessToast] = useState(paymentSuccess);

  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Auto-retry when payment succeeded but report still shows locked
  const [retryCount, setRetryCount] = useState(0);
  const MAX_RETRIES = 3;

  useEffect(() => {
    if (paymentSuccess && !isPaid && !isLoading && retryCount < MAX_RETRIES) {
      const timer = setTimeout(() => {
        setRetryCount(c => c + 1);
        refetch();
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [paymentSuccess, isPaid, isLoading, retryCount, refetch]);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <ReportLoadingSpinner />
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    const errorConfig = getErrorCardConfig(errorStatus, error.message);
    return (
      <div className={styles.container}>
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

  // No data
  if (!data) {
    return (
      <div className={styles.container}>
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

  // Success - render report
  return (
    <div className={styles.container}>
      {/* Success Toast */}
      {showSuccessToast && (
        <div className={styles.successToast}>
          <CheckCircle size={20} />
          <span>Payment successful! Your full report is now available.</span>
        </div>
      )}

      {/* Back Link */}
      <Link href="/dashboard/personal" className={styles.backLink}>
        <ArrowLeft size={16} />
        Back to Profile
      </Link>

      {/* Preview Banner */}
      {!isPaid && preview && (
        <ReportPreviewBanner title="Preview Mode">
          You&apos;re viewing a preview. Unlock to see all {preview.totalPromptPatterns} patterns
          and personalized insights.
        </ReportPreviewBanner>
      )}

      {/* Main Report - data is pre-filtered by backend based on tier */}
      <div className={styles.reportWrapper}>
        <TabbedReportContainer
          analysis={data}
          agentOutputs={data.agentOutputs}
          analysisMetadata={data.analysisMetadata}
          isPaid={isPaid}
          reportId={resultId}
          credits={credits}
          onCreditsUsed={refetch}
        />
      </div>

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
          lockedDomains={undefined}
        />
      </div>
    </div>
  );
}
