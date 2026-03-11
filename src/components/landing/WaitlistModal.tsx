'use client';

import { useEffect, useCallback, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import styles from './WaitlistModal.module.css';

export type WaitlistType = 'macos_app' | 'pro_subscription' | 'enterprise_contact' | 'free_trial';

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

export const waitlistConfigs: Record<WaitlistType, WaitlistConfig> = {
  macos_app: {
    type: 'macos_app',
    title: 'Desktop App Removed',
    subtitle: (
      <>
        The supported open-source product is the
        <br />
        self-hosted server plus CLI workflow.
      </>
    ),
    successTitle: 'Desktop app removed',
    successMessage: (
      <>
        Start the server locally and run the CLI
        <br />
        against your own machine instead.
      </>
    ),
    disclaimer: 'No desktop binary is required for the OSS build.',
    ctaText: 'Open Dashboard',
  },
  pro_subscription: {
    type: 'pro_subscription',
    title: 'Self-Hosted Setup',
    subtitle: (
      <>
        Run the Next.js server locally,
        <br />
        then connect the CLI to it.
      </>
    ),
    successTitle: 'Self-hosted only',
    successMessage: (
      <>
        Billing and hosted upgrades are removed.
        <br />
        The full report is available by default.
      </>
    ),
    disclaimer: 'Requires GOOGLE_GEMINI_API_KEY in your local .env file.',
    ctaText: 'Read Setup Docs',
  },
  enterprise_contact: {
    type: 'enterprise_contact',
    title: 'Team Rollout',
    subtitle: (
      <>
        Use the same self-hosted server for teammates
        <br />
        and invite them with local accounts.
      </>
    ),
    successTitle: 'Team support is local-first',
    successMessage: (
      <>
        There is no hosted enterprise sales flow
        <br />
        in the OSS build.
      </>
    ),
    disclaimer: 'Commercial support and hosted onboarding are out of scope for this repo.',
    ctaText: 'Open Dashboard',
  },
  free_trial: {
    type: 'free_trial',
    title: 'Quick Start',
    subtitle: (
      <>
        Start the server, sign in,
        <br />
        and run the CLI against your own Gemini key.
      </>
    ),
    successTitle: 'Ready locally',
    successMessage: (
      <>
        No waitlist, no billing, no managed backend.
        <br />
        Everything runs on your own server.
      </>
    ),
    disclaimer: 'Use .env.example and README.md for the full setup path.',
    ctaText: 'Open Dashboard',
  },
};

interface WaitlistModalProps {
  isOpen: boolean;
  onClose: () => void;
  config?: WaitlistConfig;
}

function getPrimaryHref(type: WaitlistType): string {
  return type === 'pro_subscription' ? '/docs' : '/dashboard/analyze';
}

export function WaitlistModal({
  isOpen,
  onClose,
  config = waitlistConfigs.macos_app,
}: WaitlistModalProps) {
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

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <Card className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button
          className={styles.closeButton}
          onClick={onClose}
          aria-label="Close"
        >
          <X size={20} />
        </button>

        <h2 className={styles.title}>{config.title}</h2>
        <p className={styles.subtitle}>{config.subtitle}</p>

        {config.highlight}

        <div className={styles.form}>
          <p className={styles.disclaimer}>
            1. <code>cp .env.example .env</code>
          </p>
          <p className={styles.disclaimer}>
            2. Set <code>GOOGLE_GEMINI_API_KEY</code>
          </p>
          <p className={styles.disclaimer}>
            3. Run <code>npm run dev</code>
          </p>
          <p className={styles.disclaimer}>
            4. Run <code>npx no-ai-slop</code>
          </p>

          <Button
            type="button"
            onClick={() => {
              window.location.href = getPrimaryHref(config.type);
              onClose();
            }}
          >
            {config.ctaText}
          </Button>

          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              window.location.href = '/docs';
              onClose();
            }}
          >
            Read Docs
          </Button>
        </div>

        <p className={styles.disclaimer}>{config.disclaimer}</p>
      </Card>
    </div>
  );
}
