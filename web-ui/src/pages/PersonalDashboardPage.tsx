/**
 * Personal Dashboard Page
 * Individual developer's growth journey with tabbed navigation
 */

import { useState } from 'react';
import { FileText, TrendingUp, Lightbulb } from 'lucide-react';
import { Header } from '../components/layout';
import { Tabs, LoadingState } from '../components/ui';
import type { Tab } from '../components/ui';
import { ReportTab, ProgressTab, InsightsTab } from '../components/personal';
import { usePersonalAnalytics } from '../hooks/usePersonalAnalytics';
import { useLatestAnalysis } from '../hooks/useLatestAnalysis';
import { MOCK_PERSONAL_DATA } from '../data/mockPersonalData';
import styles from './PersonalDashboardPage.module.css';

const TABS: Tab[] = [
  { id: 'report', label: 'Report', icon: <FileText size={16} /> },
  { id: 'progress', label: 'Progress', icon: <TrendingUp size={16} /> },
  { id: 'insights', label: 'Insights', icon: <Lightbulb size={16} /> },
];

export function PersonalDashboardPage() {
  const [activeTab, setActiveTab] = useState('report');
  const { data: analytics, isLoading: analyticsLoading } = usePersonalAnalytics();
  const { data: analysis, isLoading: analysisLoading, hasAnalysis } = useLatestAnalysis();

  const isLoading = analyticsLoading || analysisLoading;

  if (isLoading) {
    return <LoadingState message="Loading your profile..." />;
  }

  // Use mock data for MVP if no analytics
  const personalData = analytics || MOCK_PERSONAL_DATA;

  return (
    <div className={styles.page}>
      <Header
        title="My Profile"
        subtitle="Your AI coding analysis and growth journey"
      />

      <Tabs tabs={TABS} activeTab={activeTab} onTabChange={setActiveTab} />

      <div className={styles.tabContent}>
        {activeTab === 'report' && (
          <ReportTab analysis={analysis} hasAnalysis={hasAnalysis} />
        )}
        {activeTab === 'progress' && (
          <ProgressTab analytics={personalData} />
        )}
        {activeTab === 'insights' && (
          <InsightsTab analytics={personalData} analysis={analysis} />
        )}
      </div>
    </div>
  );
}
