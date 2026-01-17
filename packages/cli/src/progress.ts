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
 * Detailed analysis messages that rotate during the "analyzing" stage
 * These create the feeling of thorough, multi-dimensional analysis
 */
const ANALYSIS_DETAILS = [
  // Stage 1: Data Analyst (Module A)
  'Extracting behavioral patterns from conversations...',
  'Analyzing tool usage patterns (Read, Write, Edit, Bash)...',
  'Mapping conversation flow and interaction style...',
  'Identifying prompt engineering techniques...',
  'Detecting AI collaboration patterns...',
  'Measuring verification and validation habits...',
  'Analyzing planning and task decomposition...',
  'Evaluating context engineering strategies...',

  // Module B: Personality Analyst
  'Running personality dimension analysis...',
  'Analyzing communication style (concise vs verbose)...',
  'Evaluating information processing patterns...',
  'Assessing decision-making approach...',
  'Mapping work structure preferences...',
  'Detecting strength and growth patterns...',
  'Analyzing synergy and conflict relationships...',
  'Building personality profile...',

  // Stage 2: Content Writer
  'Generating personalized insights...',
  'Crafting narrative from behavioral data...',
  'Creating evidence-based observations...',
  'Synthesizing findings into story...',
  'Finalizing your developer profile...',
];

/**
 * Parsing stage details
 */
const PARSING_DETAILS = [
  'Reading JSONL session files...',
  'Parsing conversation messages...',
  'Extracting tool calls and results...',
  'Computing session statistics...',
  'Aggregating multi-session data...',
];

/**
 * ProgressDisplay class for rich progress visualization
 */
export class ProgressDisplay {
  private spinner: Ora;
  private startTime: number;
  private currentStage: string = '';
  private detailIndex: number = 0;
  private detailInterval: ReturnType<typeof setInterval> | null = null;
  private lastProgress: number = 0; // Store server-sent progress to avoid fluctuation
  private readonly detailRotationMs = 2500; // Rotate details every 2.5 seconds

  constructor() {
    this.spinner = ora({
      text: 'Initializing analysis...',
      spinner: 'dots12',
    });
    this.startTime = Date.now();
  }

  /**
   * Start the progress display
   */
  start(): void {
    this.startTime = Date.now();
    this.spinner.start();
  }

  /**
   * Update progress with new stage/message
   */
  update(stage: string, progress: number, message: string): void {
    const config = STAGE_CONFIGS[stage] || STAGE_CONFIGS.analyzing;

    // Store server-sent progress for use in detail rotation
    this.lastProgress = progress;

    // Track stage change
    if (stage !== this.currentStage) {
      this.currentStage = stage;
      this.detailIndex = 0;

      // Stop previous detail rotation
      if (this.detailInterval) {
        clearInterval(this.detailInterval);
        this.detailInterval = null;
      }

      // Start detail rotation for analyzing stage
      if (stage === 'analyzing') {
        this.startDetailRotation();
      }
    }

    // Build display text
    const elapsed = this.formatElapsed();
    const progressBar = this.renderProgressBar(progress);

    // Main status line
    const mainLine = `${config.icon} ${config.color(message)}`;

    // Secondary info line (elapsed time + progress bar)
    const infoLine = pc.dim(`   ${progressBar} ${elapsed}`);

    this.spinner.text = `${mainLine}\n${infoLine}`;
  }

  /**
   * Start rotating detailed analysis messages
   */
  private startDetailRotation(): void {
    // Immediately show first detail
    this.showCurrentDetail();

    // Rotate details periodically
    this.detailInterval = setInterval(() => {
      this.detailIndex = (this.detailIndex + 1) % ANALYSIS_DETAILS.length;
      this.showCurrentDetail();
    }, this.detailRotationMs);
  }

  /**
   * Show the current detail message
   */
  private showCurrentDetail(): void {
    const config = STAGE_CONFIGS.analyzing;
    const detail = ANALYSIS_DETAILS[this.detailIndex];
    const elapsed = this.formatElapsed();

    // Use server-sent progress instead of calculating our own
    // This prevents the percentage from jumping around
    const progressBar = this.renderProgressBar(this.lastProgress);

    const mainLine = `${config.icon} ${config.color('Running deep analysis...')}`;
    const detailLine = pc.dim(`   → ${detail}`);
    const infoLine = pc.dim(`   ${progressBar} ${elapsed}`);

    this.spinner.text = `${mainLine}\n${detailLine}\n${infoLine}`;
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
    this.cleanup();
    const elapsed = this.formatElapsed();
    this.spinner.succeed(`${pc.green(message)} ${pc.dim(`(${elapsed})`)}`);
  }

  /**
   * Mark as failed
   */
  fail(message: string = 'Analysis failed'): void {
    this.cleanup();
    this.spinner.fail(pc.red(message));
  }

  /**
   * Stop the spinner without success/fail
   */
  stop(): void {
    this.cleanup();
    this.spinner.stop();
  }

  /**
   * Cleanup intervals
   */
  private cleanup(): void {
    if (this.detailInterval) {
      clearInterval(this.detailInterval);
      this.detailInterval = null;
    }
  }
}

/**
 * Create a new progress display instance
 */
export function createProgressDisplay(): ProgressDisplay {
  return new ProgressDisplay();
}
