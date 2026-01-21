/**
 * Rich Progress Display
 *
 * Shows engaging, detailed progress messages during analysis
 * to convey the depth and thoroughness of the analysis process.
 *
 * Makes users feel like something substantial is happening behind the scenes.
 */

import pc from 'picocolors';
import ora, { type Ora } from 'ora';
import {
  getChippyWithIndicator,
  THINKING_FRAMES,
  getAnimationFrame,
  type ChippyExpression,
} from './animations/index.js';

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
    icon: '🧠',
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
 * Displays server-sent progress messages without client-side manipulation
 */
export class ProgressDisplay {
  private spinner: Ora;
  private startTime: number;
  private tick: number;

  constructor() {
    this.spinner = ora({
      text: 'Initializing analysis...',
      spinner: 'dots12',
    });
    this.startTime = Date.now();
    this.tick = 0;
  }

  /**
   * Start the progress display
   */
  start(): void {
    this.startTime = Date.now();
    this.spinner.start();
  }

  /**
   * Update progress with server-sent stage/message
   */
  update(stage: string, progress: number, message: string): void {
    this.tick++;
    const config = STAGE_CONFIGS[stage] || STAGE_CONFIGS.analyzing;
    const elapsed = this.formatElapsed();
    const progressBar = this.renderProgressBar(progress);

    // Get Chippy expression based on stage
    const expression: ChippyExpression =
      stage === 'complete' ? 'excited' : getAnimationFrame(THINKING_FRAMES, this.tick);

    // Chippy face with stage indicator
    const chippyLine = getChippyWithIndicator(expression, config.icon);

    // Main status line with server message
    const mainLine = `${config.icon} ${config.color(message)}`;

    // Progress bar line with elapsed time
    const progressLine = pc.dim(`              ${progressBar} ${elapsed}`);

    this.spinner.text = `${chippyLine}   ${mainLine}\n${progressLine}`;
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
   * Mark as succeeded
   */
  succeed(message: string = 'Analysis complete!'): void {
    const elapsed = this.formatElapsed();
    this.spinner.succeed(`${pc.green(message)} ${pc.dim(`(${elapsed})`)}`);
  }

  /**
   * Mark as failed
   */
  fail(message: string = 'Analysis failed'): void {
    this.spinner.fail(pc.red(message));
  }

  /**
   * Stop the spinner without success/fail
   */
  stop(): void {
    this.spinner.stop();
  }
}

/**
 * Create a new progress display instance
 */
export function createProgressDisplay(): ProgressDisplay {
  return new ProgressDisplay();
}
