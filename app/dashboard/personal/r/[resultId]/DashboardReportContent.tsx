/**
 * DashboardReportContent - Client Component
 * Full report view within dashboard layout
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRemoteResult } from '@/hooks/useRemoteResult';
import { TabbedReportContainer } from '@/components/personal/tabs/TabbedReportContainer';
import { UnlockSection } from '@/components/report/UnlockSection';
import { ArrowLeft, CheckCircle } from 'lucide-react';
import styles from './page.module.css';

interface DashboardReportContentProps {
  resultId: string;
}

export function DashboardReportContent({ resultId }: DashboardReportContentProps) {
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('payment') === 'success';

  const { data, isPaid, preview, credits, isLoading, error, errorStatus, refetch } = useRemoteResult(resultId);
  const [showSuccessToast, setShowSuccessToast] = useState(paymentSuccess);

  // Hide success toast after delay
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your analysis...</p>
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>
            {errorStatus === 404 ? '🔍' : errorStatus === 410 ? '⏳' : '⚠️'}
          </div>
          <h1 className={styles.errorTitle}>
            {errorStatus === 404
              ? 'Report Not Found'
              : errorStatus === 410
              ? 'Report Expired'
              : 'Something Went Wrong'}
          </h1>
          <p className={styles.errorMessage}>
            {errorStatus === 404
              ? "This analysis report doesn't exist or the link may be incorrect."
              : errorStatus === 410
              ? 'This analysis report has expired. Run a new analysis to generate a fresh report.'
              : error.message || 'Failed to load the analysis. Please try again.'}
          </p>
          <div className={styles.errorActions}>
            {errorStatus !== 404 && errorStatus !== 410 && (
              <button onClick={refetch} className={styles.primaryButton}>
                Try Again
              </button>
            )}
            <Link href="/dashboard/personal" className={styles.secondaryButton}>
              Back to Profile
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // No data
  if (!data) {
    return (
      <div className={styles.container}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>📋</div>
          <h1 className={styles.errorTitle}>No Data Available</h1>
          <p className={styles.errorMessage}>Unable to load the analysis data.</p>
          <div className={styles.errorActions}>
            <button onClick={refetch} className={styles.primaryButton}>
              Try Again
            </button>
            <Link href="/dashboard/personal" className={styles.secondaryButton}>
              Back to Profile
            </Link>
          </div>
        </div>
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
        <div className={styles.previewBanner}>
          <span className={styles.previewIcon}>&#128274;</span>
          <div className={styles.previewContent}>
            <p className={styles.previewTitle}>Preview Mode</p>
            <p className={styles.previewText}>
              You&apos;re viewing a preview. Unlock to see all {preview.totalPromptPatterns} patterns
              and {preview.totalGrowthAreas} growth areas.
            </p>
          </div>
        </div>
      )}

      {/* Main Report */}
      <div className={styles.reportWrapper}>
        <TabbedReportContainer
          analysis={data}
          agentOutputs={data.agentOutputs}
          isPaid={isPaid}
        />
      </div>

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
