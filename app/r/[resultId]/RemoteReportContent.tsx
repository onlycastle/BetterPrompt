'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { useRemoteResult } from '@/hooks/useRemoteResult';
import { useGrowthData } from '@/hooks/useGrowthData';
import { TabbedReportContainer } from '@/components/personal/tabs';
import { UnlockSection } from '@/components/report/UnlockSection';
import { ReportShareBar } from '@/components/report/ReportShareBar';
import { ReportErrorCard } from '@/components/report/ReportErrorCard';
import { ReportLoadingSpinner } from '@/components/report/ReportLoadingSpinner';
import { ReportPreviewBanner } from '@/components/report/ReportPreviewBanner';
import { StickyUnlockBar } from '@/components/report/StickyUnlockBar';
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

export function RemoteReportContent({ resultId }: RemoteReportContentProps) {
  const { data, isPaid, preview, credits, isLoading, error, errorStatus, refetch } = useRemoteResult(resultId);
  const { progressAnalytics, benchmarkPercentiles } = useGrowthData();

  // StickyUnlockBar visibility
  const reportWrapperRef = useRef<HTMLDivElement>(null);
  const [showStickyBar, setShowStickyBar] = useState(false);

  useEffect(() => {
    if (isPaid) {
      setShowStickyBar(false);
      return;
    }

    const reportEl = reportWrapperRef.current;
    const unlockEl = document.getElementById('unlock-section');
    if (!reportEl) return;

    let passedReport = false;
    let unlockVisible = false;

    const update = () => setShowStickyBar(passedReport && !unlockVisible);

    const reportObserver = new IntersectionObserver(
      ([entry]) => {
        passedReport = !entry.isIntersecting;
        update();
      },
      { threshold: 0 },
    );
    reportObserver.observe(reportEl);

    let unlockObserver: IntersectionObserver | undefined;
    if (unlockEl) {
      unlockObserver = new IntersectionObserver(
        ([entry]) => {
          unlockVisible = entry.isIntersecting;
          update();
        },
        { threshold: 0 },
      );
      unlockObserver.observe(unlockEl);
    }

    return () => {
      reportObserver.disconnect();
      unlockObserver?.disconnect();
    };
  }, [isPaid]);

  // Total locked recommendations across all worker domains
  const totalLockedCount = useMemo(() => {
    const wi = data?.workerInsights;
    if (!wi) return 0;
    const count = (domain: { growthAreas?: { recommendation?: string }[] } | undefined) =>
      domain?.growthAreas?.filter(g => !g.recommendation).length ?? 0;
    return count(wi.thinkingQuality) + count(wi.communicationPatterns)
      + count(wi.learningBehavior) + count(wi.contextEfficiency);
  }, [data?.workerInsights]);

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

        {/* Preview banner for free users */}
        {!isPaid && (
          <ReportPreviewBanner title="Premium Content Locked">
            Unlock to access: <strong>personalized recommendations</strong>, <strong>4 more dimensions</strong>, <strong>growth roadmap</strong>, and <strong>premium agent insights</strong>
          </ReportPreviewBanner>
        )}

        {/* Main report content - data is pre-filtered by backend based on tier */}
        <div ref={reportWrapperRef} className={styles.reportWrapper}>
          <TabbedReportContainer
            analysis={data}
            agentOutputs={data.agentOutputs}
            analysisMetadata={data.analysisMetadata}
            progressAnalytics={progressAnalytics}
            benchmarkPercentiles={benchmarkPercentiles}
            isPaid={isPaid}
          />
        </div>

        {/* Share buttons */}
        {data.primaryType && (
          <div className={styles.shareWrapper}>
            <ReportShareBar primaryType={data.primaryType} reportId={resultId} />
          </div>
        )}

        {/* Unlock section for free users */}
        <div className={styles.unlockWrapper}>
          <UnlockSection
            isUnlocked={isPaid}
            resultId={resultId}
            credits={credits}
            onCreditsUsed={refetch}
          />
        </div>

        {/* Sticky bottom CTA bar for free users */}
        <StickyUnlockBar lockedCount={totalLockedCount} visible={showStickyBar} />
      </div>
    </div>
  );
}
