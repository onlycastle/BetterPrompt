/**
 * PersonalitySummaryClean Component
 * Notion/Linear style personality summary
 * Supports **bold markers**, "quoted text", and paragraph breaks
 */

import { Card } from '../../../ui/Card';
import { FormattedPersonalityText } from '../../../../utils/textFormatting';
import styles from './PersonalitySummaryClean.module.css';

interface PersonalitySummaryCleanProps {
  summary: string;
}

export function PersonalitySummaryClean({ summary }: PersonalitySummaryCleanProps) {
  return (
    <Card padding="lg" className={styles.container}>
      <FormattedPersonalityText
        text={summary}
        className={styles.textContainer}
        paragraphClassName={styles.paragraph}
        quoteClassName={styles.quote}
        boldClassName={styles.emphasis}
      />
    </Card>
  );
}

export default PersonalitySummaryClean;
