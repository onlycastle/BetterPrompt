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
import { LogOut, FileText, Terminal, ArrowRight, Github } from 'lucide-react';
import styles from './page.module.css';

interface UserAnalysis {
  id: string;
  resultId: string;
  evaluation: {
    primaryType?: string;
    controlLevel?: string;
    sessionsAnalyzed?: number;
  } | null;
  isPaid: boolean;
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
function PageHeader({ isAuthenticated, onSignOut }: { isAuthenticated: boolean; onSignOut: () => void }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.logo}>
        <span className={styles.logoIcon}>&#128202;</span>
        <span className={styles.logoText}>NoMoreAISlop</span>
      </Link>
      <div className={styles.headerActions}>
        {isAuthenticated && (
          <button onClick={onSignOut} className={styles.signOutBtn}>
            <LogOut size={16} />
            Sign Out
          </button>
        )}
      </div>
    </header>
  );
}

/**
 * Login CTA for unauthenticated users
 */
function LoginCTA({ onGitHubLogin, isLoading }: { onGitHubLogin: () => void; isLoading: boolean }) {
  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <div className={styles.loginIcon}>&#128274;</div>
        <h1 className={styles.loginTitle}>Sign in to Your Dashboard</h1>
        <p className={styles.loginDescription}>
          View your analysis history, track your progress, and unlock premium insights.
        </p>
        <button
          onClick={onGitHubLogin}
          disabled={isLoading}
          className={styles.githubBtn}
        >
          <Github size={20} />
          {isLoading ? 'Signing in...' : 'Continue with GitHub'}
        </button>
        <div className={styles.cliHint}>
          <Terminal size={16} />
          <span>New here? Run <code>npx no-ai-slop</code> to analyze your AI sessions</span>
        </div>
      </div>
    </div>
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
        Run your first analysis to see your AI insights here.
      </p>
      <div className={styles.cliBox}>
        <code>npx no-ai-slop</code>
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
      <div className={styles.cardBadge}>
        {analysis.isPaid ? (
          <span className={styles.paidBadge}>Full</span>
        ) : (
          <span className={styles.freeBadge}>Preview</span>
        )}
      </div>
      <ArrowRight size={20} className={styles.cardArrow} />
    </Link>
  );
}

/**
 * Main dashboard content
 */
export function PersonalDashboardContent() {
  const { user, isAuthenticated, isLoading: authLoading, signInWithGitHub, signOut } = useAuth();
  const [analyses, setAnalyses] = useState<UserAnalysis[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);
  const [analysesError, setAnalysesError] = useState<string | null>(null);
  const [loginLoading, setLoginLoading] = useState(false);

  // Fetch user's analyses when authenticated
  useEffect(() => {
    if (!isAuthenticated || !user) {
      setAnalyses([]);
      setAnalysesError(null);
      return;
    }

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
  }, [isAuthenticated, user]);

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

  // Not authenticated - show login CTA
  if (!isAuthenticated) {
    return (
      <div className={styles.page}>
        <div className={styles.container}>
          <PageHeader isAuthenticated={false} onSignOut={signOut} />
          <LoginCTA onGitHubLogin={handleGitHubLogin} isLoading={loginLoading} />
        </div>
      </div>
    );
  }

  // Authenticated - show dashboard
  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <PageHeader isAuthenticated={true} onSignOut={signOut} />

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
