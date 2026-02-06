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
 */

import pc from 'picocolors';
import { createLogUpdate } from 'log-update';
import cliCursor from 'cli-cursor';
import {
  getChipCharacter,
  THINKING_FRAMES,
  getAnimationFrame,
  type ChippyExpression,
} from './animations/index.js';

/** Animation smoothing constants */
const ANIMATION_INTERVAL = 200; // ms per tick
const NORMAL_STEP = 1; // % per tick when gap <= 20
const FAST_STEP = 2; // % per tick when gap > 20
const SLOW_THRESHOLD = 40; // below this %, advance at reduced speed
const SLOW_TICK_DIVISOR = 3; // only advance every Nth tick below threshold

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

  constructor() {
    this.logUpdate = createLogUpdate(process.stderr);
    this.spinnerFrameIndex = 0;
    this.startTime = Date.now();
    this.tick = 0;

    this.targetProgress = 0;
    this.displayedProgress = 0;
    this.currentStage = 'preparing';
    this.currentMessage = 'Initializing analysis...';
    this.animationTimer = null;
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
   * spinner frame, and re-renders.
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
        const step = gap > 20 ? FAST_STEP : NORMAL_STEP;
        this.displayedProgress = Math.min(
          this.displayedProgress + step,
          this.targetProgress,
        );
      }
    }

    this.render();
  }

  /**
   * Render the current state to the terminal.
   * Uses displayedProgress, currentStage, and currentMessage.
   *
   * log-update overwrites the previous output atomically,
   * so there is no visible clear→rewrite gap.
   */
  private render(): void {
    const config = STAGE_CONFIGS[this.currentStage] || STAGE_CONFIGS.analyzing;
    const elapsed = this.formatElapsed();
    const progressBar = this.renderProgressBar(this.displayedProgress);

    // Get Chippy expression based on stage
    const expression: ChippyExpression =
      this.currentStage === 'complete'
        ? 'excited'
        : getAnimationFrame(THINKING_FRAMES, this.tick);

    // Get 3-line chip character with pixel dust animation
    const chipLines = getChipCharacter(expression, this.tick);

    // Spinner character (manually rotated)
    const spinnerChar = pc.cyan(SPINNER_FRAMES[this.spinnerFrameIndex]);

    // Main status line with server message (icon only if present)
    const iconPart = config.icon ? `${config.icon} ` : '';
    const mainLine = `${spinnerChar} ${iconPart}${config.color(this.currentMessage)}`;

    // Progress bar line with elapsed time and optional time hint
    const timeHint = this.shouldShowTimeHint()
      ? pc.dim(' | Usually takes 5-10 min')
      : '';
    const progressLine = `${progressBar} ${pc.dim(elapsed)}${timeHint}`;

    // Atomic multiline write — no flicker
    this.logUpdate(
      `${mainLine}\n  ${chipLines[0]}\n  ${chipLines[1]}\n  ${chipLines[2]}\n  ${progressLine}`,
    );
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
export function createProgressDisplay(): ProgressDisplay {
  return new ProgressDisplay();
}
