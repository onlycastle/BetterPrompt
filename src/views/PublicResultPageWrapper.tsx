/**
 * Public Result Page Wrapper
 * Server component for SEO, fetches data directly from Supabase
 * Implements tiered access: FREE users see preview data with blur, PAID users see full data
 */

import { createClient } from '@supabase/supabase-js';
import styles from './PublicResultPage.module.css';
import { UnlockButton } from './UnlockButton';

// ============================================================================
// Preview Configuration (same as API route)
// ============================================================================

const PREVIEW_CONFIG = {
  FULL_ITEMS: 3,      // Number of items to show in full
  PARTIAL_ITEM: true, // Whether to show 4th item truncated
};

function truncateText(text: string): string {
  const halfLength = Math.floor(text.length / 2);
  return text.slice(0, halfLength) + '...';
}

// ============================================================================
// Types
// ============================================================================

interface PromptPattern {
  patternName: string;
  description: string;
  frequency: string;
}

interface DimensionInsight {
  dimensionName: string;
  score: number;
  strengths: Array<{ title: string; description: string }>;
  growthAreas: Array<{ title: string; description: string; recommendation?: string }>;
}

interface Evaluation {
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
  promptPatterns?: PromptPattern[];
  dimensionInsights?: DimensionInsight[];
}

interface PreviewMetadata {
  totalPromptPatterns: number;
  totalGrowthAreas: number;
  previewCount: number;
  hasPartialItem: boolean;
}

interface ResultData {
  resultId: string;
  isPaid: boolean;
  evaluation: Evaluation;
  preview?: PreviewMetadata;
}

const TYPE_META: Record<string, { emoji: string; name: string; tagline: string }> = {
  architect: { emoji: '🏗️', name: 'Architect', tagline: 'Strategic thinker who plans before diving into code' },
  scientist: { emoji: '🔬', name: 'Scientist', tagline: 'Truth-seeker who always verifies AI output' },
  collaborator: { emoji: '🤝', name: 'Collaborator', tagline: 'Partnership master who finds answers through dialogue' },
  speedrunner: { emoji: '⚡', name: 'Speedrunner', tagline: 'Agile executor who delivers through fast iteration' },
  craftsman: { emoji: '🔧', name: 'Craftsman', tagline: 'Artisan who prioritizes code quality above all' },
};

/**
 * Create preview evaluation with limited premium data
 */
function createPreviewEvaluation(evaluation: Evaluation): Evaluation {
  // promptPatterns: 3 full + 4th truncated
  const previewPatterns: PromptPattern[] | undefined = evaluation.promptPatterns?.slice(0, 4).map((pattern, idx) => {
    if (idx < PREVIEW_CONFIG.FULL_ITEMS) {
      return pattern;
    }
    return {
      ...pattern,
      description: truncateText(pattern.description),
    };
  });

  // dimensionInsights: strengths full, growthAreas 3 full + 4th truncated
  const previewDimensionInsights: DimensionInsight[] | undefined = evaluation.dimensionInsights?.map(insight => ({
    ...insight,
    strengths: insight.strengths,
    growthAreas: insight.growthAreas?.slice(0, 4).map((area, idx) => {
      if (idx < PREVIEW_CONFIG.FULL_ITEMS) {
        return area;
      }
      return {
        ...area,
        description: truncateText(area.description),
        recommendation: area.recommendation ? truncateText(area.recommendation) : undefined,
      };
    }),
  }));

  return {
    ...evaluation,
    promptPatterns: previewPatterns,
    dimensionInsights: previewDimensionInsights,
  };
}

/**
 * Calculate preview metadata for display
 */
function getPreviewMetadata(evaluation: Evaluation): PreviewMetadata {
  return {
    totalPromptPatterns: evaluation.promptPatterns?.length || 0,
    totalGrowthAreas: evaluation.dimensionInsights?.reduce(
      (sum, d) => sum + (d.growthAreas?.length || 0), 0
    ) || 0,
    previewCount: PREVIEW_CONFIG.FULL_ITEMS,
    hasPartialItem: PREVIEW_CONFIG.PARTIAL_ITEM,
  };
}

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

    const evaluation = data.evaluation as Evaluation;

    // FREE users: return preview data only
    if (!data.is_paid) {
      return {
        resultId,
        isPaid: false,
        evaluation: createPreviewEvaluation(evaluation),
        preview: getPreviewMetadata(evaluation),
      };
    }

    // PAID users: return full data
    return {
      resultId,
      isPaid: true,
      evaluation,
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

  const { evaluation, isPaid, preview } = data;
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

      {/* Prompt Patterns - Show actual data with blur for unpaid users */}
      {evaluation.promptPatterns && evaluation.promptPatterns.length > 0 && (
        <div className={styles.card}>
          <h2>Your Prompt Patterns</h2>
          <div className={isPaid ? '' : styles.blurredSection}>
            <div className={isPaid ? '' : styles.blurredContent}>
              <div className={styles.patterns}>
                {evaluation.promptPatterns.map((pattern, idx) => (
                  <div key={idx} className={styles.patternItem}>
                    <h3>{pattern.patternName}</h3>
                    <p>{pattern.description}</p>
                    <span className={styles.frequency}>{pattern.frequency}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Unlock overlay for unpaid users */}
            {!isPaid && <UnlockButton resultId={resultId} />}
          </div>

          {/* Additional patterns count */}
          {!isPaid && preview && preview.totalPromptPatterns > (evaluation.promptPatterns?.length || 0) && (
            <p className={styles.moreContent}>
              +{preview.totalPromptPatterns - (evaluation.promptPatterns?.length || 0)} more patterns available
            </p>
          )}
        </div>
      )}

    </div>
  );
}

