import { FormattedText } from '../../utils/textFormatting';
import styles from './PersonalitySummary.module.css';

interface PersonalitySummaryProps {
  personalitySummary: string;
}

/**
 * Verbose personality summary card
 * Displays a personalized AI coding personality description
 * Supports **bold markers** for emphasized text
 */
export function PersonalitySummary({ personalitySummary }: PersonalitySummaryProps) {
  return (
    <div className={styles.container}>
      <div className={styles.title}>Your AI Coding Personality</div>
      <FormattedText
        text={personalitySummary}
        as="p"
        className={styles.content}
        boldClassName={styles.emphasis}
      />
    </div>
  );
}
