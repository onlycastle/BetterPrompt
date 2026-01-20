/**
 * Personal Page
 * Individual developer's growth journey with tabbed navigation
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePersonalAnalytics } from '../hooks';
import { getStoredAnalyses } from '../utils/analysisStorage';
import {
  JourneyHeader,
  ScoreComparisonCard,
  TrendLineChart,
  DimensionBreakdown,
  GrowthAreasSection,
} from '../components/personal';
import type { PersonalAnalyticsExtended } from '../api/types';
import styles from './PersonalPage.module.css';

interface PersonalPageProps {
  onViewReport?: (resultId: string) => void;
}

type TabId = 'report' | 'progress' | 'insights';

const TABS: Array<{ id: TabId; label: string; icon: string }> = [
  { id: 'report', label: 'Report', icon: '📄' },
  { id: 'progress', label: 'Progress', icon: '📈' },
  { id: 'insights', label: 'Insights', icon: '💡' },
];

export default function PersonalPage({ onViewReport }: PersonalPageProps) {
  const [activeTab, setActiveTab] = useState<TabId>('report');
  const { user } = useAuth();
  const { data: analytics, isLoading } = usePersonalAnalytics(user?.id);

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>My Profile</h1>
          <p className={styles.subtitle}>Your AI coding analysis and growth journey</p>
        </div>
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
          <ReportTabContent onViewReport={onViewReport} />
        )}
        {activeTab === 'progress' && (
          <ProgressTabContent analytics={analytics} />
        )}
        {activeTab === 'insights' && (
          <InsightsTabContent analytics={analytics} />
        )}
      </div>
    </div>
  );
}

function formatDate(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function ReportTabContent({ onViewReport }: { onViewReport?: (resultId: string) => void }) {
  const analyses = getStoredAnalyses();

  if (analyses.length === 0) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📊</span>
          <h3>No Analysis Reports Yet</h3>
          <p>
            Run your first analysis to see your AI coding insights here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      <h3>Your Analysis Reports</h3>
      <div className={styles.reportList}>
        {analyses.map((analysis) => (
          <button
            key={analysis.resultId}
            className={styles.reportCard}
            onClick={() => onViewReport?.(analysis.resultId)}
          >
            <div className={styles.reportInfo}>
              <span className={styles.reportDate}>{formatDate(analysis.completedAt)}</span>
              <span className={styles.reportMeta}>
                {analysis.sessionCount} sessions • {analysis.projectCount} projects
              </span>
            </div>
            <span className={styles.reportArrow}>→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function ProgressTabContent({ analytics }: { analytics?: PersonalAnalyticsExtended | null }) {
  // Empty state when no analyses
  if (!analytics) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>📈</span>
          <h3>No Progress Data Yet</h3>
          <p>
            Complete your first analysis to start tracking your growth journey.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      {/* Journey Header */}
      <JourneyHeader analytics={analytics} />

      {/* Score Comparison (only show if 2+ analyses) */}
      {analytics.analysisCount >= 2 && (
        <div className={styles.statsRow}>
          <ScoreComparisonCard analytics={analytics} />
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Progress Over Time</h3>
            <TrendLineChart data={analytics.history} height={220} />
          </div>
        </div>
      )}

      {/* Single analysis: just show the chart */}
      {analytics.analysisCount === 1 && (
        <div className={styles.singleAnalysis}>
          <div className={styles.chartCard}>
            <h3 className={styles.chartTitle}>Your First Analysis</h3>
            <p className={styles.chartSubtitle}>
              Complete more analyses to see your progress over time
            </p>
            <TrendLineChart data={analytics.history} height={180} />
          </div>
        </div>
      )}

      {/* Dimension Breakdown */}
      {analytics.currentDimensions && (
        <DimensionBreakdown analytics={analytics} />
      )}
    </div>
  );
}

function getInsightIcon(type: string): string {
  switch (type) {
    case 'strength':
      return '💪';
    case 'growth':
      return '🌱';
    case 'trend':
      return '📈';
    default:
      return '💡';
  }
}

function InsightsTabContent({ analytics }: { analytics?: PersonalAnalyticsExtended | null }) {
  const growthAreas = analytics?.growthAreas || [];
  const insights = analytics?.insights || [];

  // Empty state when no insights or growth areas
  if (growthAreas.length === 0 && insights.length === 0) {
    return (
      <div className={styles.tabContent}>
        <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>💡</span>
          <h3>No Insights Yet</h3>
          <p>
            Unlock a report to see personalized growth areas and recommendations.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.tabContent}>
      {/* Growth Areas from analysis */}
      {growthAreas.length > 0 && (
        <GrowthAreasSection areas={growthAreas} />
      )}

      {/* Generated insights (fallback/additional) */}
      {insights.length > 0 && (
        <div className={styles.insightsSection}>
          <h3 className={styles.sectionTitle}>Your Insights</h3>
          <div className={styles.insightsList}>
            {insights.map((insight, i) => (
              <div
                key={i}
                className={styles.insightCard}
                data-type={insight.type}
              >
                <div className={styles.insightIcon}>
                  {getInsightIcon(insight.type)}
                </div>
                <div className={styles.insightContent}>
                  <h4>{insight.title}</h4>
                  <p>{insight.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
