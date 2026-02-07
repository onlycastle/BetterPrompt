/**
 * TabbedReportContainer Component
 *
 * Organizes the report into 4 tabs based on Phase 2 Workers:
 * - Fixed header: TypeResultMinimal + PersonalitySummary (always visible)
 * - Tabs: Thinking Quality | Communication | Learning Behavior | Context Efficiency
 * - Smart "Next Tab" navigation at bottom
 *
 * Each tab displays the corresponding Worker's strengths/growthAreas.
 * Communication tab displays patterns from CommunicationPatternsWorker.
 */

import { useState, useRef, useCallback, useMemo, useEffect, useLayoutEffect } from 'react';
import { TypeResultMinimal } from '../type-result/TypeResultMinimal';
import { PersonalitySummaryClean } from '../type-result/PersonalitySummaryClean';
import { WorkerDomainSection } from '../insights/WorkerInsightsSection';
import { ActivitySection } from '../activity/ActivitySection';
import { NextTabButton } from '../shared/NextTabButton';
import { PremiumValueSummary } from '../shared/PremiumValueSummary';
import { ReportAnchorNav } from '../shared/ReportAnchorNav';
import { ResourceSidebar } from '../resources/ResourceSidebar';
import { DataQualityBadge } from '../shared/DataQualityBadge';
import { InsightPreviewCard } from '../insights/InsightPreviewCard';
import { TopFocusAreasSection } from '../focus/TopFocusAreasSection';

import type { VerboseAnalysisData, AnalysisMetadata, DimensionResourceMatch } from '../../../../types/verbose';
import type { AgentOutputs, ParsedResource } from '../../../../lib/models/agent-outputs';
import { aggregateWorkerInsights } from '../../../../lib/models/agent-outputs';
import {
  WORKER_DOMAIN_CONFIGS,
  WORKER_TO_DIMENSIONS,
  matchedInsightToReferenced,
  type AggregatedWorkerInsights,
  type WorkerInsightsContainer,
  type WorkerStrength,
  type WorkerGrowth,
  type ReferencedInsight,
} from '../../../../lib/models/worker-insights';
import type { MatchedProfessionalInsight } from '../../../../lib/models/verbose-evaluation';
import {
  deduplicateInsights,
  createGrowthKey,
  filterFallbackInsights,
  LLM_REFERENCE_SCORE,
  type GrowthWithCandidates,
  type InsightCandidate,
} from '../../../../lib/utils/insight-deduplication';
import type { UtteranceLookupEntry, TransformationAuditEntry } from '../../../../lib/models/verbose-evaluation';
import { SourceContextSidebar } from '../insights/SourceContextSidebar';
import { transformCommunicationPatterns } from '../../../../lib/transformers/prompt-pattern-transformer';
import styles from './TabbedReportContainer.module.css';

// Valid ParsedResource types for validation
const VALID_RESOURCE_TYPES = new Set(['docs', 'tutorial', 'course', 'article', 'video']);

function isValidResourceType(type: string): type is ParsedResource['type'] {
  return VALID_RESOURCE_TYPES.has(type);
}

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
      // Validate contentType before adding to prevent runtime type mismatches
      if (isValidResourceType(item.contentType)) {
        result.push({
          topic: item.title,
          type: item.contentType,
          url: item.sourceUrl,
        });
      }
    }
  }

  return result;
}

export type ReportTabId = 'activity' | 'thinking' | 'communication' | 'learning' | 'context';

/** Maps tab IDs to their corresponding worker domain keys for insight lookup */
const TAB_TO_DOMAIN: Record<ReportTabId, keyof AggregatedWorkerInsights | null> = {
  activity: null,
  thinking: 'thinkingQuality',
  communication: 'communicationPatterns',
  learning: 'learningBehavior',
  context: 'contextEfficiency',
};

interface TabConfig {
  id: ReportTabId;
  label: string;
}

/**
 * 4-tab structure based on Phase 2 Workers (v3.1):
 * - Thinking Quality: ThinkingQualityWorker (Planning + Critical Thinking)
 * - Communication: CommunicationPatternsWorker (Communication Patterns + Signature Quotes)
 * - Learning Behavior: LearningBehaviorWorker (Knowledge Gaps + Repeated Mistakes)
 * - Context Efficiency: ContextEfficiencyWorker (Token Efficiency)
 */
