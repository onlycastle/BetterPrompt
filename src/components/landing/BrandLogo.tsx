'use client';

import styles from './BrandLogo.module.css';

interface BrandLogoProps {
  size?: 'sm' | 'md';
  dark?: boolean;
  className?: string;
}

export function BrandLogo({ size = 'md', dark = false, className }: BrandLogoProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <a
      href="/"
      className={`${styles.logo} ${styles[size]} ${dark ? styles.dark : ''} ${className ?? ''}`}
      onClick={handleClick}
      aria-label="BetterPrompt - scroll to top"
    >
      <span className={styles.prompt}>&gt;_</span>
      <span className={styles.name}>BetterPrompt</span>
    </a>
  );
}
