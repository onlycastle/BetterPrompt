/**
 * Results Page
 *
 * Displays analysis results with blur/unlock based on payment status.
 * Uses web app report components for consistent design.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import {
  TerminalWindow,
  TypeResultSection,
  AnalyzedSessions,
  ReportFooter,
} from '../components/report';
import type {
  VerboseEvaluation,
  AnalysisResultResponse,
} from '../types/report';
import { REPORT_TYPE_METADATA } from '../types/report';
import styles from './ResultsPage.module.css';

interface ResultsPageProps {
  resultId: string;
  onBack: () => void;
}

export default function ResultsPage({ resultId, onBack }: ResultsPageProps) {
  const { session } = useAuth();
  const [result, setResult] = useState<AnalysisResultResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  // Fetch result function (reusable for initial load and refresh after payment)
  const fetchResult = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/analysis/results/${resultId}`
      );

      if (!response.ok) {
        throw new Error('Failed to load result');
      }

      const data = await response.json();
      setResult(data);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  }, [resultId]);

  // Fetch result on mount
  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  // Listen for payment success deep link to refresh result
  useEffect(() => {
    const unsubscribe = window.electronAPI.onDeepLink((data) => {
      if (
        data.route === 'payment-success' &&
        data.params.resultId === resultId
      ) {
        console.log('Payment success received for current result, refreshing...');
        fetchResult();
      }
    });

    return unsubscribe;
  }, [resultId, fetchResult]);

  // Handle checkout
  const handleCheckout = async () => {
    setIsCheckingOut(true);

    try {
      // Build headers with auth token
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/payments/checkout`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            resultId,
            desktopApp: true, // Enable deep link redirect
          }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to create checkout');
      }

      const { checkoutUrl } = await response.json();

      // Open checkout in browser
      await window.electronAPI.openCheckout({ checkoutUrl });
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.dragRegion} />
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading results...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.dragRegion} />
        <div className={styles.error}>
          <p>Error: {error}</p>
          <button onClick={onBack}>Go Back</button>
        </div>
      </div>
    );
  }

  const evaluation = result?.evaluation;
  const isPaid = result?.isPaid ?? false;

  // Construct typeResult for TypeResultSection
  const typeResult = evaluation
    ? {
        primaryType: evaluation.primaryType,
        distribution: evaluation.distribution,
        sessionCount: evaluation.sessionsAnalyzed,
        analyzedAt: evaluation.analyzedAt,
        metrics: {
          avgPromptLength: evaluation.avgPromptLength || 0,
          avgFirstPromptLength: 0,
          avgTurnsPerSession: evaluation.avgTurnsPerSession || 0,
          questionFrequency: 0,
          modificationRate: 0,
          toolUsageHighlight: '',
        },
      }
    : null;

  return (
    <div className={styles.container}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onBack}>
          ← Back
        </button>
        <h1 className={styles.pageTitle}>Analysis Results</h1>
        <div className={styles.spacer} />
      </header>

      {/* Results */}
      <main className={styles.main}>
        <TerminalWindow title="NoMoreAISlop — analysis-report.html">
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
                <p className={styles.summaryText}>{evaluation.personalitySummary}</p>
              </div>
            )}

            {/* Analyzed Sessions */}
            <AnalyzedSessions sessions={evaluation?.analyzedSessions} />

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

                <button
                  className={styles.checkoutButton}
                  onClick={handleCheckout}
                  disabled={isCheckingOut}
                >
                  {isCheckingOut ? 'Opening checkout...' : 'Unlock for $4.99'}
                </button>
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
                        <p>{strength.description}</p>
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
                        <p>{area.description}</p>
                        {area.recommendation && (
                          <div className={styles.recommendation}>
                            <strong>💡 Recommendation:</strong> {area.recommendation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Prompt Patterns */}
                {evaluation.promptPatterns && evaluation.promptPatterns.length > 0 && (
                  <div className={styles.patternsSection}>
                    <h2 className={styles.sectionTitle}>🎯 Prompt Patterns</h2>
                    {evaluation.promptPatterns.map((pattern, i) => (
                      <div key={i} className={styles.patternCard}>
                        <div className={styles.patternHeader}>
                          <span className={styles.patternName}>{pattern.patternName}</span>
                          <span className={`${styles.frequency} ${styles[pattern.frequency]}`}>
                            {pattern.frequency}
                          </span>
                        </div>
                        <p>{pattern.description}</p>
                        {pattern.examples && pattern.examples.length > 0 && (
                          <div className={styles.exampleList}>
                            {pattern.examples.slice(0, 2).map((ex, j) => (
                              <div key={j} className={styles.example}>
                                <code>"{ex.quote}"</code>
                                <span>{ex.analysis}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <ReportFooter />
          </div>
        </TerminalWindow>
      </main>
    </div>
  );
}