const REPORT_TABS: TabConfig[] = [
  { id: 'activity', label: 'Activity' },
  { id: 'thinking', label: 'Thinking Quality' },
  { id: 'communication', label: 'Communication' },
  { id: 'learning', label: 'Learning Behavior' },
  { id: 'context', label: 'Context Efficiency' },
];

/**
 * Count locked recommendations in a worker domain.
 * A recommendation is "locked" when it's empty (filtered by backend ContentGateway).
 */
function getLockedCount(domain: WorkerInsightsContainer | undefined): number {
  if (!domain) return 0;
  return domain.growthAreas.filter(g => !g.recommendation).length;
}

interface TabbedReportContainerProps {
  analysis: VerboseAnalysisData;
  agentOutputs?: AgentOutputs;
  /** Analysis metadata for confidence display */
  analysisMetadata?: AnalysisMetadata;
}

/**
 * Data-driven UI: No isPaid prop needed.
 * Backend pre-filters data based on tier before sending to client.
 * - workerInsights.growthAreas.recommendation: empty = locked
 * - knowledgeResources: pre-filtered to tier limit
 * - utteranceLookup: undefined = locked "View original" feature
 */
export function TabbedReportContainer({
  analysis,
  agentOutputs,
  analysisMetadata,
}: TabbedReportContainerProps) {
  const [activeTab, setActiveTab] = useState<ReportTabId>('activity');
  const contentRef = useRef<HTMLDivElement>(null);
  const headerSectionRef = useRef<HTMLDivElement>(null);
  const tabNavRef = useRef<HTMLDivElement>(null);

  // Anchor nav visibility: show when header scrolls out of view
  const [navVisible, setNavVisible] = useState(false);

  useEffect(() => {
    const headerEl = headerSectionRef.current;
    if (!headerEl) return;

    const observer = new IntersectionObserver(
      ([entry]) => setNavVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(headerEl);
    return () => observer.disconnect();
  }, []);

  // Professional Insight state (lifted from WorkerDomainSection for inline sidebar display)
  const [selectedInsight, setSelectedInsight] = useState<ReferencedInsight | null>(null);
  // Track whether user explicitly dismissed the auto-shown insight (reset on tab change)
  const [userDismissedInsight, setUserDismissedInsight] = useState(false);
  // Store raw viewport Y from click (before sidebar renders)
  const [clickedViewportY, setClickedViewportY] = useState<number | null>(null);
  // Track Y position offset for inline positioning (relative to sidebar top)
  const [insightYOffset, setInsightYOffset] = useState<number>(0);
  // Ref to sidebar for calculating relative positions
  const sidebarRef = useRef<HTMLElement>(null);
  // When true, useLayoutEffect will calculate Y offset from the first InsightIndicator in DOM
  const autoShowPending = useRef(false);

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

  // Transform Communication Patterns (from promptPatterns) into Strengths/Growth Areas format
  // This is used as a fallback for backward compatibility when CommunicationPatterns worker data
  // is not available (e.g., cached data from before v3.1)
  // Classification: highly_effective/effective → Strengths, could_improve → Growth Areas
  const communicationInsights = useMemo(
    () => transformCommunicationPatterns(analysis.promptPatterns),
    [analysis.promptPatterns]
  );

  // Get CommunicationPatterns worker insights, with fallback to transformed promptPatterns
  const communicationStrengths = useMemo((): WorkerStrength[] => {
    // Prefer CommunicationPatterns worker output (v3.1+)
    if (workerInsights?.communicationPatterns?.strengths?.length) {
      return workerInsights.communicationPatterns.strengths;
    }
    // Fallback to transformed promptPatterns for backward compatibility
    return communicationInsights.strengths;
  }, [workerInsights?.communicationPatterns?.strengths, communicationInsights.strengths]);

  const communicationGrowthAreas = useMemo((): WorkerGrowth[] => {
    // Prefer CommunicationPatterns worker output (v3.1+)
    if (workerInsights?.communicationPatterns?.growthAreas?.length) {
      return workerInsights.communicationPatterns.growthAreas;
    }
    // Fallback to transformed promptPatterns for backward compatibility
    return communicationInsights.growthAreas;
  }, [workerInsights?.communicationPatterns?.growthAreas, communicationInsights.growthAreas]);

  // Handle tab change with scroll-to-top + scroll active tab into view
  const handleTabChange = useCallback((tabId: ReportTabId) => {
    setActiveTab(tabId);
    // Scroll content to top when changing tabs
    if (contentRef.current) {
      contentRef.current.scrollTop = 0;
    }
    // Scroll the active tab button into view (for narrow screens with horizontal overflow)
    requestAnimationFrame(() => {
      const tabButton = tabNavRef.current?.querySelector(`[data-tab-id="${tabId}"]`);
      if (tabButton instanceof HTMLElement) {
        tabButton.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
      }
    });
  }, []);

  // Handle anchor nav tab click: switch tab + scroll to tab content area
  const handleNavTabClick = useCallback((tabId: ReportTabId) => {
    setActiveTab(tabId);
    // Wait for React to render the new tab content before scrolling
    requestAnimationFrame(() => {
      contentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  // Handle anchor nav "Profile" click: scroll to header
  const handleProfileClick = useCallback(() => {
    headerSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  // Build utterance lookup map for O(1) access (used for evidence linking)
  const utteranceLookupMap = useMemo(() => {
    const lookup = analysis.utteranceLookup;
    if (!lookup || lookup.length === 0) return undefined;
    const map = new Map<string, UtteranceLookupEntry>();
    for (const entry of lookup) {
      map.set(entry.id, entry);
    }
    return map;
  }, [analysis.utteranceLookup]);

  // Build transformation audit map for O(1) access (used for Source Context sidebar)
  const transformationAuditMap = useMemo(() => {
    const audit = analysis.transformationAudit;
    if (!audit || audit.length === 0) return undefined;
    const map = new Map<string, TransformationAuditEntry>();
    for (const entry of audit) {
      map.set(entry.utteranceId, entry);
    }
    return map;
  }, [analysis.transformationAudit]);

  // Source Context sidebar state
  const [sourceContext, setSourceContext] = useState<{
    utterance: UtteranceLookupEntry;
    audit?: TransformationAuditEntry;
  } | null>(null);

  // Handle View Context click from ExpandableEvidence
  const handleViewContext = useCallback((utteranceId: string) => {
    const utterance = utteranceLookupMap?.get(utteranceId);
    if (!utterance) return;
    const audit = transformationAuditMap?.get(utteranceId);
    setSourceContext({ utterance, audit });
  }, [utteranceLookupMap, transformationAuditMap]);

  // ============================================================================
  // Professional Insights Fallback Logic (Phase 2.75)
  // ============================================================================

  // Extract professionalInsights grouped by Worker domain
  // Converts Phase 2.75 dimension-based grouping to Worker domain-based grouping
  const professionalInsightsByDomain = useMemo(() => {
    const result = new Map<keyof AggregatedWorkerInsights, MatchedProfessionalInsight[]>();
    if (!analysis.knowledgeResources) return result;

    // For each worker domain, collect insights from matching dimensions
    for (const [domainKey, dimensions] of Object.entries(WORKER_TO_DIMENSIONS)) {
      const insights: MatchedProfessionalInsight[] = [];
      for (const dimMatch of analysis.knowledgeResources) {
        if (dimensions.includes(dimMatch.dimension)) {
          insights.push(...dimMatch.professionalInsights);
        }
      }
      if (insights.length > 0) {
        result.set(domainKey as keyof AggregatedWorkerInsights, insights);
      }
    }
    return result;
  }, [analysis.knowledgeResources]);

  // Build growth area candidates for deduplication
  // Collects both LLM-referenced and fallback insights
  const insightAllocation = useMemo(() => {
    const allGrowthWithCandidates: GrowthWithCandidates[] = [];

    // Helper to process a domain's growth areas
    const processDomain = (
      domainKey: keyof AggregatedWorkerInsights,
      growthAreas: WorkerGrowth[] | undefined,
      referencedInsights: ReferencedInsight[] | undefined
    ) => {
      if (!growthAreas) return;

      // Get fallback insights for this domain
      const fallbackInsights = professionalInsightsByDomain.get(domainKey);
      const filteredFallbacks = filterFallbackInsights(fallbackInsights);

      for (const growth of growthAreas) {
        const key = createGrowthKey(domainKey, growth.title);
        const candidates: InsightCandidate[] = [];

        // Add LLM-referenced insights (highest priority)
        if (referencedInsights && referencedInsights.length > 0) {
          for (const insight of referencedInsights) {
            candidates.push({
              insight,
              matchScore: LLM_REFERENCE_SCORE,
              source: 'llm',
            });
          }
        }

        // Add fallback insights (from Phase 2.75)
        for (const fallback of filteredFallbacks) {
          candidates.push({
            insight: matchedInsightToReferenced(fallback),
            matchScore: fallback.matchScore,
            source: 'fallback',
          });
        }

        if (candidates.length > 0) {
          allGrowthWithCandidates.push({ key, domainKey, growthTitle: growth.title, candidates });
        }
      }
    };

    // Process each Worker domain
    if (workerInsights?.thinkingQuality) {
      processDomain(
        'thinkingQuality',
        workerInsights.thinkingQuality.growthAreas,
        workerInsights.thinkingQuality.referencedInsights
      );
    }
    if (workerInsights?.communicationPatterns || communicationGrowthAreas.length > 0) {
      processDomain(
        'communicationPatterns',
        workerInsights?.communicationPatterns?.growthAreas || communicationGrowthAreas,
        workerInsights?.communicationPatterns?.referencedInsights
      );
    }
    if (workerInsights?.learningBehavior) {
      processDomain(
        'learningBehavior',
        workerInsights.learningBehavior.growthAreas,
        workerInsights.learningBehavior.referencedInsights
      );
    }
    if (workerInsights?.contextEfficiency) {
      processDomain(
        'contextEfficiency',
        workerInsights.contextEfficiency.growthAreas,
        workerInsights.contextEfficiency.referencedInsights
      );
    }

    // Deduplicate across all growth areas
    return deduplicateInsights(allGrowthWithCandidates);
  }, [workerInsights, professionalInsightsByDomain, communicationGrowthAreas]);

  // Debug logging: Track data flow for Professional Insights (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TabbedReportContainer] Professional Insights Data Check:', {
        hasKnowledgeResources: !!analysis.knowledgeResources,
        knowledgeResourcesLength: analysis.knowledgeResources?.length ?? 0,
        hasWorkerInsights: !!workerInsights,
        thinkingQualityRefs: workerInsights?.thinkingQuality?.referencedInsights?.length ?? 0,
        communicationPatternsRefs: workerInsights?.communicationPatterns?.referencedInsights?.length ?? 0,
        learningBehaviorRefs: workerInsights?.learningBehavior?.referencedInsights?.length ?? 0,
        contextEfficiencyRefs: workerInsights?.contextEfficiency?.referencedInsights?.length ?? 0,
        allResourcesLength: allResources.length,
        insightAllocationSize: insightAllocation.size,
        professionalInsightsByDomainKeys: Array.from(professionalInsightsByDomain.keys()),
      });

      // Log detailed insight allocation for debugging
      if (insightAllocation.size > 0) {
        console.log('[TabbedReportContainer] insightAllocation entries:', Object.fromEntries(insightAllocation));
      }
    }
  }, [analysis.knowledgeResources, workerInsights, allResources.length, insightAllocation, professionalInsightsByDomain]);

  // Find the first available insight for the current tab's domain (auto-show in sidebar)
  const defaultInsightForTab = useMemo((): ReferencedInsight | null => {
    const domainKey = TAB_TO_DOMAIN[activeTab];
    if (!domainKey) return null;
    const prefix = `${domainKey}:`;
    for (const [key, insight] of insightAllocation) {
      if (key.startsWith(prefix) && insight !== null) {
        return insight;
      }
    }
    return null;
  }, [activeTab, insightAllocation]);

  // Reset dismissal when switching tabs (re-enable auto-show for new tab)
  useEffect(() => {
    setUserDismissedInsight(false);
  }, [activeTab]);

  // Auto-show the first insight for current tab's domain
  useEffect(() => {
    if (userDismissedInsight) return;

    if (defaultInsightForTab) {
      setSelectedInsight(defaultInsightForTab);
      autoShowPending.current = true; // Let useLayoutEffect calculate Y from DOM
    } else {
      setSelectedInsight(null);
      setInsightYOffset(0);
    }
  }, [activeTab, defaultInsightForTab, userDismissedInsight]);

  // Helper to check if a domain has content
  const hasDomainContent = (key: keyof AggregatedWorkerInsights): boolean => {
    const domain = workerInsights?.[key];
    return Boolean(domain && (domain.strengths?.length > 0 || domain.growthAreas?.length > 0));
  };

  // Check if we have content for each tab
  const hasThinking = hasDomainContent('thinkingQuality');
  const hasCommunication =
    communicationStrengths.length > 0 ||
    communicationGrowthAreas.length > 0;
  const hasLearning = hasDomainContent('learningBehavior');
  const hasContext = hasDomainContent('contextEfficiency');

  // Memoize availableTabs to prevent unnecessary recalculations and useEffect triggers
  const availableTabs = useMemo(() => {
    return REPORT_TABS.filter(tab => {
      switch (tab.id) {
        case 'activity':
          return true; // Always available - shows session calendar
        case 'thinking':
          return hasThinking;
        case 'communication':
          return hasCommunication;
        case 'learning':
          return hasLearning;
        case 'context':
          return hasContext;
        default:
          return false;
      }
    });
  }, [hasThinking, hasCommunication, hasLearning, hasContext]);

  // Calculate locked recommendation counts for each tab (for premium badge)
  const lockedCounts = useMemo(() => ({
    activity: 0,
    thinking: getLockedCount(workerInsights?.thinkingQuality),
    communication: getLockedCount(workerInsights?.communicationPatterns),
    learning: getLockedCount(workerInsights?.learningBehavior),
    context: getLockedCount(workerInsights?.contextEfficiency),
  }), [workerInsights]);

  // Memoize defaultTab based on availableTabs — prefer first worker tab for insight auto-show
  const defaultTab = useMemo(() => {
    const firstWorkerTab = availableTabs.find(t => t.id !== 'activity');
    return firstWorkerTab?.id || availableTabs[0]?.id || 'thinking';
  }, [availableTabs]);

  // Sync activeTab with available tabs:
  // - When current tab becomes unavailable, fall back to defaultTab
  const hasInitializedTab = useRef(false);
  useEffect(() => {
    if (!hasInitializedTab.current) {
      hasInitializedTab.current = true;
      if (activeTab === 'activity' && defaultTab !== 'activity') {
        setActiveTab(defaultTab);
        return;
      }
    }
    const isActiveTabAvailable = availableTabs.some(t => t.id === activeTab);
    if (!isActiveTabAvailable) {
      setActiveTab(defaultTab);
    }
  }, [activeTab, availableTabs, defaultTab]);

  // Calculate next available tab
  const currentAvailableIndex = availableTabs.findIndex(t => t.id === activeTab);
  const hasNextTab = currentAvailableIndex >= 0 && currentAvailableIndex < availableTabs.length - 1;
  const nextAvailableTab = hasNextTab ? availableTabs[currentAvailableIndex + 1] : null;

  // Handle next tab button click
  const handleNextTab = useCallback(() => {
    if (nextAvailableTab) {
      handleTabChange(nextAvailableTab.id);
    }
  }, [nextAvailableTab, handleTabChange]);

  // Handle insight click - open insight in sidebar
  // Store viewportY immediately; offset calculation happens in useLayoutEffect after sidebar renders
  const handleInsightClick = useCallback((insight: ReferencedInsight, viewportY?: number) => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[handleInsightClick] Setting selectedInsight:', insight, 'viewportY:', viewportY);
    }
    setSelectedInsight(insight);
    // Store viewport Y for offset calculation after sidebar renders
    if (viewportY !== undefined) {
      setClickedViewportY(viewportY);
    }
  }, []);

  // Handle close insight
  const handleCloseInsight = useCallback(() => {
    setSelectedInsight(null);
    setClickedViewportY(null);
    setInsightYOffset(0);
    setUserDismissedInsight(true);
  }, []);

  // Calculate offset after sidebar renders (useLayoutEffect runs synchronously after DOM mutations)
  useLayoutEffect(() => {
    // Manual click path: use captured viewport Y from click event
    if (clickedViewportY !== null && sidebarRef.current) {
      const sidebarTop = sidebarRef.current.getBoundingClientRect().top;
      const relativeOffset = Math.max(0, clickedViewportY - sidebarTop);
      setInsightYOffset(relativeOffset);
      // Clear viewportY after calculation to avoid re-running
      setClickedViewportY(null);
      if (process.env.NODE_ENV === 'development') {
        console.log('[useLayoutEffect] Manual click offset:', { clickedViewportY, sidebarTop, relativeOffset });
      }
      return;
    }

    // Auto-show path: position at first InsightIndicator in current tab content
    if (autoShowPending.current && selectedInsight && sidebarRef.current && contentRef.current) {
      autoShowPending.current = false;
      const indicator = contentRef.current.querySelector('[data-insight-indicator]');
      if (indicator) {
        const indicatorTop = indicator.getBoundingClientRect().top;
        const sidebarTop = sidebarRef.current.getBoundingClientRect().top;
        const relativeOffset = Math.max(0, indicatorTop - sidebarTop);
        setInsightYOffset(relativeOffset);
        if (process.env.NODE_ENV === 'development') {
          console.log('[useLayoutEffect] Auto-show offset:', { indicatorTop, sidebarTop, relativeOffset });
        }
      } else {
        setInsightYOffset(0); // Fallback if indicator not yet in DOM
      }
    }
  }, [clickedViewportY, selectedInsight]);

  // Debug: Log sidebar render conditions
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[Sidebar Render Conditions]', {
        selectedInsight: !!selectedInsight,
        allResourcesLength: allResources.length,
        shouldShowSidebar: allResources.length > 0 || !!selectedInsight,
        shouldShowInlineCard: !!selectedInsight,
      });
    }
  }, [selectedInsight, allResources.length]);

  return (
    <div className={styles.pageLayout}>
      {/* 1. Nav Column — vertical sidebar navigation */}
      <div className={styles.navColumn}>
        <ReportAnchorNav
          activeTab={activeTab}
          availableTabs={availableTabs}
          onTabClick={handleNavTabClick}
          onProfileClick={handleProfileClick}
          visible={navVisible}
        />
      </div>

      {/* 2. Main Content Column */}
      <div className={styles.mainContent}>
        {/* Fixed Header Section - Always Visible */}
        <div ref={headerSectionRef} className={styles.headerSection}>
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

          {/* Top Focus Areas (between personality summary and tabs) */}
          {analysis.topFocusAreas && analysis.topFocusAreas.areas?.length > 0 && (
            <TopFocusAreasSection focusAreas={analysis.topFocusAreas} />
          )}
        </div>

        {/* Tab Navigation */}
        {availableTabs.length > 1 && (
          <div ref={tabNavRef} className={styles.tabNav}>
            {availableTabs.map((tab) => {
              const lockedCount = lockedCounts[tab.id];
              return (
                <button
                  key={tab.id}
                  data-tab-id={tab.id}
                  className={`${styles.tab} ${activeTab === tab.id ? styles.tabActive : ''}`}
                  onClick={() => handleTabChange(tab.id)}
                  type="button"
                >
                  {tab.label}
                  {lockedCount > 0 && (
                    <span className={styles.lockedBadge}>
                      🔒{lockedCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* Tab Content - Scrollable */}
        <div ref={contentRef} className={styles.tabContent}>
          {/* Activity Tab - GitHub-style contribution graph */}
          {activeTab === 'activity' && (
            <div className={styles.tabPanel}>
              <ActivitySection
                activitySessions={analysis.activitySessions}
                analyzedSessions={analysis.analyzedSessions ?? []}
                sessionSummaries={analysis.sessionSummaries}
                projectSummaries={analysis.projectSummaries}
                analysisDateRange={analysisMetadata?.analysisDateRange}
                weeklyInsights={analysis.weeklyInsights}
              />
            </div>
          )}

          {/* Thinking Quality Tab - ThinkingQualityWorker (Planning + Critical Thinking) */}
          {activeTab === 'thinking' && hasThinking && workerInsights?.thinkingQuality && (
            <div className={styles.tabPanel}>
              <WorkerDomainSection
                config={WORKER_DOMAIN_CONFIGS[0]}
                strengths={workerInsights.thinkingQuality.strengths}
                growthAreas={workerInsights.thinkingQuality.growthAreas}
                translatedStrengthsData={translatedAgentInsights?.thinkingQuality?.strengths ?? translatedAgentInsights?.thinkingQuality?.strengthsData}
                translatedGrowthAreasData={translatedAgentInsights?.thinkingQuality?.growthAreas ?? translatedAgentInsights?.thinkingQuality?.growthAreasData}
                utteranceLookup={utteranceLookupMap}
                domainScore={workerInsights.thinkingQuality.domainScore}
                insightAllocation={insightAllocation}
                domainKey="thinkingQuality"
                onInsightClick={handleInsightClick}
                onViewContext={handleViewContext}
              />
              {/* Premium Value Summary */}
              <PremiumValueSummary
                lockedCount={lockedCounts.thinking}
                domainName="Thinking Quality"
              />
            </div>
          )}

          {/* Communication Tab - CommunicationPatternsWorker (Patterns + Signature Quotes) */}
          {activeTab === 'communication' && hasCommunication && (
            <div className={styles.tabPanel}>
              <WorkerDomainSection
                config={WORKER_DOMAIN_CONFIGS[1]}
                strengths={communicationStrengths}
                growthAreas={communicationGrowthAreas}
                translatedStrengthsData={translatedAgentInsights?.communicationPatterns?.strengths ?? translatedAgentInsights?.communicationPatterns?.strengthsData}
                translatedGrowthAreasData={translatedAgentInsights?.communicationPatterns?.growthAreas ?? translatedAgentInsights?.communicationPatterns?.growthAreasData}
                utteranceLookup={utteranceLookupMap}
                domainScore={workerInsights?.communicationPatterns?.domainScore}
                insightAllocation={insightAllocation}
                domainKey="communicationPatterns"
                onInsightClick={handleInsightClick}
                onViewContext={handleViewContext}
              />
              {/* Premium Value Summary */}
              <PremiumValueSummary
                lockedCount={lockedCounts.communication}
                domainName="Communication"
              />
            </div>
          )}

          {/* Learning Behavior Tab - LearningBehaviorWorker */}
          {activeTab === 'learning' && hasLearning && workerInsights?.learningBehavior && (
            <div className={styles.tabPanel}>
              <WorkerDomainSection
                config={WORKER_DOMAIN_CONFIGS[2]}
                strengths={workerInsights.learningBehavior.strengths}
                growthAreas={workerInsights.learningBehavior.growthAreas}
                translatedStrengthsData={translatedAgentInsights?.learningBehavior?.strengths ?? translatedAgentInsights?.learningBehavior?.strengthsData}
                translatedGrowthAreasData={translatedAgentInsights?.learningBehavior?.growthAreas ?? translatedAgentInsights?.learningBehavior?.growthAreasData}
                utteranceLookup={utteranceLookupMap}
                domainScore={workerInsights.learningBehavior.domainScore}
                insightAllocation={insightAllocation}
                domainKey="learningBehavior"
                onInsightClick={handleInsightClick}
                onViewContext={handleViewContext}
              />
              {/* Premium Value Summary */}
              <PremiumValueSummary
                lockedCount={lockedCounts.learning}
                domainName="Learning Behavior"
              />
            </div>
          )}

          {/* Context Efficiency Tab - ContextEfficiencyWorker */}
          {activeTab === 'context' && hasContext && workerInsights?.contextEfficiency && (
            <div className={styles.tabPanel}>
              <WorkerDomainSection
                config={WORKER_DOMAIN_CONFIGS[3]}
                strengths={workerInsights.contextEfficiency.strengths}
                growthAreas={workerInsights.contextEfficiency.growthAreas}
                translatedStrengthsData={translatedAgentInsights?.contextEfficiency?.strengths ?? translatedAgentInsights?.contextEfficiency?.strengthsData}
                translatedGrowthAreasData={translatedAgentInsights?.contextEfficiency?.growthAreas ?? translatedAgentInsights?.contextEfficiency?.growthAreasData}
                utteranceLookup={utteranceLookupMap}
                domainScore={workerInsights.contextEfficiency.domainScore}
                insightAllocation={insightAllocation}
                domainKey="contextEfficiency"
                onInsightClick={handleInsightClick}
                onViewContext={handleViewContext}
              />
              {/* Premium Value Summary */}
              <PremiumValueSummary
                lockedCount={lockedCounts.context}
                domainName="Context Efficiency"
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

      {/* 3. Context Sidebar — always render container for grid stability */}
      <aside ref={sidebarRef} className={styles.sidebar}>
        {/* Inline Insight Preview Card — positioned at same Y level as clicked Growth Area */}
        {selectedInsight && (
          <div
            className={styles.insightCardWrapper}
            style={{ top: `${insightYOffset}px` }}
          >
            <InsightPreviewCard
              insight={selectedInsight}
              onClose={handleCloseInsight}
            />
          </div>
        )}
        {/* Resource Sidebar (resources pre-filtered by backend) */}
        {allResources.length > 0 && (
          <ResourceSidebar resources={allResources} />
        )}
      </aside>

      {/* Source Context Sidebar — shows conversation thread for evidence items */}
      <SourceContextSidebar
        utterance={sourceContext?.utterance ?? null}
        audit={sourceContext?.audit}
        isOpen={sourceContext !== null}
        onClose={() => setSourceContext(null)}
      />
    </div>
  );
}

export default TabbedReportContainer;
