import { useState, useCallback } from 'react';
import styles from './ShareSection.module.css';

interface TypeMetadata {
  name: string;
  emoji: string;
  tagline: string;
  strengths: string[];
}

interface ShareSectionProps {
  typeMeta: TypeMetadata;
  reportId?: string;
  baseUrl?: string;
}

const XIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const LinkedInIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const CopyIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
  </svg>
);

const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
    <circle cx="12" cy="7" r="4"></circle>
  </svg>
);

function trackShare(baseUrl: string, reportId: string | undefined, platform: string): void {
  if (!reportId) return;
  fetch(`${baseUrl}/api/reports/${reportId}/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ platform }),
  }).catch(() => {});
}

/**
 * Share section with social buttons and dashboard links
 */
export function ShareSection({
  typeMeta,
  reportId,
  baseUrl,
}: ShareSectionProps) {
  const resolvedBaseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  const [copied, setCopied] = useState(false);
  const shareUrl = reportId ? `${resolvedBaseUrl}/r/${reportId}` : '';

  const tweetText = encodeURIComponent(`I'm a ${typeMeta.name} ${typeMeta.emoji} builder!

My NoMoreAISlop profile:
"${typeMeta.tagline}"

Top Strength: ${typeMeta.strengths[0]}

See the full report:
${shareUrl}

#NoMoreAISlop #AICollaboration #SelfHosted`);

  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}`;
  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;

  const handleTwitterClick = useCallback(() => {
    window.open(twitterUrl, '_blank', 'width=600,height=400');
    trackShare(resolvedBaseUrl, reportId, 'twitter');
  }, [twitterUrl, resolvedBaseUrl, reportId]);

  const handleLinkedInClick = useCallback(() => {
    window.open(linkedInUrl, '_blank', 'width=600,height=600');
    trackShare(resolvedBaseUrl, reportId, 'linkedin');
  }, [linkedInUrl, resolvedBaseUrl, reportId]);

  const handleCopyClick = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      trackShare(resolvedBaseUrl, reportId, 'clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.querySelector<HTMLInputElement>('#share-url');
      if (input) {
        input.select();
        document.execCommand('copy');
      }
    }
  }, [shareUrl, resolvedBaseUrl, reportId]);

  const dashboardUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return (
    <div className={styles.container}>
      {/* Dashboard Buttons */}
      <div className={styles.dashboardButtons}>
        <a href={`${dashboardUrl}/dashboard/personal`} className={`${styles.dashboardBtn} ${styles.personal}`}>
          <UserIcon />
          My Dashboard
        </a>
      </div>

      {/* Share Section */}
      {reportId && (
        <>
          <h3 className={styles.title}>Share Your Results</h3>
          <p className={styles.subtitle}>Share your self-hosted analysis link.</p>

          <div className={styles.shareButtons}>
            <button className={`${styles.shareBtn} ${styles.twitter}`} onClick={handleTwitterClick}>
              <XIcon />
              <span>Share on X</span>
            </button>
            <button className={`${styles.shareBtn} ${styles.linkedin}`} onClick={handleLinkedInClick}>
              <LinkedInIcon />
              <span>Share on LinkedIn</span>
            </button>
            <button className={`${styles.shareBtn} ${styles.copy}`} onClick={handleCopyClick}>
              <CopyIcon />
              <span>{copied ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          <div className={styles.urlContainer}>
            <input
              type="text"
              id="share-url"
              className={styles.urlInput}
              value={shareUrl}
              readOnly
              onClick={(e) => e.currentTarget.select()}
            />
          </div>

          {copied && (
            <div className={styles.toast}>
              <span className={styles.toastIcon}>✓</span>
              <span>Link copied to clipboard!</span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
