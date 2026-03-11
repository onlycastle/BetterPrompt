'use client';

import { useState } from 'react';
import { Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import styles from './TestLoginForm.module.css';

interface TestLoginFormProps {
  onSuccess?: () => void;
}

export function TestLoginForm({ onSuccess }: TestLoginFormProps) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = mode === 'login'
      ? await signInWithEmail(email, password)
      : await signUpWithEmail(email, password);

    setLoading(false);

    if (result.error) {
      setError(result.error.message);
      return;
    }

    onSuccess?.();
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Mail size={16} className={styles.icon} />
        <span className={styles.badge}>LOCAL ACCOUNT</span>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
          autoComplete="email"
          className={styles.input}
        />
        <input
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          placeholder="Password (min 6 chars)"
          required
          minLength={6}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          className={styles.input}
        />

        {error && <p className={styles.error}>{error}</p>}

        <button type="submit" disabled={loading} className={styles.submitBtn}>
          <Mail size={16} />
          {loading ? 'Processing...' : mode === 'login' ? 'Sign In' : 'Sign Up'}
        </button>
      </form>

      <button
        type="button"
        className={styles.toggleBtn}
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login');
          setError(null);
        }}
      >
        {mode === 'login' ? 'Need an account? Sign up' : 'Have an account? Sign in'}
      </button>
    </div>
  );
}
