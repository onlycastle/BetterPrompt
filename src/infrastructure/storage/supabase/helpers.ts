/**
 * Supabase Repository Helpers
 *
 * Common utility functions for Supabase repositories.
 * Extracts repeated patterns to reduce duplication.
 *
 * @module infrastructure/storage/supabase/helpers
 */

import { err, type Result } from '../../../lib/result.js';
import { StorageError } from '../../../domain/errors/index.js';

/**
 * Extract error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown error';
}

/**
 * Check if Supabase error indicates not found
 * PGRST116 is the PostgREST code for "no rows returned"
 */
export function isNotFoundError(error: { code?: string }): boolean {
  return error.code === 'PGRST116';
}

/**
 * Calculate whether there are more results beyond current page
 */
export function hasMoreResults(total: number | null, offset: number, limit: number): boolean {
  return (total ?? 0) > offset + limit;
}

/**
 * Wrap a Supabase operation with standard error handling
 * Returns connection error on exception
 */
export async function withConnectionHandler<T>(
  operation: () => Promise<T>
): Promise<T | Result<never, StorageError>> {
  try {
    return await operation();
  } catch (e) {
    return err(StorageError.connectionFailed('Supabase', getErrorMessage(e)));
  }
}

/**
 * Generate random hex string of specified byte length
 */
export function generateHexToken(bytes: number): string {
  const randomBytes = new Uint8Array(bytes);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate short ID (8 hex chars / 4 bytes)
 */
export function generateShortId(): string {
  return generateHexToken(4);
}

/**
 * Generate access token (16 hex chars / 8 bytes)
 */
export function generateAccessToken(): string {
  return generateHexToken(8);
}

/**
 * Get first day of current month as ISO string
 */
export function getFirstOfMonth(): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
}

/**
 * Get first day of next month as ISO string
 */
export function getFirstOfNextMonth(): string {
  const resetDate = new Date();
  resetDate.setMonth(resetDate.getMonth() + 1, 1);
  resetDate.setHours(0, 0, 0, 0);
  return resetDate.toISOString();
}

/**
 * Build pagination range from options
 */
export function getPaginationRange(
  options?: { limit?: number; offset?: number }
): { limit: number; offset: number; end: number } {
  const limit = options?.limit ?? 20;
  const offset = options?.offset ?? 0;
  return { limit, offset, end: offset + limit - 1 };
}
