/**
 * Token Store
 *
 * Secure storage for authentication tokens using the system keychain.
 * Uses keytar for cross-platform keychain access.
 */

import keytar from 'keytar';

const SERVICE_NAME = 'no-ai-slop';
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_EMAIL_KEY = 'user_email';

export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  email?: string;
}

export async function storeTokens(tokens: StoredTokens): Promise<void> {
  await Promise.all([
    keytar.setPassword(SERVICE_NAME, ACCESS_TOKEN_KEY, tokens.accessToken),
    keytar.setPassword(SERVICE_NAME, REFRESH_TOKEN_KEY, tokens.refreshToken),
    tokens.email
      ? keytar.setPassword(SERVICE_NAME, USER_EMAIL_KEY, tokens.email)
      : Promise.resolve(),
  ]);
}

export async function getStoredAccessToken(): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, ACCESS_TOKEN_KEY);
}

export async function getStoredRefreshToken(): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, REFRESH_TOKEN_KEY);
}

export async function getStoredUserEmail(): Promise<string | null> {
  return keytar.getPassword(SERVICE_NAME, USER_EMAIL_KEY);
}

export async function clearTokens(): Promise<void> {
  await Promise.all([
    keytar.deletePassword(SERVICE_NAME, ACCESS_TOKEN_KEY),
    keytar.deletePassword(SERVICE_NAME, REFRESH_TOKEN_KEY),
    keytar.deletePassword(SERVICE_NAME, USER_EMAIL_KEY),
  ]);
}

export async function hasStoredTokens(): Promise<boolean> {
  const accessToken = await getStoredAccessToken();
  return accessToken !== null;
}
