/**
 * RemoteReportContent - Client Component
 *
 * Handles data fetching and rendering of the remote report.
 * Must be a client component because it uses React Query hooks.
 */

'use client';

import Link from 'next/link';
import { useRemoteResult } from '@/hooks/useRemoteResult';
import { TabbedReportContainer } from '@/components/personal/tabs';
import { UnlockSection } from '@/components/report/UnlockSection';
import { VERBOSE_TYPE_METADATA } from '@/types/verbose';
import styles from './page.module.css';

interface RemoteReportContentProps {
  resultId: string;
}

/**
 * Error display component for 404/410/etc states
 */
function ErrorState({
  title,
  message,
  icon,
  showHomeButton = true,
  showRetryButton = false,
  onRetry,
}: {
  title: string;
  message: string;
  icon: string;
  showHomeButton?: boolean;
  showRetryButton?: boolean;
  onRetry?: () => void;
}) {
  return (
    <div className={styles.page}>
      <div className={styles.errorContainer}>
        <div className={styles.errorCard}>
          <div className={styles.errorIcon}>{icon}</div>
          <h1 className={styles.errorTitle}>{title}</h1>
          <p className={styles.errorMessage}>{message}</p>
          <div className={styles.errorActions}>
            {showRetryButton && onRetry && (
              <button onClick={onRetry} className={styles.primaryButton}>
                Try Again
              </button>
            )}
            {showHomeButton && (
              <Link href="/" className={showRetryButton ? styles.secondaryButton : styles.primaryButton}>
                Go to Homepage
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div className={styles.page}>
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p className={styles.loadingText}>Loading your analysis...</p>
      </div>
    </div>
  );
}

/**
 * Preview banner for free users
 */
function PreviewBanner() {
  return (
    <div className={styles.previewBanner}>
      <span className={styles.previewIcon}>&#128274;</span>
      <div className={styles.previewContent}>
        <p className={styles.previewTitle}>Premium Content Locked</p>
        <p className={styles.previewText}>
          Unlock to access: <strong>personalized recommendations</strong>, <strong>4 more dimensions</strong>, <strong>growth roadmap</strong>, and <strong>premium agent insights</strong>
        </p>
      </div>
    </div>
  );
}

/**
 * Page header with branding
 */
function PageHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoIcon}>&#128202;</span>
        <span className={styles.logoText}>NoMoreAISlop</span>
      </Link>
      <div className={styles.headerActions}>
        <Link href="/dashboard/personal" className={styles.headerButton}>
          My Dashboard
        </Link>
      </div>
    </header>
  );
}

/**
 * Main client component for remote report
 */
export function RemoteReportContent({ resultId }: RemoteReportContentProps) {
  const { data, isPaid, preview, isLoading, error, errorStatus, refetch } = useRemoteResult(resultId);

  // Loading state
  if (isLoading) {
    return <LoadingState />;
  }

  // Error states
  if (error) {
    if (errorStatus === 404) {
      return (
        <ErrorState
          title="Report Not Found"
          message="This analysis report doesn't exist or the link may be incorrect. Please check the URL and try again."
          icon="&#128269;"
          showHomeButton={true}
        />
      );
    }

    if (errorStatus === 410) {
      return (
        <ErrorState
          title="Report Expired"
          message="This analysis report has expired. Run a new analysis with the CLI to generate a fresh report."
          icon="&#8987;"
          showHomeButton={true}
        />
      );
    }

    // Generic error
    return (
      <ErrorState
        title="Something Went Wrong"
        message={error.message || 'Failed to load the analysis. Please try again.'}
        icon="&#9888;&#65039;"
        showHomeButton={true}
        showRetryButton={true}
        onRetry={refetch}
      />
    );
  }

  // No data (shouldn't happen if no error, but safety check)
  if (!data) {
    return (
      <ErrorState
        title="No Data Available"
        message="Unable to load the analysis data. Please try again."
        icon="&#128203;"
        showHomeButton={true}
        showRetryButton={true}
        onRetry={refetch}
      />
    );
  }

  // Success state - render the report
  const typeMetadata = data.primaryType ? VERBOSE_TYPE_METADATA[data.primaryType] : null;

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <PageHeader />

        {/* Preview banner for free users */}
        {!isPaid && <PreviewBanner />}

        {/* Main report content - data is pre-filtered by backend based on tier */}
        <div className={styles.reportWrapper}>
          <TabbedReportContainer
            analysis={data}
            agentOutputs={data.agentOutputs}
            analysisMetadata={data.analysisMetadata}
          />
        </div>

        {/* Unlock section for free users */}
        <div className={styles.unlockWrapper}>
          <UnlockSection isUnlocked={isPaid} resultId={resultId} />
        </div>
      </div>
    </div>
  );
}
