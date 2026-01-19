/**
 * Secure Storage Utility
 *
 * Provides secure encryption key generation using Electron's safeStorage API.
 * Falls back to machine-specific derived keys for development environments.
 *
 * Security: Uses OS-native keychain (macOS Keychain, Windows DPAPI, Linux libsecret)
 * instead of hardcoded encryption keys in source code.
 */

import { safeStorage, app } from 'electron';
import * as crypto from 'crypto';

/**
 * Cache for generated keys to avoid regenerating on every call
 */
const keyCache = new Map<string, string>();

/**
 * Generate a secure encryption key for a specific purpose
 *
 * Uses Electron's safeStorage API when available (production).
 * Falls back to machine-specific derived key (development).
 *
 * @param purpose - Unique identifier for this key (e.g., 'tokens', 'cache')
 * @returns 32-character hex string suitable for encryption
 */
export function getEncryptionKey(purpose: string): string {
  // Check cache first
  const cached = keyCache.get(purpose);
  if (cached) {
    return cached;
  }

  let key: string;

  if (safeStorage.isEncryptionAvailable()) {
    // Production: Use OS-native secure storage
    // safeStorage uses the OS keychain to encrypt data
    try {
      const seedData = `nomoreaislop-${purpose}-v1`;
      const encrypted = safeStorage.encryptString(seedData);
      // Derive a key from the encrypted data (which is unique per machine)
      key = crypto.createHash('sha256').update(encrypted).digest('hex').slice(0, 32);
      console.log(`[SecureStorage] Generated key for "${purpose}" using safeStorage`);
    } catch (error) {
      console.warn(`[SecureStorage] safeStorage failed, using fallback:`, error);
      key = generateFallbackKey(purpose);
    }
  } else {
    // Development/fallback: Use machine-specific derived key
    console.log(`[SecureStorage] safeStorage not available, using fallback for "${purpose}"`);
    key = generateFallbackKey(purpose);
  }

  keyCache.set(purpose, key);
  return key;
}

/**
 * Generate a fallback encryption key based on machine-specific data
 *
 * Used when safeStorage is not available (e.g., some Linux environments without libsecret).
 * Still more secure than hardcoded keys as it varies per machine.
 */
function generateFallbackKey(purpose: string): string {
  // Combine multiple machine-specific values for uniqueness
  const userData = app.getPath('userData');
  const appPath = app.getAppPath();
  const platform = process.platform;

  const seedData = `${userData}:${appPath}:${platform}:${purpose}:fallback-v1`;
  return crypto.createHash('sha256').update(seedData).digest('hex').slice(0, 32);
}

/**
 * Check if secure encryption is available
 */
export function isSecureEncryptionAvailable(): boolean {
  return safeStorage.isEncryptionAvailable();
}

/**
 * Clear the key cache (useful for testing)
 */
export function clearKeyCache(): void {
  keyCache.clear();
}
