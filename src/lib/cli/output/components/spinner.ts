/**
 * Spinner Component
 *
 * Provides progress indicators during long operations.
 */

import ora, { type Ora } from 'ora';
import pc from 'picocolors';

/**
 * Progress spinner wrapper with timing
 */
export class ProgressSpinner {
  private spinner: Ora;
  private startTime: number;

  constructor() {
    this.spinner = ora({
      spinner: 'dots',
      color: 'cyan',
    });
    this.startTime = Date.now();
  }

  /**
   * Start the spinner with text
   */
  start(text: string): this {
    this.startTime = Date.now();
    this.spinner.start(pc.cyan(text));
    return this;
  }

  /**
   * Update spinner text
   */
  update(text: string): this {
    this.spinner.text = pc.cyan(text);
    return this;
  }

  /**
   * Show info message (without stopping)
   */
  info(text: string): this {
    this.spinner.info(pc.dim(text));
    return this;
  }

  /**
   * Complete with success
   */
  succeed(text: string): this {
    const elapsed = this.formatElapsed();
    this.spinner.succeed(`${pc.green(text)} ${pc.dim(`(${elapsed})`)}`);
    return this;
  }

  /**
   * Complete with failure
   */
  fail(text: string): this {
    this.spinner.fail(pc.red(text));
    return this;
  }

  /**
   * Stop spinner without status
   */
  stop(): this {
    this.spinner.stop();
    return this;
  }

  /**
   * Format elapsed time
   */
  private formatElapsed(): string {
    const ms = Date.now() - this.startTime;
    if (ms > 1000) {
      return `${(ms / 1000).toFixed(1)}s`;
    }
    return `${ms}ms`;
  }
}

/**
 * Create a new progress spinner
 */
export function createSpinner(): ProgressSpinner {
  return new ProgressSpinner();
}
