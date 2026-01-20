/**
 * Loading Experience Component
 *
 * Displays engaging content during the scan and analysis phases.
 * Three-panel layout: Type teasers, Dimension preview, Educational facts
 */

import { useState, useEffect } from 'react';
interface AnalysisProgress {
  stage: string;
  percent: number;
  message: string;
}
import styles from './LoadingExperience.module.css';

// Educational facts that rotate during loading
const LOADING_FACTS = [
  // AI Collaboration Stats
  { icon: '📊', label: 'Research', text: '60% of developers report skill atrophy concerns when using AI' },
  { icon: '🎯', label: 'Pro tip', text: 'Context engineering can reduce iteration cycles by 40%' },
  { icon: '🔬', label: 'Did you know?', text: 'Developers who verify AI output catch 65% more bugs early' },

  // Personality-specific insights
  { icon: '🏗️', label: 'Architect insight', text: 'Providing clear specs upfront leads to 2x faster AI responses' },
  { icon: '⚡', label: 'Speedrunner fact', text: 'Rapid prototyping is 3x faster but may accumulate technical debt' },
  { icon: '🤝', label: 'Collaborator tip', text: 'Iterative refinement typically needs 3-5 rounds for optimal results' },

  // Dimension education
  { icon: '💪', label: 'Skill Resilience', text: 'Developers who explain code to AI retain concepts 40% longer' },
  { icon: '🔥', label: 'Burnout Risk', text: 'Sustainable AI usage patterns correlate with 25% higher job satisfaction' },
  { icon: '🎮', label: 'AI Control', text: 'Strategic AI users spend 30% less time on debugging' },
];

// 5 AI Coding Styles
const CODING_STYLES = [
  { type: 'Architect', emoji: '🏗️', tagline: 'Plans before coding' },
  { type: 'Scientist', emoji: '🔬', tagline: 'Verifies everything' },
  { type: 'Collaborator', emoji: '🤝', tagline: 'Iterates through dialogue' },
  { type: 'Speedrunner', emoji: '⚡', tagline: 'Ships fast, fixes later' },
  { type: 'Craftsman', emoji: '🔧', tagline: 'Quality over speed' },
];

// 6 Dimensions of AI Mastery
const DIMENSIONS = [
  { name: 'AI Control', icon: '🎮', description: 'How you direct AI behavior' },
  { name: 'Context Engineering', icon: '📐', description: 'Quality of context you provide' },
  { name: 'Skill Resilience', icon: '💪', description: 'Maintaining your own skills' },
  { name: 'Tool Mastery', icon: '🔧', description: 'Using AI capabilities effectively' },
  { name: 'Burnout Risk', icon: '🔥', description: 'Sustainable collaboration patterns' },
  { name: 'AI Collaboration', icon: '🤝', description: 'Quality of human-AI teamwork' },
];

// Phased messaging based on progress
const PHASE_MESSAGES: Record<number, { title: string; detail: string }> = {
  0: { title: 'Starting analysis...', detail: 'Preparing your session data' },
  10: { title: 'Extracting patterns...', detail: 'Identifying your communication style' },
  25: { title: 'Analyzing behaviors...', detail: 'Mapping your AI collaboration patterns' },
  40: { title: 'Detecting style...', detail: 'Comparing against 5 coding archetypes' },
  55: { title: 'Measuring dimensions...', detail: 'Evaluating 6 key mastery dimensions' },
  70: { title: 'Finding insights...', detail: 'Discovering your unique strengths' },
  85: { title: 'Crafting your story...', detail: 'Personalizing your narrative' },
  95: { title: 'Finalizing report...', detail: 'Almost there...' },
};

function getPhaseMessage(percent: number): { title: string; detail: string } {
  const thresholds = [95, 85, 70, 55, 40, 25, 10, 0];
  for (const threshold of thresholds) {
    if (percent >= threshold) {
      return PHASE_MESSAGES[threshold];
    }
  }
  return PHASE_MESSAGES[0];
}

interface LoadingExperienceProps {
  phase: 'scanning' | 'analyzing';
  progress: AnalysisProgress | null;
  sessionCount?: number;
}

