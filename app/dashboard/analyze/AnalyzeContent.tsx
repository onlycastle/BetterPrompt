/**
 * AnalyzeContent - Client Component
 * Shows CLI command CTA and recent analysis summary
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { TestLoginForm } from '@/components/auth';
import { Terminal, ArrowRight, FileText, RefreshCw, Github, Clock } from 'lucide-react';
import styles from './page.module.css';

interface RecentAnalysis {
  id: string;
  resultId: string;
  evaluation: {
    primaryType?: string;
    sessionsAnalyzed?: number;
  } | null;
  isPaid: boolean;
  claimedAt: string;
}

export function AnalyzeContent() {
  const { isAuthenticated, isLoading: authLoading, signInWithGitHub } = useAuth();
  const [recentAnalysis, setRecentAnalysis] = useState<RecentAnalysis | null>(null);
  const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);

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

  const handleGitHubLogin = async () => {
    setLoginLoading(true);
    try {
      await signInWithGitHub();
    } catch (error) {
      console.error('GitHub login failed:', error);
    } finally {
      setLoginLoading(false);
    }
  };

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

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

  // Not authenticated
  if (!isAuthenticated) {
    return (
      <div className={styles.container}>
        <div className={styles.loginCard}>
          <div className={styles.loginIcon}>&#128274;</div>
          <h1 className={styles.loginTitle}>Sign in to Analyze</h1>
          <p className={styles.loginDescription}>
            Connect your GitHub account to start analyzing your AI coding sessions.
          </p>
          <button
            onClick={handleGitHubLogin}
            disabled={loginLoading}
            className={styles.githubBtn}
          >
            <Github size={20} />
            {loginLoading ? 'Signing in...' : 'Continue with GitHub'}
          </button>
          <TestLoginForm />
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
          Discover your AI collaboration patterns and coding style
        </p>
      </header>

      {/* CLI CTA Card */}
      <section className={styles.ctaCard}>
        <div className={styles.ctaContent}>
          <Terminal size={48} className={styles.ctaIcon} />
          <h2 className={styles.ctaTitle}>Start a New Analysis</h2>
          <p className={styles.ctaDescription}>
            Run the CLI command in your terminal to analyze your Claude Code sessions.
            Your data is processed in the cloud but <strong>never stored</strong>.
          </p>
          <div className={styles.cliCommand}>
            <code>npx no-ai-slop</code>
          </div>
          <p className={styles.ctaHint}>
            Works with Claude Code sessions from <code>~/.claude/projects/</code>
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
            <span className={`${styles.badge} ${recentAnalysis.isPaid ? styles.paidBadge : styles.freeBadge}`}>
              {recentAnalysis.isPaid ? 'Full' : 'Preview'}
            </span>
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
            No analyses yet. Run the CLI command above to get started!
          </p>
        </section>
      )}
    </div>
  );
}
