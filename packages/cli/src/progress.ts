/**
 * Rich Progress Display
 *
 * Shows engaging, detailed progress messages during analysis
 * to convey the depth and thoroughness of the analysis process.
 *
 * Uses client-side animation smoothing to decouple server-sent
 * target progress from the displayed progress, preventing jumps
 * and backward regressions.
 *
 * Renders via log-update (single atomic write per frame) instead
 * of ora (per-line clear/rewrite) to eliminate multiline flickering.
 *
 * During the analyzing phase (~4 min), shows personalized messages
 * derived from the user's own session data ("Spotify Wrapped" effect).
 */

import pc from 'picocolors';
import { createLogUpdate } from 'log-update';
import cliCursor from 'cli-cursor';
import {
  getChipCharacter,
  getChipCharacterWithBubble,
  THINKING_FRAMES,
  getAnimationFrame,
  type ChippyExpression,
  type AnalysisMessage,
  type MilestoneConfig,
  computeSessionInsights,
  generatePersonalizedMessages,
  getAnalyzingStatusMessage,
  MILESTONES,
} from './animations/index.js';
import type { SessionWithParsed } from './scanner.js';

/** Animation smoothing constants */
const ANIMATION_INTERVAL = 200; // ms per tick
const NORMAL_STEP = 1; // % per tick when gap <= 20
const FAST_STEP = 2; // % per tick when gap > 20
const SLOW_THRESHOLD = 40; // below this %, advance at reduced speed
const SLOW_TICK_DIVISOR = 9; // only advance every Nth tick below threshold

/** Rotation intervals (in ticks) */
const BUBBLE_ROTATION_TICKS = 50; // ~10 seconds
const TIP_ROTATION_TICKS = 90; // ~18 seconds
const MILESTONE_DISPLAY_TICKS = 25; // ~5 seconds

/** Braille spinner frames (same cadence as ora's dots) */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Analysis stages with their display configurations
 */
interface StageConfig {
  icon: string;
  color: (text: string) => string;
  baseMessage: string;
}

const STAGE_CONFIGS: Record<string, StageConfig> = {
  preparing: {
    icon: '📦',
    color: pc.magenta,
    baseMessage: 'Preparing payload',
  },
  parsing: {
    icon: '📄',
    color: pc.cyan,
    baseMessage: 'Processing session data',
  },
  analyzing: {
    icon: '',
    color: pc.yellow,
    baseMessage: 'Running AI analysis',
  },
  storing: {
    icon: '💾',
    color: pc.blue,
    baseMessage: 'Storing results',
  },
  complete: {
    icon: '✨',
    color: pc.green,
    baseMessage: 'Analysis complete',
  },
};

/**
 * Options for creating a ProgressDisplay
 */
export interface ProgressDisplayOptions {
  sessions?: SessionWithParsed[];
}

/**
 * ProgressDisplay class for rich progress visualization
 *
 * Decouples targetProgress (from SSE events) from displayedProgress
 * (rendered to terminal). An animation timer smoothly advances the
 * display toward the target, preventing jumps and backward regression.
 *
 * Uses log-update for flicker-free multiline rendering: each render()
 * call atomically overwrites the previous output in a single write.
 */
export class ProgressDisplay {
  private logUpdate: ReturnType<typeof createLogUpdate>;
  private spinnerFrameIndex: number;
  private startTime: number;
  private tick: number;

  private targetProgress: number;
  private displayedProgress: number;
  private currentStage: string;
  private currentMessage: string;
  private animationTimer: ReturnType<typeof setInterval> | null;

  // Personalized message state
  private bubbleMessages: string[];
  private tipMessages: AnalysisMessage[];
  private lastMilestoneHit: number;
  private milestoneTicksRemaining: number;
  private activeMilestone: MilestoneConfig | null;

