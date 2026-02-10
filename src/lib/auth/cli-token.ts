/**
 * CLI Token Management
 *
 * Creates and validates long-lived opaque tokens for CLI authentication.
 * Tokens are stored as SHA-256 hashes in the database; only the plaintext
 * is returned to the CLI (once, at creation time).
 *
 * Format: cli_<40 hex chars>  (20 random bytes)
 * TTL: 30 days
 */

import { createClient } from '@supabase/supabase-js';
import crypto from 'node:crypto';

const CLI_TOKEN_PREFIX = 'cli_';
const TOKEN_BYTES = 20; // 40 hex chars
const TTL_DAYS = 30;

function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  return createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

/**
 * Create a new CLI token for a user.
 *
 * @returns The plaintext token (cli_<hex>) — store securely, cannot be retrieved again.
 */
export async function createCliTokenForUser(userId: string): Promise<string> {
  const rawBytes = crypto.randomBytes(TOKEN_BYTES);
  const plaintext = `${CLI_TOKEN_PREFIX}${rawBytes.toString('hex')}`;
  const tokenHash = hashToken(plaintext);

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + TTL_DAYS);

  const admin = getSupabaseAdmin();
  const { error } = await admin.from('cli_tokens').insert({
    token_hash: tokenHash,
    user_id: userId,
    expires_at: expiresAt.toISOString(),
  });

  if (error) {
    console.error('[CLI Token] Failed to create token:', error.message);
    throw new Error('Failed to create CLI token');
  }

  return plaintext;
}

/**
 * Validate a CLI token and return the associated user ID.
 *
 * Checks: exists, not revoked, not expired.
 * Side effect: updates last_used_at on success.
 *
 * @returns userId if valid, null otherwise.
 */
export async function validateCliToken(token: string): Promise<string | null> {
  if (!token.startsWith(CLI_TOKEN_PREFIX)) {
    return null;
  }

  const tokenHash = hashToken(token);
  const admin = getSupabaseAdmin();

  const { data, error } = await admin
    .from('cli_tokens')
    .select('id, user_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .single();

  if (error || !data) {
    return null;
  }

  // Check revoked
  if (data.revoked_at) {
    return null;
  }

  // Check expired
  if (new Date(data.expires_at) < new Date()) {
    return null;
  }

  // Update last_used_at (fire and forget)
  Promise.resolve(
    admin
      .from('cli_tokens')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
  ).catch((err: unknown) => console.error('[CLI Token] Failed to update last_used_at:', err));

  return data.user_id;
}

/**
 * Check if a token string looks like a CLI token (has the cli_ prefix).
 */
export function isCliToken(token: string): boolean {
  return token.startsWith(CLI_TOKEN_PREFIX);
}
