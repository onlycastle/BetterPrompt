/**
 * PersonalContent - Client Component
 * Tabbed view: Report | Progress | Insights
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { FileText, TrendingUp, Lightbulb, ArrowRight, Github, CheckCircle } from 'lucide-react';
import styles from './page.module.css';

type TabId = 'report' | 'progress' | 'insights';

interface UserAnalysis {
  id: string;
  resultId: string;
  evaluation: {
    primaryType?: string;
    sessionsAnalyzed?: number;
    overallScore?: number;
  } | null;
  isPaid: boolean;
  claimedAt: string;
}

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'report', label: 'Report', icon: <FileText size={18} /> },
  { id: 'progress', label: 'Progress', icon: <TrendingUp size={18} /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb size={18} /> },
];

export function PersonalContent() {
  const searchParams = useSearchParams();
  const paymentSuccess = searchParams.get('payment') === 'success';

  const { isAuthenticated, isLoading: authLoading, user, signInWithGitHub } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('report');
  const [analyses, setAnalyses] = useState<UserAnalysis[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [showSuccessToast, setShowSuccessToast] = useState(paymentSuccess);

  // Hide success toast after delay
  useEffect(() => {
    if (showSuccessToast) {
      const timer = setTimeout(() => setShowSuccessToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessToast]);

  // Fetch analyses
  useEffect(() => {
    if (!isAuthenticated) return;

    const fetchAnalyses = async () => {
      setIsLoadingAnalyses(true);
      try {
        const response = await fetch('/api/analysis/user');
        if (response.ok) {
          const data = await response.json();
          setAnalyses(data.analyses || []);
        }
      } catch (error) {
        console.error('Failed to fetch analyses:', error);
      } finally {
        setIsLoadingAnalyses(false);
      }
    };

    fetchAnalyses();
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
          <h1 className={styles.loginTitle}>Sign in to View Profile</h1>
          <p className={styles.loginDescription}>
            Access your analysis history and track your growth journey.
          </p>
          <button
            onClick={handleGitHubLogin}
            disabled={loginLoading}
            className={styles.githubBtn}
          >
            <Github size={20} />
            {loginLoading ? 'Signing in...' : 'Continue with GitHub'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* Success Toast */}
      {showSuccessToast && (
        <div className={styles.successToast}>
          <CheckCircle size={20} />
          <span>Payment successful! Your report has been unlocked.</span>
        </div>
      )}

      {/* Header */}
      <header className={styles.header}>
        <h1 className={styles.title}>My Profile</h1>
        <p className={styles.subtitle}>
          Welcome{user?.email ? `, ${user.email.split('@')[0]}` : ''}
        </p>
      </header>

      {/* Tabs */}
      <div className={styles.tabs}>
        {TABS.map(({ id, label, icon }) => (
          <button
            key={id}
            className={`${styles.tab} ${activeTab === id ? styles.active : ''}`}
            onClick={() => setActiveTab(id)}
          >
            <span className={styles.tabIcon}>{icon}</span>
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {activeTab === 'report' && (
          <ReportTabContent analyses={analyses} isLoading={isLoadingAnalyses} />
        )}
        {activeTab === 'progress' && (
          <ProgressTabContent analyses={analyses} />
        )}
        {activeTab === 'insights' && (
          <InsightsTabContent analyses={analyses} />
        )}
      </div>
    </div>
  );
}

function ReportTabContent({
  analyses,
  isLoading
}: {
  analyses: UserAnalysis[];
  isLoading: boolean;
}) {
  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className={styles.loadingInline}>
        <div className={styles.spinnerSmall} />
        <span>Loading analyses...</span>
      </div>
    );
  }

  if (analyses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#128202;</div>
        <h3>No Analysis Reports Yet</h3>
        <p>Run your first analysis to see your AI coding insights here.</p>
        <div className={styles.cliBox}>
          <code>npx nomoreaislop</code>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.reportList}>
      <h3 className={styles.sectionTitle}>Your Analysis Reports</h3>
      {analyses.map((analysis) => (
        <Link
          key={analysis.id}
          href={`/dashboard/personal/r/${analysis.resultId}`}
          className={styles.analysisCard}
        >
          <div className={styles.cardIcon}>
            <FileText size={24} />
          </div>
          <div className={styles.cardContent}>
            <span className={styles.cardType}>
              {analysis.evaluation?.primaryType || 'Analysis'}
            </span>
            <span className={styles.cardMeta}>
              {formatDate(analysis.claimedAt)} &middot;{' '}
              {analysis.evaluation?.sessionsAnalyzed || 0} sessions
            </span>
          </div>
          <span className={`${styles.badge} ${analysis.isPaid ? styles.paidBadge : styles.freeBadge}`}>
            {analysis.isPaid ? 'Full' : 'Preview'}
          </span>
          <ArrowRight size={20} className={styles.cardArrow} />
        </Link>
      ))}
    </div>
  );
}

function ProgressTabContent({ analyses }: { analyses: UserAnalysis[] }) {
  if (analyses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#128200;</div>
        <h3>No Progress Data Yet</h3>
        <p>Complete your first analysis to start tracking your growth journey.</p>
        <div className={styles.cliBox}>
          <code>npx nomoreaislop</code>
        </div>
      </div>
    );
  }

  // Show basic progress info
  const latestScore = analyses[0]?.evaluation?.overallScore;
  const analysisCount = analyses.length;
  const paidCount = analyses.filter(a => a.isPaid).length;

  return (
    <div className={styles.progressContent}>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{analysisCount}</span>
          <span className={styles.statLabel}>Total Analyses</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{paidCount}</span>
          <span className={styles.statLabel}>Unlocked Reports</span>
        </div>
        {latestScore !== undefined && (
          <div className={styles.statCard}>
            <span className={styles.statValue}>{Math.round(latestScore)}</span>
            <span className={styles.statLabel}>Latest Score</span>
          </div>
        )}
      </div>

      <div className={styles.progressHint}>
        <TrendingUp size={20} />
        <p>
          Run more analyses over time to see your progress chart and detailed trends.
          Each analysis captures a snapshot of your AI collaboration patterns.
        </p>
      </div>
    </div>
  );
}

function InsightsTabContent({ analyses }: { analyses: UserAnalysis[] }) {
  const paidAnalyses = analyses.filter(a => a.isPaid);

  if (paidAnalyses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#128161;</div>
        <h3>No Insights Yet</h3>
        <p>Unlock a report to see personalized growth areas and recommendations.</p>
        {analyses.length > 0 && (
          <Link href={`/dashboard/personal/r/${analyses[0].resultId}`} className={styles.unlockLink}>
            Unlock Your First Report
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className={styles.insightsContent}>
      <div className={styles.insightCard}>
        <Lightbulb size={24} className={styles.insightIcon} />
        <div>
          <h4>Your Growth Journey</h4>
          <p>
            You&apos;ve unlocked {paidAnalyses.length} report{paidAnalyses.length > 1 ? 's' : ''}.
            View each report for detailed insights and personalized recommendations.
          </p>
        </div>
      </div>

      <div className={styles.reportLinks}>
        <h4>View Detailed Insights</h4>
        {paidAnalyses.slice(0, 3).map((analysis) => (
          <Link
            key={analysis.id}
            href={`/dashboard/personal/r/${analysis.resultId}`}
            className={styles.insightLink}
          >
            {analysis.evaluation?.primaryType || 'Analysis'} Report
            <ArrowRight size={14} />
          </Link>
        ))}
      </div>
    </div>
  );
}
