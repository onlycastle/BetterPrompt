/**
 * Public Result Page
 *
 * Displays analysis results from CLI (npx no-ai-slop).
 * Accessed via /r/:resultId - shareable public link.
 */

import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import styles from './PublicResultPage.module.css';

// In Next.js, API routes are served from the same domain

interface ResultData {
  resultId: string;
  isPaid: boolean;
  evaluation: {
    primaryType: string;
    controlLevel?: string;
    distribution: {
      architect: number;
      scientist: number;
      collaborator: number;
      speedrunner: number;
      craftsman: number;
    };
    personalitySummary: string;
    promptPatterns?: Array<{
      patternName: string;
      description: string;
      frequency: string;
    }>;
    dimensionInsights?: Array<{
      dimensionName: string;
      score: number;
      strengths: Array<{ title: string; description: string }>;
      growthAreas: Array<{ title: string; description: string }>;
    }>;
  };
}

const TYPE_META: Record<string, { emoji: string; name: string; tagline: string }> = {
  architect: { emoji: '🏗️', name: 'Architect', tagline: 'Strategic thinker who plans before diving into code' },
  scientist: { emoji: '🔬', name: 'Scientist', tagline: 'Truth-seeker who always verifies AI output' },
  collaborator: { emoji: '🤝', name: 'Collaborator', tagline: 'Partnership master who finds answers through dialogue' },
  speedrunner: { emoji: '⚡', name: 'Speedrunner', tagline: 'Agile executor who delivers through fast iteration' },
  craftsman: { emoji: '🔧', name: 'Craftsman', tagline: 'Artisan who prioritizes code quality above all' },
};

async function fetchResult(resultId: string): Promise<ResultData> {
  const response = await fetch(`/api/analysis/results/${resultId}`);
  if (!response.ok) {
    throw new Error('Result not found');
  }
  return response.json();
}

export function PublicResultPage() {
  const { resultId } = useParams<{ resultId: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ['publicResult', resultId],
    queryFn: () => fetchResult(resultId!),
    enabled: !!resultId,
  });

  if (isLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>
          <div className={styles.spinner} />
          <p>Loading your results...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>
          <div className={styles.errorIcon}>🔍</div>
          <h1>Result Not Found</h1>
          <p>This analysis result may have expired or doesn't exist.</p>
          <a href="https://npmjs.com/package/no-ai-slop" className={styles.ctaButton}>
            Try no-ai-slop yourself
          </a>
        </div>
      </div>
    );
  }

  const { evaluation, isPaid } = data;
  const typeMeta = TYPE_META[evaluation.primaryType] || TYPE_META.collaborator;

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <div className={styles.hero}>
        <div className={styles.typeEmoji}>{typeMeta.emoji}</div>
        <h1 className={styles.typeName}>{typeMeta.name}</h1>
        <p className={styles.typeTagline}>{typeMeta.tagline}</p>
      </div>

      {/* Distribution */}
      <div className={styles.card}>
        <h2>Type Distribution</h2>
        <div className={styles.distribution}>
          {Object.entries(evaluation.distribution).map(([type, percentage]) => {
            const meta = TYPE_META[type];
            const isMain = type === evaluation.primaryType;
            return (
              <div key={type} className={`${styles.barRow} ${isMain ? styles.primary : ''}`}>
                <div className={styles.barLabel}>
                  <span>{meta.emoji}</span>
                  <span>{meta.name}</span>
                </div>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
                <span className={styles.barValue}>{Math.round(percentage)}%</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Summary */}
      <div className={styles.card}>
        <h2>Your AI Collaboration Style</h2>
        <p className={styles.summary}>{evaluation.personalitySummary}</p>
      </div>

      {/* Blurred Premium Content */}
      {!isPaid && (
        <div className={styles.card}>
          <div className={styles.blurredSection}>
            <div className={styles.blurredContent}>
              <h2>Deep Insights</h2>
              <p>Unlock detailed analysis of your prompt patterns, dimension scores, and personalized recommendations.</p>
            </div>
            <div className={styles.unlockOverlay}>
              <button className={styles.unlockButton}>
                🔓 Unlock Full Report
              </button>
              <p className={styles.unlockNote}>One-time purchase</p>
            </div>
          </div>
        </div>
      )}

      {/* Premium Content (if paid) */}
      {isPaid && evaluation.promptPatterns && (
        <div className={styles.card}>
          <h2>Your Prompt Patterns</h2>
          <div className={styles.patterns}>
            {evaluation.promptPatterns.map((pattern, i) => (
              <div key={i} className={styles.patternItem}>
                <h3>{pattern.patternName}</h3>
                <p>{pattern.description}</p>
                <span className={styles.frequency}>{pattern.frequency}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Share & CTA */}
      <div className={styles.footer}>
        <button
          onClick={() => navigator.clipboard.writeText(window.location.href)}
          className={styles.shareButton}
        >
          📋 Copy Link
        </button>
        <a
          href="https://npmjs.com/package/no-ai-slop"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.ctaLink}
        >
          Get your own analysis →
        </a>
      </div>
    </div>
  );
}
