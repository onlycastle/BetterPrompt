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
  getChipCharacter,
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

    // Get 3-line chip character with pixel dust animation
    const chipLines = getChipCharacter(expression, this.tick);

    // Main status line with server message (icon only if present)
    const iconPart = config.icon ? `${config.icon} ` : '';
    const mainLine = `${iconPart}${config.color(message)}`;

    // Progress bar line with elapsed time
    const progressLine = `${progressBar} ${pc.dim(elapsed)}`;

    // Build multiline output: status on first line (with spinner), chip below
    // This prevents the spinner from colliding with Unicode box-drawing characters
    this.spinner.text = [
      `${mainLine}`,
      `  ${chipLines[0]}`,
      `  ${chipLines[1]}   ${progressLine}`,
      `  ${chipLines[2]}`,
    ].join('\n');
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
