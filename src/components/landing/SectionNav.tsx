'use client';

import { useEffect, useState, useCallback } from 'react';
import styles from './SectionNav.module.css';

const SECTIONS = [
  { id: 'philosophy', label: 'Why' },
  { id: 'value', label: 'How' },
  { id: 'preview', label: 'Preview' },
  { id: 'types', label: 'Types' },
  { id: 'knowledge', label: 'Research' },
  { id: 'download', label: 'Start' },
] as const;

export function SectionNav() {
  const [visible, setVisible] = useState(false);
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    const heroEl = document.getElementById('hero');
    if (!heroEl) return;

    const heroObserver = new IntersectionObserver(
      ([entry]) => setVisible(!entry.isIntersecting),
      { threshold: 0 },
    );
    heroObserver.observe(heroEl);

    return () => heroObserver.disconnect();
  }, []);

  useEffect(() => {
    const sectionEls = SECTIONS.map(({ id }) => document.getElementById(id)).filter(Boolean) as HTMLElement[];
    if (sectionEls.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { threshold: 0.3, rootMargin: '-48px 0px 0px 0px' },
    );

    for (const el of sectionEls) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const handleClick = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  return (
    <nav
      className={`${styles.nav} ${visible ? styles.visible : ''}`}
      aria-label="Section navigation"
    >
      <ul className={styles.list}>
        {SECTIONS.map(({ id, label }) => (
          <li key={id}>
            <button
              className={`${styles.item} ${activeId === id ? styles.active : ''}`}
              onClick={() => handleClick(id)}
              aria-current={activeId === id ? 'true' : undefined}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
