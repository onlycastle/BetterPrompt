/**
 * PersonalitySummaryClean Component
 * Self-contained shareable personality card:
 * - Hero badge (emoji + matrix type name + key strength)
 * - Formatted personality narrative (3 paragraphs)
 * - Inline share buttons (X, LinkedIn, Copy Link) when reportId is provided
 * - Watermark for share context
 */

'use client';

import { useState, useCallback } from 'react';
import { Linkedin, Link as LinkIcon } from 'lucide-react';
import { Card } from '../../../ui/Card';
import { FormattedPersonalityText } from '../../../../utils/textFormatting';
import {
  generateTwitterShareUrl,
  generateLinkedInShareUrl,
} from '../../../../lib/share';
import type { CodingStyleType, TypeResult } from '../../../../lib/models/coding-style';
import styles from './PersonalitySummaryClean.module.css';

const BASE_URL = process.env.NOSLOP_BASE_URL || 'https://www.nomoreaislop.app';

interface PersonalitySummaryCleanProps {
  summary: string;
  matrixName?: string;
  matrixEmoji?: string;
  keyStrength?: string;
  reportId?: string;
  primaryType?: CodingStyleType;
}

function openSharePopup(url: string) {
  window.open(url, '_blank', 'width=600,height=500,noopener,noreferrer');
}

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
    // Analytics tracking is best-effort
  }
}

export function PersonalitySummaryClean({
  summary,
  matrixName,
  matrixEmoji,
  keyStrength,
  reportId,
  primaryType,
}: PersonalitySummaryCleanProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const canShare = Boolean(reportId && primaryType);

  const handleTwitter = useCallback(() => {
    if (!reportId || !primaryType) return;
    const typeResult = buildMinimalTypeResult(primaryType);
    const url = generateTwitterShareUrl(typeResult, reportId);
    openSharePopup(url);
    trackShare(reportId, 'twitter');
  }, [reportId, primaryType]);

  const handleLinkedIn = useCallback(() => {
    if (!reportId) return;
    const url = generateLinkedInShareUrl(reportId);
    openSharePopup(url);
    trackShare(reportId, 'linkedin');
  }, [reportId]);

  const handleCopyLink = useCallback(async () => {
    if (!reportId) return;
    const shareUrl = `${BASE_URL}/r/${reportId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied to clipboard!');
    } catch {
      showToast('Failed to copy. Please try again.');
    }
    trackShare(reportId, 'copy_link');
  }, [reportId, showToast]);

  return (
    <Card padding="lg" className={styles.container}>
      {/* Hero Badge — type emoji + name + key strength */}
      {matrixName && (
        <div className={styles.heroBadge}>
          {matrixEmoji && <span className={styles.heroEmoji}>{matrixEmoji}</span>}
          <div className={styles.heroText}>
            <h3 className={styles.heroName}>The {matrixName}</h3>
            {keyStrength && <p className={styles.heroStrength}>{keyStrength}</p>}
          </div>
        </div>
      )}

      {/* Personality Narrative */}
      <FormattedPersonalityText
        text={summary}
        className={styles.textContainer}
        paragraphClassName={styles.paragraph}
        quoteClassName={styles.quote}
        boldClassName={styles.emphasis}
        softBreakClassName={styles.softBreak}
      />

      {/* Share Footer — only when reportId is available */}
      {canShare && (
        <div className={styles.shareFooter}>
          <div className={styles.shareButtons}>
            <button
              type="button"
              className={`${styles.shareButton} ${styles.twitter}`}
              onClick={handleTwitter}
            >
              <span className={styles.xIcon}>&#120143;</span>
              Share
            </button>
            <button
              type="button"
              className={`${styles.shareButton} ${styles.linkedin}`}
              onClick={handleLinkedIn}
            >
              <Linkedin size={14} />
              LinkedIn
            </button>
            <button
              type="button"
              className={`${styles.shareButton} ${styles.copyLink}`}
              onClick={handleCopyLink}
            >
              <LinkIcon size={14} />
              Copy Link
            </button>
          </div>
          <span className={styles.watermark}>nomoreaislop.app</span>
        </div>
      )}

      {/* Toast */}
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
    </Card>
  );
}

export default PersonalitySummaryClean;
