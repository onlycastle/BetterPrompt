/**
 * Content Gateway
 *
 * The open-source runtime no longer has paywalled report sections or tier-based
 * filtering. This module remains as a compatibility wrapper for older call sites
 * and public imports, but it now passes analysis data through unchanged.
 *
 * @module analyzer/content-gateway
 */

import type { VerboseEvaluation } from '../models/verbose-evaluation';
import type { QuickFixResult } from '../models/quick-fix-data';

/**
 * Legacy access labels kept for API compatibility.
 *
 * Self-hosted OSS runs always return full content regardless of this value.
 */
export type Tier = 'free' | 'one_time' | 'pro' | 'enterprise';

/**
 * Compatibility placeholder kept for callers that still import the old policy.
 */
export const TIER_POLICY = {
  accessMode: 'full-access',
} as const;

/**
 * Legacy preview shape. OSS builds do not generate premium previews.
 */
export interface PremiumPreview {
  toolUsageDeepDivePreview?: string[];
  tokenEfficiencyPreview?: string;
  growthRoadmapPreview?: string;
  comparativeInsightsPreview?: string[];
  sessionTrendsPreview?: string[];
  antiPatternsPreview?: {
    count: number;
    healthScore: number;
  };
  criticalThinkingPreview?: {
    strengthCount: number;
    overallScore: number;
  };
  planningPreview?: {
    maturityLevel: string;
    slashPlanUsage?: number;
  };
}

/**
 * Compatibility wrapper that returns full results unchanged.
 */
export class ContentGateway {
  filter(evaluation: VerboseEvaluation, _tier: Tier): VerboseEvaluation {
    return evaluation;
  }

  createPremiumPreview(_evaluation: VerboseEvaluation): PremiumPreview {
    return {};
  }

  filterQuickFixResult(result: QuickFixResult, _tier: Tier): QuickFixResult {
    return result;
  }
}

export function createContentGateway(): ContentGateway {
  return new ContentGateway();
}
