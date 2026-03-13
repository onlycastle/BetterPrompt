'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { useRemoteResult } from '@/hooks/useRemoteResult';
import { ReportSummarySection } from '@/components/personal/tabs/shared/ReportSummarySection';
import { ReportShareBar } from '@/components/report/ReportShareBar';
import { ReportErrorCard } from '@/components/report/ReportErrorCard';
import { ReportLoadingSpinner } from '@/components/report/ReportLoadingSpinner';
import { aggregateWorkerInsights } from '@/lib/models/agent-outputs';
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
      message: "This analysis report doesn't exist or the link may be incorrect. Please check the URL and try again.",
      icon: '&#128269;',
      showRetry: false,
    };
  }

  if (errorStatus === 410) {
    return {
      title: 'Report Expired',
      message: 'This analysis report has expired. Run a new analysis with the CLI to generate a fresh report.',
      icon: '&#8987;',
      showRetry: false,
    };
  }

  return {
    title: 'Something Went Wrong',
    message: errorMessage || 'Failed to load the analysis. Please try again.',
    icon: '&#9888;&#65039;',
    showRetry: true,
  };
}

interface RemoteReportContentProps {
  resultId: string;
}

function PageHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoIcon}>&#128202;</span>
        <span className={styles.logoText}>BetterPrompt</span>
      </Link>
      <div className={styles.headerActions}>
        <Link href="/dashboard/personal" className={styles.headerButton}>
          My Dashboard
        </Link>
      </div>
    </header>
  );
}

export function RemoteReportContent({ resultId }: RemoteReportContentProps) {
  const { data, isLoading, error, errorStatus, refetch } = useRemoteResult(resultId);

  // Compute workerInsights from DB cache or aggregate from agentOutputs
  const workerInsights = useMemo(() => {
    if (!data) return undefined;
    if (data.workerInsights) return data.workerInsights;
    if (data.agentOutputs) return aggregateWorkerInsights(data.agentOutputs);
    return undefined;
  }, [data]);

  // Loading state
  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <ReportLoadingSpinner />
        </div>
      </div>
    );
  }

  // Error states
  if (error) {
    const errorConfig = getErrorCardConfig(errorStatus, error.message);
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
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
            <Link href="/" className={errorConfig.showRetry ? styles.secondaryButton : styles.primaryButton}>
              Go to Homepage
            </Link>
          </ReportErrorCard>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className={styles.page}>
        <div className={styles.errorContainer}>
          <ReportErrorCard
            title="No Data Available"
            message="Unable to load the analysis data. Please try again."
            icon="&#128203;"
          >
            <button onClick={refetch} className={styles.primaryButton}>
              Try Again
            </button>
            <Link href="/" className={styles.secondaryButton}>
              Go to Homepage
            </Link>
          </ReportErrorCard>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <PageHeader />

        {/* Summary only — type result + personality narrative */}
        <div className={styles.reportWrapper}>
          <ReportSummarySection
            analysis={data}
            workerInsights={workerInsights}
            reportId={resultId}
          />
        </div>

        {/* Share buttons */}
        {data.primaryType && (
          <div className={styles.shareWrapper}>
            <ReportShareBar primaryType={data.primaryType} reportId={resultId} />
          </div>
        )}
      </div>
    </div>
  );
}
