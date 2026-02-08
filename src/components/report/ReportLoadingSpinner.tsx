/**
 * ReportLoadingSpinner - Shared loading spinner for report pages
 *
 * Pure presentation component (no 'use client' needed).
 */

import styles from './ReportLoadingSpinner.module.css';

interface ReportLoadingSpinnerProps {
  text?: string;
}

export function ReportLoadingSpinner({ text = 'Loading your analysis...' }: ReportLoadingSpinnerProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.spinner} />
      <p className={styles.text}>{text}</p>
    </div>
  );
}
