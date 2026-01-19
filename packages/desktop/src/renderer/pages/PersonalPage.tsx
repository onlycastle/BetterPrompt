/**
 * Personal Page
 * Individual developer's growth journey with tabbed navigation
 */

import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { usePersonalAnalytics } from '../hooks';
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

function ReportTabContent({ onViewReport }: { onViewReport?: (resultId: string) => void }) {
  return (
    <div className={styles.tabContent}>
      <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>📊</span>
        <h3>Your Analysis Reports</h3>
        <p>
          View your past AI coding analyses and track your progress over time.
        </p>
        <button
          className={styles.ctaButton}
          onClick={() => onViewReport?.('latest')}
        >
          View Latest Analysis
        </button>
      </div>
    </div>
  );
}

function ProgressTabContent({ analytics }: { analytics?: ReturnType<typeof usePersonalAnalytics>['data'] }) {
  const history = analytics?.history || [];
  const goals = analytics?.goals || [];

  return (
    <div className={styles.tabContent}>
      {/* Progress Chart */}
      <div className={styles.chartSection}>
        <h3>Score History</h3>
        {history.length > 0 ? (
          <div className={styles.chartContainer}>
            {history.map((entry, i) => (
              <div key={i} className={styles.chartBar}>
                <div
                  className={styles.chartFill}
                  style={{ height: `${entry.score}%` }}
                />
                <span className={styles.chartLabel}>{entry.date.split('-').slice(1).join('/')}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noData}>No history data available yet</p>
        )}
      </div>

      {/* Goals */}
      <div className={styles.goalsSection}>
        <h3>Goals</h3>
        {goals.length > 0 ? (
          <div className={styles.goalsList}>
            {goals.map((goal) => (
              <div key={goal.id} className={styles.goalCard}>
                <div className={styles.goalHeader}>
                  <span>{goal.title}</span>
                  <span className={styles.goalProgress}>{goal.progress}%</span>
                </div>
                <div className={styles.goalBar}>
                  <div
                    className={styles.goalFill}
                    style={{ width: `${goal.progress}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className={styles.noData}>No goals set yet</p>
        )}
      </div>
    </div>
  );
}

function InsightsTabContent({ analytics }: { analytics?: ReturnType<typeof usePersonalAnalytics>['data'] }) {
  const insights = analytics?.insights || [];

  return (
    <div className={styles.tabContent}>
      <h3>Personalized Insights</h3>
      {insights.length > 0 ? (
        <div className={styles.insightsList}>
          {insights.map((insight, i) => (
            <div
              key={i}
              className={styles.insightCard}
              data-type={insight.type}
            >
              <div className={styles.insightIcon}>
                {insight.type === 'strength' && '💪'}
                {insight.type === 'growth' && '🌱'}
                {insight.type === 'trend' && '📈'}
              </div>
              <div className={styles.insightContent}>
                <h4>{insight.title}</h4>
                <p>{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className={styles.noData}>Complete more analyses to get personalized insights</p>
      )}
    </div>
  );
}
