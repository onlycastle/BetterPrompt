/**
 * useActiveTimer Hook
 *
 * Tracks actual active time on the page using document.visibilityState.
 * Timer pauses when the tab is hidden and resumes when visible again.
 * Returns true once the target seconds have been reached.
 *
 * Uses useRef for elapsed time to minimize re-renders — only triggers
 * a single state update when the target is reached.
 */

import { useState, useEffect, useRef, useCallback } from 'react';

const TICK_INTERVAL_MS = 1000;

/**
 * @param targetSeconds - Number of active seconds before returning true
 * @returns boolean indicating whether the target active time has been reached
 */
export function useActiveTimer(targetSeconds: number): boolean {
  const [reached, setReached] = useState(false);
  const elapsedRef = useRef(0);
  const reachedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startTimer = useCallback(() => {
    if (intervalRef.current || reachedRef.current) return;
    intervalRef.current = setInterval(() => {
      elapsedRef.current += 1;
      if (elapsedRef.current >= targetSeconds && !reachedRef.current) {
        reachedRef.current = true;
        setReached(true);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
      }
    }, TICK_INTERVAL_MS);
  }, [targetSeconds]);

  const stopTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Start immediately if page is visible
    if (document.visibilityState === 'visible') {
      startTimer();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        startTimer();
      } else {
        stopTimer();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stopTimer();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startTimer, stopTimer]);

  return reached;
}
