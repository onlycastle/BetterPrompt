'use client';

import { useEffect, useState } from 'react';
import styles from './TextRotator.module.css';

interface TextRotatorProps {
  words: string[];
  interval?: number;
}

export function TextRotator({ words, interval = 3000 }: TextRotatorProps) {
  const [state, setState] = useState({ current: 0, previous: null as number | null });

  useEffect(() => {
    const timer = setInterval(() => {
      setState((prev) => ({
        current: (prev.current + 1) % words.length,
        previous: prev.current,
      }));
    }, interval);
    return () => clearInterval(timer);
  }, [words.length, interval]);

  // Clear previous after exit animation completes
  useEffect(() => {
    if (state.previous === null) return;
    const timer = setTimeout(() => {
      setState((prev) => ({ ...prev, previous: null }));
    }, 500);
    return () => clearTimeout(timer);
  }, [state.previous]);

  const longest = words.reduce((a, b) => (a.length > b.length ? a : b));
  const { current, previous } = state;

  return (
    <span className={styles.rotator}>
      <span className={styles.sizer} aria-hidden="true">
        {longest}
      </span>
      <span
        className={previous !== null ? styles.wordExiting : styles.wordHidden}
        aria-hidden="true"
      >
        {previous !== null ? words[previous] : ''}
      </span>
      <span key={`word-${current}`} className={styles.word}>
        {words[current]}
      </span>
    </span>
  );
}
