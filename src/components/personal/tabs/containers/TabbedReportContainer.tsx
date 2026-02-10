/**
 * TabbedReportContainer Component (Continuous Scroll Layout)
 *
 * Renders all analysis sections sequentially in a continuous scroll layout:
 * - Fixed header: TypeResultMinimal + PersonalitySummary (always visible)
 * - Sections: Activity | Thinking Quality | Communication | Learning Behavior | Context Efficiency | Session Success
 * - FloatingProgressDots: right-side navigation dots indicating active section
 *
 * Each section displays the corresponding Worker's strengths/growthAreas.
 * Professional insights are rendered inline within GrowthCard components.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { WorkerDomainSection } from '../insights/WorkerInsightsSection';
import { ActivitySection } from '../activity/ActivitySection';
import { FloatingProgressDots } from '../shared/FloatingProgressDots';
import { ReportTableOfContents, type TocSection } from '../shared/ReportTableOfContents';
import { ResourceSidebar } from '../resources/ResourceSidebar';
import { ReportSummarySection } from '../shared/ReportSummarySection';
import { TopFocusAreasSection } from '../focus/TopFocusAreasSection';
import { useScrollSpy } from '../../../../hooks/useScrollSpy';
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

export type ReportTabId = 'activity' | 'thinking' | 'communication' | 'learning' | 'context' | 'session';

/** Section icons used by FloatingProgressDots */
const SECTION_ICONS: Record<ReportTabId, string> = {
  activity: '📊',
  thinking: '🧠',
  communication: '💬',
  learning: '📚',
  context: '⚡',
  session: '🎯',
};

interface SectionConfig {
  id: ReportTabId;
  label: string;
}

/**
 * Section structure based on Phase 2 Workers:
 * - Activity: Session calendar + weekly insights
 * - Thinking Quality: ThinkingQualityWorker (Planning + Critical Thinking)
 * - Communication: CommunicationPatternsWorker (Communication Patterns + Signature Quotes)
 * - Learning Behavior: LearningBehaviorWorker (Knowledge Gaps + Repeated Mistakes)
 * - Context Efficiency: ContextEfficiencyWorker (Token Efficiency)
 */
const REPORT_SECTIONS: SectionConfig[] = [
  { id: 'activity', label: 'Activity' },
  { id: 'thinking', label: 'Thinking Quality' },
  { id: 'communication', label: 'Communication' },
  { id: 'learning', label: 'Learning Behavior' },
  { id: 'context', label: 'Context Efficiency' },
  { id: 'session', label: 'Session Success' },
];

/**
 * Count locked recommendations in a worker domain.
 * A recommendation is "locked" when it's empty (filtered by backend ContentGateway).
 * A fully locked domain (description === '') counts all growth areas as locked.
 */
function getLockedCount(domain: WorkerInsightsContainer | undefined): number {
  if (!domain) return 0;
  // Fully locked domain: description empty on both strengths and growth areas
  if (domain.strengths.length > 0 && domain.strengths[0].description === ''
    && domain.growthAreas.length > 0 && domain.growthAreas[0].description === '') {
    return domain.growthAreas.length;
  }
  return domain.growthAreas.filter(g => !g.recommendation).length;
}

interface TabbedReportContainerProps {
  analysis: VerboseAnalysisData;
  agentOutputs?: AgentOutputs;
  /** Analysis metadata for confidence display */
  analysisMetadata?: AnalysisMetadata;
  /** Whether the user has paid (hides conversion nudges) */
  isPaid?: boolean;
  /** Report ID for share URL generation (omit to hide share buttons) */
  reportId?: string;
}

