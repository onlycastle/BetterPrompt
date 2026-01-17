/**
 * Personal Dashboard Page
 * Individual developer's growth journey with tabbed navigation
 * Shows blurred content for non-authenticated users
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { FileText, TrendingUp, Lightbulb, LogOut } from 'lucide-react';
import { Header } from '@/components/layout';
import { Tabs, LoadingState } from '@/components/ui';
import type { Tab } from '@/components/ui';
import { AuthGatedContent, LoginModal } from '@/components/auth';
import { useAuth } from '@/contexts';
import { ReportTab, ProgressTab, InsightsTab } from '@/components/personal';
import { usePersonalAnalytics } from '@/hooks/usePersonalAnalytics';
import { useLatestAnalysis } from '@/hooks/useLatestAnalysis';
import { MOCK_PERSONAL_DATA } from '@/data/mockPersonalData';
import styles from './PersonalDashboardPage.module.css';

const TABS: Tab[] = [
  { id: 'report', label: 'Report', icon: <FileText size={16} /> },
  { id: 'progress', label: 'Progress', icon: <TrendingUp size={16} /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb size={16} /> },
];

export function PersonalDashboardPage() {
  const [activeTab, setActiveTab] = useState('report');
  const [showLogin, setShowLogin] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);
  const { isAuthenticated, signOut, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  const { data: analytics, isLoading: analyticsLoading } = usePersonalAnalytics();
  const { data: analysis, isLoading: analysisLoading, hasAnalysis, refetch } = useLatestAnalysis();

  const pendingResultId = searchParams.get('pendingResultId');

  // Claim pending result after OAuth redirect
  const claimPendingResult = useCallback(async (resultId: string) => {
    setIsClaiming(true);
    try {
      await fetch('/api/analysis/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId }),
      });
      // Remove pendingResultId from URL and refetch analysis
      router.replace('/personal');
      refetch();
    } catch (err) {
      console.warn('Failed to claim result:', err);
    } finally {
      setIsClaiming(false);
    }
  }, [router, refetch]);

  useEffect(() => {
    if (pendingResultId && isAuthenticated && !isClaiming) {
      claimPendingResult(pendingResultId);
    }
  }, [pendingResultId, isAuthenticated, isClaiming, claimPendingResult]);

  const isLoading = analyticsLoading || analysisLoading || isClaiming;

  if (isLoading) {
    return <LoadingState message={isClaiming ? "Claiming your analysis..." : "Loading your profile..."} />;
  }

  // Use mock data for MVP if no analytics
  const personalData = analytics || MOCK_PERSONAL_DATA;

  // Content components
  const reportContent = <ReportTab analysis={analysis} hasAnalysis={hasAnalysis} />;
  const progressContent = <ProgressTab analytics={personalData} />;
  const insightsContent = <InsightsTab analytics={personalData} analysis={analysis} />;

  return (
    <div className={styles.page}>
      <Header
        title="My Profile"
        subtitle={isAuthenticated
          ? `Your AI coding analysis and growth journey`
          : "Sign in to unlock your personalized insights"}
        actions={
          isAuthenticated ? (
            <button className={styles.signOutButton} onClick={signOut} title={user?.email}>
              <LogOut size={16} />
              Sign out
            </button>
          ) : (
            <button className={styles.signInHint} onClick={() => setShowLogin(true)}>
              Sign in
            </button>
          )
        }
      />

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className={styles.tabContent}>
        {activeTab === 'report' && (
          isAuthenticated ? reportContent : (
            <AuthGatedContent blurIntensity="medium" message="Sign in to see your full analysis report">
              {reportContent}
            </AuthGatedContent>
          )
        )}
        {activeTab === 'progress' && (
          isAuthenticated ? progressContent : (
            <AuthGatedContent blurIntensity="heavy" message="Sign in to track your progress over time">
              {progressContent}
            </AuthGatedContent>
          )
        )}
        {activeTab === 'insights' && (
          isAuthenticated ? insightsContent : (
            <AuthGatedContent blurIntensity="heavy" message="Sign in to get personalized insights">
              {insightsContent}
            </AuthGatedContent>
          )
        )}
      </div>

      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </div>
  );
}
