/**
 * Supabase Client Infrastructure
 *
 * Centralized Supabase client management for infrastructure layer.
 * Uses @supabase/ssr for proper cookie-based session handling.
 *
 * @module infrastructure/storage/supabase/client
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { createBrowserClient } from '@supabase/ssr';

// Environment variables
// NEXT_PUBLIC_ prefix required for client-side access in Next.js
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Singleton instances
let _supabase: SupabaseClient | null = null;
let _browserClient: SupabaseClient | null = null;

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
 * Get the browser client instance (singleton)
 * Uses @supabase/ssr for cookie-based session storage.
 * This allows server-side API routes to read the auth session.
 */
export function getBrowserClient(): SupabaseClient {
  if (typeof window === 'undefined') {
    throw new Error('getBrowserClient can only be used in browser environment');
  }

  if (!_browserClient) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set');
    }
    _browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey);
  }
  return _browserClient;
}

/**
 * Create a new Supabase client with anon key
 * For client-side or restricted access (respects RLS)
 * @deprecated Use getBrowserClient() instead for proper SSR cookie handling
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
 * Reset the singletons (for testing)
 */
export function resetSupabaseClient(): void {
  _supabase = null;
  _browserClient = null;
}

// Re-export types
export type { SupabaseClient };
