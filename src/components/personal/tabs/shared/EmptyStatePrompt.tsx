/**
 * EmptyStatePrompt Component
 * Shown when no analysis data is available
 */

import { FileText, Terminal } from 'lucide-react';
import { Card } from '../../../ui/Card';
import styles from './EmptyStatePrompt.module.css';

interface EmptyStatePromptProps {
  title?: string;
  message?: string;
  showCommand?: boolean;
}

export function EmptyStatePrompt({
  title = 'No Analysis Available',
  message = "You haven't run an analysis yet. Get started by analyzing your AI sessions.",
  showCommand = true,
}: EmptyStatePromptProps) {
  return (
    <Card padding="lg" className={styles.container}>
      <div className={styles.iconWrapper}>
        <FileText size={48} strokeWidth={1.5} className={styles.icon} />
      </div>

      <h3 className={styles.title}>{title}</h3>
      <p className={styles.message}>{message}</p>

      {showCommand && (
        <div className={styles.commandSection}>
          <div className={styles.commandLabel}>
            <Terminal size={14} />
            <span>Run this command to get started</span>
          </div>
          <code className={styles.command}>npx betterprompt</code>
        </div>
      )}
    </Card>
  );
}
