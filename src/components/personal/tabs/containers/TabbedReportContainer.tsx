/**
 * TabbedReportContainer Component (Continuous Scroll Layout)
 *
 * Renders all analysis sections sequentially in a continuous scroll layout:
 * - Fixed header: TypeResultMinimal + PersonalitySummary (always visible)
 * - Sections: Activity | Thinking Quality | Communication | Learning Behavior | Context Efficiency
 * - FloatingProgressDots: right-side navigation dots indicating active section
 *
 * Each section displays the corresponding Worker's strengths/growthAreas.
 * Professional insights are rendered inline within GrowthCard components.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { TypeResultMinimal } from '../type-result/TypeResultMinimal';
import { PersonalitySummaryClean } from '../type-result/PersonalitySummaryClean';
import { WorkerDomainSection } from '../insights/WorkerInsightsSection';
import { ActivitySection } from '../activity/ActivitySection';
import { PremiumValueSummary } from '../shared/PremiumValueSummary';
import { FloatingProgressDots } from '../shared/FloatingProgressDots';
import { ResourceSidebar } from '../resources/ResourceSidebar';
import { DataQualityBadge } from '../shared/DataQualityBadge';
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

export type ReportTabId = 'activity' | 'thinking' | 'communication' | 'learning' | 'context';

/** Section icons used by FloatingProgressDots */
const SECTION_ICONS: Record<ReportTabId, string> = {
  activity: '📊',
  thinking: '🧠',
  communication: '💬',
  learning: '📚',
  context: '⚡',
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
  const contentRef = useRef<HTMLDivElement>(null);
  const headerSectionRef = useRef<HTMLDivElement>(null);

  // Section refs for scroll spy
  const activityRef = useRef<HTMLDivElement>(null);
  const thinkingRef = useRef<HTMLDivElement>(null);
  const communicationRef = useRef<HTMLDivElement>(null);
  const learningRef = useRef<HTMLDivElement>(null);
  const contextRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useMemo(() => new Map<string, React.RefObject<HTMLDivElement | null>>([
    ['activity', activityRef],
    ['thinking', thinkingRef],
    ['communication', communicationRef],
    ['learning', learningRef],
    ['context', contextRef],
  ]), []);

  // Scroll spy: detect active section from scroll position
  const activeSection = useScrollSpy({ sectionRefs });
  const activeTab = (activeSection as ReportTabId) || 'activity';

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

  // Helper to check if a domain has content
  const hasDomainContent = (key: keyof AggregatedWorkerInsights): boolean => {
    const domain = workerInsights?.[key];
    return Boolean(domain && (domain.strengths?.length > 0 || domain.growthAreas?.length > 0));
  };

  // Check if we have content for each section
  const hasThinking = hasDomainContent('thinkingQuality');
  const hasCommunication =
    communicationStrengths.length > 0 ||
    communicationGrowthAreas.length > 0;
  const hasLearning = hasDomainContent('learningBehavior');
  const hasContext = hasDomainContent('contextEfficiency');

  // Build available sections for FloatingProgressDots
  const availableSections = useMemo(() => {
    const sectionVisibility: Record<ReportTabId, boolean> = {
      activity: true,
      thinking: hasThinking,
      communication: hasCommunication,
      learning: hasLearning,
      context: hasContext,
    };

    return REPORT_SECTIONS
      .filter(section => sectionVisibility[section.id])
      .map(section => ({
        id: section.id,
        label: section.label,
        icon: SECTION_ICONS[section.id],
      }));
  }, [hasThinking, hasCommunication, hasLearning, hasContext]);

  // Calculate locked recommendation counts for each section (for premium badge)
  const lockedCounts = useMemo(() => ({
    activity: 0,
    thinking: getLockedCount(workerInsights?.thinkingQuality),
    communication: getLockedCount(workerInsights?.communicationPatterns),
    learning: getLockedCount(workerInsights?.learningBehavior),
    context: getLockedCount(workerInsights?.contextEfficiency),
  }), [workerInsights]);

  return (
    <div className={styles.pageLayout}>
      {/* Floating Progress Dots — section navigation */}
      <FloatingProgressDots
        sections={availableSections}
        activeSection={activeTab}
        onSectionClick={handleSectionClick}
        visible={navVisible}
      />

      {/* Main Content Column */}
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

          {/* Top Focus Areas (between personality summary and sections) */}
          {analysis.topFocusAreas && analysis.topFocusAreas.areas?.length > 0 && (
            <TopFocusAreasSection focusAreas={analysis.topFocusAreas} />
          )}
        </div>

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
              <PremiumValueSummary
                lockedCount={lockedCounts.thinking}
                domainName="Thinking Quality"
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
              <PremiumValueSummary
                lockedCount={lockedCounts.communication}
                domainName="Communication"
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
              <PremiumValueSummary
                lockedCount={lockedCounts.learning}
                domainName="Learning Behavior"
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
              <PremiumValueSummary
                lockedCount={lockedCounts.context}
                domainName="Context Efficiency"
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