  constructor(options: ProgressDisplayOptions = {}) {
    this.logUpdate = createLogUpdate(process.stderr);
    this.spinnerFrameIndex = 0;
    this.startTime = Date.now();
    this.tick = 0;

    this.targetProgress = 0;
    this.displayedProgress = 0;
    this.currentStage = 'preparing';
    this.currentMessage = 'Initializing analysis...';
    this.animationTimer = null;

    // Compute personalized messages from session data
    if (options.sessions && options.sessions.length > 0) {
      const insights = computeSessionInsights(options.sessions);
      const messages = generatePersonalizedMessages(insights);
      this.bubbleMessages = messages.bubbles;
      this.tipMessages = messages.tips;
    } else {
      this.bubbleMessages = [];
      this.tipMessages = [];
    }

    this.lastMilestoneHit = -1;
    this.milestoneTicksRemaining = 0;
    this.activeMilestone = null;
  }

  /**
   * Start the progress display
   */
  start(): void {
    this.startTime = Date.now();
    cliCursor.hide(process.stderr);
    this.render();
    this.animationTimer = setInterval(() => {
      this.animationTick();
    }, ANIMATION_INTERVAL);
    this.animationTimer.unref();
  }

  /**
   * Update target progress from server-sent stage/message.
   * The animation timer handles actual rendering.
   */
  update(stage: string, progress: number, message: string): void {
    // Monotonic: never allow target to go backward
    this.targetProgress = Math.max(this.targetProgress, progress);
    this.currentStage = stage;
    this.currentMessage = message;

    // Snap to 100% immediately when complete
    if (progress >= 100) {
      this.displayedProgress = 100;
      this.render();
    }
  }

  /**
   * Animation tick called every ANIMATION_INTERVAL ms.
   * Advances displayedProgress toward targetProgress, rotates
   * spinner frame, checks milestones, and re-renders.
   */
  private animationTick(): void {
    this.tick++;
    this.spinnerFrameIndex =
      (this.spinnerFrameIndex + 1) % SPINNER_FRAMES.length;

    const gap = this.targetProgress - this.displayedProgress;
    if (gap > 0) {
      // Below SLOW_THRESHOLD, only advance every SLOW_TICK_DIVISOR ticks
      // to prevent the bar from racing through the early range
      const isSlow = this.displayedProgress < SLOW_THRESHOLD;
      if (!isSlow || this.tick % SLOW_TICK_DIVISOR === 0) {
        // In slow zone, always use NORMAL_STEP to prevent racing ahead
        const step = isSlow ? NORMAL_STEP : gap > 20 ? FAST_STEP : NORMAL_STEP;
        this.displayedProgress = Math.min(
          this.displayedProgress + step,
          this.targetProgress,
        );
      }
    }

    // Check milestones during analyzing phase
    if (this.currentStage === 'analyzing') {
      this.checkMilestones();
    }

    // Decrement milestone display timer
    if (this.milestoneTicksRemaining > 0) {
      this.milestoneTicksRemaining--;
      if (this.milestoneTicksRemaining === 0) {
        this.activeMilestone = null;
      }
    }

    this.render();
  }

  /**
   * Check if any milestone threshold has been crossed.
   */
  private checkMilestones(): void {
    for (const milestone of MILESTONES) {
      if (
        this.displayedProgress >= milestone.percent &&
        this.lastMilestoneHit < milestone.percent
      ) {
        this.lastMilestoneHit = milestone.percent;
        this.activeMilestone = milestone;
        this.milestoneTicksRemaining = MILESTONE_DISPLAY_TICKS;
      }
    }
  }

