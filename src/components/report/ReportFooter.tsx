import styles from './ReportFooter.module.css';

interface ReportFooterProps {
  generatedAt?: Date | string;
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Report footer with generation date and branding
 */
export function ReportFooter({ generatedAt = new Date() }: ReportFooterProps) {
  return (
    <footer className={styles.footer}>
      <p className={styles.date}>Analysis generated on {formatDate(generatedAt)}</p>
      <p className={styles.branding}>
        Built with 💜 by{' '}
        <a href="https://betterprompt.dev" target="_blank" rel="noopener noreferrer">
          BetterPrompt
        </a>
      </p>
    </footer>
  );
}
