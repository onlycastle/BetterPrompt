'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { TestLoginForm } from '@/components/auth';
import { CheckCircle, Terminal, XCircle } from 'lucide-react';
import styles from './page.module.css';

function DeviceAuthContent() {
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, signOut } = useAuth();
  const [status, setStatus] = useState<'input' | 'authorizing' | 'success' | 'error'>('input');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [userCode, setUserCode] = useState(searchParams.get('user_code') || '');
  const authorizingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const authorizeDevice = useCallback(async (code: string) => {
    if (authorizingRef.current) {
      return;
    }

    authorizingRef.current = true;
    setStatus('authorizing');
    setErrorMessage(null);

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch('/api/auth/device/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ user_code: code }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({})) as { message?: string };
      if (!response.ok) {
        setStatus('error');
        setErrorMessage(data.message || 'Failed to authorize device');
        authorizingRef.current = false;
        return;
      }

      setStatus('success');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      setStatus('error');
      setErrorMessage('Network error. Please try again.');
      authorizingRef.current = false;
    }
  }, []);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const codeFromUrl = searchParams.get('user_code');
    if (!isAuthenticated || !user || !codeFromUrl || status !== 'input' || authorizingRef.current) {
      return;
    }

    setUserCode(codeFromUrl);
    void authorizeDevice(codeFromUrl);
  }, [authorizeDevice, isAuthenticated, searchParams, status, user]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!userCode.trim()) {
      setErrorMessage('Please enter the code from your terminal');
      return;
    }

    await authorizeDevice(userCode.trim().toUpperCase());
  };

  if (isLoading) {
    return (
      <div className={styles.page}>
        <div className={`${styles.spinner} ${styles.smallSpinner}`} />
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.iconWrapper}>
            <Terminal className={styles.icon} />
          </div>
          <h1 className={styles.title}>Authorize CLI</h1>
          <p className={styles.subtitle}>Connect your terminal to NoMoreAISlop</p>
        </header>

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
                authorizingRef.current = false;
              }}
              className={styles.retryButton}
            >
              Try Again
            </button>
          </div>
        )}

        {status === 'authorizing' && (
          <div className={styles.card}>
            <div className={styles.spinner} />
            <h2 className={styles.statusTitle}>Authorizing...</h2>
            <p className={styles.statusMessage}>Connecting your device</p>
          </div>
        )}

        {status === 'input' && (
          <div className={styles.card}>
            {!isAuthenticated || !user ? (
              <>
                <p className={styles.oauthDescription}>
                  Sign in with a local account to authorize your CLI
                </p>
                <TestLoginForm />

                {userCode && (
                  <p className={styles.codePreview}>
                    Code <span className={styles.codeHighlight}>{userCode}</span> will be authorized after sign in
                  </p>
                )}
              </>
            ) : (
              <>
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
                    onChange={(event) => setUserCode(event.target.value.toUpperCase())}
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
                    await signOut();
                    authorizingRef.current = false;
                  }}
                  className={styles.signOutButton}
                >
                  Sign out
                </button>
              </>
            )}
          </div>
        )}

        <p className={styles.helpText}>
          Run <code className={styles.codeSnippet}>npx no-ai-slop</code> to get started
        </p>
      </div>
    </div>
  );
}

export default function DeviceAuthPage() {
  return (
    <Suspense
      fallback={
        <div className={styles.page}>
          <div className={`${styles.spinner} ${styles.smallSpinner}`} />
        </div>
      }
    >
      <DeviceAuthContent />
    </Suspense>
  );
}
