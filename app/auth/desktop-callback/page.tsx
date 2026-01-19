/**
 * Desktop OAuth Callback Page
 *
 * Intermediate page for Electron app OAuth flow.
 * Receives tokens from Supabase (as hash fragments) and redirects to custom URL scheme.
 *
 * Flow:
 * 1. Supabase redirects here: /auth/desktop-callback#access_token=xxx&refresh_token=xxx
 * 2. This page parses hash fragments (client-side only)
 * 3. Redirects to: nomoreaislop://auth/callback#access_token=xxx&refresh_token=xxx
 * 4. Shows user-friendly message
 */

'use client';

import { useEffect, useState } from 'react';

export default function DesktopCallbackPage() {
  const [status, setStatus] = useState<'redirecting' | 'success' | 'error'>('redirecting');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    // Hash fragments are only accessible client-side
    const hash = window.location.hash;

    if (!hash || hash.length < 2) {
      setStatus('error');
      setErrorMessage('No authentication data received');
      return;
    }

    // Parse hash fragments: #access_token=xxx&refresh_token=xxx&...
    const hashParams = new URLSearchParams(hash.substring(1));
    const accessToken = hashParams.get('access_token');
    const refreshToken = hashParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setStatus('error');
      setErrorMessage('Missing authentication tokens');
      return;
    }

    // Build the custom URL scheme with all hash params
    const customUrl = `nomoreaislop://auth/callback${hash}`;

    console.log('[Desktop Callback] Redirecting to app:', customUrl.substring(0, 50) + '...');

    // Try to open the app
    window.location.href = customUrl;

    // After a short delay, show success message
    // (The page will stay visible since custom URL doesn't "load" anything)
    setTimeout(() => {
      setStatus('success');
    }, 500);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        {status === 'redirecting' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
            <h1 className="text-xl font-semibold text-white mb-2">
              Redirecting to App...
            </h1>
            <p className="text-zinc-400">
              Please wait while we open NoMoreAISlop
            </p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-emerald-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Login Successful!
            </h1>
            <p className="text-zinc-400 mb-6">
              You can now return to the NoMoreAISlop app.
            </p>
            <p className="text-zinc-500 text-sm">
              You can close this browser tab.
            </p>

            {/* Manual retry button in case auto-redirect failed */}
            <button
              onClick={() => {
                const hash = window.location.hash;
                window.location.href = `nomoreaislop://auth/callback${hash}`;
              }}
              className="mt-6 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-lg transition-colors text-sm"
            >
              Click here if app didn't open
            </button>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 mx-auto mb-6 bg-red-500/20 rounded-full flex items-center justify-center">
              <svg
                className="w-8 h-8 text-red-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h1 className="text-xl font-semibold text-white mb-2">
              Authentication Failed
            </h1>
            <p className="text-zinc-400 mb-4">
              {errorMessage || 'An error occurred during login'}
            </p>
            <p className="text-zinc-500 text-sm">
              Please close this tab and try again in the app.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
