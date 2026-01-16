/**
 * Supabase Client - Convenience Re-exports
 *
 * This module re-exports from the infrastructure layer for
 * backward compatibility. The source of truth is:
 * src/infrastructure/storage/supabase/client.ts
 *
 * @module lib/supabase
 */

export {
  getSupabaseClient as getSupabase,
  getBrowserClient,
  createAnonClient,
  createUserClient,
  isSupabaseConfigured,
  resetSupabaseClient,
  type SupabaseClient,
} from './infrastructure/storage/supabase/client';

// Backward compatibility for existing .client getter pattern
import { getSupabaseClient, getBrowserClient } from './infrastructure/storage/supabase/client';

export const supabase = {
  get client() {
    // Use browser client for cookie-based auth (SSR compatible)
    if (typeof window !== 'undefined') {
      return getBrowserClient();
    }
    return getSupabaseClient();
  },
};
