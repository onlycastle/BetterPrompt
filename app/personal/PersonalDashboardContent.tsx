/**
 * PersonalDashboardContent - Client Component
 *
 * Handles authentication state and displays user's analysis history.
 * Shows login CTA for unauthenticated users.
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, ArrowRight } from 'lucide-react';
import styles from './page.module.css';

interface UserAnalysis {
  id: string;
  resultId: string;
  evaluation: {
    primaryType?: string;
    controlLevel?: string;
    sessionsAnalyzed?: number;
  } | null;
  claimedAt: string;
  expiresAt: string;
}

/**
 * Format date for display
 */
function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Page header with branding
 */
function PageHeader() {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoIcon}>&#128202;</span>
        <span className={styles.logoText}>BetterPrompt</span>
      </Link>
    </header>
  );
}

/**
 * Empty state when user has no analyses
 */
function EmptyState() {
  return (
    <div className={styles.emptyState}>
      <div className={styles.emptyIcon}>&#128202;</div>
      <h2 className={styles.emptyTitle}>No Analyses Yet</h2>
      <p className={styles.emptyDescription}>
        Install the Claude Code plugin and run your first local analysis to see your AI insights here.
      </p>
      <div className={styles.cliBox}>
        <code>/plugin install betterprompt@betterprompt</code>
      </div>
    </div>
  );
}

/**
 * Analysis card for list display
 */
function AnalysisCard({ analysis }: { analysis: UserAnalysis }) {
  const evaluation = analysis.evaluation;
  const primaryType = evaluation?.primaryType || 'Unknown';
  const sessionsAnalyzed = evaluation?.sessionsAnalyzed || 0;

  return (
    <Link href={`/r/${analysis.resultId}`} className={styles.analysisCard}>
      <div className={styles.cardIcon}>
        <FileText size={24} />
      </div>
      <div className={styles.cardContent}>
        <div className={styles.cardType}>{primaryType}</div>
        <div className={styles.cardMeta}>
          {formatDate(analysis.claimedAt)} &middot; {sessionsAnalyzed} sessions
        </div>
      </div>
      <ArrowRight size={20} className={styles.cardArrow} />
    </Link>
  );
}

/**
 * Main dashboard content
 */
export function PersonalDashboardContent() {
  const { user, isLoading: authLoading } = useAuth();
  const [analyses, setAnalyses] = useState<UserAnalysis[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);
  const [analysesError, setAnalysesError] = useState<string | null>(null);

  // Fetch user's analyses
  useEffect(() => {
    const fetchAnalyses = async () => {
      setIsLoadingAnalyses(true);
      setAnalysesError(null);
      try {
        const response = await fetch('/api/analysis/user');
        if (!response.ok) {
          const errorText = await response.text().catch(() => 'Unknown error');
          throw new Error(`Failed to fetch analyses: ${response.status} ${errorText}`);
        }
        const data = await response.json();
        setAnalyses(data.analyses || []);
      } catch (error) {
        console.error('Failed to fetch analyses:', error);
        setAnalysesError(error instanceof Error ? error.message : 'Failed to load analyses');
      } finally {
        setIsLoadingAnalyses(false);
      }
    };

    fetchAnalyses();
  }, []);

  // Loading state
  if (authLoading) {
    return (
      <div className={styles.page}>
        <div className={styles.loadingContainer}>
          <div className={styles.spinner} />
          <p className={styles.loadingText}>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <PageHeader />

        <div className={styles.dashboardHeader}>
          <h1 className={styles.dashboardTitle}>My Dashboard</h1>
          <p className={styles.dashboardSubtitle}>
            Welcome back{user?.email ? `, ${user.email.split('@')[0]}` : ''}
          </p>
        </div>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Your Analyses</h2>

          {isLoadingAnalyses ? (
            <div className={styles.loadingInline}>
              <div className={styles.spinnerSmall} />
              <span>Loading analyses...</span>
            </div>
          ) : analysesError ? (
            <div className={styles.errorState}>
              <p className={styles.errorText}>{analysesError}</p>
            </div>
          ) : analyses.length === 0 ? (
            <EmptyState />
          ) : (
            <div className={styles.analysisList}>
              {analyses.map((analysis) => (
                <AnalysisCard key={analysis.id} analysis={analysis} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
