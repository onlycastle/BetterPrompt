/**
 * PersonalContent - Client Component
 * Tabbed view: Report | Progress
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { usePersonalAnalytics } from '@/hooks/usePersonalAnalytics';
import { TestLoginForm } from '@/components/auth';
import { ProgressTab } from '@/components/personal';
import { FileText, TrendingUp, ArrowRight, Trash2, AlertTriangle } from 'lucide-react';
import styles from './page.module.css';

type TabId = 'report' | 'progress';

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

interface UserAnalysis {
  id: string;
  resultId: string;
  evaluation: {
    primaryType?: string;
    sessionsAnalyzed?: number;
    overallScore?: number;
  } | null;
  claimedAt: string;
}

const TABS: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
  { id: 'report', label: 'Report', icon: <FileText size={18} /> },
  { id: 'progress', label: 'Progress', icon: <TrendingUp size={18} /> },
];

export function PersonalContent() {
  const searchParams = useSearchParams();
  const initialTab = (searchParams.get('tab') as TabId) || 'report';
  const focusResultId = searchParams.get('focus');

  const { isAuthenticated, isLoading: authLoading, user } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>(initialTab);
  const [analyses, setAnalyses] = useState<UserAnalysis[]>([]);
  const [isLoadingAnalyses, setIsLoadingAnalyses] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<UserAnalysis | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  const handleDeleteClick = (analysis: UserAnalysis) => {
    setDeleteTarget(analysis);
    setDeleteError(null);
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
    setDeleteError(null);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const response = await fetch(`/api/analysis/results/${deleteTarget.resultId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete report');
      }

      // Remove from local state
      setAnalyses(prev => prev.filter(a => a.id !== deleteTarget.id));
      setDeleteTarget(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : 'Failed to delete report');
    } finally {
      setIsDeleting(false);
    }
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
          <TestLoginForm />
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
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
          <ReportTabContent
            analyses={analyses}
            isLoading={isLoadingAnalyses}
            onDelete={handleDeleteClick}
            focusResultId={focusResultId}
          />
        )}
        {activeTab === 'progress' && (
          <ProgressTabWrapper analyses={analyses} />
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          analysis={deleteTarget}
          isDeleting={isDeleting}
          error={deleteError}
          onCancel={handleDeleteCancel}
          onConfirm={handleDeleteConfirm}
        />
      )}
    </div>
  );
}

function ReportTabContent({
  analyses,
  isLoading,
  onDelete,
  focusResultId,
}: {
  analyses: UserAnalysis[];
  isLoading: boolean;
  onDelete: (analysis: UserAnalysis) => void;
  focusResultId: string | null;
}) {
  const focusApplied = useRef(false);

  // Scroll to focused card and highlight it
  useEffect(() => {
    if (!focusResultId || isLoading || analyses.length === 0 || focusApplied.current) return;
    focusApplied.current = true;

    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-result-id="${CSS.escape(focusResultId)}"]`);
      if (!el) return;
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add(styles.highlighted);
      setTimeout(() => el.classList.remove(styles.highlighted), 2000);
      window.history.replaceState({}, '', '/dashboard/personal?tab=report');
    });
  }, [focusResultId, isLoading, analyses]);

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
        <p>Run your first analysis to see your AI insights here.</p>
        <div className={styles.cliBox}>
          <code>npx no-ai-slop</code>
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
          href={`/dashboard/r/${analysis.resultId}`}
          className={styles.analysisCard}
          data-result-id={analysis.resultId}
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
          <button
            className={styles.deleteBtn}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDelete(analysis);
            }}
            aria-label="Delete report"
          >
            <Trash2 size={16} />
          </button>
          <ArrowRight size={20} className={styles.cardArrow} />
        </Link>
      ))}
    </div>
  );
}

function ProgressTabWrapper({ analyses }: { analyses: UserAnalysis[] }) {
  const { data: analytics, isLoading, error } = usePersonalAnalytics();

  const isPremium = analyses.length > 0;

  // Show loading state
  if (isLoading) {
    return (
      <div className={styles.loadingInline}>
        <div className={styles.spinnerSmall} />
        <span>Loading progress data...</span>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#9888;</div>
        <h3>Failed to Load Progress</h3>
        <p>There was an error loading your progress data. Please try again.</p>
      </div>
    );
  }

  // Show empty state if no analyses yet
  if (analyses.length === 0) {
    return (
      <div className={styles.emptyState}>
        <div className={styles.emptyIcon}>&#128200;</div>
        <h3>No Progress Data Yet</h3>
        <p>Complete your first analysis to start tracking your growth journey.</p>
        <div className={styles.cliBox}>
          <code>npx no-ai-slop</code>
        </div>
      </div>
    );
  }

  // Show progress tab with real analytics data
  // analytics can be undefined before query completes, treat as null
  return <ProgressTab analytics={analytics ?? null} isPremium={isPremium} />;
}

function DeleteConfirmModal({
  analysis,
  isDeleting,
  error,
  onCancel,
  onConfirm,
}: {
  analysis: UserAnalysis;
  isDeleting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (isDeleting) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDeleting, onCancel]);

  return (
    <div className={styles.modal} onClick={isDeleting ? undefined : onCancel}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalIcon}>
          <AlertTriangle size={32} />
        </div>
        <h3 className={styles.modalTitle}>Delete Report?</h3>
        <p className={styles.modalDescription}>
          This action cannot be undone. The report
          {analysis.evaluation?.primaryType && (
            <strong> &quot;{analysis.evaluation.primaryType}&quot;</strong>
          )} and all associated data will be permanently deleted.
        </p>
        {error && (
          <div className={styles.modalError}>
            {error}
          </div>
        )}
        <div className={styles.modalActions}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            className={styles.confirmDeleteBtn}
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
