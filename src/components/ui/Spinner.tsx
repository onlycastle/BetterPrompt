import { Loader2 } from 'lucide-react';
import styles from './Spinner.module.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZES = {
  sm: 16,
  md: 24,
  lg: 40,
};

export function Spinner({ size = 'md', className = '' }: SpinnerProps) {
  return (
    <Loader2
      size={SIZES[size]}
      className={`${styles.spinner} ${className}`}
    />
  );
}

export interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message = 'Loading...' }: LoadingStateProps) {
  return (
    <div className={styles.loadingState}>
      <Spinner size="lg" />
      <p className={styles.message}>{message}</p>
    </div>
  );
}
