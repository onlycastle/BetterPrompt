/**
 * Analysis Storage
 *
 * Persists completed analysis results to localStorage for the Personal page.
 * Since the desktop app can't easily use cookie-based auth for the user API,
 * we store analysis history locally.
 *
 * Extended to store full evaluation data for Progress/Insights tabs.
 */

import type { DimensionScores, GrowthArea } from '../api/types';

/** Basic stored analysis metadata */
export interface StoredAnalysis {
  resultId: string;
  completedAt: string;
  sessionCount: number;
  projectCount: number;
}

/** Dimension insight from verbose analysis */
export interface StoredDimensionInsight {
  dimensionKey: string;
  score: number;
  strengths: Array<{ title: string; description: string }>;
  growthAreas: Array<{ title: string; description: string; recommendation?: string }>;
}

/** Extended stored analysis with full evaluation data */
export interface StoredAnalysisExtended extends StoredAnalysis {
  evaluation?: {
    primaryType: string;
    distribution: Record<string, number>;
    sessionsAnalyzed: number;
    overallScore?: number;
    dimensionInsights?: StoredDimensionInsight[];
    strengths?: Array<{ title: string; description: string }>;
    growthAreas?: GrowthArea[];
  };
}

const STORAGE_KEY = 'nomoreaislop_analyses';
const STORAGE_KEY_EXTENDED = 'nomoreaislop_analyses_v2';
const MAX_STORED = 20;

/**
 * Get all stored analyses, newest first
 */
export function getStoredAnalyses(): StoredAnalysis[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as StoredAnalysis[];
  } catch {
    return [];
  }
}

/**
 * Save a new analysis result
 */
export function saveAnalysis(analysis: StoredAnalysis): void {
  try {
    const existing = getStoredAnalyses();

    // Remove duplicate if exists
    const filtered = existing.filter((a) => a.resultId !== analysis.resultId);

    // Add new at the beginning
    const updated = [analysis, ...filtered].slice(0, MAX_STORED);

    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.error('[AnalysisStorage] Failed to save:', error);
  }
}

/**
 * Get the most recent analysis
 */
export function getLatestAnalysis(): StoredAnalysis | null {
  const analyses = getStoredAnalyses();
  return analyses[0] || null;
}

/**
 * Clear all stored analyses
 */
export function clearStoredAnalyses(): void {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STORAGE_KEY_EXTENDED);
}

// ============================================
// Extended Storage (for Progress/Insights)
// ============================================

/**
 * Get all stored analyses with evaluation data, newest first
 */
export function getStoredAnalysesExtended(): StoredAnalysisExtended[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_EXTENDED);
    if (!raw) {
      // Try to migrate from legacy storage
      const legacy = getStoredAnalyses();
      if (legacy.length > 0) {
        return legacy.map((a) => ({ ...a }));
      }
      return [];
    }
    return JSON.parse(raw) as StoredAnalysisExtended[];
  } catch {
    return [];
  }
}

/**
 * Save an analysis with full evaluation data
 */
export function saveAnalysisExtended(analysis: StoredAnalysisExtended): void {
  try {
    const existing = getStoredAnalysesExtended();

    // Remove duplicate if exists
    const filtered = existing.filter((a) => a.resultId !== analysis.resultId);

    // Add new at the beginning
    const updated = [analysis, ...filtered].slice(0, MAX_STORED);

    localStorage.setItem(STORAGE_KEY_EXTENDED, JSON.stringify(updated));

    // Also save to legacy storage for backwards compatibility
    saveAnalysis({
      resultId: analysis.resultId,
      completedAt: analysis.completedAt,
      sessionCount: analysis.sessionCount,
      projectCount: analysis.projectCount,
    });
  } catch (error) {
    console.error('[AnalysisStorage] Failed to save extended:', error);
  }
}

/**
 * Get the most recent analysis with evaluation
 */
export function getLatestAnalysisExtended(): StoredAnalysisExtended | null {
  const analyses = getStoredAnalysesExtended();
  return analyses[0] || null;
}

/**
 * Extract dimension scores from dimension insights
 */
export function extractDimensionScores(
  insights?: StoredDimensionInsight[]
): DimensionScores | undefined {
  if (!insights || insights.length === 0) return undefined;

  const scores: Partial<DimensionScores> = {};
  for (const insight of insights) {
    const key = insight.dimensionKey as keyof DimensionScores;
    if (key in scores || !['aiCollaboration', 'contextEngineering', 'burnoutRisk', 'toolMastery', 'aiControl', 'skillResilience'].includes(key)) {
      continue;
    }
    scores[key] = insight.score;
  }

  // Return undefined if we don't have all 6 dimensions
  if (Object.keys(scores).length < 6) return undefined;

  return scores as DimensionScores;
}

/**
 * Calculate overall score from dimension insights
 */
export function calculateOverallScore(insights?: StoredDimensionInsight[]): number {
  if (!insights || insights.length === 0) return 0;
  const total = insights.reduce((sum, i) => sum + i.score, 0);
  return Math.round(total / insights.length);
}
