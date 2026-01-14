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
  createAnonClient,
  createUserClient,
  isSupabaseConfigured,
  resetSupabaseClient,
  type SupabaseClient,
} from '../infrastructure/storage/supabase/client.js';

// Backward compatibility for existing .client getter pattern
import { getSupabaseClient } from '../infrastructure/storage/supabase/client.js';

export const supabase = {
  get client() {
    return getSupabaseClient();
  },
};
