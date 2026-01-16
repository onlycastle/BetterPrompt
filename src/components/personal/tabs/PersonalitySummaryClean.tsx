/**
 * PersonalitySummaryClean Component
 * Notion/Linear style personality summary
 * Supports **bold markers** for emphasized text
 */

import { Card } from '../../ui/Card';
import { FormattedText } from '../../../utils/textFormatting';
import styles from './PersonalitySummaryClean.module.css';

interface PersonalitySummaryCleanProps {
  summary: string;
}

export function PersonalitySummaryClean({ summary }: PersonalitySummaryCleanProps) {
  return (
    <Card padding="lg" className={styles.container}>
      <FormattedText
        text={summary}
        as="p"
        className={styles.text}
        boldClassName={styles.emphasis}
      />
    </Card>
  );
}

export default PersonalitySummaryClean;
