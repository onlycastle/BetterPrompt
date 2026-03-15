/**
 * Insight Cache
 *
 * Local SQLite cache for user insights at ~/.betterprompt/insight-cache.db.
 * Serves stale data when the server is unreachable, refreshes after
 * each analysis or every 24 hours.
 */
import { type UserSummary } from './api-client.js';
/**
 * Store a summary in the local cache.
 */
export declare function setCachedSummary(userId: string, summary: UserSummary): void;
/**
 * Get cached summary. Returns null if not cached.
 */
export declare function getCachedSummary(userId: string): UserSummary | null;
/**
 * Check if the cache is stale (older than 24 hours).
 */
export declare function isCacheStale(userId: string): boolean;
/**
 * Get summary with cache-through pattern:
 * 1. Return cached data if fresh
 * 2. Try to refresh from server
 * 3. Return stale cache if server unreachable
 * 4. Return null if no data anywhere
 */
export declare function getSummaryWithCache(userId: string): Promise<UserSummary | null>;
/**
 * Force refresh the cache from the server.
 */
export declare function refreshCache(userId: string): Promise<UserSummary | null>;
/**
 * Close the database connection (for clean shutdown).
 */
export declare function closeCache(): void;
