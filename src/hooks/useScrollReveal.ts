/**
 * useScrollReveal Hook
 *
 * IntersectionObserver-based hook that detects when an element enters
 * the viewport for scroll-triggered reveal animations.
 * Observer disconnects after first visibility for performance.
 * Respects prefers-reduced-motion by immediately showing content.
 */

import { useState, useEffect, useRef } from 'react';

interface UseScrollRevealOptions {
  /** IntersectionObserver threshold (0-1). Default: 0.15 */
  threshold?: number;
  /** IntersectionObserver root margin. Default: '0px 0px -60px 0px' */
  rootMargin?: string;
  /** Disable animation (immediately visible). Default: false */
  disabled?: boolean;
}

/**
 * Returns a ref to attach to the element and a boolean indicating visibility.
 * Once visible, stays visible (one-shot).
 * Respects `prefers-reduced-motion` — immediately visible when motion is reduced.
 */
export function useScrollReveal(options: UseScrollRevealOptions = {}) {
  const { threshold = 0.15, rootMargin = '0px 0px -60px 0px', disabled = false } = options;
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Respect prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (disabled || prefersReducedMotion) {
      setIsVisible(true);
      return;
    }

    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect(); // One-shot: stop observing after reveal
        }
      },
      { threshold, rootMargin },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, rootMargin, disabled]);

  return { ref, isVisible };
}
