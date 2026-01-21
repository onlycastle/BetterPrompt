/**
 * Analyze Page
 *
 * Main screen after login - shows session summary, starts analysis,
 * and displays results inline (without navigating to a separate page).
 *
 * Credit System:
 * - Users get 1 free credit on signup
 * - Each "detailed report view" costs 1 credit
 * - Users can purchase more credits if needed
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAnalysis } from '../contexts/AnalysisContext';
import {
  TerminalWindow,
  TypeResultSection,
  DimensionInsightsTerminal,
  TopFocusAreasSection,
  EnhancedPatternCard,
  AgentInsightsSection,
} from '../components/report';
import { LoadingExperience } from '../components/analyze/LoadingExperience';
import { FormattedText } from '../utils/textFormatting';
import { useCredit } from '../api/client';
import type { AnalysisResultResponse } from '../types/report';
import { saveAnalysisExtended, type StoredAnalysisExtended } from '../utils/analysisStorage';
import { extractTypeResult } from '../utils/reportHelpers';
import { REPORT_TYPE_METADATA } from '../types/report';
import styles from './AnalyzePage.module.css';

/**
 * Reusable dimension bar for the preview card
 */
function DimensionBar({ name, percent }: { name: string; percent: number }) {
  return (
    <div className={styles.dimensionRow}>
      <span className={styles.dimensionName}>{name}</span>
      <div className={styles.dimensionTrack}>
        <div className={styles.dimensionFill} style={{ width: `${percent}%` }} />
      </div>
      <span className={styles.dimensionValue}>???</span>
    </div>
  );
}

interface AnalyzePageProps {
  /** Optional: pre-populated resultId from deep link */
  initialResultId?: string | null;
}

