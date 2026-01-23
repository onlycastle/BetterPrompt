/**
 * Comparison Service
 *
 * Transforms report data into free/premium tier versions for comparison.
 * Used by the comparison page to demonstrate tier differences.
 */

import type { TypeResult } from '@/lib/models/coding-style';
import type { FullAnalysisResult } from '@/lib/analyzer/dimensions/index';
import type { VerboseEvaluation } from '@/lib/models/verbose-evaluation';

// ============================================================================
// Types
// ============================================================================

export interface ReportData {
  reportId: string;
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
  verboseEvaluation?: VerboseEvaluation;
  sessionMetadata?: {
    sessionId?: string;
    durationMinutes?: number;
    messageCount?: number;
    toolCallCount?: number;
  };
}

export interface FreeReportData {
  tier: 'free';
  reportId: string;
  typeResult: TypeResult;
  lockedFeatures: string[];
}

export interface PremiumReportData {
  tier: 'premium';
  reportId: string;
  typeResult: TypeResult;
  dimensions?: FullAnalysisResult;
  verboseEvaluation?: VerboseEvaluation;
  sessionMetadata?: ReportData['sessionMetadata'];
}

export interface ComparisonResult {
  free: FreeReportData;
  premium: PremiumReportData;
  featureComparison: FeatureComparisonItem[];
}

export interface FeatureComparisonItem {
  feature: string;
  description: string;
  free: boolean;
  premium: boolean;
  category: 'analysis' | 'insights' | 'tracking' | 'advanced';
}

// ============================================================================
// Feature Comparison Matrix
// ============================================================================

export const FEATURE_COMPARISON: FeatureComparisonItem[] = [
  {
    feature: 'AI Coding Style Type',
    description: 'Your primary coding style (Architect, Scientist, etc.)',
    free: true,
    premium: true,
    category: 'analysis',
  },
  {
    feature: 'Style Distribution',
    description: 'Percentage breakdown of all 5 coding styles',
    free: true,
    premium: true,
    category: 'analysis',
  },
  {
    feature: 'Personality Summary',
    description: 'Personalized summary of your AI coding personality',
    free: true,
    premium: true,
    category: 'analysis',
  },
  {
    feature: 'Strengths Analysis',
    description: 'Detailed strengths with evidence from your sessions',
    free: true,
    premium: true,
    category: 'analysis',
  },
  {
    feature: 'Growth Areas',
    description: 'Areas for improvement with specific recommendations',
    free: true,
    premium: true,
    category: 'analysis',
  },
  {
    feature: 'Prompt Patterns',
    description: 'Analysis of your prompting style and patterns',
    free: true,
    premium: true,
    category: 'analysis',
  },
  {
    feature: '6 Dimension Deep Dive',
    description: 'AI Collaboration, Prompt Engineering, Burnout Risk, etc.',
    free: false,
    premium: true,
    category: 'insights',
  },
  {
    feature: 'Tool Usage Deep Dive',
    description: 'Detailed analysis of how you use different tools',
    free: false,
    premium: true,
    category: 'insights',
  },
  {
    feature: 'Token Efficiency',
    description: 'Analysis of your token usage and optimization tips',
    free: false,
    premium: true,
    category: 'insights',
  },
  {
    feature: 'Actionable Recommendations',
    description: 'Specific improvement tips for patterns and growth areas',
    free: false,
    premium: true,
    category: 'advanced',
  },
  {
    feature: 'Full AI Agent Analysis',
    description: '7 specialized AI agents analyzing your sessions (vs 2 free)',
    free: false,
    premium: true,
    category: 'advanced',
  },
  {
    feature: 'Full Progress History',
    description: 'Track all analyses over time with skill evolution timeline',
    free: false,
    premium: true,
    category: 'tracking',
  },
];

// ============================================================================
// Transformation Functions
// ============================================================================

/**
 * Transform report data to free tier version
 */
export function transformToFreeTier(report: ReportData): FreeReportData {
  const lockedFeatures = FEATURE_COMPARISON.filter((f) => !f.free).map(
    (f) => f.feature
  );

  return {
    tier: 'free',
    reportId: report.reportId,
    typeResult: report.typeResult,
    lockedFeatures,
  };
}

/**
 * Transform report data to premium tier version
 */
export function transformToPremiumTier(report: ReportData): PremiumReportData {
  return {
    tier: 'premium',
    reportId: report.reportId,
    typeResult: report.typeResult,
    dimensions: report.dimensions,
    verboseEvaluation: report.verboseEvaluation,
    sessionMetadata: report.sessionMetadata,
  };
}

/**
 * Generate comparison result from report data
 */
export function generateComparison(report: ReportData): ComparisonResult {
  return {
    free: transformToFreeTier(report),
    premium: transformToPremiumTier(report),
    featureComparison: FEATURE_COMPARISON,
  };
}

/**
 * Get features by category for display
 */
export function getFeaturesByCategory(): Record<string, FeatureComparisonItem[]> {
  return FEATURE_COMPARISON.reduce(
    (acc, item) => {
      if (!acc[item.category]) {
        acc[item.category] = [];
      }
      acc[item.category].push(item);
      return acc;
    },
    {} as Record<string, FeatureComparisonItem[]>
  );
}

/**
 * Get summary stats for comparison
 */
export function getComparisonStats(): {
  freeFeatureCount: number;
  premiumFeatureCount: number;
  premiumOnlyCount: number;
} {
  const freeFeatureCount = FEATURE_COMPARISON.filter((f) => f.free).length;
  const premiumFeatureCount = FEATURE_COMPARISON.filter((f) => f.premium).length;
  const premiumOnlyCount = FEATURE_COMPARISON.filter(
    (f) => f.premium && !f.free
  ).length;

  return {
    freeFeatureCount,
    premiumFeatureCount,
    premiumOnlyCount,
  };
}
