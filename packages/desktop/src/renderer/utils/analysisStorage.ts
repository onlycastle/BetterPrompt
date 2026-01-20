/**
 * Analysis Storage
 *
 * Persists completed analysis results to localStorage for the Personal page.
 * Since the desktop app can't easily use cookie-based auth for the user API,
 * we store analysis history locally.
 */

export interface StoredAnalysis {
  resultId: string;
  completedAt: string;
  sessionCount: number;
  projectCount: number;
}

const STORAGE_KEY = 'nomoreaislop_analyses';
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
}
