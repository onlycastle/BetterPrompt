'use client';

import { useEffect, useState, useRef } from 'react';
import { track } from '@vercel/analytics';
import styles from './SectionNav.module.css';

const SECTIONS = [
  { id: 'problems', label: 'Problems' },
  { id: 'solution', label: 'Solution' },
  { id: 'preview', label: 'Preview' },
  { id: 'teams', label: 'Teams' },
  { id: 'pricing', label: 'Pricing' },
] as const;

export function SectionNav() {
  const [visible, setVisible] = useState(false);
  const [activeId, setActiveId] = useState<string>('');
  const trackedSections = useRef(new Set<string>());

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
            // Track scroll depth — each section only once
            if (!trackedSections.current.has(entry.target.id)) {
              trackedSections.current.add(entry.target.id);
              track('scroll_depth', { section: entry.target.id });
            }
          }
        }
      },
      { threshold: 0.3, rootMargin: '-48px 0px 0px 0px' },
    );

    for (const el of sectionEls) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function handleClick(id: string): void {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

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
