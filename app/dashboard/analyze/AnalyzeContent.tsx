/**
 * AnalyzeContent - Client Component
 * Shows plugin-first analysis CTA and recent analysis summary
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { Terminal, ArrowRight, FileText, RefreshCw, Clock } from 'lucide-react';
import styles from './page.module.css';

interface RecentAnalysis {
  id: string;
  resultId: string;
  evaluation: {
    primaryType?: string;
    sessionsAnalyzed?: number;
  } | null;
  claimedAt: string;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function AnalyzeContent() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [recentAnalysis, setRecentAnalysis] = useState<RecentAnalysis | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);

  // Fetch most recent analysis
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchRecent = async () => {
      setIsLoadingAnalysis(true);
      try {
        const response = await fetch('/api/analysis/user?limit=1');
        if (response.ok) {
          const data = await response.json();
          if (data.analyses && data.analyses.length > 0) {
            setRecentAnalysis(data.analyses[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch recent analysis:', error);
      } finally {
        setIsLoadingAnalysis(false);
      }
    };

    fetchRecent();
  }, [isAuthenticated]);

  // Loading state
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>Analyze Your Sessions</h1>
        <p className={styles.subtitle}>
          Discover your AI collaboration patterns and builder style
        </p>
      </header>

      {/* Plugin CTA Card */}
      <section className={styles.ctaCard}>
        <div className={styles.ctaContent}>
          <Terminal size={48} className={styles.ctaIcon} />
          <h2 className={styles.ctaTitle}>Start a New Analysis</h2>
          <p className={styles.ctaDescription}>
            Install the BetterPrompt Claude Code plugin, then ask Claude Code to analyze your sessions locally.
            Use <code>sync_to_team</code> afterward if you want this run stored in the dashboard.
          </p>
          <div className={styles.cliCommand}>
            <code>/plugin install betterprompt@betterprompt</code>
          </div>
          <p className={styles.ctaHint}>
            Then say: <code>Analyze my coding sessions and generate a report</code>
          </p>
        </div>
      </section>

      {/* Recent Analysis Preview */}
      {isLoadingAnalysis ? (
        <section className={styles.recentSection}>
          <div className={styles.loadingInline}>
            <RefreshCw size={16} className={styles.spinIcon} />
            <span>Loading recent analysis...</span>
          </div>
        </section>
      ) : recentAnalysis ? (
        <section className={styles.recentSection}>
          <h3 className={styles.sectionTitle}>
            <Clock size={18} />
            Most Recent Analysis
          </h3>
          <Link
            href={`/dashboard/r/${recentAnalysis.resultId}`}
            className={styles.recentCard}
          >
            <div className={styles.recentIcon}>
              <FileText size={24} />
            </div>
            <div className={styles.recentContent}>
              <span className={styles.recentType}>
                {recentAnalysis.evaluation?.primaryType || 'Analysis'}
              </span>
              <span className={styles.recentMeta}>
                {formatDate(recentAnalysis.claimedAt)} &middot;{' '}
                {recentAnalysis.evaluation?.sessionsAnalyzed || 0} sessions
              </span>
            </div>
            <ArrowRight size={20} className={styles.arrow} />
          </Link>
          <Link href="/dashboard/personal" className={styles.viewAllLink}>
            View all analyses
            <ArrowRight size={14} />
          </Link>
        </section>
      ) : (
        <section className={styles.emptyRecent}>
          <FileText size={32} className={styles.emptyIcon} />
          <p className={styles.emptyText}>
            No analyses yet. Install the plugin above and run your first local analysis.
          </p>
        </section>
      )}
    </div>
  );
}
