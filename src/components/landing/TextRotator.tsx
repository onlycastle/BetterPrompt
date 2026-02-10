'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './TextRotator.module.css';

interface TextRotatorProps {
  words: string[];
  interval?: number;
}

export function TextRotator({ words, interval = 3000 }: TextRotatorProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [exitingIndex, setExitingIndex] = useState<number | null>(null);

  const rotate = useCallback(() => {
    setExitingIndex(currentIndex);
    setCurrentIndex((prev) => (prev + 1) % words.length);

    // Clear exiting word after animation completes
    setTimeout(() => setExitingIndex(null), 500);
  }, [currentIndex, words.length]);

  useEffect(() => {
    const timer = setInterval(rotate, interval);
    return () => clearInterval(timer);
  }, [rotate, interval]);

  // Find longest word for sizing
  const longest = words.reduce((a, b) => (a.length > b.length ? a : b));

  return (
    <span className={styles.rotator}>
      <span className={styles.sizer} aria-hidden="true">
        {longest}
      </span>
      {exitingIndex !== null && (
        <span key={`exit-${exitingIndex}`} className={styles.wordExiting} aria-hidden="true">
          {words[exitingIndex]}
        </span>
      )}
      <span key={`word-${currentIndex}`} className={styles.word}>
        {words[currentIndex]}
      </span>
    </span>
  );
}
