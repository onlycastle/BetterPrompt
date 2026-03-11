import {
  createCliTokenForUser as createLocalCliTokenForUser,
  isCliToken as isLocalCliToken,
  validateCliToken as validateLocalCliToken,
} from '@/lib/local/auth';

export async function createCliTokenForUser(userId: string): Promise<string> {
  return createLocalCliTokenForUser(userId);
}

export async function validateCliToken(token: string): Promise<string | null> {
  return validateLocalCliToken(token);
}

export function isCliToken(token: string): boolean {
  return isLocalCliToken(token);
}
