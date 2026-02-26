'use client';

/**
 * WaitlistModal - Reusable email signup modal for various waitlists
 * Supports multiple waitlist types via config props
 */

import { useState, useEffect, useCallback, ReactNode } from 'react';
import { X, Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import styles from './WaitlistModal.module.css';

/** Waitlist source types for Supabase tracking */
export type WaitlistType = 'macos_app' | 'pro_subscription' | 'enterprise_contact' | 'free_trial';

/** Configuration for customizing modal content */
export interface WaitlistConfig {
  type: WaitlistType;
  title: string;
  subtitle: ReactNode;
  successTitle: string;
  successMessage: ReactNode;
  disclaimer: string;
  ctaText: string;
  highlight?: ReactNode;
}

/** Pre-configured waitlist presets */
export const waitlistConfigs: Record<WaitlistType, WaitlistConfig> = {
  macos_app: {
    type: 'macos_app',
    title: 'Coming Soon',
    subtitle: (
      <>
        We're crafting the macOS app.
        <br />
        Join the waitlist to be notified when it's ready.
      </>
    ),
    successTitle: "You're on the list!",
    successMessage: (
      <>
        We'll notify you when the
        <br />
        macOS app is ready.
      </>
    ),
    disclaimer: "We'll only email about the macOS app launch. No spam.",
    ctaText: 'Notify Me',
  },
  pro_subscription: {
    type: 'pro_subscription',
    title: 'PRO Coming Soon',
    subtitle: (
      <>
        Personalized data analysis with regular assessments
        <br />
        Custom learning materials and feedback for your growth
      </>
    ),
    successTitle: "You're on the early bird list!",
    successMessage: (
      <>
        We'll notify you when PRO launches
        <br />
        with your exclusive 50% discount code.
      </>
    ),
    disclaimer: "We'll only email about PRO launch. No spam.",
    ctaText: 'Join Waitlist',
    highlight: <div className={styles.earlyBirdBanner}>🎁 Early bird: 50% off for 3 months</div>,
  },
  enterprise_contact: {
    type: 'enterprise_contact',
    title: 'Enterprise Solutions',
    subtitle: (
      <>
        Team capability testing and performance tracking
        <br />
        Tailored solutions for your organization
      </>
    ),
    successTitle: "We'll be in touch!",
    successMessage: (
      <>
        Our team will reach out to discuss
        <br />
        your enterprise needs.
      </>
    ),
    disclaimer: "We'll only email about enterprise solutions. No spam.",
    ctaText: 'Contact Sales',
    highlight: <div className={styles.enterpriseBadge}>🏢 Custom plans for teams</div>,
  },
  free_trial: {
    type: 'free_trial',
    title: 'Get Early Access',
    subtitle: (
      <>
        BetterPrompt is in private beta.
        <br />
        Join the waitlist and be the first to try it.
      </>
    ),
    successTitle: "You're in!",
    successMessage: (
      <>
        We'll send you an invite
        <br />
        as soon as your spot opens up.
      </>
    ),
    disclaimer: "We'll only email about your access. No spam.",
    ctaText: 'Get Early Access',
  },
};

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: WaitlistConfig;
}

type SubmitStatus = 'idle' | 'submitting' | 'success' | 'error' | 'already_exists';

export function WaitlistModal({
  isOpen,
  onClose,
  config = waitlistConfigs.macos_app,
}: WaitlistModalProps) {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  // Handle Escape key
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setStatus('idle');
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setStatus('submitting');

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError('Please enter a valid email address');
      setStatus('error');
      return;
    }

    try {
      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: config.type }),
      });

      const data = await response.json();

      if (data.status === 'already_exists') {
        setStatus('already_exists');
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      setStatus('success');
    } catch (err) {
      console.error('[Waitlist] Error:', err);
      setError('Something went wrong. Please try again.');
      setStatus('error');
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Card className={styles.modal} onClick={e => e.stopPropagation()}>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        {status === 'success' ? (
          <div className={styles.successState}>
            <Check className={styles.checkmark} size={48} strokeWidth={2.5} />
            <h2 className={styles.successTitle}>{config.successTitle}</h2>
            <p className={styles.successMessage}>{config.successMessage}</p>
          </div>
        ) : (
          <>
            <h2 className={styles.title}>{config.title}</h2>
            <p className={styles.subtitle}>{config.subtitle}</p>

            {config.highlight}

            <form onSubmit={handleSubmit} className={styles.form}>
              <Input
                type="email"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                autoFocus
              />

              {status === 'error' && error && (
                <p className={styles.error}>{error}</p>
              )}

              {status === 'already_exists' && (
                <p className={styles.alreadyOnList}>You're already on the list!</p>
              )}

              <Button
                type="submit"
                loading={status === 'submitting'}
                disabled={status === 'already_exists'}
              >
                {config.ctaText}
              </Button>
            </form>

            <p className={styles.disclaimer}>{config.disclaimer}</p>
          </>
        )}
      </Card>
    </div>
  );
}
