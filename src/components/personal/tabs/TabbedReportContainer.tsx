/**
 * TabbedReportContainer Component
 *
 * Organizes the report into 2 tabs for cleaner UX:
 * - Fixed header: TypeResultMinimal + PersonalitySummary (always visible)
 * - Tabs: Communication Patterns | Your Insights
 * - Smart "Next Tab" navigation at bottom
 *
 * REFACTORED: Simplified from 4 tabs to 2 tabs.
 * - "Your Insights" tab shows Worker-specific strengths/growthAreas directly
 * - Removes legacy GrowthInsightsSection, DimensionInsightsClean, AgentInsightsSection
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { TypeResultMinimal } from './TypeResultMinimal';
import { PersonalitySummaryClean } from './PersonalitySummaryClean';
import { PromptPatternsClean } from './PromptPatternsClean';
import { WorkerInsightsSection } from './WorkerInsightsSection';
import { NextTabButton } from './NextTabButton';
import { ResourceSidebar } from './ResourceSidebar';
import { DataQualityBadge } from './DataQualityBadge';
import type { VerboseAnalysisData, AnalysisMetadata, DimensionResourceMatch } from '../../../types/verbose';
import type { AgentOutputs, ParsedResource } from '../../../lib/models/agent-outputs';
import { aggregateWorkerInsights } from '../../../lib/models/agent-outputs';
import styles from './TabbedReportContainer.module.css';

/**
 * Convert DimensionResourceMatch[] to ParsedResource[] for ResourceSidebar.
 *
 * DimensionResourceMatch is grouped by dimension, while ParsedResource is a flat array.
 * We extract knowledge items from each dimension and convert to ParsedResource format.
 */
function convertKnowledgeResourcesToFlat(resources: DimensionResourceMatch[]): ParsedResource[] {
  const result: ParsedResource[] = [];

  for (const dimMatch of resources) {
    for (const item of dimMatch.knowledgeItems) {
      result.push({
        topic: item.title,
        type: item.contentType as ParsedResource['type'],
        url: item.sourceUrl,
      });
    }
  }

  return result;
}

export type ReportTabId = 'patterns' | 'insights';

interface TabConfig {
  id: ReportTabId;
  label: string;
}

/**
 * 2-tab structure (simplified from 4 tabs):
 * - Communication Patterns: promptPatterns from ContentWriter
 * - Your Insights: Domain-specific strengths/growthAreas from Phase 2 workers
 */
const REPORT_TABS: TabConfig[] = [
  { id: 'patterns', label: 'Communication Patterns' },
  { id: 'insights', label: 'Your Insights' },
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

  // Get matched resources from Knowledge Base (Phase 2.75 deterministic matching)
  // These are validated URLs from our curated database, NOT LLM-generated URLs
  const allResources = useMemo(() => {
    if (!analysis.knowledgeResources || analysis.knowledgeResources.length === 0) {
      return [];
    }
    return convertKnowledgeResourcesToFlat(analysis.knowledgeResources);
  }, [analysis.knowledgeResources]);

  // Aggregate worker insights from Phase 2 workers
  // This replaces the centralized StrengthGrowthSynthesizer approach
  const workerInsights = useMemo(() => {
    // First check if workerInsights is already on the analysis (from DB)
    if (analysis.workerInsights) {
      return analysis.workerInsights;
    }
    // Otherwise aggregate from agentOutputs
    if (agentOutputs) {
      return aggregateWorkerInsights(agentOutputs);
    }
    return undefined;
  }, [analysis, agentOutputs]);

  // Extract translatedAgentInsights for non-English translations
  // Phase 4 Translator produces this when output language != English
  const translatedAgentInsights = analysis.translatedAgentInsights;

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
  const hasInsights = workerInsights && Object.values(workerInsights).some(
    (domain: any) => domain && (domain.strengths?.length > 0 || domain.growthAreas?.length > 0)
  );

  // Filter tabs to only show those with content
  const availableTabs = REPORT_TABS.filter(tab => {
    if (tab.id === 'patterns') {
      return hasPatterns;
    }
    if (tab.id === 'insights') {
      return hasInsights;
    }
    return false;
  });

  // Set default tab to first available
  const defaultTab = availableTabs[0]?.id || 'patterns';

  // Sync activeTab with available tabs when current tab becomes unavailable
  // Using useEffect to avoid state updates during render (React anti-pattern)
  useEffect(() => {
    if (!availableTabs.find(t => t.id === activeTab)) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, availableTabs, defaultTab]);

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
          {/* Communication Patterns Tab */}
          {activeTab === 'patterns' && hasPatterns && (
            <div className={styles.tabPanel}>
              <h3 className={styles.sectionTitle}>Communication Patterns</h3>
              <PromptPatternsClean patterns={analysis.promptPatterns} isPaid={isPaid} />
            </div>
          )}

          {/* Your Insights Tab - Worker-specific strengths/growthAreas */}
          {activeTab === 'insights' && hasInsights && (
            <div className={styles.tabPanel}>
              <WorkerInsightsSection
                workerInsights={workerInsights}
                translatedAgentInsights={translatedAgentInsights}
                isPaid={isPaid}
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

      {/* Resource Sidebar - Right column */}
      {allResources.length > 0 && (
        <aside className={styles.sidebar}>
          <ResourceSidebar resources={allResources} isPaid={isPaid} />
        </aside>
      )}
    </div>
  );
}

export default TabbedReportContainer;
