/**
 * PersonalitySummaryClean Component
 * Self-contained shareable personality card:
 * - Hero badge (emoji + matrix type name + key strength)
 * - Formatted personality narrative (3 paragraphs)
 * - Inline share buttons (X, LinkedIn, Copy Link) when reportId is provided
 * - Watermark for share context
 */

'use client';

import { useState, useCallback, useMemo } from 'react';
import { ChevronDown, Linkedin, Link as LinkIcon } from 'lucide-react';
import { Card } from '../../../ui/Card';
import { FormattedPersonalityText } from '../../../../utils/textFormatting';
import {
  generateTwitterShareUrl,
  generateLinkedInShareUrl,
} from '../../../../lib/share';
import { getBrowserSiteOrigin } from '../../../../lib/site-origin';
import type { CodingStyleType, TypeResult } from '../../../../lib/models/coding-style';
import styles from './PersonalitySummaryClean.module.css';

interface PersonalitySummaryCleanProps {
  summary: string;
  matrixName?: string;
  matrixEmoji?: string;
  keyStrength?: string;
  reportId?: string;
  primaryType?: CodingStyleType;
  layout?: 'card' | 'editorial';
}

interface QuickTakeItem {
  label: string;
  text: string;
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

function normalizeParagraphs(text: string): string[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const paragraphs = cleaned.split(/\n\n+/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length > 1) {
    return paragraphs;
  }

  // Long single-block content fallback.
  return cleaned
    .split(/(?<=[.!?。！？])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function firstSentence(text: string): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (!normalized) return '';

  const match = normalized.match(/^(.{20,220}?)(?:니다\.|다\.|요\.|[.!?。！？])/);
  if (match?.[1]) {
    return `${match[1].trim()}.`;
  }

  if (normalized.length <= 160) return normalized;
  return `${normalized.slice(0, 157).trim()}...`;
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\s+/g, ' ').trim();
}

function extractHighlightChips(text: string, limit = 6): string[] {
  const chips: string[] = [];
  const seen = new Set<string>();
  const regex = /\*\*([^*]{2,90})\*\*/g;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const phrase = match[1].trim();
    if (!phrase || seen.has(phrase)) continue;
    seen.add(phrase);
    chips.push(phrase);
    if (chips.length >= limit) break;
  }

  return chips;
}

export function PersonalitySummaryClean({
  summary,
  matrixName,
  matrixEmoji,
  keyStrength,
  reportId,
  primaryType,
  layout = 'card',
}: PersonalitySummaryCleanProps) {
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const baseUrl = getBrowserSiteOrigin();

  const showToast = useCallback((message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
  }, []);

  const canShare = Boolean(reportId && primaryType);
  const isEditorial = layout === 'editorial';
  const paragraphs = useMemo(() => normalizeParagraphs(summary), [summary]);
  const highlightChips = useMemo(() => extractHighlightChips(summary), [summary]);

  const quickTakes = useMemo((): QuickTakeItem[] => {
    const items: QuickTakeItem[] = [];
    const labels = ['Core Signal', 'Risk Pattern', 'Next Shift'];

    for (let i = 0; i < labels.length; i += 1) {
      const paragraph = paragraphs[i];
      if (!paragraph) break;
      const sentence = firstSentence(stripMarkdown(paragraph));
      if (!sentence) continue;
      items.push({ label: labels[i], text: sentence });
    }

    if (items.length === 0 && keyStrength) {
      items.push({ label: 'Core Signal', text: keyStrength });
    }

    return items;
  }, [paragraphs, keyStrength]);

  const shouldCollapseDetails = paragraphs.length > 3 || summary.length > 900;

  const handleTwitter = useCallback(() => {
    if (!reportId || !primaryType) return;
    const typeResult = buildMinimalTypeResult(primaryType);
    const url = generateTwitterShareUrl(typeResult, reportId, { baseUrl });
    openSharePopup(url);
    trackShare(reportId, 'twitter');
  }, [reportId, primaryType]);

  const handleLinkedIn = useCallback(() => {
    if (!reportId) return;
    const url = generateLinkedInShareUrl(reportId, { baseUrl });
    openSharePopup(url);
    trackShare(reportId, 'linkedin');
  }, [reportId]);

  const handleCopyLink = useCallback(async () => {
    if (!reportId) return;
    const shareUrl = `${baseUrl}/r/${reportId}`;
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied to clipboard!');
    } catch {
      showToast('Failed to copy. Please try again.');
    }
    trackShare(reportId, 'copy_link');
  }, [baseUrl, reportId, showToast]);

  return (
    <Card
      padding={isEditorial ? 'none' : 'lg'}
      className={`${styles.container} ${isEditorial ? styles.editorial : ''}`}
      data-layout={layout}
    >
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

      {/* Quick Takes — editorial layout only (card layout shows hero badge instead) */}
      {isEditorial && quickTakes.length > 0 && (
        <section className={styles.quickTakeSection} aria-label="Quick summary">
          <div className={styles.quickTakeGrid}>
            {quickTakes.map((item) => (
              <article key={item.label} className={styles.quickTakeCard}>
                <p className={styles.quickTakeLabel}>{item.label}</p>
                <p className={styles.quickTakeText}>{item.text}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Highlight Chips — editorial layout only */}
      {isEditorial && highlightChips.length > 0 && (
        <div className={styles.highlightChips} aria-label="Key themes">
          {highlightChips.map((chip) => (
            <span key={chip} className={styles.highlightChip}>
              {chip}
            </span>
          ))}
        </div>
      )}

      {/* Personality Narrative */}
      <div
        className={`${styles.detailPanel} ${shouldCollapseDetails && !isExpanded ? styles.detailPanelCollapsed : ''}`}
      >
        <FormattedPersonalityText
          text={summary}
          className={styles.textContainer}
          paragraphClassName={styles.paragraph}
          quoteClassName={styles.quote}
          boldClassName={styles.emphasis}
          softBreakClassName={styles.softBreak}
        />
      </div>

      {shouldCollapseDetails && (
        <button
          type="button"
          className={styles.expandButton}
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
        >
          {isExpanded ? 'Show less' : 'Read full analysis'}
          <ChevronDown size={16} className={`${styles.expandIcon} ${isExpanded ? styles.expandIconOpen : ''}`} />
        </button>
      )}

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
          <span className={styles.watermark}>{new URL(baseUrl).host}</span>
        </div>
      )}

      {/* Toast */}
      {toastMessage && <div className={styles.toast}>{toastMessage}</div>}
    </Card>
  );
}

export default PersonalitySummaryClean;
