'use client';

/**
 * SurveyBottomSheet Component
 *
 * PMF (Product-Market Fit) multi-step survey using Superhuman/Sean Ellis methodology.
 * 4-step Typeform-style flow: disappointment level → target user → main benefit → improvement.
 *
 * Accessibility:
 * - role="dialog" with aria-labelledby
 * - aria-modal="false" (non-blocking overlay)
 * - ESC key to dismiss
 * - Keyboard navigation (Tab, Enter, Escape)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import styles from './SurveyBottomSheet.module.css';

export type DisappointmentLevel = 'very_disappointed' | 'somewhat_disappointed' | 'not_disappointed';

interface SurveyData {
  disappointmentLevel: DisappointmentLevel | null;
  targetUser: string;
  mainBenefit: string;
  improvement: string;
}

const STEPS = [
  { command: '$ survey --pmf', question: 'How would you feel if you could no longer use NoMoreAISlop?' },
  { command: '$ survey --target', question: 'What type of developer do you think would benefit most from NoMoreAISlop?' },
  { command: '$ survey --value', question: 'What is the main benefit you receive from NoMoreAISlop?' },
  { command: '$ survey --improve', question: 'How can we improve NoMoreAISlop for you?' },
] as const;

const DISAPPOINTMENT_OPTIONS: { value: DisappointmentLevel; label: string }[] = [
  { value: 'very_disappointed', label: 'Very disappointed' },
  { value: 'somewhat_disappointed', label: 'Somewhat disappointed' },
  { value: 'not_disappointed', label: 'Not disappointed' },
];

interface SurveyBottomSheetProps {
  resultId: string;
  onDismiss: (reason: 'later' | 'skip' | 'submitted') => void;
  mode?: 'full' | 'enrichment';
  disappointmentLevel?: DisappointmentLevel;
}

export function SurveyBottomSheet({ resultId, onDismiss, mode = 'full', disappointmentLevel: initialDisappointmentLevel }: SurveyBottomSheetProps) {
  const [step, setStep] = useState(mode === 'enrichment' ? 1 : 0);
  const [slideDirection, setSlideDirection] = useState<'forward' | 'backward'>('forward');
  const [data, setData] = useState<SurveyData>({
    disappointmentLevel: null,
    targetUser: '',
    mainBenefit: '',
    improvement: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [visible, setVisible] = useState(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  // Slide in on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  // Focus text input when entering steps 2-4
  useEffect(() => {
    if (step > 0 && textInputRef.current) {
      const timer = setTimeout(() => textInputRef.current?.focus(), 350);
      return () => clearTimeout(timer);
    }
  }, [step]);

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
    setTimeout(() => onDismiss(reason), 350);
  }, [onDismiss]);

  const handleSubmit = useCallback(async () => {
    const finalDisappointmentLevel = mode === 'enrichment'
      ? initialDisappointmentLevel
      : data.disappointmentLevel;

    if (!finalDisappointmentLevel || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resultId,
          disappointmentLevel: finalDisappointmentLevel,
          targetUser: data.targetUser.trim() || undefined,
          mainBenefit: data.mainBenefit.trim() || undefined,
          improvement: data.improvement.trim() || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit');
      }

      setSubmitted(true);
      setTimeout(() => handleDismiss('submitted'), 1500);
    } catch {
      handleDismiss('submitted');
    }
  }, [data, resultId, isSubmitting, handleDismiss, mode, initialDisappointmentLevel]);

  const goToStep = useCallback((nextStep: number) => {
    setSlideDirection(nextStep > step ? 'forward' : 'backward');
    setStep(nextStep);
  }, [step]);

  const handleDisappointmentSelect = useCallback((level: DisappointmentLevel) => {
    setData(prev => ({ ...prev, disappointmentLevel: level }));
    // Typeform pattern: auto-advance after short delay
    setTimeout(() => {
      setSlideDirection('forward');
      setStep(1);
    }, 250);
  }, []);

  const handleTextChange = useCallback((field: 'targetUser' | 'mainBenefit' | 'improvement', value: string) => {
    setData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleNext = useCallback(() => {
    if (step < 3) {
      goToStep(step + 1);
    } else {
      handleSubmit();
    }
  }, [step, goToStep, handleSubmit]);

  const handleBack = useCallback(() => {
    if (step > 0) {
      goToStep(step - 1);
    }
  }, [step, goToStep]);

  // Handle Enter key in text inputs (submit on last step, next otherwise)
  const handleTextKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleNext();
    }
  }, [handleNext]);

  const textFields: Array<{ field: 'targetUser' | 'mainBenefit' | 'improvement'; maxLength: number; placeholder: string }> = [
    { field: 'targetUser', maxLength: 300, placeholder: 'e.g., "Backend developers who use AI coding assistants daily"' },
    { field: 'mainBenefit', maxLength: 300, placeholder: 'e.g., "Understanding how I actually collaborate with AI"' },
    { field: 'improvement', maxLength: 500, placeholder: 'Any feature, change, or fix that would help...' },
  ];

  const currentTextField = step > 0 ? textFields[step - 1] : null;
  const isLastStep = step === 3;

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
          {STEPS[step].command}
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
            {/* Step indicator dots */}
            <div className={styles.stepIndicator} role="progressbar"
              aria-valuenow={mode === 'enrichment' ? step : step + 1}
              aria-valuemin={1}
              aria-valuemax={mode === 'enrichment' ? 3 : 4}>
              {(mode === 'enrichment' ? STEPS.slice(1) : STEPS).map((_, i) => {
                const actualIndex = mode === 'enrichment' ? i + 1 : i;
                return (
                  <span
                    key={actualIndex}
                    className={`${styles.stepDot} ${actualIndex === step ? styles.stepDotActive : ''} ${actualIndex < step ? styles.stepDotCompleted : ''}`}
                  />
                );
              })}
            </div>

            {/* Slide container */}
            <div className={styles.slideContainer}>
              <div
                className={`${styles.slideContent} ${slideDirection === 'forward' ? styles.slideForward : styles.slideBackward}`}
                key={step}
              >
                <p className={styles.question}>{STEPS[step].question}</p>

                {/* Step 1: Disappointment options */}
                {step === 0 && (
                  <div className={styles.options} role="radiogroup" aria-label="Disappointment level">
                    {DISAPPOINTMENT_OPTIONS.map(({ value, label }) => (
                      <button
                        key={value}
                        className={`${styles.optionButton} ${data.disappointmentLevel === value ? styles.optionButtonActive : ''}`}
                        onClick={() => handleDisappointmentSelect(value)}
                        role="radio"
                        aria-checked={data.disappointmentLevel === value}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}

                {/* Steps 2-4: Text input */}
                {currentTextField && (
                  <textarea
                    ref={textInputRef}
                    className={styles.textInput}
                    placeholder={currentTextField.placeholder}
                    value={data[currentTextField.field]}
                    onChange={(e) => handleTextChange(currentTextField.field, e.target.value)}
                    onKeyDown={handleTextKeyDown}
                    maxLength={currentTextField.maxLength}
                    rows={3}
                    aria-label={STEPS[step].question}
                  />
                )}
              </div>
            </div>

            {/* Navigation */}
            <div className={styles.actions}>
              {step > 0 ? (
                <button className={styles.backButton} onClick={() => {
                  if (mode === 'enrichment' && step === 1) {
                    handleDismiss('skip');
                  } else {
                    handleBack();
                  }
                }} aria-label="Previous question">
                  {mode === 'enrichment' && step === 1 ? '[close]' : '[← back]'}
                </button>
              ) : (
                <button className={styles.laterButton} onClick={() => handleDismiss('later')}>
                  [later]
                </button>
              )}
              {step > 0 && (
                <button
                  className={styles.submitButton}
                  onClick={handleNext}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'sending...' : isLastStep ? '[submit →]' : '[next →]'}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
