/**
 * FloatingBackButton
 * Fixed glass pill button for returning from immersive report to report list
 */

import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import styles from './FloatingBackButton.module.css';

interface FloatingBackButtonProps {
  resultId: string;
}

export function FloatingBackButton({ resultId }: FloatingBackButtonProps) {
  return (
    <Link
      href={`/dashboard/personal?tab=report&focus=${encodeURIComponent(resultId)}`}
      className={styles.button}
    >
      <span className={styles.icon}>
        <ArrowLeft size={16} />
      </span>
      Reports
    </Link>
  );
}
