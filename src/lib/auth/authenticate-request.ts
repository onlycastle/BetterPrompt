import { findUserBySessionToken, isCliToken, validateCliToken } from '@/lib/local/auth';

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

  const user = findUserBySessionToken(token);
  if (!user) {
    return null;
  }

  return { userId: user.id, source: 'web' };
}
