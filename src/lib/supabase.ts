/**
 * Supabase Client
 *
 * Server-side Supabase client for database operations.
 * Uses service role key for full access (bypasses RLS).
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

// Validate environment variables
function validateEnv(): void {
  if (!supabaseUrl) {
    throw new Error('SUPABASE_URL environment variable is not set');
  }
  if (!supabaseServiceKey && !supabaseAnonKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY must be set');
  }
}

// Lazy initialization to allow environment setup
let _supabase: SupabaseClient | null = null;

/**
 * Get the Supabase client instance (singleton)
 * Uses service role key for server-side operations
 */
export function getSupabase(): SupabaseClient {
  if (!_supabase) {
    validateEnv();
    _supabase = createClient(supabaseUrl!, supabaseServiceKey || supabaseAnonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabase;
}

/**
 * Create a new Supabase client with anon key
 * For client-side or restricted access
 */
export function createAnonClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY must be set');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

// Export a convenience accessor
export const supabase = {
  get client(): SupabaseClient {
    return getSupabase();
  },
};