export function LoadingExperience({ phase, progress, sessionCount }: LoadingExperienceProps) {
  const [currentFactIndex, setCurrentFactIndex] = useState(0);
  const [checkingStyleIndex, setCheckingStyleIndex] = useState(-1);

  // Rotate educational facts every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentFactIndex((prev) => (prev + 1) % LOADING_FACTS.length);
    }, 4000);
    return () => clearInterval(interval);
  }, []);

  // Animate through types during analyzing phase
  useEffect(() => {
    if (phase !== 'analyzing') {
      setCheckingStyleIndex(-1);
      return;
    }

    const interval = setInterval(() => {
      setCheckingStyleIndex((prev) => {
        if (prev >= CODING_STYLES.length - 1) return 0;
        return prev + 1;
      });
    }, 3000);

    // Start immediately
    setCheckingStyleIndex(0);

    return () => clearInterval(interval);
  }, [phase]);

  const currentFact = LOADING_FACTS[currentFactIndex];
  const phaseMessage = progress ? getPhaseMessage(progress.percent) : { title: 'Starting...', detail: '' };

  // Scanning phase - simpler view
  if (phase === 'scanning') {
    return (
      <div className={styles.container}>
        <div className={styles.scanningPhase}>
          <span className={styles.scannerIcon}>🔍</span>
          <h2 className={styles.scanningTitle}>Reading your history...</h2>
          <p className={styles.scanningSubtext}>Selecting the sessions that tell your story</p>
          {sessionCount !== undefined && sessionCount > 0 && (
            <p className={styles.sessionCounter}>Found: {sessionCount} sessions</p>
          )}
        </div>
      </div>
    );
  }

  // Analyzing phase - full 3-panel experience
  return (
    <div className={styles.container}>
      {/* Progress Header */}
      <div className={styles.progressHeader}>
        <h2 className={styles.progressTitle}>{phaseMessage.title}</h2>
        <div className={styles.progressBar} role="progressbar" aria-valuenow={progress?.percent || 0}>
          <div
            className={styles.progressFill}
            style={{ width: `${progress?.percent || 0}%` }}
          />
        </div>
        <p className={styles.progressDetail}>{phaseMessage.detail}</p>
      </div>

      {/* 3-Panel Layout */}
      <div className={styles.panels}>
        {/* Left Panel: Type Teasers */}
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>Types Detected</h3>
          <div className={styles.typeList}>
            {CODING_STYLES.map((style, index) => (
              <div
                key={style.type}
                className={`${styles.typeRow} ${checkingStyleIndex === index ? styles.checking : ''}`}
              >
                <span className={styles.typeEmoji}>{style.emoji}</span>
                <span className={styles.typeName}>{style.type}</span>
                <div className={styles.typeBar}>
                  {checkingStyleIndex === index ? (
                    <div className={styles.shimmerBar} />
                  ) : (
                    <div className={styles.emptyBar} />
                  )}
                </div>
                {checkingStyleIndex === index && (
                  <span className={styles.checkingLabel}>checking...</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Right Panel: Dimension Preview */}
        <div className={styles.panel}>
          <h3 className={styles.panelTitle}>6 Dimensions of AI Mastery</h3>
          <div className={styles.dimensionList}>
            {DIMENSIONS.map((dim, index) => (
              <div
                key={dim.name}
                className={styles.dimensionRow}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <span className={styles.dimensionIcon}>{dim.icon}</span>
                <span className={styles.dimensionName}>{dim.name}</span>
                <span className={styles.dimensionValue}>???</span>
              </div>
            ))}
          </div>
          <p className={styles.tagline}>
            &ldquo;Are you getting better with AI &mdash; or just more dependent?&rdquo;
          </p>
        </div>
      </div>

      {/* Bottom Panel: Rotating Facts */}
      <div className={styles.factPanel} aria-live="polite">
        <span className={styles.factIcon}>{currentFact.icon}</span>
        <div className={styles.factContent}>
          <span className={styles.factLabel}>{currentFact.label}</span>
          <p className={styles.factText}>&ldquo;{currentFact.text}&rdquo;</p>
        </div>
      </div>
    </div>
  );
}

export default LoadingExperience;
