/**
 * TabbedReportContainer Component
 *
 * Organizes the report into tabs to reduce scroll length:
 * - Fixed header: TypeResultMinimal + PersonalitySummary (always visible)
 * - Tabs: Patterns | Dimensions | AI Agents
 * - Smart "Next Tab" navigation at bottom
 */

import { useState, useRef, useCallback } from 'react';
import { TypeResultMinimal } from './TypeResultMinimal';
import { PersonalitySummaryClean } from './PersonalitySummaryClean';
import { PromptPatternsClean } from './PromptPatternsClean';
import { DimensionInsightsClean } from './DimensionInsightsClean';
import { AgentInsightsSection } from './AgentInsightsSection';
import { NextTabButton } from './NextTabButton';
import type { VerboseAnalysisData } from '../../../types/verbose';
import type { AgentOutputs } from '../../../lib/models/agent-outputs';
import styles from './TabbedReportContainer.module.css';

export type ReportTabId = 'patterns' | 'dimensions' | 'agents';

interface TabConfig {
  id: ReportTabId;
  label: string;
  icon: string;
}

const REPORT_TABS: TabConfig[] = [
  { id: 'patterns', label: 'Prompt Patterns', icon: '💬' },
  { id: 'dimensions', label: 'Dimension Insights', icon: '📊' },
  { id: 'agents', label: 'AI Agent Insights', icon: '>_' },
];

interface TabbedReportContainerProps {
  analysis: VerboseAnalysisData;
  agentOutputs?: AgentOutputs;
  isPaid?: boolean;
}

export function TabbedReportContainer({
  analysis,
  agentOutputs,
  isPaid = false,
}: TabbedReportContainerProps) {
  const [activeTab, setActiveTab] = useState<ReportTabId>('patterns');
  const contentRef = useRef<HTMLDivElement>(null);

  // Get index of current tab
  const currentTabIndex = REPORT_TABS.findIndex(t => t.id === activeTab);
  const hasNextTab = currentTabIndex < REPORT_TABS.length - 1;
  const nextTab = hasNextTab ? REPORT_TABS[currentTabIndex + 1] : null;

  // Handle tab change with scroll-to-top
  const handleTabChange = useCallback((tabId: ReportTabId) => {
    setActiveTab(tabId);
    // Scroll content to top when changing tabs
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, []);

  // Handle next tab button click
  const handleNextTab = useCallback(() => {
    if (nextTab) {
      handleTabChange(nextTab.id);
    }
  }, [nextTab, handleTabChange]);

  // Check if we have content for each tab
  const hasPatterns = analysis.promptPatterns && analysis.promptPatterns.length > 0;
  const hasDimensions = analysis.dimensionInsights && analysis.dimensionInsights.length > 0;
  const hasAgents = agentOutputs && Object.values(agentOutputs).some(Boolean);

  // Filter tabs to only show those with content
  const availableTabs = REPORT_TABS.filter(tab => {
    switch (tab.id) {
      case 'patterns': return hasPatterns;
      case 'dimensions': return hasDimensions;
      case 'agents': return hasAgents;
      default: return false;
    }
  });

  // Set default tab to first available
  const defaultTab = availableTabs[0]?.id || 'patterns';
  if (activeTab !== defaultTab && !availableTabs.find(t => t.id === activeTab)) {
    setActiveTab(defaultTab);
  }

  // Update next tab calculation with available tabs
  const currentAvailableIndex = availableTabs.findIndex(t => t.id === activeTab);
  const hasNextAvailableTab = currentAvailableIndex < availableTabs.length - 1;
  const nextAvailableTab = hasNextAvailableTab ? availableTabs[currentAvailableIndex + 1] : null;

  return (
    <div className={styles.container}>
      {/* Fixed Header Section - Always Visible */}
      <div className={styles.headerSection}>
        {/* Type Result */}
        <TypeResultMinimal
          primaryType={analysis.primaryType}
          distribution={analysis.distribution}
          sessionsAnalyzed={analysis.sessionsAnalyzed}
          controlLevel={analysis.controlLevel}
        />

        {/* Personality Summary */}
        {analysis.personalitySummary && (
          <section className={styles.personalitySection}>
            <h3 className={styles.sectionTitle}>Your AI Coding Personality</h3>
            <PersonalitySummaryClean summary={analysis.personalitySummary} />
          </section>
        )}
      </div>

      {/* Tab Navigation */}
      {availableTabs.length > 1 && (
        <div className={styles.tabNav}>
          {availableTabs.map((tab) => (
            <button
              key={tab.id}
              className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
              onClick={() => handleTabChange(tab.id)}
              type="button"
            >
              <span className={styles.tabIcon}>{tab.icon}</span>
              <span className={styles.tabLabel}>{tab.label}</span>
            </button>
          ))}
        </div>
      )}

      {/* Tab Content - Scrollable */}
      <div ref={contentRef} className={styles.tabContent}>
        {/* Patterns Tab */}
        {activeTab === 'patterns' && hasPatterns && (
          <div className={styles.tabPanel}>
            <h3 className={styles.sectionTitle}>Communication Patterns</h3>
            <PromptPatternsClean patterns={analysis.promptPatterns} isPaid={isPaid} />
          </div>
        )}

        {/* Dimensions Tab */}
        {activeTab === 'dimensions' && hasDimensions && (
          <div className={styles.tabPanel}>
            <DimensionInsightsClean
              insights={analysis.dimensionInsights}
              sessionsAnalyzed={analysis.sessionsAnalyzed}
              isPaid={isPaid}
            />
          </div>
        )}

        {/* Agents Tab */}
        {activeTab === 'agents' && hasAgents && agentOutputs && (
          <div className={styles.tabPanel}>
            <AgentInsightsSection
              agentOutputs={agentOutputs}
              isPaid={isPaid}
            />
          </div>
        )}

        {/* Smart Navigation - Next Tab Button */}
        {nextAvailableTab && (
          <NextTabButton
            contentRef={contentRef}
            nextTabLabel={nextAvailableTab.label}
            nextTabIcon={nextAvailableTab.icon}
            onNextTab={handleNextTab}
          />
        )}
      </div>
    </div>
  );
}

export default TabbedReportContainer;
