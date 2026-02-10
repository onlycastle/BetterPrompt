/**
 * Unified Request Authentication
 *
 * Routes authentication based on token type:
 * - cli_* prefix → CLI token validation (opaque, long-lived)
 * - eyJ* prefix (JWT) → Supabase JWT validation (short-lived)
 *
 * Used by API endpoints that need to support both CLI and web clients.
 */

import { createClient } from '@supabase/supabase-js';
import { validateCliToken, isCliToken } from './cli-token';

export interface AuthResult {
  userId: string;
  source: 'cli' | 'web';
}

/**
 * Authenticate a request from its Authorization header.
 *
 * @param authHeader - Full "Bearer <token>" header value
 * @returns AuthResult with userId and source, or null if invalid/missing
 */
export async function authenticateRequest(
  authHeader: string | null | undefined
): Promise<AuthResult | null> {
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7);
  if (!token) {
    return null;
  }

  // CLI token path
  if (isCliToken(token)) {
    const userId = await validateCliToken(token);
    if (!userId) return null;
    return { userId, source: 'cli' };
  }

  // Supabase JWT path
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('[Auth] Missing Supabase configuration');
    return null;
  }

  try {
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return null;
    }

    return { userId: user.id, source: 'web' };
  } catch {
    return null;
  }
}
