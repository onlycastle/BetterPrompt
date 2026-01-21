/**
 * Token Store
 *
 * Secure storage for authentication tokens using the system keychain.
 * Uses keytar for cross-platform keychain access (macOS Keychain,
 * Windows Credential Vault, Linux libsecret).
 *
 * Note: keytar is loaded dynamically to avoid compilation errors in
 * environments that don't support native modules (e.g., Vercel).
 */

const SERVICE_NAME = 'no-ai-slop';

// Lazy-loaded keytar instance
let keytarModule: typeof import('keytar') | null = null;

/**
 * Get keytar module (lazy loaded)
 * Throws clear error if keytar is not available
 */
async function getKeytar(): Promise<typeof import('keytar')> {
  if (keytarModule) {
    return keytarModule;
  }

  try {
    keytarModule = await import('keytar');
    return keytarModule;
  } catch (error) {
    throw new Error(
      'keytar is not available. Token storage requires a native environment (CLI or Desktop app). ' +
        'This module cannot be used in serverless or browser environments.'
    );
  }
}
const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_EMAIL_KEY = 'user_email';

/**
 * Stored authentication tokens
 */
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  email?: string;
}

/**
 * Store authentication tokens securely
 */
export async function storeTokens(tokens: StoredTokens): Promise<void> {
  const keytar = await getKeytar();
  await Promise.all([
    keytar.setPassword(SERVICE_NAME, ACCESS_TOKEN_KEY, tokens.accessToken),
    keytar.setPassword(SERVICE_NAME, REFRESH_TOKEN_KEY, tokens.refreshToken),
    tokens.email
      ? keytar.setPassword(SERVICE_NAME, USER_EMAIL_KEY, tokens.email)
      : Promise.resolve(),
  ]);
}

/**
 * Retrieve stored access token
 */
export async function getStoredAccessToken(): Promise<string | null> {
  const keytar = await getKeytar();
  return keytar.getPassword(SERVICE_NAME, ACCESS_TOKEN_KEY);
}

/**
 * Retrieve stored refresh token
 */
export async function getStoredRefreshToken(): Promise<string | null> {
  const keytar = await getKeytar();
  return keytar.getPassword(SERVICE_NAME, REFRESH_TOKEN_KEY);
}

/**
 * Retrieve stored user email
 */
export async function getStoredUserEmail(): Promise<string | null> {
  const keytar = await getKeytar();
  return keytar.getPassword(SERVICE_NAME, USER_EMAIL_KEY);
}

/**
 * Retrieve all stored tokens
 */
export async function getStoredTokens(): Promise<StoredTokens | null> {
  const [accessToken, refreshToken, email] = await Promise.all([
    getStoredAccessToken(),
    getStoredRefreshToken(),
    getStoredUserEmail(),
  ]);

  if (!accessToken || !refreshToken) {
    return null;
  }

  return {
    accessToken,
    refreshToken,
    email: email || undefined,
  };
}

/**
 * Clear all stored tokens (logout)
 */
export async function clearTokens(): Promise<void> {
  const keytar = await getKeytar();
  await Promise.all([
    keytar.deletePassword(SERVICE_NAME, ACCESS_TOKEN_KEY),
    keytar.deletePassword(SERVICE_NAME, REFRESH_TOKEN_KEY),
    keytar.deletePassword(SERVICE_NAME, USER_EMAIL_KEY),
  ]);
}

/**
 * Check if tokens are stored
 */
export async function hasStoredTokens(): Promise<boolean> {
  const accessToken = await getStoredAccessToken();
  return accessToken !== null;
}
