/**
 * useScrollProgress Hook
 *
 * Maps scroll position to a 0.0–1.0 progress value for a given element
 * and writes it as a CSS custom property `--scroll-progress` on the element.
 *
 * Performance strategy:
 * 1. IntersectionObserver (rootMargin 200px) detects proximity
 * 2. Only when near viewport: register passive scroll listener
 * 3. RAF-throttled: one getBoundingClientRect + one setProperty per frame
 * 4. When element leaves proximity: unregister scroll listener
 * 5. prefers-reduced-motion: fix progress at 0.5, skip scroll listener
 */

import { useEffect, useRef, useState, useCallback } from 'react';

interface UseScrollProgressReturn {
  ref: React.RefObject<HTMLDivElement | null>;
  progress: number;
}

export function useScrollProgress(): UseScrollProgressReturn {
  const ref = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const rafId = useRef(0);
  const isNear = useRef(false);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight;
    const elH = rect.height;

    // progress: 0 = fully below viewport, 0.5 = centered, 1 = fully above
    const raw = (vh - rect.top) / (vh + elH);
    const clamped = Math.max(0, Math.min(1, raw));

    el.style.setProperty('--scroll-progress', clamped.toFixed(4));
    setProgress(clamped);
  }, []);

  const onScroll = useCallback(() => {
    cancelAnimationFrame(rafId.current);
    rafId.current = requestAnimationFrame(update);
  }, [update]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    // Respect prefers-reduced-motion: hold at 0.5
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      el.style.setProperty('--scroll-progress', '0.5000');
      setProgress(0.5);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!isNear.current) {
            isNear.current = true;
            window.addEventListener('scroll', onScroll, { passive: true });
            update(); // immediate first calculation
          }
        } else {
          if (isNear.current) {
            isNear.current = false;
            window.removeEventListener('scroll', onScroll);
            cancelAnimationFrame(rafId.current);
          }
        }
      },
      { rootMargin: '200px 0px 200px 0px' },
    );

    observer.observe(el);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(rafId.current);
    };
  }, [onScroll, update]);

  return { ref, progress };
}
