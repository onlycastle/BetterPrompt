/**
 * ReportErrorCard - Shared error card for report pages
 *
 * Renders an error state with icon, title, message, and action buttons.
 * Buttons are passed as children so each route can provide its own navigation.
 */

import styles from './ReportErrorCard.module.css';

interface ReportErrorCardProps {
  title: string;
  message: string;
  icon: string;
  children?: React.ReactNode;
}

export function ReportErrorCard({ title, message, icon, children }: ReportErrorCardProps) {
  return (
    <div className={styles.errorCard}>
      <div className={styles.errorIcon}>{icon}</div>
      <h1 className={styles.errorTitle}>{title}</h1>
      <p className={styles.errorMessage}>{message}</p>
      {children && <div className={styles.errorActions}>{children}</div>}
    </div>
  );
}
