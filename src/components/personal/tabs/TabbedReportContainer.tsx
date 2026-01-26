/**
 * TabbedReportContainer Component
 *
 * Organizes the report into tabs to reduce scroll length:
 * - Fixed header: TypeResultMinimal + PersonalitySummary (always visible)
 * - Tabs: Patterns | Dimensions | AI Agents
 * - Smart "Next Tab" navigation at bottom
 */

import { useState, useRef, useCallback, useMemo } from 'react';
import { TypeResultMinimal } from './TypeResultMinimal';
import { PersonalitySummaryClean } from './PersonalitySummaryClean';
import { PromptPatternsClean } from './PromptPatternsClean';
import { DimensionInsightsClean } from './DimensionInsightsClean';
import { GrowthInsightsSection } from './GrowthInsightsSection';
import { AgentInsightsSection } from './AgentInsightsSection';
import { NextTabButton } from './NextTabButton';
import { ResourceSidebar } from './ResourceSidebar';
import { DataQualityBadge } from './DataQualityBadge';
import type { VerboseAnalysisData, AnalysisMetadata } from '../../../types/verbose';
import type { AgentOutputs } from '../../../lib/models/agent-outputs';
import {
  parseRecommendedResourcesData,
  getAllAgentGrowthAreas,
  type ParsedResource,
} from '../../../lib/models/agent-outputs';
import styles from './TabbedReportContainer.module.css';

export type ReportTabId = 'patterns' | 'growth' | 'dimensions' | 'agents';

interface TabConfig {
  id: ReportTabId;
  label: string;
}

const REPORT_TABS: TabConfig[] = [
  { id: 'patterns', label: 'Prompt Patterns' },
  { id: 'growth', label: 'Growth Insights' },
  { id: 'dimensions', label: 'Dimension Insights' },
  { id: 'agents', label: 'AI Agent Insights' },
];

interface TabbedReportContainerProps {
  analysis: VerboseAnalysisData;
  agentOutputs?: AgentOutputs;
  isPaid?: boolean;
  /** Analysis metadata for confidence display */
  analysisMetadata?: AnalysisMetadata;
}

export function TabbedReportContainer({
  analysis,
  agentOutputs,
  isPaid = false,
  analysisMetadata,
}: TabbedReportContainerProps) {
  const [activeTab, setActiveTab] = useState<ReportTabId>('patterns');
  const contentRef = useRef<HTMLDivElement>(null);

  // Parse all resources for sidebar display (flat array)
  const allResources = useMemo(() => {
    if (!agentOutputs?.knowledgeGap?.recommendedResourcesData) return [];
    return parseRecommendedResourcesData(agentOutputs.knowledgeGap.recommendedResourcesData);
  }, [agentOutputs]);

  // Parse knowledge resources into a map by topic for inline display (used by DimensionInsightsClean)
  const resourcesMap = useMemo(() => {
    const map = new Map<string, ParsedResource[]>();
    allResources.forEach((resource) => {
      const key = resource.topic.toLowerCase();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(resource);
    });
    return map;
  }, [allResources]);

  // Handle tab change with scroll-to-top
  const handleTabChange = useCallback((tabId: ReportTabId) => {
    setActiveTab(tabId);
    // Scroll content to top when changing tabs
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
  }, []);

  // Check if we have content for each tab
  const hasPatterns = analysis.promptPatterns && analysis.promptPatterns.length > 0;
  const hasGrowth = agentOutputs && getAllAgentGrowthAreas(agentOutputs).length > 0;
  const hasDimensions = analysis.dimensionInsights && analysis.dimensionInsights.length > 0;
  const hasAgents = agentOutputs && Object.values(agentOutputs).some(Boolean);

  // Filter tabs to only show those with content
  const availableTabs = REPORT_TABS.filter(tab => {
    switch (tab.id) {
      case 'patterns': return hasPatterns;
      case 'growth': return hasGrowth;
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

  // Calculate next available tab
  const currentAvailableIndex = availableTabs.findIndex(t => t.id === activeTab);
  const nextAvailableTab = currentAvailableIndex < availableTabs.length - 1
    ? availableTabs[currentAvailableIndex + 1]
    : null;

  // Handle next tab button click
  const handleNextTab = useCallback(() => {
    if (nextAvailableTab) {
      handleTabChange(nextAvailableTab.id);
    }
  }, [nextAvailableTab, handleTabChange]);

  return (
    <div className={styles.pageLayout}>
      {/* Main Content Column */}
      <div className={styles.mainContent}>
        {/* Fixed Header Section - Always Visible */}
        <div className={styles.headerSection}>
          {/* Analysis Quality Badge - Transparency for trust */}
          {analysisMetadata && (
            <DataQualityBadge metadata={analysisMetadata} />
          )}

          {/* Type Result */}
          <TypeResultMinimal
            primaryType={analysis.primaryType}
            distribution={analysis.distribution}
            sessionsAnalyzed={analysis.sessionsAnalyzed}
            controlLevel={analysis.controlLevel}
            controlScore={analysis.controlScore}
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
                {tab.label}
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

          {/* Growth Tab */}
          {activeTab === 'growth' && hasGrowth && agentOutputs && (
            <div className={styles.tabPanel}>
              <GrowthInsightsSection
                agentOutputs={agentOutputs}
                isPaid={isPaid}
                resourcesMap={resourcesMap}
                translatedAgentInsights={analysis.translatedAgentInsights}
              />
            </div>
          )}

          {/* Dimensions Tab */}
          {activeTab === 'dimensions' && hasDimensions && (
            <div className={styles.tabPanel}>
              <DimensionInsightsClean
                insights={analysis.dimensionInsights}
                sessionsAnalyzed={analysis.sessionsAnalyzed}
                isPaid={isPaid}
                resourcesMap={resourcesMap}
              />
            </div>
          )}

          {/* Agents Tab */}
          {activeTab === 'agents' && hasAgents && agentOutputs && (
            <div className={styles.tabPanel}>
              <AgentInsightsSection
                agentOutputs={agentOutputs}
                isPaid={isPaid}
                translatedAgentInsights={analysis.translatedAgentInsights}
              />
            </div>
          )}

          {/* Smart Navigation - Next Tab Button */}
          {nextAvailableTab && (
            <NextTabButton
              contentRef={contentRef}
              nextTabLabel={nextAvailableTab.label}
              onNextTab={handleNextTab}
            />
          )}
        </div>
      </div>

      {/* Resource Sidebar - Right column
          Only show when NOT on Growth or Dimensions tabs
          (those tabs show inline resources via ResourceBubble) */}
      {allResources.length > 0 && activeTab !== 'growth' && activeTab !== 'dimensions' && (
        <aside className={styles.sidebar}>
          <ResourceSidebar resources={allResources} isPaid={isPaid} />
        </aside>
      )}
    </div>
  );
}

export default TabbedReportContainer;
