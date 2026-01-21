/**
 * useTabScrollNavigation Hook
 *
 * Detects when user has scrolled near the bottom of a scrollable container.
 * Used to show "Next Tab" navigation hint.
 */

import { useState, useEffect, type RefObject } from 'react';

interface UseTabScrollNavigationOptions {
  /** The scrollable container ref */
  contentRef: RefObject<HTMLElement | null>;
  /** Scroll threshold (0-1) - shows button when scroll reaches this percentage */
  threshold?: number;
  /** Debounce delay in ms for scroll events */
  debounceMs?: number;
}

interface UseTabScrollNavigationResult {
  /** Whether user has scrolled past the threshold */
  isAtBottom: boolean;
  /** Current scroll percentage (0-1) */
  scrollProgress: number;
}

export function useTabScrollNavigation({
  contentRef,
  threshold = 0.85,
  debounceMs = 100,
}: UseTabScrollNavigationOptions): UseTabScrollNavigationResult {
  const [isAtBottom, setIsAtBottom] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleScroll = () => {
      // Debounce scroll events
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        const scrollTop = el.scrollTop;
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;

        // Calculate scroll progress
        const maxScroll = scrollHeight - clientHeight;
        const progress = maxScroll > 0 ? scrollTop / maxScroll : 1;

        setScrollProgress(progress);
        setIsAtBottom(progress >= threshold);
      }, debounceMs);
    };

    // Initial check
    handleScroll();

    el.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      el.removeEventListener('scroll', handleScroll);
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [contentRef, threshold, debounceMs]);

  // Reset when content changes (detected via ref change)
  useEffect(() => {
    setIsAtBottom(false);
    setScrollProgress(0);
  }, [contentRef.current?.scrollHeight]);

  return { isAtBottom, scrollProgress };
}

export default useTabScrollNavigation;
