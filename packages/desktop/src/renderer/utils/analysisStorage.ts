/**
 * Analysis Storage
 *
 * Persists completed analysis results to localStorage for the Personal page.
 * Since the desktop app can't easily use cookie-based auth for the user API,
 * we store analysis history locally.
 *
 * Extended to store full evaluation data for Progress/Insights tabs.
 */

import type { GrowthArea } from '../api/types';

/** Basic stored analysis metadata */
export interface StoredAnalysis {
  resultId: string;
  completedAt: string;
  sessionCount: number;
  projectCount: number;
}

/** Extended stored analysis with full evaluation data */
export interface StoredAnalysisExtended extends StoredAnalysis {
  evaluation?: {
    primaryType: string;
    distribution: Record<string, number>;
    sessionsAnalyzed: number;
    overallScore?: number;
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

