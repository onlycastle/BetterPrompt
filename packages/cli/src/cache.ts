/**
 * Analysis Cache - Local caching for analysis results
 *
 * Saves analysis results to avoid repeated API costs during testing.
 * Cache location: ~/.nomoreaislop/analysis-cache.json
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';
import pc from 'picocolors';
import type { AnalysisResult } from './uploader.js';

const CACHE_DIR = join(homedir(), '.nomoreaislop');
const CACHE_FILE = join(CACHE_DIR, 'analysis-cache.json');

interface AnalysisCache {
  version: 2;
  createdAt: string;
  result: AnalysisResult;
}

/**
 * Save analysis result to cache
 */
export async function saveCache(result: AnalysisResult): Promise<void> {
  await mkdir(CACHE_DIR, { recursive: true });

  const cache: AnalysisCache = {
    version: 2,
    createdAt: new Date().toISOString(),
    result,
  };

  await writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  console.log(pc.dim(`  Cache saved to ${CACHE_FILE}`));
}

/**
 * Load analysis result from cache
 * Returns null if cache doesn't exist or is invalid
 */
export async function loadCache(): Promise<AnalysisResult | null> {
  try {
    const content = await readFile(CACHE_FILE, 'utf-8');
    const cache: AnalysisCache = JSON.parse(content);

    // Validate version
    if (cache.version !== 2) {
      console.log(pc.yellow('  Cache version mismatch, will analyze fresh'));
      return null;
    }

    const cacheAge = Date.now() - new Date(cache.createdAt).getTime();
    const ageMinutes = Math.round(cacheAge / 60000);
    console.log(pc.green(`  Using cached analysis (${ageMinutes} minutes old)`));

    return cache.result;
  } catch {
    return null;
  }
}

/**
 * Display help message for cache flags
 */
export function displayCacheHelp(): void {
  console.log('');
  console.log(pc.bold('Cache Options:'));
  console.log('  --save-cache    Save analysis result to local cache');
  console.log('  --use-cache     Use cached analysis result (skip API call)');
  console.log('');
  console.log(pc.dim(`Cache location: ${CACHE_FILE}`));
}
