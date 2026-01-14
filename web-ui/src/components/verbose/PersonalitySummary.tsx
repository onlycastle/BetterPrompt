import styles from './PersonalitySummary.module.css';

interface PersonalitySummaryProps {
  personalitySummary: string;
}

/**
 * Verbose personality summary card
 * Displays a personalized AI coding personality description
 */
export function PersonalitySummary({ personalitySummary }: PersonalitySummaryProps) {
  return (
    <div className={styles.container}>
      <div className={styles.title}>Your AI Coding Personality</div>
      <p className={styles.content}>{personalitySummary}</p>
    </div>
  );
}
