'use client';

/**
 * SurveyInlineCard Component
 *
 * Inline PMF survey card rendered at the bottom of the report scroll flow.
 * Captures the Sean Ellis "disappointment level" metric with a single click,
 * then offers a CTA to expand into the full survey (SurveyBottomSheet).
 *
 * State machine: 'idle' → 'submitting' → 'answered' → (optionally) 'hidden'
 * Also: mount check can set 'hidden' immediately if already submitted/dismissed.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import styles from './SurveyInlineCard.module.css';

type DisappointmentLevel = 'very_disappointed' | 'somewhat_disappointed' | 'not_disappointed';

type CardState = 'idle' | 'answered' | 'submitting' | 'hidden';

const STORAGE_KEY = 'survey-pmf';

const DISAPPOINTMENT_OPTIONS: { value: DisappointmentLevel; label: string }[] = [
  { value: 'very_disappointed', label: 'Very disappointed' },
  { value: 'somewhat_disappointed', label: 'Somewhat disappointed' },
  { value: 'not_disappointed', label: 'Not disappointed' },
];

interface SurveyInlineCardProps {
  resultId: string;
  onExpand: (disappointmentLevel: DisappointmentLevel) => void;
}

export function SurveyInlineCard({ resultId, onExpand }: SurveyInlineCardProps) {
  const [state, setState] = useState<CardState>('idle');
  const selectedLevelRef = useRef<DisappointmentLevel | null>(null);

  // Check localStorage on mount — skip rendering if already submitted or dismissed
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'submitted' || stored === 'dismissed') {
      setState('hidden');
    }
  }, []);

  const handleOptionClick = useCallback(async (level: DisappointmentLevel) => {
    selectedLevelRef.current = level;
    setState('submitting');

    try {
      const response = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resultId, disappointmentLevel: level }),
      });

      if (!response.ok) {
        throw new Error('Survey submission failed');
      }
    } catch {
      // Don't block UX on API failure — still transition to answered
    }

    localStorage.setItem(STORAGE_KEY, 'submitted');
    setState('answered');
  }, [resultId]);

  const handleDismiss = useCallback(() => {
    localStorage.setItem(STORAGE_KEY, 'dismissed');
    setState('hidden');
  }, []);

  const handleExpand = useCallback(() => {
    if (selectedLevelRef.current) {
      onExpand(selectedLevelRef.current);
    }
  }, [onExpand]);

  if (state === 'hidden') {
    return null;
  }

  return (
    <div className={styles.card}>
      {/* Terminal Header */}
      <div className={styles.header}>
        <span className={styles.headerDot} />
        <span className={styles.headerLabel}>
          {state === 'answered' ? '$ survey --thanks' : '$ survey --feedback'}
        </span>
        <button
          className={styles.closeButton}
          onClick={handleDismiss}
          aria-label="Dismiss survey"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {state === 'answered' ? (
          <div className={styles.answeredContent}>
            <p className={styles.thankYouText}>
              &#10003; Thanks for your feedback!
            </p>
            <button className={styles.expandButton} onClick={handleExpand}>
              Help us improve →
            </button>
          </div>
        ) : (
          <>
            <p className={styles.question}>
              How would you feel if you could no longer use NoMoreAISlop?
            </p>
            <div
              role="radiogroup"
              aria-label="Disappointment level"
              className={styles.options}
            >
              {DISAPPOINTMENT_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  className={styles.optionButton}
                  onClick={() => handleOptionClick(value)}
                  disabled={state === 'submitting'}
                  role="radio"
                  aria-checked={selectedLevelRef.current === value}
                >
                  {label}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
