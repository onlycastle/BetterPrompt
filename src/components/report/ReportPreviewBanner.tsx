/**
 * ReportPreviewBanner - Shared preview banner for report pages
 *
 * Shows a lock icon and warning when viewing preview/free content.
 * Text content is passed as children for route-specific messaging.
 */

import styles from './ReportPreviewBanner.module.css';

interface ReportPreviewBannerProps {
  title: string;
  children: React.ReactNode;
}

export function ReportPreviewBanner({ title, children }: ReportPreviewBannerProps) {
  return (
    <div className={styles.previewBanner}>
      <span className={styles.previewIcon}>&#128274;</span>
      <div className={styles.previewContent}>
        <p className={styles.previewTitle}>{title}</p>
        <div className={styles.previewText}>{children}</div>
      </div>
    </div>
  );
}
