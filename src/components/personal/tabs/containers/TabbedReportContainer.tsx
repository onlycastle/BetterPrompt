/**
 * TabbedReportContainer Component (Scrollytelling Layout)
 *
 * Renders the analysis report as a scroll-driven narrative:
 *
 * 1. Identity  — Type result + personality summary (who you are)
 * 2. Activity  — Coding heatmap + session stats (your world)
 * 3. Strengths — All domain strengths aggregated (your shining moments)
 * 4. Growth    — All domain diagnoses sorted by severity (the turn)
 * 5. Unlock    — Cliffhanger paywall (prescriptions locked)
 *
 * NarrativeMoment components act as chapter breaks between sections.
 * FloatingProgressDots tracks story progress on the right side.
 */

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { ActivitySection } from '../activity/ActivitySection';
import { FloatingProgressDots } from '../shared/FloatingProgressDots';
import { ResourceSidebar } from '../resources/ResourceSidebar';
import { ReportSummarySection } from '../shared/ReportSummarySection';
import { StrengthsOverview } from '../insights/StrengthsOverview';
import { DiagnosisOverview } from '../insights/DiagnosisOverview';
import { NarrativeMoment } from '../../../report/NarrativeMoment';
import { CliffhangerWall } from '../../../report/CliffhangerWall';
import { useScrollSpy } from '../../../../hooks/useScrollSpy';
import { SurveyInlineCard } from '../../../report/SurveyInlineCard';
import { SurveyBottomSheet } from '../../../report/SurveyBottomSheet';
import type { DisappointmentLevel } from '../../../report/SurveyBottomSheet';
import type { VerboseAnalysisData, AnalysisMetadata, DimensionResourceMatch } from '../../../../types/verbose';
import type { AgentOutputs, ParsedResource } from '../../../../lib/models/agent-outputs';
import { aggregateWorkerInsights } from '../../../../lib/models/agent-outputs';
import {
  WORKER_TO_DIMENSIONS,
  matchedInsightToReferenced,
  type AggregatedWorkerInsights,
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

// ============================================================================
// Resource Helpers
// ============================================================================

const VALID_RESOURCE_TYPES = new Set(['docs', 'tutorial', 'course', 'article', 'video']);

function isValidResourceType(type: string): type is ParsedResource['type'] {
  return VALID_RESOURCE_TYPES.has(type);
}

function convertKnowledgeResourcesToFlat(resources: DimensionResourceMatch[]): ParsedResource[] {
  const result: ParsedResource[] = [];
  for (const dimMatch of resources) {
    for (const item of dimMatch.knowledgeItems) {
      if (isValidResourceType(item.contentType)) {
        result.push({ topic: item.title, type: item.contentType, url: item.sourceUrl });
      }
    }
  }
  return result;
}

// ============================================================================
// Narrative Section Config
// ============================================================================

export type NarrativeSectionId = 'identity' | 'activity' | 'strengths' | 'growth';

const NARRATIVE_SECTIONS: { id: NarrativeSectionId; label: string; icon: string }[] = [
  { id: 'identity', label: 'Your Type', icon: '🎭' },
  { id: 'activity', label: 'Activity', icon: '📊' },
  { id: 'strengths', label: 'Strengths', icon: '✨' },
  { id: 'growth', label: 'Growth', icon: '📈' },
];

// ============================================================================
// Component
// ============================================================================

interface TabbedReportContainerProps {
  analysis: VerboseAnalysisData;
  agentOutputs?: AgentOutputs;
  analysisMetadata?: AnalysisMetadata;
  isPaid?: boolean;
  reportId?: string;
  credits?: number | null;
  onCreditsUsed?: () => void;
}

export function TabbedReportContainer({
  analysis,
  agentOutputs,
  analysisMetadata,
  isPaid = false,
  reportId,
  credits,
  onCreditsUsed,
}: TabbedReportContainerProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const headerSectionRef = useRef<HTMLDivElement>(null);

  // Section refs for scroll spy (narrative sections)
  const identityRef = useRef<HTMLDivElement>(null);
  const activityRef = useRef<HTMLDivElement>(null);
  const strengthsRef = useRef<HTMLDivElement>(null);
  const growthRef = useRef<HTMLDivElement>(null);

  const sectionRefs = useMemo(() => new Map<string, React.RefObject<HTMLDivElement | null>>([
    ['identity', identityRef],
    ['activity', activityRef],
    ['strengths', strengthsRef],
    ['growth', growthRef],
  ]), []);

  // Scroll spy: detect active section from scroll position
  const activeSection = useScrollSpy({ sectionRefs });
  const activeTab = (activeSection as NarrativeSectionId) || 'identity';

  // Track visited sections for FloatingProgressDots
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

  // Survey enrichment mode
  const [enrichmentOpen, setEnrichmentOpen] = useState(false);
  const [enrichmentLevel, setEnrichmentLevel] = useState<DisappointmentLevel | null>(null);

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

  // Flatten knowledge resources for sidebar
  const allResources = useMemo(
    () => convertKnowledgeResourcesToFlat(analysis.knowledgeResources ?? []),
    [analysis.knowledgeResources],
  );

  // ============================================================================
  // Worker Insights Data Pipeline
  // ============================================================================

  // Aggregate worker insights from Phase 2 workers
  const rawWorkerInsights = useMemo(() => {
    if (analysis.workerInsights) return analysis.workerInsights;
    if (agentOutputs) return aggregateWorkerInsights(agentOutputs);
    return undefined;
  }, [analysis, agentOutputs]);

  // Communication patterns fallback: transform promptPatterns if worker data missing
  const communicationInsights = useMemo(
    () => transformCommunicationPatterns(analysis.promptPatterns),
    [analysis.promptPatterns]
  );

  // Enrich workerInsights with communication fallback for backward compatibility
  const workerInsights = useMemo((): AggregatedWorkerInsights | undefined => {
    if (!rawWorkerInsights) return undefined;

    const commDomain = rawWorkerInsights.communicationPatterns;
    const hasWorkerComm = commDomain?.strengths?.length || commDomain?.growthAreas?.length;

    if (hasWorkerComm) return rawWorkerInsights;

    // Merge legacy communication patterns as fallback
    if (communicationInsights.strengths.length > 0 || communicationInsights.growthAreas.length > 0) {
      return {
        ...rawWorkerInsights,
        communicationPatterns: {
          strengths: communicationInsights.strengths as WorkerStrength[],
          growthAreas: communicationInsights.growthAreas as WorkerGrowth[],
          domainScore: commDomain?.domainScore,
          referencedInsights: commDomain?.referencedInsights,
        },
      };
    }

    return rawWorkerInsights;
  }, [rawWorkerInsights, communicationInsights]);

  const translatedAgentInsights = analysis.translatedAgentInsights;

  // Scroll to section handler
  const handleSectionClick = useCallback((sectionId: string) => {
    sectionRefs.get(sectionId)?.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [sectionRefs]);

  // Build utterance lookup map
  const utteranceLookupMap = useMemo(() => {
    const lookup = analysis.utteranceLookup;
    if (!lookup?.length) return undefined;
    const map = new Map<string, UtteranceLookupEntry>();
    for (const entry of lookup) map.set(entry.id, entry);
    return map;
  }, [analysis.utteranceLookup]);

  // Build transformation audit map
  const transformationAuditMap = useMemo(() => {
    const audit = analysis.transformationAudit;
    if (!audit?.length) return undefined;
    const map = new Map<string, TransformationAuditEntry>();
    for (const entry of audit) map.set(entry.utteranceId, entry);
    return map;
  }, [analysis.transformationAudit]);

  // Source Context sidebar state
  const [sourceContext, setSourceContext] = useState<{
    utterance: UtteranceLookupEntry;
    audit?: TransformationAuditEntry;
  } | null>(null);

  const handleViewContext = useCallback((utteranceId: string) => {
    const utterance = utteranceLookupMap?.get(utteranceId);
    if (!utterance) return;
    const audit = transformationAuditMap?.get(utteranceId);
    setSourceContext({ utterance, audit });
  }, [utteranceLookupMap, transformationAuditMap]);

  // ============================================================================
  // Professional Insights Deduplication (Phase 2.75)
  // ============================================================================

  const professionalInsightsByDomain = useMemo(() => {
    const result = new Map<keyof AggregatedWorkerInsights, MatchedProfessionalInsight[]>();
    if (!analysis.knowledgeResources) return result;

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

  const insightAllocation = useMemo(() => {
    const allGrowthWithCandidates: GrowthWithCandidates[] = [];

    const processDomain = (
      domainKey: keyof AggregatedWorkerInsights,
      growthAreas: WorkerGrowth[] | undefined,
      referencedInsights: ReferencedInsight[] | undefined
    ) => {
      if (!growthAreas) return;
      const fallbackInsights = professionalInsightsByDomain.get(domainKey);
      const filteredFallbacks = filterFallbackInsights(fallbackInsights);

      for (const growth of growthAreas) {
        const key = createGrowthKey(domainKey, growth.title);
        const candidates: InsightCandidate[] = [];

        if (referencedInsights?.length) {
          for (const insight of referencedInsights) {
            candidates.push({ insight, matchScore: LLM_REFERENCE_SCORE, source: 'llm' });
          }
        }

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
    const domains: (keyof AggregatedWorkerInsights)[] = [
      'thinkingQuality', 'communicationPatterns', 'learningBehavior',
      'contextEfficiency', 'sessionOutcome',
    ];
    for (const domain of domains) {
      const data = workerInsights?.[domain];
      if (data) {
        processDomain(domain, data.growthAreas, data.referencedInsights);
      }
    }

    return deduplicateInsights(allGrowthWithCandidates);
  }, [workerInsights, professionalInsightsByDomain]);

  // Debug logging (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log('[TabbedReportContainer] Scrollytelling layout:', {
        hasWorkerInsights: !!workerInsights,
        domainCount: workerInsights ? Object.keys(workerInsights).length : 0,
        insightAllocationSize: insightAllocation.size,
        allResourcesLength: allResources.length,
      });
    }
  }, [workerInsights, insightAllocation, allResources.length]);

  return (
    <div className={styles.pageLayout}>
      {/* Floating Progress Dots — narrative section navigation */}
      <FloatingProgressDots
        sections={NARRATIVE_SECTIONS}
        activeSection={activeTab}
        onSectionClick={handleSectionClick}
        visible={navVisible}
        visitedSections={visitedSections}
      />

      {/* Main Content Column */}
      <div className={styles.mainContent}>
        {/* ── Chapter 1: Identity ── */}
        <div ref={identityRef} data-section-id="identity" className={styles.headerSection}>
          <div ref={headerSectionRef}>
            <ReportSummarySection
              analysis={analysis}
              workerInsights={workerInsights}
              reportId={reportId}
            />
          </div>
        </div>

        {/* Scrollytelling Content */}
        <div ref={contentRef} className={styles.scrollContent}>
          {/* ── Narrative: "Your Coding World" ── */}
          <NarrativeMoment
            title="Your Coding World"
            subtitle="A look at how you spend your time with AI"
          />

          {/* ── Chapter 2: Activity ── */}
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

          {/* ── Narrative: "Your Shining Moments" ── */}
          <NarrativeMoment
            title="Your Shining Moments"
            subtitle="What you do exceptionally well across all domains"
          />

          {/* ── Chapter 3: Strengths ── */}
          <div ref={strengthsRef} data-section-id="strengths" className={styles.scrollSection}>
            <StrengthsOverview
              workerInsights={workerInsights}
              translatedAgentInsights={translatedAgentInsights}
              utteranceLookup={analysis.utteranceLookup}
            />
          </div>

          {/* ── Narrative: Dramatic Turn ── */}
          <NarrativeMoment
            title="But..."
            subtitle="Every great developer has blind spots"
            variant="dramatic"
          />

          {/* ── Chapter 4: Growth Areas ── */}
          <div ref={growthRef} data-section-id="growth" className={styles.scrollSection}>
            <DiagnosisOverview
              workerInsights={workerInsights}
              translatedAgentInsights={translatedAgentInsights}
              utteranceLookup={analysis.utteranceLookup}
              insightAllocation={insightAllocation}
            />
          </div>

          {/* ── Cliffhanger Paywall ── */}
          {!isPaid && (
            <CliffhangerWall
              workerInsights={workerInsights}
              resultId={reportId}
              credits={credits}
              onCreditsUsed={onCreditsUsed}
            />
          )}

          {/* PMF Survey Inline Card — after all sections */}
          {reportId && (
            <SurveyInlineCard
              resultId={reportId}
              onExpand={(level) => {
                setEnrichmentLevel(level);
                setEnrichmentOpen(true);
              }}
            />
          )}
        </div>
      </div>

      {/* Resource Sidebar */}
      <aside className={styles.sidebar}>
        {allResources.length > 0 && (
          <ResourceSidebar resources={allResources} />
        )}
      </aside>

      {/* Source Context Sidebar */}
      <SourceContextSidebar
        utterance={sourceContext?.utterance ?? null}
        audit={sourceContext?.audit}
        isOpen={sourceContext !== null}
        onClose={() => setSourceContext(null)}
      />

      {/* Survey Bottom Sheet */}
      {enrichmentOpen && reportId && enrichmentLevel && (
        <SurveyBottomSheet
          resultId={reportId}
          onDismiss={() => setEnrichmentOpen(false)}
          mode="enrichment"
          disappointmentLevel={enrichmentLevel}
        />
      )}
    </div>
  );
}

export default TabbedReportContainer;