export function TabbedReportContainer({
  analysis,
  agentOutputs,
  analysisMetadata,
  isPaid = false,
  reportId,
}: TabbedReportContainerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const headerSectionRef = useRef<HTMLDivElement>(null);

  // Section refs for scroll spy
  const activityRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const communicationRef = useRef<HTMLDivElement>(null);
  const learningRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useMemo(() => new Map<string, React.RefObject<HTMLDivElement | null>>([
    ['activity', activityRef],
    ['thinking', thinkingRef],
    ['communication', communicationRef],
    ['learning', learningRef],
    ['context', contextRef],
    ['session', sessionRef],
  ]), []);

  // Scroll spy: detect active section from scroll position
  const activeSection = useScrollSpy({ sectionRefs });
  const activeTab = (activeSection as ReportTabId) || 'activity';

  // Track visited sections for FloatingProgressDots state rendering
  const [visitedSections, setVisitedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (activeTab) {
      setVisitedSections(prev => {
        if (prev.has(activeTab)) return prev;
        const next = new Set(prev);
        next.add(activeTab);
        return next;
      });
    }
  }, [activeTab]);

  // FloatingProgressDots visibility: show when header scrolls out of view
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

  // Flatten dimension-grouped knowledge resources to a flat list for ResourceSidebar
  const allResources = useMemo(
    () => convertKnowledgeResourcesToFlat(analysis.knowledgeResources ?? []),
    [analysis.knowledgeResources],
  );

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

  const communicationStrengths = useMemo((): WorkerStrength[] => {
    return workerInsights?.communicationPatterns?.strengths?.length
      ? workerInsights.communicationPatterns.strengths
      : communicationInsights.strengths;
  }, [workerInsights?.communicationPatterns?.strengths, communicationInsights.strengths]);

  const communicationGrowthAreas = useMemo((): WorkerGrowth[] => {
    return workerInsights?.communicationPatterns?.growthAreas?.length
      ? workerInsights.communicationPatterns.growthAreas
      : communicationInsights.growthAreas;
  }, [workerInsights?.communicationPatterns?.growthAreas, communicationInsights.growthAreas]);

  // Scroll to section handler (used by FloatingProgressDots)
  const handleSectionClick = useCallback((sectionId: string) => {
    sectionRefs.get(sectionId)?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sectionRefs]);

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
    if (workerInsights?.sessionOutcome) {
      processDomain(
        'sessionOutcome',
        workerInsights.sessionOutcome.growthAreas,
        workerInsights.sessionOutcome.referencedInsights
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
        sessionOutcomeRefs: workerInsights?.sessionOutcome?.referencedInsights?.length ?? 0,
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

  const hasDomainContent = (key: keyof AggregatedWorkerInsights): boolean => {
    const domain = workerInsights?.[key];
    return Boolean(domain && (domain.strengths?.length > 0 || domain.growthAreas?.length > 0));
  };

  const hasThinking = hasDomainContent('thinkingQuality');
  const hasCommunication = communicationStrengths.length > 0 || communicationGrowthAreas.length > 0;
  const hasLearning = hasDomainContent('learningBehavior');
  const hasContext = hasDomainContent('contextEfficiency');
  const hasSession = hasDomainContent('sessionOutcome');

  // Build available sections for FloatingProgressDots
  const availableSections = useMemo(() => {
    const sectionVisibility: Record<ReportTabId, boolean> = {
      activity: true,
      thinking: hasThinking,
      communication: hasCommunication,
      learning: hasLearning,
      context: hasContext,
      session: hasSession,
    };

    return REPORT_SECTIONS
      .filter(section => sectionVisibility[section.id])
      .map(section => ({
        id: section.id,
        label: section.label,
        icon: SECTION_ICONS[section.id],
      }));
  }, [hasThinking, hasCommunication, hasLearning, hasContext, hasSession]);

  // Session count for Activity teaser in ToC
  const sessionsAnalyzed = analysis.activitySessions?.length ?? 0;

  // Calculate locked recommendation counts for each section (for premium badge)
  const lockedCounts = useMemo(() => ({
    activity: 0,
    thinking: getLockedCount(workerInsights?.thinkingQuality),
    communication: getLockedCount(workerInsights?.communicationPatterns),
    learning: getLockedCount(workerInsights?.learningBehavior),
    context: getLockedCount(workerInsights?.contextEfficiency),
    session: getLockedCount(workerInsights?.sessionOutcome),
  }), [workerInsights]);

  // Build ToC section data from available sections + worker insights
  const tocSections = useMemo((): TocSection[] => {
    // Map ReportTabId to WORKER_DOMAIN_CONFIGS index
    const domainKeyMap: Record<string, keyof AggregatedWorkerInsights> = {
      thinking: 'thinkingQuality',
      communication: 'communicationPatterns',
      learning: 'learningBehavior',
      context: 'contextEfficiency',
      session: 'sessionOutcome',
    };

    return availableSections.map((section) => {
      const domainKey = domainKeyMap[section.id];
      const domain = domainKey ? workerInsights?.[domainKey] : undefined;
      const config = domainKey
        ? WORKER_DOMAIN_CONFIGS.find((c) => c.key === domainKey)
        : undefined;

      // Communication fallback: use legacy strengths/growth if worker data missing
      const strengthCount = section.id === 'communication' && !domain
        ? communicationStrengths.length
        : (domain?.strengths?.length ?? 0);
      const growthCount = section.id === 'communication' && !domain
        ? communicationGrowthAreas.length
        : (domain?.growthAreas?.length ?? 0);

      return {
        id: section.id,
        label: section.label,
        icon: section.icon,
        subtitle: section.id === 'activity'
          ? 'Your coding rhythm and session patterns'
          : (config?.subtitle ?? ''),
        score: domain?.domainScore,
        strengthCount,
        growthCount,
        lockedCount: lockedCounts[section.id as ReportTabId] ?? 0,
      };
    });
  }, [availableSections, workerInsights, lockedCounts, communicationStrengths.length, communicationGrowthAreas.length]);

  // Unlock percentage for ProgressiveMeter (free users only)
  const { totalLocked, unlockPercentage } = useMemo(() => {
    const locked = lockedCounts.thinking + lockedCounts.communication
      + lockedCounts.learning + lockedCounts.context + lockedCounts.session;
    const totalGrowthAreas =
      (workerInsights?.thinkingQuality?.growthAreas?.length ?? 0)
      + (workerInsights?.communicationPatterns?.growthAreas?.length ?? 0)
      + (workerInsights?.learningBehavior?.growthAreas?.length ?? 0)
      + (workerInsights?.contextEfficiency?.growthAreas?.length ?? 0)
      + (workerInsights?.sessionOutcome?.growthAreas?.length ?? 0);
    const pct = totalGrowthAreas > 0
      ? Math.round(((totalGrowthAreas - locked) / totalGrowthAreas) * 100)
      : 100;
    return { totalLocked: locked, unlockPercentage: pct };
  }, [lockedCounts, workerInsights]);

  return (
    <div className={styles.pageLayout}>
      {/* Floating Progress Dots — section navigation */}
      <FloatingProgressDots
        sections={availableSections}
        activeSection={activeTab}
        onSectionClick={handleSectionClick}
        visible={navVisible}
        visitedSections={visitedSections}
        unlockPercentage={!isPaid ? unlockPercentage : undefined}
        lockedCount={!isPaid ? totalLocked : undefined}
      />

      {/* Main Content Column */}
      <div className={styles.mainContent}>
        {/* Fixed Header Section - Always Visible */}
        <div ref={headerSectionRef} className={styles.headerSection}>
          <ReportSummarySection
            analysis={analysis}
            workerInsights={workerInsights}
            reportId={reportId}
          />

          {/* Top Focus Areas (between personality summary and sections) */}
          {analysis.topFocusAreas && analysis.topFocusAreas.areas?.length > 0 && (
            <TopFocusAreasSection focusAreas={analysis.topFocusAreas} />
          )}
        </div>

        {/* Table of Contents — magazine-style guide between header and content */}
        <ReportTableOfContents
          sections={tocSections}
          sessionsAnalyzed={sessionsAnalyzed}
          onSectionClick={handleSectionClick}
        />

        {/* Continuous Scroll Content */}
        <div ref={contentRef} className={styles.scrollContent}>
          {/* Activity Section - GitHub-style contribution graph */}
          <div ref={activityRef} data-section-id="activity" className={styles.scrollSection}>
            <ActivitySection
              activitySessions={analysis.activitySessions}
              analyzedSessions={analysis.analyzedSessions ?? []}
              sessionSummaries={analysis.sessionSummaries}
              projectSummaries={analysis.projectSummaries}
              analysisDateRange={analysisMetadata?.analysisDateRange}
              weeklyInsights={analysis.weeklyInsights}
            />
          </div>

          {/* Thinking Quality Section - ThinkingQualityWorker (Planning + Critical Thinking) */}
          {hasThinking && workerInsights?.thinkingQuality && (
            <div ref={thinkingRef} data-section-id="thinking" className={styles.scrollSection}>
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
                onViewContext={handleViewContext}
              />
            </div>
          )}

          {/* Communication Section - CommunicationPatternsWorker (Patterns + Signature Quotes) */}
          {hasCommunication && (
            <div ref={communicationRef} data-section-id="communication" className={styles.scrollSection}>
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
                onViewContext={handleViewContext}
              />
            </div>
          )}

          {/* Learning Behavior Section - LearningBehaviorWorker */}
          {hasLearning && workerInsights?.learningBehavior && (
            <div ref={learningRef} data-section-id="learning" className={styles.scrollSection}>
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
                onViewContext={handleViewContext}
              />
            </div>
          )}

          {/* Context Efficiency Section - ContextEfficiencyWorker */}
          {hasContext && workerInsights?.contextEfficiency && (
            <div ref={contextRef} data-section-id="context" className={styles.scrollSection}>
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
                onViewContext={handleViewContext}
              />
            </div>
          )}

          {/* Session Success Section - SessionOutcomeWorker */}
          {hasSession && workerInsights?.sessionOutcome && (
            <div ref={sessionRef} data-section-id="session" className={styles.scrollSection}>
              <WorkerDomainSection
                config={WORKER_DOMAIN_CONFIGS[4]}
                strengths={workerInsights.sessionOutcome.strengths}
                growthAreas={workerInsights.sessionOutcome.growthAreas}
                translatedStrengthsData={translatedAgentInsights?.sessionOutcome?.strengths ?? translatedAgentInsights?.sessionOutcome?.strengthsData}
                translatedGrowthAreasData={translatedAgentInsights?.sessionOutcome?.growthAreas ?? translatedAgentInsights?.sessionOutcome?.growthAreasData}
                utteranceLookup={utteranceLookupMap}
                domainScore={workerInsights.sessionOutcome.domainScore}
                insightAllocation={insightAllocation}
                domainKey="sessionOutcome"
                onViewContext={handleViewContext}
              />
            </div>
          )}
        </div>
      </div>

      {/* Resource Sidebar */}
      <aside className={styles.sidebar}>
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