export default function AnalyzePage({ initialResultId }: AnalyzePageProps) {
  const { user, session } = useAuth();
  const {
    scanSummary,
    scanError,
    analysisProgress,
    analysisError,
    currentPhase,
    scanSessions,
    startFullAnalysis,
    resetPhase,
  } = useAnalysis();

  // View mode: 'analyze' or 'report'
  const [viewMode, setViewMode] = useState<'analyze' | 'report'>(
    initialResultId ? 'report' : 'analyze'
  );

  // Result state (moved from ResultsPage)
  const [resultId, setResultId] = useState<string | null>(initialResultId ?? null);
  const [result, setResult] = useState<AnalysisResultResponse | null>(null);
  const [isLoadingResult, setIsLoadingResult] = useState(false);
  const [resultError, setResultError] = useState<string | null>(null);

  // Credit/payment state
  const [credits, setCredits] = useState<number | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Fetch result function (reusable for initial load and refresh after payment)
  const fetchResult = useCallback(async (id: string) => {
    const url = `${import.meta.env.VITE_APP_URL}/api/analysis/results/${id}`;
    console.log('[AnalyzePage] Fetching result:', url);

    try {
      setIsLoadingResult(true);
      setResultError(null);

      const headers: HeadersInit = {};
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(url, { headers });
      const contentType = response.headers.get('content-type') || '';

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[AnalyzePage] Error response:', {
          status: response.status,
          body: errorText.slice(0, 300),
        });
        throw new Error(`Failed to load result: ${response.status}`);
      }

      if (!contentType.includes('application/json')) {
        const rawText = await response.text();
        console.error('[AnalyzePage] Unexpected Content-Type:', {
          contentType,
          body: rawText.slice(0, 300),
        });
        throw new Error(`Unexpected response format: ${contentType}`);
      }

      const text = await response.text();
      const data = JSON.parse(text);

      console.log('[AnalyzePage] Result loaded:', {
        isPaid: data.isPaid,
        resultId: data.resultId,
        hasEvaluation: !!data.evaluation,
        credits: data.credits,
      });

      setResult(data);
      if (data.credits !== undefined) {
        setCredits(data.credits);
      }

      // Save to extended storage for Personal page Progress/Insights
      if (data.isPaid && data.evaluation) {
        const extendedAnalysis: StoredAnalysisExtended = {
          resultId: id,
          completedAt: data.evaluation.analyzedAt || new Date().toISOString(),
          sessionCount: data.evaluation.sessionsAnalyzed || 0,
          projectCount: data.evaluation.analyzedSessions?.length || 0,
          evaluation: {
            primaryType: data.evaluation.primaryType,
            distribution: data.evaluation.distribution || {},
            sessionsAnalyzed: data.evaluation.sessionsAnalyzed || 0,
            overallScore: data.evaluation.overallScore,
            dimensionInsights: data.evaluation.dimensionInsights,
            strengths: data.evaluation.strengths,
            growthAreas: data.evaluation.growthAreas,
          },
        };
        saveAnalysisExtended(extendedAnalysis);
        console.log('[AnalyzePage] Saved extended analysis to storage');
      }
    } catch (err) {
      console.error('[AnalyzePage] Fetch error:', err);
      setResultError((err as Error).message);
    } finally {
      setIsLoadingResult(false);
    }
  }, [session?.access_token]);

  // Fetch result when initialResultId is provided
  useEffect(() => {
    if (initialResultId && viewMode === 'report') {
      fetchResult(initialResultId);
    }
  }, [initialResultId, viewMode, fetchResult]);

  // Listen for payment success deep link
  useEffect(() => {
    if (!resultId) return;

    const unsubscribe = window.electronAPI.onDeepLink((data) => {
      if (data.route === 'payment-success' && data.params.resultId === resultId) {
        console.log('[AnalyzePage] Payment success - refreshing result...');
        fetchResult(resultId);
      }
    });

    return unsubscribe;
  }, [resultId, fetchResult]);

  // Handle starting full analysis (scan + analyze in one action)
  const handleStartAnalysis = async () => {
    if (!user) return;

    // Use combined action that scans then analyzes
    const newResultId = await startFullAnalysis(user.id, session?.access_token);
    if (newResultId) {
      setResultId(newResultId);
      await fetchResult(newResultId);

      // Scroll to top smoothly
      window.scrollTo({ top: 0, behavior: 'smooth' });

      // Switch to report view
      setViewMode('report');
    }
  };

  // Handle using a credit to unlock
  const handleUseCredit = async () => {
    if (!session?.access_token || !resultId) {
      setResultError('Please sign in to use credits');
      return;
    }

    setIsUnlocking(true);
    try {
      const useCreditResult = await useCredit(resultId, session.access_token);

      if (useCreditResult.success) {
        console.log('[AnalyzePage] Credit used. Remaining:', useCreditResult.creditsRemaining);
        setCredits(useCreditResult.creditsRemaining);
        await fetchResult(resultId);
      } else if (useCreditResult.reason === 'insufficient_credits') {
        handleCheckout();
      }
    } catch (err) {
      setResultError((err as Error).message);
    } finally {
      setIsUnlocking(false);
    }
  };

  // Handle checkout (buy credits)
  const handleCheckout = async () => {
    if (!resultId) return;

    setIsCheckingOut(true);
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_APP_URL}/api/payments/checkout`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            resultId,
            desktopApp: true,
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();
      await window.electronAPI.openCheckout({ checkoutUrl });
    } catch (err) {
      setResultError((err as Error).message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  // Handle new analysis (reset to analyze view)
  const handleNewAnalysis = () => {
    setViewMode('analyze');
    setResultId(null);
    setResult(null);
    setResultError(null);
    setCredits(null);
    // Rescan sessions for fresh data
    scanSessions();
  };

  // ============================================
  // Render: Analyze View
  // ============================================
  function renderAnalyzeView() {
    const isLoading = currentPhase === 'scanning' || currentPhase === 'analyzing';

    // Show LoadingExperience during scanning or analyzing
    if (isLoading) {
      return (
        <main className={styles.main}>
          <LoadingExperience
            phase={currentPhase as 'scanning' | 'analyzing'}
            progress={analysisProgress}
            sessionCount={scanSummary?.sessionCount}
          />
          {(scanError || analysisError) && (
            <div className={styles.errorSection}>
              <p className={styles.error}>{scanError || analysisError}</p>
              <button
                className={styles.retryButton}
                onClick={() => {
                  resetPhase();
                }}
              >
                Try Again
              </button>
            </div>
          )}
        </main>
      );
    }

    // Initial state: Show CTA with preview teaser
    return (
      <main className={styles.main}>
        <h1 className={styles.title}>Know your AI mastery in 5 minutes</h1>
        <p className={styles.subtitle}>
          Based on your real conversations, not a quiz
        </p>

        {/* Privacy notice */}
        <div className={styles.privacyNotice}>
          Analyzed in the cloud, <strong>never stored</strong> — your sessions stay yours
        </div>

        {/* Preview teaser card */}
        <div className={styles.sessionSection}>
          {renderPreviewTeaser()}
        </div>

        {/* Single CTA button */}
        <div className={styles.analyzeSection}>
          <button
            className={styles.analyzeButton}
            onClick={handleStartAnalysis}
            disabled={!user}
          >
            Get My Report
          </button>

          {(scanError || analysisError) && (
            <p className={styles.error}>{scanError || analysisError}</p>
          )}
        </div>
      </main>
    );
  }

  /**
   * Preview teaser shown in initial state (before clicking Get My Report)
   */
  function renderPreviewTeaser() {
    return (
      <div className={styles.previewCard}>
        {/* Radar chart preview */}
        <div className={styles.radarPreview}>
          <svg viewBox="0 0 200 200" className={styles.radarChart}>
            <polygon
              className={styles.radarGrid}
              points="100,20 166,50 166,130 100,160 34,130 34,50"
            />
            <polygon
              className={styles.radarGrid}
              points="100,40 146,60 146,120 100,140 54,120 54,60"
            />
            <polygon
              className={styles.radarGrid}
              points="100,60 126,70 126,110 100,120 74,110 74,70"
            />
            <polygon
              className={styles.radarShape}
              points="100,35 150,55 160,115 100,145 50,100 45,55"
            />
            <circle cx="100" cy="90" r="3" className={styles.radarCenter} />
          </svg>
          <div className={styles.radarBlur} />
        </div>

        {/* Type hint */}
        <div className={styles.typeHint}>
          <p className={styles.typeLabel}>You might be a...</p>
          <p className={styles.typeName}>
            <span className={styles.typeBlurred}>The Architect</span>
          </p>
        </div>

        {/* Dimension bars */}
        <div className={styles.dimensionBars}>
          <DimensionBar name="AI Control" percent={75} />
          <DimensionBar name="Context Quality" percent={60} />
          <DimensionBar name="Planning" percent={85} />
          <div className={styles.dimensionFade}>
            <DimensionBar name="Tool Mastery" percent={45} />
            <DimensionBar name="+ 2 more" percent={70} />
          </div>
        </div>

        <p className={styles.previewSubtext}>Based on your real chat history</p>
      </div>
    );
  }

  // ============================================
  // Render: Report View
  // ============================================
  function renderReportView() {
    const evaluation = result?.evaluation;
    const isPaid = result?.isPaid ?? false;
    const typeResult = extractTypeResult(evaluation);

    return (
      <main className={styles.mainReport}>
        <TerminalWindow
          title="NoMoreAISlop — analysis-report.html"
          variant="inline"
          onNewAnalysis={handleNewAnalysis}
        >
          {isLoadingResult ? (
            <div className={styles.reportLoading}>
              <div className={styles.spinner} />
              <p>Loading results...</p>
            </div>
          ) : resultError ? (
            <div className={styles.reportError}>
              <p>Error: {resultError}</p>
              <button onClick={handleNewAnalysis}>Try Again</button>
            </div>
          ) : (
            <div className={styles.reportContent}>
              {/* Type Result Section */}
              {typeResult && (
                <TypeResultSection
                  typeResult={typeResult}
                  typeMetadata={REPORT_TYPE_METADATA}
                />
              )}

              {/* Personality Summary */}
              {evaluation?.personalitySummary && (
                <div className={styles.summarySection}>
                  <h2 className={styles.sectionTitle}>📝 Personality Summary</h2>
                  <FormattedText
                    text={evaluation.personalitySummary}
                    as="p"
                    className={styles.summaryText}
                  />
                </div>
              )}

              {/* Unlock Section */}
              {!isPaid && (
                <div className={styles.unlockSection}>
                  <h2 className={styles.unlockTitle}>🔓 Unlock Full Analysis</h2>
                  <p className={styles.unlockDescription}>
                    Get access to detailed prompt patterns, growth areas, and
                    personalized recommendations.
                  </p>

                  <ul className={styles.featureList}>
                    <li>🎯 {result?.preview?.totalPromptPatterns || 0} unique prompt patterns analyzed</li>
                    <li>🌱 {result?.preview?.totalGrowthAreas || 0} personalized growth areas</li>
                    <li>📊 Full dimension breakdowns with detailed metrics</li>
                    <li>💡 Actionable recommendations for each area</li>
                  </ul>

                  {credits !== null && (
                    <div className={styles.creditBalance}>
                      <span className={styles.creditIcon}>🎟️</span>
                      <span className={styles.creditCount}>
                        {credits} credit{credits !== 1 ? 's' : ''} remaining
                      </span>
                    </div>
                  )}

                  {credits !== null && credits > 0 ? (
                    <button
                      className={styles.unlockButton}
                      onClick={handleUseCredit}
                      disabled={isUnlocking}
                    >
                      {isUnlocking ? 'Unlocking...' : 'Use 1 Credit to Unlock'}
                    </button>
                  ) : (
                    <button
                      className={styles.checkoutButton}
                      onClick={handleCheckout}
                      disabled={isCheckingOut}
                    >
                      {isCheckingOut ? 'Opening checkout...' : 'Buy Credits ($4.99)'}
                    </button>
                  )}
                </div>
              )}

              {/* Full Results (when paid) */}
              {isPaid && evaluation && (
                <div className={styles.fullResults}>
                  {/* Strengths */}
                  {evaluation.strengths && evaluation.strengths.length > 0 && (
                    <div className={styles.strengthsSection}>
                      <h2 className={styles.sectionTitle}>✨ Your Strengths</h2>
                      {evaluation.strengths.map((strength, i) => (
                        <div key={i} className={styles.strengthCard}>
                          <h3>{strength.title}</h3>
                          <FormattedText text={strength.description} as="p" />
                          {strength.evidence && strength.evidence.length > 0 && (
                            <div className={styles.evidenceList}>
                              {strength.evidence.slice(0, 2).map((ev, j) => (
                                <blockquote key={j} className={styles.evidence}>
                                  "{ev.quote}"
                                  <cite>{ev.context}</cite>
                                </blockquote>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Growth Areas */}
                  {evaluation.growthAreas && evaluation.growthAreas.length > 0 && (
                    <div className={styles.growthSection}>
                      <h2 className={styles.sectionTitle}>🌱 Growth Areas</h2>
                      {evaluation.growthAreas.map((area, i) => (
                        <div key={i} className={styles.growthCard}>
                          <h3>{area.title}</h3>
                          <FormattedText text={area.description} as="p" />
                          {area.recommendation && (
                            <div className={styles.recommendation}>
                              <strong>💡 Recommendation:</strong>{' '}
                              <FormattedText text={area.recommendation} />
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Top 3 Focus Areas - Most actionable section */}
                  {evaluation.topFocusAreas && (
                    <TopFocusAreasSection focusAreas={evaluation.topFocusAreas} />
                  )}

                  {/* Prompt Patterns - Enhanced with full examples and tips */}
                  {evaluation.promptPatterns && evaluation.promptPatterns.length > 0 && (
                    <div className={styles.patternsSection}>
                      <h2 className={styles.sectionTitle}>🎯 Prompt Patterns</h2>
                      {evaluation.promptPatterns.map((pattern, i) => (
                        <EnhancedPatternCard
                          key={i}
                          pattern={pattern}
                          index={i}
                        />
                      ))}
                    </div>
                  )}

                  {/* Dimension Insights */}
                  {evaluation.dimensionInsights && evaluation.dimensionInsights.length > 0 && (
                    <DimensionInsightsTerminal
                      insights={evaluation.dimensionInsights}
                      sessionsAnalyzed={evaluation.sessionsAnalyzed}
                    />
                  )}

                  {/* Agent Insights - 4 Wow Agents (Premium only) */}
                  {evaluation.agentOutputs && (
                    <AgentInsightsSection agentOutputs={evaluation.agentOutputs} />
                  )}
                </div>
              )}
            </div>
          )}
        </TerminalWindow>
      </main>
    );
  }

  // ============================================
  // Main Render
  // ============================================
  return (
    <div className={styles.container}>
      {viewMode === 'analyze' ? renderAnalyzeView() : renderReportView()}
    </div>
  );
}
