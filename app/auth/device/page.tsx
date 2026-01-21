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
import styles from './page.module.css';

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
