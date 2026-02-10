'use client';

/**
 * SurveyBottomSheet Component
 *
 * Terminal-style bottom sheet that collects user satisfaction data.
 * Shows a 1-5 star rating, optional comment, and later/submit actions.
 *
 * Accessibility:
 * - role="dialog" with aria-labelledby
 * - aria-modal="false" (non-blocking overlay)
 * - ESC key to dismiss
 * - Star buttons have aria-label for screen readers
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SurveyBottomSheet.module.css';

interface SurveyBottomSheetProps {
  resultId: string;
  onDismiss: (reason: 'later' | 'skip' | 'submitted') => void;
}

export function SurveyBottomSheet({ resultId, onDismiss }: SurveyBottomSheetProps) {
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Slide in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // ESC key to dismiss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleDismiss('later');
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDismiss = useCallback((reason: 'later' | 'skip' | 'submitted') => {
    setVisible(false);
    // Wait for slide-out animation before calling onDismiss
    setTimeout(() => onDismiss(reason), 350);
  }, [onDismiss]);

  const handleSubmit = useCallback(async () => {
    if (rating === 0 || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultId,
          rating,
          comment: comment.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      setSubmitted(true);
      setTimeout(() => handleDismiss('submitted'), 1500);
    } catch {
      // Still dismiss on error — don't block the user
      handleDismiss('submitted');
    }
  }, [rating, comment, resultId, isSubmitting, handleDismiss]);

  const displayRating = hoveredRating || rating;

  return (
    <div
      ref={sheetRef}
      className={`${styles.sheet} ${visible ? styles.sheetVisible : ''}`}
      role="dialog"
      aria-modal="false"
      aria-labelledby="survey-header"
    >
      {/* Terminal Header */}
      <div className={styles.header}>
        <span className={styles.headerDot} />
        <span id="survey-header" className={styles.headerLabel}>
          $ survey --quick
        </span>
        <button
          className={styles.closeButton}
          onClick={() => handleDismiss('later')}
          aria-label="Close survey"
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className={styles.body}>
        {submitted ? (
          <div className={styles.thankYou}>
            <p className={styles.thankYouText}>Thanks for your feedback!</p>
          </div>
        ) : (
          <>
            <p className={styles.question}>
              How well did this report reflect your actual workflow?
            </p>

            {/* Star Rating */}
            <div className={styles.stars} role="radiogroup" aria-label="Rating">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  className={`${styles.starButton} ${
                    n <= displayRating
                      ? n <= rating
                        ? styles.starButtonFilled
                        : styles.starButtonActive
                      : ''
                  }`}
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoveredRating(n)}
                  onMouseLeave={() => setHoveredRating(0)}
                  aria-label={`Rate ${n} out of 5`}
                  role="radio"
                  aria-checked={rating === n}
                >
                  {n}
                </button>
              ))}
            </div>

            {/* Comment */}
            <input
              type="text"
              className={styles.commentInput}
              placeholder="Honest feedback welcome!"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={500}
              aria-label="Optional feedback comment"
            />

            {/* Actions */}
            <div className={styles.actions}>
              <button
                className={styles.laterButton}
                onClick={() => handleDismiss('later')}
              >
                [later]
              </button>
              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={rating === 0 || isSubmitting}
              >
                {isSubmitting ? 'sending...' : '[submit →]'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
