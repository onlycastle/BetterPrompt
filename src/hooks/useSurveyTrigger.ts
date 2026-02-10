/**
 * useSurveyTrigger Hook
 *
 * Composite trigger that determines whether to show the survey bottom sheet.
 * Combines active time, section visit count, and localStorage dismiss state.
 *
 * Trigger condition: activeTimeReached && visitedSections.size >= 4 && !dismissed
 *
 * localStorage states per resultId:
 * - null (absent): first visit, eligible for survey
 * - "later": show once more on next visit, then escalate to "dismissed"
 * - "dismissed": permanently hidden (user said "later" twice)
 * - "submitted": permanently hidden (user submitted survey)
 */

import { useState, useCallback, useRef, useEffect } from 'react';

const STORAGE_PREFIX = 'survey-';
const MIN_VISITED_SECTIONS = 4;

type DismissState = 'later' | 'dismissed' | 'submitted' | null;
type DismissReason = 'later' | 'skip' | 'submitted';

interface SurveyTriggerOptions {
  activeTimeReached: boolean;
  visitedSections: Set<string>;
  resultId: string;
}

interface SurveyTriggerResult {
  shouldShow: boolean;
  dismiss: (reason: DismissReason) => void;
}

function getStorageKey(resultId: string): string {
  return `${STORAGE_PREFIX}${resultId}`;
}

function readDismissState(resultId: string): DismissState {
  try {
    const value = localStorage.getItem(getStorageKey(resultId));
    if (value === 'later' || value === 'dismissed' || value === 'submitted') {
      return value;
    }
    return null;
  } catch {
    // localStorage unavailable (SSR, privacy mode)
    return null;
  }
}

function writeDismissState(resultId: string, state: DismissState): void {
  try {
    if (state === null) {
      localStorage.removeItem(getStorageKey(resultId));
    } else {
      localStorage.setItem(getStorageKey(resultId), state);
    }
  } catch {
    // localStorage unavailable
  }
}

export function useSurveyTrigger({
  activeTimeReached,
  visitedSections,
  resultId,
}: SurveyTriggerOptions): SurveyTriggerResult {
  // Read initial dismiss state from localStorage (once on mount)
  const [dismissState, setDismissState] = useState<DismissState>(() =>
    readDismissState(resultId)
  );

  // Track whether survey was manually dismissed this session
  const [sessionDismissed, setSessionDismissed] = useState(false);

  // Handle "later" → "dismissed" escalation on subsequent visits
  const escalatedRef = useRef(false);
  useEffect(() => {
    if (escalatedRef.current) return;
    if (dismissState === 'later') {
      // Second visit with "later" state: escalate to "dismissed" after showing once
      escalatedRef.current = true;
      // We'll still show the survey this visit, but mark for permanent hide next time
    }
  }, [dismissState]);

  const dismiss = useCallback((reason: DismissReason) => {
    setSessionDismissed(true);

    switch (reason) {
      case 'submitted':
        writeDismissState(resultId, 'submitted');
        setDismissState('submitted');
        break;
      case 'skip':
        writeDismissState(resultId, 'dismissed');
        setDismissState('dismissed');
        break;
      case 'later':
        if (dismissState === 'later') {
          // Second "later" → permanent dismiss
          writeDismissState(resultId, 'dismissed');
          setDismissState('dismissed');
        } else {
          writeDismissState(resultId, 'later');
          setDismissState('later');
        }
        break;
    }
  }, [resultId, dismissState]);

  // Determine if survey should show
  const isPermanentlyDismissed = dismissState === 'dismissed' || dismissState === 'submitted';
  const conditionsMet = activeTimeReached && visitedSections.size >= MIN_VISITED_SECTIONS;
  const shouldShow = conditionsMet && !isPermanentlyDismissed && !sessionDismissed;

  return { shouldShow, dismiss };
}
