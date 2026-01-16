/**
 * Personal Dashboard Page
 * Individual developer's growth journey with tabbed navigation
 * Shows blurred content for non-authenticated users
 */

import { useState } from 'react';
import { FileText, TrendingUp, Lightbulb } from 'lucide-react';
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
  const { isAuthenticated } = useAuth();

  const { data: analytics, isLoading: analyticsLoading } = usePersonalAnalytics();
  const { data: analysis, isLoading: analysisLoading, hasAnalysis } = useLatestAnalysis();

  const isLoading = analyticsLoading || analysisLoading;

  if (isLoading) {
    return <LoadingState message="Loading your profile..." />;
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
          ? "Your AI coding analysis and growth journey"
          : "Sign in to unlock your personalized insights"}
        actions={!isAuthenticated ? (
          <button className={styles.signInHint} onClick={() => setShowLogin(true)}>
            Sign in
          </button>
        ) : undefined}
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
