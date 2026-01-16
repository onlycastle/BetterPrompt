/**
 * Supabase Client Infrastructure
 *
 * Centralized Supabase client management for infrastructure layer.
 * Re-exports from lib/supabase.ts with additional utilities.
 *
 * @module infrastructure/storage/supabase/client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Environment variables
// NEXT_PUBLIC_ prefix required for client-side access in Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton instance
let _supabase: SupabaseClient | null = null;

/**
 * Validate Supabase environment configuration
 */
function validateEnv(): void {
  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL environment variable is not set');
  }
  if (!supabaseServiceKey && !supabaseAnonKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }
}

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return !!(supabaseUrl && (supabaseServiceKey || supabaseAnonKey));
}

/**
 * Get the Supabase client instance (singleton)
 * Uses service role key for server-side operations (bypasses RLS)
 */
export function getSupabaseClient(): SupabaseClient {
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
 * For client-side or restricted access (respects RLS)
 */
export function createAnonClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }
  return createClient(supabaseUrl, supabaseAnonKey);
}

/**
 * Create a Supabase client for a specific user
 * Used for user-scoped operations
 */
export function createUserClient(accessToken: string): SupabaseClient {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
  }
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Reset the singleton (for testing)
 */
export function resetSupabaseClient(): void {
  _supabase = null;
}

// Re-export types
export type { SupabaseClient };
