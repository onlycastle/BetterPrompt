import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import styles from './Input.module.css';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  icon?: ReactNode;
  error?: string;
  label?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ icon, error, label, className = '', ...props }, ref) => {
    return (
      <div className={styles.container}>
        {label && <label className={styles.label}>{label}</label>}
        <div className={`${styles.inputWrapper} ${error ? styles.hasError : ''}`}>
          {icon && <span className={styles.icon}>{icon}</span>}
          <input
            ref={ref}
            className={`${styles.input} ${icon ? styles.hasIcon : ''} ${className}`}
            {...props}
          />
        </div>
        {error && <span className={styles.error}>{error}</span>}
      </div>
    );
  }
);

Input.displayName = 'Input';
