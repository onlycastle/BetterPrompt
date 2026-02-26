'use client';

import styles from './BrandLogo.module.css';

interface BrandLogoProps {
  size?: 'sm' | 'md';
  className?: string;
}

export function BrandLogo({ size = 'md', className }: BrandLogoProps) {
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <a
      href="/"
      className={`${styles.logo} ${styles[size]} ${className ?? ''}`}
      onClick={handleClick}
      aria-label="BetterPrompt — scroll to top"
    >
      <span className={styles.prompt}>&gt;_</span>
      <span className={styles.name}>BetterPrompt</span>
    </a>
  );
}
