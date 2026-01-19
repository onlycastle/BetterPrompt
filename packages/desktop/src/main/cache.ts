/**
 * Analysis Cache - Local caching for analysis results
 *
 * Saves analysis results to avoid repeated API costs during testing/development.
 * Uses electron-store for encrypted local storage.
 *
 * Based on CLI package implementation, adapted for Electron.
 */

import Store from 'electron-store';
import type { AnalysisResult } from './uploader';

// Separate store for analysis cache
const cacheStore = new Store({
  name: 'nomoreaislop-cache',
  encryptionKey: 'nomoreaislop-cache-key', // Consistent with main store
});

interface AnalysisCache {
  version: 2;
  createdAt: string;
  result: AnalysisResult;
}

/**
 * Save analysis result to cache
 */
export function saveCache(result: AnalysisResult): void {
  const cache: AnalysisCache = {
    version: 2,
    createdAt: new Date().toISOString(),
    result,
  };

  cacheStore.set('analysisCache', cache);
  console.log('[Cache] Analysis result saved');
}

/**
 * Load analysis result from cache
 * Returns null if cache doesn't exist or is invalid
 */
export function loadCache(): AnalysisResult | null {
  try {
    const cache = cacheStore.get('analysisCache') as AnalysisCache | undefined;

    if (!cache) {
      console.log('[Cache] No cached analysis found');
      return null;
    }

    // Validate version
    if (cache.version !== 2) {
      console.log('[Cache] Version mismatch, cache invalidated');
      cacheStore.delete('analysisCache');
      return null;
    }

    const cacheAge = Date.now() - new Date(cache.createdAt).getTime();
    const ageMinutes = Math.round(cacheAge / 60000);
    console.log(`[Cache] Using cached analysis (${ageMinutes} minutes old)`);

    return cache.result;
  } catch (error) {
    console.error('[Cache] Error loading cache:', error);
    return null;
  }
}

/**
 * Clear the analysis cache
 */
export function clearCache(): void {
  cacheStore.delete('analysisCache');
  console.log('[Cache] Analysis cache cleared');
}

/**
 * Get cache info without loading full result
 */
export function getCacheInfo(): { exists: boolean; ageMinutes?: number; createdAt?: string } | null {
  try {
    const cache = cacheStore.get('analysisCache') as AnalysisCache | undefined;

    if (!cache) {
      return { exists: false };
    }

    const cacheAge = Date.now() - new Date(cache.createdAt).getTime();
    const ageMinutes = Math.round(cacheAge / 60000);

    return {
      exists: true,
      ageMinutes,
      createdAt: cache.createdAt,
    };
  } catch {
    return null;
  }
}
