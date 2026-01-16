/**
 * Public Result Page Wrapper
 * Server component for SEO, fetches data directly from Supabase
 */

import { createClient } from '@supabase/supabase-js';
import styles from './PublicResultPage.module.css';
import { ShareButton } from './ShareButton';

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

async function fetchResult(resultId: string): Promise<ResultData | null> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      const missing = [];
      if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
      if (!supabaseKey) missing.push('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY');
      console.error(`Missing environment variables: ${missing.join(', ')}`);
      return null;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('analysis_results')
      .select('evaluation, is_paid')
      .eq('result_id', resultId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      resultId,
      isPaid: data.is_paid,
      evaluation: data.evaluation,
    };
  } catch (error) {
    console.error('Error fetching result:', error);
    return null;
  }
}

interface PublicResultPageWrapperProps {
  resultId: string;
}

export async function PublicResultPageWrapper({ resultId }: PublicResultPageWrapperProps) {
  const data = await fetchResult(resultId);

  if (!data) {
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
                🔓 Unlock Detailed Report
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
        <ShareButton />
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

