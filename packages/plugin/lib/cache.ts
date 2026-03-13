/**
 * Insight Cache
 *
 * Local SQLite cache for user insights at ~/.betterprompt/insight-cache.db.
 * Serves stale data when the server is unreachable, refreshes after
 * each analysis or every 24 hours.
 */

import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { getCacheDbPath } from './config.js';
import { fetchUserSummary, type UserSummary } from './api-client.js';

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheRow {
  user_id: string;
  result_id: string;
  profile_json: string;
  growth_json: string;
  insights_json: string;
  fetched_at: string;
}

let db: Database.Database | null = null;

function getDb(): Database.Database {
  if (db) return db;

  const dbPath = getCacheDbPath();
  mkdirSync(dirname(dbPath), { recursive: true });

  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS cached_insights (
      user_id     TEXT PRIMARY KEY,
      result_id   TEXT NOT NULL,
      profile_json TEXT NOT NULL,
      growth_json  TEXT NOT NULL,
      insights_json TEXT NOT NULL,
      fetched_at   TEXT NOT NULL
    )
  `);

  return db;
}

/**
 * Store a summary in the local cache.
 */
export function setCachedSummary(userId: string, summary: UserSummary): void {
  const database = getDb();

  database
    .prepare(
      `INSERT OR REPLACE INTO cached_insights
       (user_id, result_id, profile_json, growth_json, insights_json, fetched_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      userId,
      summary.resultId,
      JSON.stringify({
        resultId: summary.resultId,
        analyzedAt: summary.analyzedAt,
        profile: summary.profile,
      }),
      JSON.stringify(summary.growthAreas),
      JSON.stringify({
        strengths: summary.strengths,
        antiPatterns: summary.antiPatterns,
        kpt: summary.kpt,
      }),
      new Date().toISOString(),
    );
}

/**
 * Get cached summary. Returns null if not cached.
 */
export function getCachedSummary(userId: string): UserSummary | null {
  const database = getDb();
  const row = database
    .prepare('SELECT * FROM cached_insights WHERE user_id = ?')
    .get(userId) as CacheRow | undefined;

  if (!row) return null;

  const profile = JSON.parse(row.profile_json) as {
    resultId: string;
    analyzedAt: string;
    profile: UserSummary['profile'];
  };
  const growthAreas = JSON.parse(row.growth_json) as UserSummary['growthAreas'];
  const insights = JSON.parse(row.insights_json) as {
    strengths: UserSummary['strengths'];
    antiPatterns: UserSummary['antiPatterns'];
    kpt: UserSummary['kpt'];
  };

  return {
    resultId: profile.resultId,
    analyzedAt: profile.analyzedAt,
    profile: profile.profile,
    growthAreas,
    strengths: insights.strengths,
    antiPatterns: insights.antiPatterns,
    kpt: insights.kpt,
  };
}

/**
 * Check if the cache is stale (older than 24 hours).
 */
export function isCacheStale(userId: string): boolean {
  const database = getDb();
  const row = database
    .prepare('SELECT fetched_at FROM cached_insights WHERE user_id = ?')
    .get(userId) as Pick<CacheRow, 'fetched_at'> | undefined;

  if (!row) return true;

  const fetchedAt = new Date(row.fetched_at).getTime();
  return Date.now() - fetchedAt > CACHE_TTL_MS;
}

/**
 * Get summary with cache-through pattern:
 * 1. Return cached data if fresh
 * 2. Try to refresh from server
 * 3. Return stale cache if server unreachable
 * 4. Return null if no data anywhere
 */
export async function getSummaryWithCache(userId: string): Promise<UserSummary | null> {
  const cached = getCachedSummary(userId);

  // Fresh cache — return immediately
  if (cached && !isCacheStale(userId)) {
    return cached;
  }

  // Try to refresh from server
  try {
    const fresh = await fetchUserSummary();
    if (fresh) {
      setCachedSummary(userId, fresh);
      return fresh;
    }
    // Server returned null (no analysis yet), return stale cache if available
    return cached;
  } catch {
    // Server unreachable — serve stale cache
    return cached;
  }
}

/**
 * Force refresh the cache from the server.
 */
export async function refreshCache(userId: string): Promise<UserSummary | null> {
  const fresh = await fetchUserSummary();
  if (fresh) {
    setCachedSummary(userId, fresh);
  }
  return fresh;
}

/**
 * Close the database connection (for clean shutdown).
 */
export function closeCache(): void {
  if (db) {
    db.close();
    db = null;
  }
}
