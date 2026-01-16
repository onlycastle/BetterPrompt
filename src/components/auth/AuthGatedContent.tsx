/**
 * Auth Gated Content Component
 * Displays blurred content with unlock CTA for non-authenticated users
 */

import { useState, type ReactNode } from 'react';
import { Lock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../ui/Button';
import { LoginModal } from './LoginModal';
import styles from './AuthGatedContent.module.css';

interface AuthGatedContentProps {
  children: ReactNode;
  /** Blur intensity: light (3px), medium (4px), heavy (6px) */
  blurIntensity?: 'light' | 'medium' | 'heavy';
  /** Custom message shown on the unlock overlay */
  message?: string;
}

export function AuthGatedContent({
  children,
  blurIntensity = 'medium',
  message = 'Sign in to unlock your full analysis'
}: AuthGatedContentProps) {
  const { isAuthenticated, isLoading } = useAuth();
  const [showLogin, setShowLogin] = useState(false);

  // Authenticated users see unblurred content
  if (isAuthenticated) {
    return <>{children}</>;
  }

  // Loading state - show slightly dimmed content
  if (isLoading) {
    return <div className={styles.loading}>{children}</div>;
  }

  // Non-authenticated: show blurred content with unlock CTA
  return (
    <>
      <div className={styles.container}>
        <div className={`${styles.blurredContent} ${styles[blurIntensity]}`}>
          {children}
        </div>
        <div className={styles.overlay}>
          <div className={styles.lockIcon}>
            <Lock size={24} />
          </div>
          <p className={styles.message}>{message}</p>
          <Button onClick={() => setShowLogin(true)}>
            Sign In to Unlock
          </Button>
        </div>
      </div>
      <LoginModal isOpen={showLogin} onClose={() => setShowLogin(false)} />
    </>
  );
}
