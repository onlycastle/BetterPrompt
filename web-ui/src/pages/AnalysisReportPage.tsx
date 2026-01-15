/**
 * Analysis Report Page
 *
 * Terminal-style verbose analysis report viewer.
 * Displays hyper-personalized AI coding analysis with keyboard navigation.
 *
 * Routes:
 * - /analysis/:reportId - Load report from API
 * - /analysis?local=id - Load report from local storage
 */

import { useParams } from 'react-router-dom';
import { useAnalysisReport, TYPE_METADATA } from '../hooks/useAnalysisReport';
import type { VerboseAnalysisData, CodingStyleType, TypeDistribution } from '../hooks/useAnalysisReport';
import { useScrollNavigation } from '../hooks/useScrollNavigation';
import { TerminalWindow, TerminalTabs, TypeResultSection, ShareSection, ReportFooter } from '../components/report';
import { PersonalitySummary, PromptPatterns, DimensionInsights, LockedTeasers } from '../components/verbose';
import '../styles/terminal-theme.css';

// Section tabs configuration
const SECTION_TABS = [
  { id: 'result', label: 'Result' },
  { id: 'personality', label: 'Personality' },
  { id: 'patterns', label: 'Patterns' },
  { id: 'dimensions', label: 'Dimensions' },
  { id: 'premium', label: 'Premium' },
  { id: 'share', label: 'Share' },
];

// Default metrics for TypeResultSection (verbose analysis doesn't compute these)
const DEFAULT_METRICS = {
  avgPromptLength: 0,
  avgFirstPromptLength: 0,
  avgTurnsPerSession: 0,
  questionFrequency: 0,
  modificationRate: 0,
  toolUsageHighlight: '',
};

interface TypeResult {
  primaryType: CodingStyleType;
  distribution: TypeDistribution;
  sessionCount: number;
  analyzedAt: string;
  metrics: typeof DEFAULT_METRICS;
}

/**
 * Build TypeResult from VerboseAnalysisData
 */
function buildTypeResult(data: VerboseAnalysisData): TypeResult {
  return {
    primaryType: data.primaryType,
    distribution: data.distribution,
    sessionCount: data.sessionsAnalyzed,
    analyzedAt: data.analyzedAt,
    metrics: {
      ...DEFAULT_METRICS,
      avgPromptLength: data.avgPromptLength ?? 0,
      avgTurnsPerSession: data.avgTurnsPerSession ?? 0,
    },
  };
}

/**
 * Loading state component
 */
function LoadingState() {
  return (
    <div className="snap-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>⏳</div>
        <div style={{ color: 'var(--neon-cyan)', fontSize: '18px', fontWeight: 600 }}>
          Loading Analysis...
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '8px' }}>
          Preparing your personalized report
        </div>
      </div>
    </div>
  );
}

/**
 * Error state component
 */
function ErrorState({ error }: { error: Error }) {
  return (
    <div className="snap-section" style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ textAlign: 'center', maxWidth: '400px' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>😔</div>
        <h1 style={{ color: 'var(--neon-red)', fontSize: '24px', marginBottom: '12px' }}>
          Analysis Not Found
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px', lineHeight: 1.6 }}>
          {error.message}
        </p>
      </div>
    </div>
  );
}

/**
 * Main Analysis Report Page component
 */
export function AnalysisReportPage() {
  const { reportId } = useParams<{ reportId: string }>();
  const { data, isLoading, error } = useAnalysisReport(reportId);

  const {
    activeSectionIndex,
    scrollToSection,
    containerRef,
  } = useScrollNavigation({
    onSectionChange: (sectionId) => {
      // Update URL hash for deep linking
      if (sectionId) {
        window.history.replaceState(null, '', `#${sectionId}`);
      }
    },
  });

  const handleTabClick = (index: number) => {
    const tab = SECTION_TABS[index];
    if (tab) {
      scrollToSection(tab.id);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="macos-background">
        <TerminalWindow title="NoMoreAISlop — loading...">
          <LoadingState />
        </TerminalWindow>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="macos-background">
        <TerminalWindow title="NoMoreAISlop — error">
          <ErrorState error={error as Error} />
        </TerminalWindow>
      </div>
    );
  }

  // No data state
  if (!data) {
    return null;
  }

  const typeMeta = TYPE_METADATA[data.primaryType];
  const typeResult = buildTypeResult(data);
  const isUnlocked = false; // Premium unlock status (future feature)

  return (
    <div className="macos-background">
      <TerminalWindow title={`NoMoreAISlop — ${typeMeta.name}`}>
        <TerminalTabs
          tabs={SECTION_TABS}
          activeIndex={activeSectionIndex}
          onTabClick={handleTabClick}
        />

        <div
          className="scroll-container"
          ref={containerRef}
        >
          {/* Section 0: Main Result */}
          <section
            className="snap-section"
            data-section="result"
            data-index="0"
          >
            <div className="section-inner">
              <TypeResultSection
                typeResult={typeResult}
                typeMetadata={TYPE_METADATA}
              />
            </div>
          </section>

          {/* Section 1: Personality Summary */}
          <section
            className="snap-section"
            data-section="personality"
            data-index="1"
          >
            <div className="section-inner">
              <div className="section-header">
                <div className="section-icon">🧠</div>
                <h2 className="section-title">Your AI Coding Personality</h2>
                <p className="section-subtitle">
                  A hyper-personalized summary based on {data.sessionsAnalyzed} sessions
                </p>
              </div>
              <PersonalitySummary personalitySummary={data.personalitySummary} />
            </div>
          </section>

          {/* Section 2: Prompt Patterns */}
          <section
            className="snap-section"
            data-section="patterns"
            data-index="2"
          >
            <div className="section-inner">
              <div className="section-header">
                <div className="section-icon">💬</div>
                <h2 className="section-title">Your Prompt Patterns</h2>
                <p className="section-subtitle">
                  Analyzed communication patterns from your AI conversations
                </p>
              </div>
              <PromptPatterns promptPatterns={data.promptPatterns} />
            </div>
          </section>

          {/* Section 3: Dimension Insights */}
          <section
            className="snap-section"
            data-section="dimensions"
            data-index="3"
          >
            <div className="section-inner">
              <DimensionInsights
                dimensionInsights={data.dimensionInsights}
                sessionsAnalyzed={data.sessionsAnalyzed}
                isUnlocked={isUnlocked}
              />
            </div>
          </section>

          {/* Section 4: Premium Content Teasers */}
          <section
            className="snap-section"
            data-section="premium"
            data-index="4"
          >
            <div className="section-inner">
              <LockedTeasers isUnlocked={isUnlocked} />
            </div>
          </section>

          {/* Section 5: Share */}
          <section
            className="snap-section"
            data-section="share"
            data-index="5"
          >
            <div className="section-inner">
              <ShareSection
                typeMeta={typeMeta}
                reportId={reportId}
              />
              <ReportFooter generatedAt={data.analyzedAt} />
            </div>
          </section>
        </div>
      </TerminalWindow>
    </div>
  );
}

export default AnalysisReportPage;
