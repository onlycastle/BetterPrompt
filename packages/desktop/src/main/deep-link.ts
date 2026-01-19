/**
 * Deep Link Handler
 *
 * Handles nomoreaislop:// URLs for:
 * - OAuth callback: nomoreaislop://auth/callback?code=xxx
 * - Payment success: nomoreaislop://payment/success?resultId=xxx
 */

import { BrowserWindow } from 'electron';

export type DeepLinkRoute = 'auth-callback' | 'payment-success' | 'unknown';

export interface DeepLinkData {
  route: DeepLinkRoute;
  params: Record<string, string>;
}

/**
 * Parse a deep link URL into route and params
 *
 * URL parsing for custom protocols:
 * nomoreaislop://auth/callback#access_token=xxx&refresh_token=xxx
 * - hostname: "auth"
 * - pathname: "/callback"
 * - hash: "#access_token=xxx&refresh_token=xxx"
 *
 * Supabase sends OAuth tokens as hash fragments, not search params!
 */
export function parseDeepLink(url: string): DeepLinkData {
  try {
    const parsed = new URL(url);

    // Build full path from hostname + pathname
    // nomoreaislop://auth/callback -> "auth/callback"
    const fullPath = `${parsed.hostname}${parsed.pathname}`;

    // Parse both search params and hash fragments
    const params: Record<string, string> = {};

    // Add search params (?key=value)
    parsed.searchParams.forEach((value, key) => {
      params[key] = value;
    });

    // Add hash fragment params (#key=value&key2=value2)
    // Supabase sends tokens as hash fragments for security
    if (parsed.hash) {
      const hashParams = new URLSearchParams(parsed.hash.substring(1));
      hashParams.forEach((value, key) => {
        params[key] = value;
      });
    }

    console.log('Parsed deep link:', { fullPath, params: Object.keys(params) });

    // nomoreaislop://auth/callback#access_token=xxx
    if (fullPath === 'auth/callback') {
      return {
        route: 'auth-callback',
        params,
      };
    }

    // nomoreaislop://payment/success?resultId=xxx
    if (fullPath === 'payment/success') {
      return {
        route: 'payment-success',
        params,
      };
    }

    console.log('Unknown deep link path:', fullPath);
    return { route: 'unknown', params: {} };
  } catch (error) {
    console.error('Failed to parse deep link:', error);
    return { route: 'unknown', params: {} };
  }
}

/**
 * Handle deep link by sending to renderer process
 */
export function handleDeepLink(window: BrowserWindow, url: string): void {
  console.log('=== handleDeepLink FUNCTION ===');
  const data = parseDeepLink(url);
  console.log('H1. Parsed data:', JSON.stringify(data, null, 2));
  console.log('H2. Window webContents exists:', !!window.webContents);
  console.log('H3. Window webContents isLoading:', window.webContents.isLoading());
  console.log('H4. Window webContents URL:', window.webContents.getURL());

  // Send to renderer process
  console.log('H5. Sending deep-link IPC event...');
  window.webContents.send('deep-link', data);
  console.log('H6. deep-link IPC event sent!');
}

/**
 * Register deep link handler (called on app ready)
 */
export function registerDeepLinkHandler(): void {
  // Deep link handling is set up in main/index.ts
  // This function is a placeholder for any additional setup
  console.log('Deep link handler registered for nomoreaislop://');
}
