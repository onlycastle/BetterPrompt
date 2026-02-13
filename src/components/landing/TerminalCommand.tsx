'use client';

import { useState, useCallback, useEffect } from 'react';
import { track } from '@vercel/analytics';
import styles from './TerminalCommand.module.css';

interface TerminalCommandProps {
  command: string;
  location?: 'hero' | 'download' | 'footer';
}

export function TerminalCommand({ command, location = 'hero' }: TerminalCommandProps) {
  const [copied, setCopied] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      track('cta_copy', { location });
      setTimeout(() => setCopied(false), 3000);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = command;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      track('cta_copy', { location });
      setTimeout(() => setCopied(false), 3000);
    }
  }, [command, location]);

  const handleMobileCta = useCallback(() => {
    track('mobile_cta_click', { location });
    // Bookmark prompt — mobile users can't run CLI
    if (navigator.share) {
      navigator.share({
        title: 'VibeBetter - AI Session Intelligence for Builders',
        url: window.location.href,
      }).catch(() => {});
    } else {
      // Fallback: copy URL
      navigator.clipboard.writeText(window.location.href).catch(() => {});
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    }
  }, [location]);

  const onClick = isMobile ? handleMobileCta : handleCopy;
  const ariaLabel = isMobile
    ? 'Save this page to try on your computer'
    : `Copy command: ${command}`;

  let copyHint: string;
  if (!copied) {
    copyHint = isMobile ? 'Save for desktop' : 'Click to copy';
  } else {
    copyHint = isMobile
      ? '\u2713 Link saved!'
      : '\u2713 Copied! Paste in terminal \u2192 2 min \u2192 See your report';
  }

  return (
    <button
      type="button"
      className={styles.terminalBox}
      onClick={onClick}
      aria-label={ariaLabel}
    >
      <div className={styles.titleBar}>
        <div className={styles.trafficLights}>
          <span className={styles.trafficRed} />
          <span className={styles.trafficYellow} />
          <span className={styles.trafficGreen} />
        </div>
        <span className={styles.titleText}>Terminal</span>
      </div>
      <div className={styles.commandLine}>
        <span className={styles.prompt}>$</span>
        <span className={styles.command}>{command}</span>
        <span className={styles.copyHint}>{copyHint}</span>
      </div>
    </button>
  );
}
