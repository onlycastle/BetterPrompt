/**
 * ReportShareBar - Social share buttons for report pages
 *
 * Placed between report content and unlock section.
 * Uses existing share utilities for Twitter/X and LinkedIn.
 * Instagram: copies a formatted caption to clipboard.
 */

'use client';

import { useState, useCallback } from 'react';
import { Instagram, Linkedin } from 'lucide-react';
import type { CodingStyleType, TypeResult } from '@/lib/models/coding-style';
import {
  generateTwitterShareUrl,
  generateLinkedInShareUrl,
  generateInstagramCaption,
} from '@/lib/share';
import styles from './ReportShareBar.module.css';

interface ReportShareBarProps {
  primaryType: CodingStyleType;
  reportId: string;
}

function openSharePopup(url: string) {
  window.open(url, '_blank', 'width=600,height=500,noopener,noreferrer');
}

/**
 * Build a minimal TypeResult for share utilities.
 * Share functions only read primaryType and distribution, so we cast safely.
 */
function buildMinimalTypeResult(primaryType: CodingStyleType): TypeResult {
  return {
    primaryType,
    distribution: { [primaryType]: 100 },
  } as TypeResult;
}

async function trackShare(reportId: string, platform: string) {
  try {
    await fetch(`/api/reports/${reportId}/share`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ platform }),
    });
  } catch {
    // Analytics tracking is best-effort; don't block UX on failure
  }
}

export function ReportShareBar({ primaryType, reportId }: ReportShareBarProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const typeResult = buildMinimalTypeResult(primaryType);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const handleTwitter = useCallback(() => {
    const url = generateTwitterShareUrl(typeResult, reportId);
    openSharePopup(url);
    trackShare(reportId, 'twitter');
  }, [typeResult, reportId]);

  const handleLinkedIn = useCallback(() => {
    const url = generateLinkedInShareUrl(reportId);
    openSharePopup(url);
    trackShare(reportId, 'linkedin');
  }, [reportId]);

  const handleInstagram = useCallback(async () => {
    const caption = generateInstagramCaption(typeResult, reportId);
    try {
      await navigator.clipboard.writeText(caption);
      showToast('Caption copied! Paste it on Instagram.');
    } catch {
      showToast('Failed to copy. Please try again.');
    }
    trackShare(reportId, 'instagram');
  }, [typeResult, reportId, showToast]);

  return (
    <div className={styles.container}>
      <p className={styles.heading}>Share Your Result</p>
      <div className={styles.buttons}>
        <button
          type="button"
          className={`${styles.shareButton} ${styles.twitter}`}
          onClick={handleTwitter}
        >
          <span className={styles.icon}>&#120143;</span>
          Share on X
        </button>
        <button
          type="button"
          className={`${styles.shareButton} ${styles.linkedin}`}
          onClick={handleLinkedIn}
        >
          <Linkedin size={16} />
          Share on LinkedIn
        </button>
        <button
          type="button"
          className={`${styles.shareButton} ${styles.instagram}`}
          onClick={handleInstagram}
        >
          <Instagram size={16} className={styles.instagramIcon} />
          Copy for Instagram
        </button>
      </div>
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
    </div>
  );
}