  /**
   * Render the current state to the terminal.
   *
   * During the analyzing phase, renders 6 lines (with bubble + tip).
   * During other phases, renders 5 lines (original layout).
   *
   * log-update overwrites the previous output atomically,
   * so there is no visible clear→rewrite gap.
   */
  private render(): void {
    const config = STAGE_CONFIGS[this.currentStage] || STAGE_CONFIGS.analyzing;
    const elapsed = this.formatElapsed();
    const progressBar = this.renderProgressBar(this.displayedProgress);

    const isAnalyzing = this.currentStage === 'analyzing';
    const hasBubbles = this.bubbleMessages.length > 0;

    // Get Chippy expression based on stage and milestones
    let expression: ChippyExpression;
    if (this.currentStage === 'complete') {
      expression = 'excited';
    } else if (this.activeMilestone) {
      expression = this.activeMilestone.expression;
    } else {
      expression = getAnimationFrame(THINKING_FRAMES, this.tick);
    }

    // Get chip character lines (with or without bubble)
    let chipLines: string[];
    if (isAnalyzing && hasBubbles) {
      // Determine current bubble text
      let bubbleText: string;
      if (this.activeMilestone) {
        bubbleText = this.activeMilestone.bubble;
      } else {
        const bubbleIdx = Math.floor(this.tick / BUBBLE_ROTATION_TICKS) % this.bubbleMessages.length;
        bubbleText = this.bubbleMessages[bubbleIdx];
      }
      chipLines = getChipCharacterWithBubble(expression, this.tick, bubbleText);
    } else {
      chipLines = getChipCharacter(expression, this.tick);
    }

    // Spinner character (manually rotated)
    const spinnerChar = pc.cyan(SPINNER_FRAMES[this.spinnerFrameIndex]);

    // Main status line — use rotating status messages during analyzing
    let mainLine: string;
    if (isAnalyzing) {
      const statusMsg = getAnalyzingStatusMessage(this.tick);
      mainLine = `${spinnerChar} ${config.color(statusMsg)}`;
    } else {
      const iconPart = config.icon ? `${config.icon} ` : '';
      mainLine = `${spinnerChar} ${iconPart}${config.color(this.currentMessage)}`;
    }

    // Progress bar line with elapsed time and optional time hint
    const timeHint = this.shouldShowTimeHint()
      ? pc.dim(' | Usually takes 5-10 min')
      : '';
    const progressLine = `${progressBar} ${pc.dim(elapsed)}${timeHint}`;

    // Build output
    let output = `${mainLine}\n  ${chipLines[0]}\n  ${chipLines[1]}\n  ${chipLines[2]}\n  ${progressLine}`;

    // Add tip line during analyzing phase
    if (isAnalyzing && this.tipMessages.length > 0) {
      const tipIdx = Math.floor(this.tick / TIP_ROTATION_TICKS) % this.tipMessages.length;
      const tip = this.tipMessages[tipIdx];
      output += `\n  ${tip.icon} ${pc.dim(tip.text)}`;
    }

    // Atomic multiline write — no flicker
    this.logUpdate(output);
  }

  /** Stages where analysis is done and time hint should be hidden */
  private static readonly POST_ANALYSIS_STAGES = new Set([
    'storing',
    'complete',
  ]);

  /**
   * Whether to show the estimated time hint.
   * Hidden during storing and complete stages (analysis is done).
   */
  private shouldShowTimeHint(): boolean {
    return !ProgressDisplay.POST_ANALYSIS_STAGES.has(this.currentStage);
  }

  /**
   * Format elapsed time as MM:SS
   */
  private formatElapsed(): string {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /**
   * Render a simple progress bar
   */
  private renderProgressBar(progress: number): string {
    const width = 20;
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;
    const bar = '█'.repeat(filled) + '░'.repeat(empty);
    return `[${bar}] ${progress}%`;
  }

  /**
   * Clear the animation timer
   */
  private clearAnimationTimer(): void {
    if (this.animationTimer !== null) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
  }

  /**
   * Mark as succeeded
   */
  succeed(message: string = 'Analysis complete!'): void {
    this.clearAnimationTimer();
    const elapsed = this.formatElapsed();
    this.logUpdate(
      `${pc.green('✔')} ${pc.green(message)} ${pc.dim(`(${elapsed})`)}`,
    );
    this.logUpdate.done();
    cliCursor.show(process.stderr);
  }

  /**
   * Mark as failed
   */
  fail(message: string = 'Analysis failed'): void {
    this.clearAnimationTimer();
    this.logUpdate(`${pc.red('✖')} ${pc.red(message)}`);
    this.logUpdate.done();
    cliCursor.show(process.stderr);
  }

  /**
   * Stop the spinner without success/fail
   */
  stop(): void {
    this.clearAnimationTimer();
    this.logUpdate.clear();
    cliCursor.show(process.stderr);
  }
}

/**
 * Create a new progress display instance
 */
export function createProgressDisplay(options: ProgressDisplayOptions = {}): ProgressDisplay {
  return new ProgressDisplay(options);
}
