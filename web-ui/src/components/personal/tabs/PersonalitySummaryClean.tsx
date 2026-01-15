/**
 * PersonalitySummaryClean Component
 * Notion/Linear style personality summary
 */

import { Card } from '../../ui/Card';
import styles from './PersonalitySummaryClean.module.css';

interface PersonalitySummaryCleanProps {
  summary: string;
}

export function PersonalitySummaryClean({ summary }: PersonalitySummaryCleanProps) {
  return (
    <Card padding="lg" className={styles.container}>
      <p className={styles.text}>{summary}</p>
    </Card>
  );
}

export default PersonalitySummaryClean;
