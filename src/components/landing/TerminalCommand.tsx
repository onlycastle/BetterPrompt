'use client';

import { useState, useCallback } from 'react';
import styles from './TerminalCommand.module.css';

interface TerminalCommandProps {
  command: string;
}

export function TerminalCommand({ command }: TerminalCommandProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(command);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = command;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [command]);

  return (
    <button
      type="button"
      className={styles.terminalBox}
      onClick={handleCopy}
      aria-label={`Copy command: ${command}`}
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
        <span className={styles.copyHint}>
          {copied ? '✓ Copied!' : 'Click to copy'}
        </span>
      </div>
    </button>
  );
}
