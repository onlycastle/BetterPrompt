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

import { useEffect, useState, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Github, Mail, CheckCircle, XCircle, Terminal, FlaskConical } from 'lucide-react';
import styles from './page.module.css';

function DeviceAuthContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'input' | 'authorizing' | 'success' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userCode, setUserCode] = useState(searchParams.get('code') || '');
  const [user, setUser] = useState<{ email: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [testEmail, setTestEmail] = useState('');
  const [testPassword, setTestPassword] = useState('');
  const [testMode, setTestMode] = useState<'login' | 'signup'>('login');
  const [testError, setTestError] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState(false);

  // Ref to prevent duplicate authorization calls (race condition fix)
  const authorizingRef = useRef(false);

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
    // Prevent duplicate authorization calls (race condition between test login and onAuthStateChange)
    if (authorizingRef.current) {
      return;
    }
    authorizingRef.current = true;

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
        authorizingRef.current = false; // Reset so user can retry
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Network error. Please try again.');
      authorizingRef.current = false; // Reset so user can retry
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

  const handleTestEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTestError(null);
    setTestLoading(true);

    const { error, data } = testMode === 'login'
      ? await supabase.auth.signInWithPassword({ email: testEmail, password: testPassword })
      : await supabase.auth.signUp({ email: testEmail, password: testPassword });

    if (error) {
      setTestError(error.message);
      setTestLoading(false);
    } else if (data.user) {
      setUser({ email: data.user.email || 'Unknown' });
      // If we have a code from URL, auto-authorize
      if (userCode) {
        await authorizeDevice(userCode);
      }
    }
    setTestLoading(false);
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={`${styles.spinner} ${styles.smallSpinner}`} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.iconWrapper}>
            <Terminal className={styles.icon} />
          </div>
          <h1 className={styles.title}>Authorize CLI</h1>
          <p className={styles.subtitle}>Connect your terminal to NoMoreAISlop</p>
        </header>

        {/* Success State */}
        {status === 'success' && (
          <div className={styles.card}>
            <div className={`${styles.statusIcon} ${styles.statusIconSuccess}`}>
              <CheckCircle className={styles.iconInner} />
            </div>
            <h2 className={styles.statusTitle}>Device Authorized!</h2>
            <p className={styles.statusMessage}>
              You can now return to your terminal. The CLI will continue automatically.
            </p>
            <p className={styles.statusHint}>You can close this browser tab.</p>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <div className={styles.card}>
            <div className={`${styles.statusIcon} ${styles.statusIconError}`}>
              <XCircle className={styles.iconInner} />
            </div>
            <h2 className={styles.statusTitle}>Authorization Failed</h2>
            <p className={styles.statusMessage}>
              {errorMessage || 'Something went wrong. Please try again.'}
            </p>
            <button
              onClick={() => {
                setStatus('input');
                setErrorMessage(null);
                authorizingRef.current = false; // Reset for retry
              }}
              className={styles.retryButton}
            >
              Try Again
            </button>
          </div>
        )}

        {/* Authorizing State */}
        {status === 'authorizing' && (
          <div className={styles.card}>
            <div className={styles.spinner} />
            <h2 className={styles.statusTitle}>Authorizing...</h2>
            <p className={styles.statusMessage}>Connecting your device</p>
          </div>
        )}

        {/* Input State */}
        {status === 'input' && (
          <div className={styles.card}>
            {!user ? (
              <>
                {/* Not logged in - Show OAuth options */}
                <p className={styles.oauthDescription}>
                  Sign in to authorize your CLI
                </p>
                <div className={styles.oauthButtons}>
                  <button
                    onClick={() => handleOAuth('github')}
                    className={styles.oauthButton}
                  >
                    <Github className={styles.oauthIcon} />
                    Continue with GitHub
                  </button>
                  <button
                    onClick={() => handleOAuth('google')}
                    className={styles.oauthButton}
                  >
                    <Mail className={styles.oauthIcon} />
                    Continue with Google
                  </button>
                </div>

                {userCode && (
                  <p className={styles.codePreview}>
                    Code <span className={styles.codeHighlight}>{userCode}</span> will be authorized after sign in
                  </p>
                )}

                {/* Test Login Form - Development Only */}
                {process.env.NODE_ENV !== 'production' && (
                  <div className={styles.testLoginContainer}>
                    <div className={styles.testLoginHeader}>
                      <FlaskConical size={14} className={styles.testLoginIcon} />
                      <span className={styles.testLoginBadge}>DEV ONLY</span>
                    </div>
                    <form onSubmit={handleTestEmailSubmit} className={styles.testLoginForm}>
                      <input
                        type="email"
                        value={testEmail}
                        onChange={e => setTestEmail(e.target.value)}
                        placeholder="test@example.com"
                        required
                        autoComplete="email"
                        className={styles.testLoginInput}
                      />
                      <input
                        type="password"
                        value={testPassword}
                        onChange={e => setTestPassword(e.target.value)}
                        placeholder="Password (min 6 chars)"
                        required
                        minLength={6}
                        autoComplete={testMode === 'login' ? 'current-password' : 'new-password'}
                        className={styles.testLoginInput}
                      />
                      {testError && <p className={styles.testLoginError}>{testError}</p>}
                      <button
                        type="submit"
                        disabled={testLoading}
                        className={styles.testLoginButton}
                      >
                        <Mail size={14} />
                        {testLoading ? 'Processing...' : testMode === 'login' ? 'Sign In' : 'Sign Up'}
                      </button>
                    </form>
                    <button
                      type="button"
                      className={styles.testLoginToggle}
                      onClick={() => {
                        setTestMode(testMode === 'login' ? 'signup' : 'login');
                        setTestError(null);
                      }}
                    >
                      {testMode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Logged in - Show code input */}
                <p className={styles.userInfo}>
                  Signed in as <span className={styles.userEmail}>{user.email}</span>
                </p>

                <form onSubmit={handleSubmit} className={styles.form}>
                  <label className={styles.formLabel}>
                    Enter the code from your terminal
                  </label>
                  <input
                    type="text"
                    value={userCode}
                    onChange={(e) => setUserCode(e.target.value.toUpperCase())}
                    placeholder="ABCD-1234"
                    className={styles.codeInput}
                    maxLength={9}
                    autoComplete="off"
                    autoFocus
                  />

                  {errorMessage && (
                    <p className={styles.errorMessage}>{errorMessage}</p>
                  )}

                  <button
                    type="submit"
                    disabled={!userCode.trim()}
                    className={styles.submitButton}
                  >
                    Authorize Device
                  </button>
                </form>

                <button
                  onClick={async () => {
                    await supabase.auth.signOut();
                    setUser(null);
                  }}
                  className={styles.signOutButton}
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        )}

        {/* Help text */}
        <p className={styles.helpText}>
          Run <code className={styles.codeSnippet}>npx no-ai-slop</code> to get started
        </p>
      </div>
    </div>
  );
}

export default function DeviceAuthPage() {
  return (
    <Suspense fallback={
      <div className={styles.page}>
        <div className={`${styles.spinner} ${styles.smallSpinner}`} />
      </div>
    }>
      <DeviceAuthContent />
    </Suspense>
  );
}
