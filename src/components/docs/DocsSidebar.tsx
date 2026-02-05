'use client';

import { useState, useEffect } from 'react';
import styles from './DocsSidebar.module.css';

interface Section {
  id: string;
  label: string;
}

interface DocsSidebarProps {
  sections: Section[];
}

export function DocsSidebar({ sections }: DocsSidebarProps) {
  const [activeSection, setActiveSection] = useState(sections[0]?.id || '');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -70% 0px',
        threshold: 0,
      }
    );

    sections.forEach((section) => {
      const element = document.getElementById(section.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [sections]);

  const handleClick = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <aside className={styles.sidebar}>
      <nav className={styles.nav}>
        <ul className={styles.navList}>
          {sections.map((section) => (
            <li key={section.id}>
              <button
                className={`${styles.navLink} ${activeSection === section.id ? styles.active : ''}`}
                onClick={() => handleClick(section.id)}
              >
                {section.label}
              </button>
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
