/**
 * Device Authorization Page
 *
 * Users visit this page from CLI to authorize their device.
 *
 * Flow:
 * 1. User arrives with ?code=XXXX-1234 (from CLI) or enters code manually
 * 2. If not logged in, user authenticates via OAuth
 * 3. After login, code is automatically submitted to authorize the device
 * 4. CLI receives tokens via polling
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Github, Mail, CheckCircle, XCircle, Terminal } from 'lucide-react';

function DeviceAuthContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'input' | 'authorizing' | 'success' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userCode, setUserCode] = useState(searchParams.get('code') || '');
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Check auth status on mount and after OAuth redirect
  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUser({ email: user.email || 'Unknown' });
      }
      setLoading(false);
    };

    checkAuth();

    // Listen for auth changes (e.g., after OAuth redirect)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser({ email: session.user.email || 'Unknown' });
        // Auto-authorize if we have a code from URL
        const codeFromUrl = searchParams.get('code');
        if (codeFromUrl) {
          setUserCode(codeFromUrl);
          await authorizeDevice(codeFromUrl);
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [searchParams]);

  const authorizeDevice = async (code: string) => {
    setStatus('authorizing');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/auth/device/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_code: code }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
      } else {
        setStatus('error');
        setErrorMessage(data.message || 'Failed to authorize device');
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCode.trim()) {
      setErrorMessage('Please enter the code from your terminal');
      return;
    }
    await authorizeDevice(userCode.trim());
  };

  const handleOAuth = async (provider: 'github' | 'google') => {
    const redirectUrl = `${window.location.origin}/auth/device${userCode ? `?code=${encodeURIComponent(userCode)}` : ''}`;

    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: redirectUrl,
      },
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 bg-zinc-900 rounded-2xl flex items-center justify-center border border-zinc-800">
            <Terminal className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-2xl font-semibold text-white mb-2">
            Authorize CLI
          </h1>
          <p className="text-zinc-400">
            Connect your terminal to NoMoreAISlop
          </p>
        </div>

        {/* Success State */}
        {status === 'success' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-emerald-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-emerald-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Device Authorized!
            </h2>
            <p className="text-zinc-400 mb-6">
              You can now return to your terminal. The CLI will continue automatically.
            </p>
            <p className="text-zinc-500 text-sm">
              You can close this browser tab.
            </p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-red-500/20 rounded-full flex items-center justify-center">
              <XCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold text-white mb-2">
              Authorization Failed
            </h2>
            <p className="text-zinc-400 mb-6">
              {errorMessage || 'Something went wrong. Please try again.'}
            </p>
            <button
              onClick={() => {
                setStatus('input');
                setErrorMessage(null);
              }}
              className="px-6 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Authorizing State */}
        {status === 'authorizing' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 border-4 border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
            <h2 className="text-xl font-semibold text-white mb-2">
              Authorizing...
            </h2>
            <p className="text-zinc-400">
              Connecting your device
            </p>
          </div>
        )}

        {/* Input State */}
        {status === 'input' && (
          <div className="bg-zinc-900 rounded-xl border border-zinc-800 p-6">
            {!user ? (
              <>
                {/* Not logged in - Show OAuth options */}
                <p className="text-zinc-300 text-center mb-6">
                  Sign in to authorize your CLI
                </p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleOAuth('github')}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                  >
                    <Github className="w-5 h-5" />
                    Continue with GitHub
                  </button>
                  <button
                    onClick={() => handleOAuth('google')}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg transition-colors"
                  >
                    <Mail className="w-5 h-5" />
                    Continue with Google
                  </button>
                </div>

                {userCode && (
                  <p className="text-zinc-500 text-sm text-center mt-6">
                    Code <span className="font-mono text-emerald-500">{userCode}</span> will be authorized after sign in
                  </p>
                )}
              </>
            ) : (
              <>
                {/* Logged in - Show code input */}
                <p className="text-zinc-400 text-sm text-center mb-4">
                  Signed in as <span className="text-white">{user.email}</span>
                </p>

                <form onSubmit={handleSubmit}>
                  <label className="block text-zinc-300 text-sm font-medium mb-2">
                    Enter the code from your terminal
                  </label>
                  <input
                    type="text"
                    value={userCode}
                    onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                    placeholder="ABCD-1234"
                    className="w-full px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-lg text-white text-center text-2xl font-mono tracking-wider focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500"
                    maxLength={9}
                    autoComplete="off"
                    autoFocus
                  />

                  {errorMessage && (
                    <p className="text-red-400 text-sm mt-2 text-center">
                      {errorMessage}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!userCode.trim()}
                    className="w-full mt-4 px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
                  >
                    Authorize Device
                  </button>
                </form>

                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                  }}
                  className="w-full mt-3 text-zinc-500 hover:text-zinc-400 text-sm transition-colors"
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        )}

        {/* Help text */}
        <p className="text-zinc-500 text-sm text-center mt-6">
          Run <code className="bg-zinc-900 px-2 py-1 rounded font-mono">npx no-ai-slop</code> to get started
        </p>
      </div>
    </div>
  );
}

export default function DeviceAuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <DeviceAuthContent />
    </Suspense>
  );
}
