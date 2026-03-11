import { useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card } from '../ui/Card';
import styles from './LoginModal.module.css';

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  pendingResultId?: string;
}

export function LoginModal({ isOpen, onClose, pendingResultId }: LoginModalProps) {
  const { signInWithEmail, signUpWithEmail } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleEmailSubmit = async (e: React.FormEvent) => {
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

    if (pendingResultId) {
      window.location.href = `/dashboard/r/${encodeURIComponent(pendingResultId)}`;
      return;
    }

    onClose();
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Card className={styles.modal} onClick={e => e.stopPropagation()}>
        <button className={styles.closeButton} onClick={onClose} aria-label="Close">
          <X size={20} />
        </button>

        <h2 className={styles.title}>
          {mode === 'login' ? 'Sign In' : 'Create Account'}
        </h2>
        <p className={styles.subtitle}>
          {mode === 'login'
            ? 'Sign in to unlock your full analysis on this self-hosted server'
            : 'Create a local account to track your progress'}
        </p>

        <form onSubmit={handleEmailSubmit} className={styles.form}>
          <Input
            type="email"
            label="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            type="password"
            label="Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
          {error && <p className={styles.error}>{error}</p>}
          <Button type="submit" loading={loading}>
            {mode === 'login' ? 'Sign In' : 'Create Account'}
          </Button>
        </form>

        <p className={styles.switchMode}>
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className={styles.switchButton}
            onClick={() => {
              setMode(mode === 'login' ? 'signup' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? 'Sign up' : 'Sign in'}
          </button>
        </p>
      </Card>
    </div>
  );
}
