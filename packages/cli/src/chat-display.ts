/**
 * Chat Display - Live Results with LLM-Style Streaming
 *
 * Extends the progress display concept to show phase results as
 * streaming chat messages during analysis. Text appears character
 * by character (2-4 chars per tick) like an LLM generating tokens.
 *
 * Layout:
 *   Line 0:      (spacer)
 *   Line 1:      {spinner}  {status message}
 *   Line 2:      (spacer)
 *   Lines 3-10:  Bear (8 lines with bubble)
 *   Line 11:     -- Live Results ----
 *   Lines 12-N:  Chat messages (scrollable)
 *   Line N+1:    Typing indicator (during streaming)
 *   Line N+2:    (spacer)
 *   Line N+3:    Progress bar + elapsed
 *   Line N+4:    Tip text
 */

import pc from 'picocolors';
import { createLogUpdate } from 'log-update';
import cliCursor from 'cli-cursor';
import {
  getLargeChipCharacterWithBubble,
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
import {
  formatChatMessage,
  isTypeClassification,
  getChatMessageParts,
  renderPartialBoxMessage,
  type ChatMessageParts,
} from './chat-message.js';
import type { PreviewSnippet } from './uploader.js';
import type { SessionWithParsed } from './scanner.js';
import {
  type PipelineState,
  createInitialPipelineState,
  renderPipelineDiagram,
  renderFlatPipelineDiagram,
  PHASE2_TOTAL,
  BOX_DIAGRAM_MIN_WIDTH,
} from './pipeline-diagram.js';

// -- Animation Constants --------------------------------------------------
const TICK_INTERVAL = 50;          // ms per animation tick
const BEAR_UPDATE_DIVISOR = 4;     // Bear updates every 4th tick (200ms)

// Streaming config
const COMMA_DELAY = 120;           // pause after comma
const PERIOD_DELAY = 200;          // pause after period
const NEWLINE_DELAY = 250;         // pause after newline
const VARIANCE = 10;               // +/-10ms random jitter
const MIN_CHUNK = 2;               // min chars per reveal
const MAX_CHUNK = 4;               // max chars per reveal
const CURSOR_CHAR = '\u258C';

// Timing
const TYPING_INDICATOR_MS = 500;   // show "..." before streaming starts
const TYPE_CLASSIFICATION_DELAY_MS = 1500;  // dramatic delay for type reveal
const INTER_MESSAGE_GAP_MS = 300;  // gap between messages
const PROGRESS_SMOOTHING_DIVISOR = 75; // slow progress below 40% (~2m30s to reach 40%)

// Layout
const FIXED_CHROME_LINES = 16;     // bear(8) + header(3) + progress(3) + divider(1) + spacer(1)
const MIN_TERMINAL_ROWS = 20;      // fallback to simple mode below this

/** Braille spinner frames */
const SPINNER_FRAMES = ['\u280B', '\u2819', '\u2839', '\u2838', '\u283C', '\u2834', '\u2826', '\u2827', '\u2807', '\u280F'];

// Bubble/tip rotation (in ticks, 50ms each)
const BUBBLE_ROTATION_TICKS = 200;  // ~10 seconds
const TIP_ROTATION_TICKS = 360;     // ~18 seconds
const MILESTONE_DISPLAY_TICKS = 100; // ~5 seconds

/** Stage display config */
interface StageConfig {
  icon: string;
  color: (text: string) => string;
}

const STAGE_CONFIGS: Record<string, StageConfig> = {
  preparing: { icon: '\u{1F4E6}', color: pc.magenta },
  parsing: { icon: '\u{1F4C4}', color: pc.cyan },
  analyzing: { icon: '', color: pc.yellow },
  storing: { icon: '\u{1F4BE}', color: pc.blue },
  complete: { icon: '\u2728', color: pc.green },
};

/** Queued message waiting to be streamed */
interface QueuedMessage {
  phase: string;
  snippets: PreviewSnippet[];
}

/** Completed (fully revealed) message */
interface CompletedMessage {
  lines: string[];
}

/** Currently streaming message state */
interface StreamingState {
  phase: string;
  snippets: PreviewSnippet[];
  fullLines: string[];
  fullText: string;
  parts: ChatMessageParts;  // decomposed parts for instant-frame rendering
  revealedChars: number;
  pauseUntil: number;   // timestamp to pause until (for punctuation)
  startedAt: number;
}

/**
 * ChatDisplay Options
 */
export interface ChatDisplayOptions {
  sessions?: SessionWithParsed[];
}

/**
 * ChatDisplay - Progress + Live Chat Results
 */
export class ChatDisplay {
  private logUpdate: ReturnType<typeof createLogUpdate>;
  private spinnerFrameIndex = 0;
  private startTime = Date.now();
  private tick = 0;

  // Progress state
  private targetProgress = 0;
  private displayedProgress = 0;
  private currentStage = 'preparing';
  private currentMessage = 'Initializing analysis...';
  private animationTimer: ReturnType<typeof setInterval> | null = null;

  // Personalized messages
  private bubbleMessages: string[];
  private tipMessages: AnalysisMessage[];
  private lastMilestoneHit = -1;
  private milestoneTicksRemaining = 0;
  private activeMilestone: MilestoneConfig | null = null;

  // Chat message state
  private completedMessages: CompletedMessage[] = [];
  private messageQueue: QueuedMessage[] = [];
  private streaming: StreamingState | null = null;
  private typingIndicatorUntil = 0;  // timestamp
  private awaitingStreamStart = false; // true after typing indicator set, before streaming begins

  // Progressive discovery timer
  private discoveryTimer: ReturnType<typeof setTimeout> | null = null;

  // Pipeline progress
  private pipelineState: PipelineState = createInitialPipelineState();
  private phase2Count = 0;
  private showPipeline = false;

  constructor(options: ChatDisplayOptions = {}) {
    this.logUpdate = createLogUpdate(process.stderr);

    if (options.sessions && options.sessions.length > 0) {
      const insights = computeSessionInsights(options.sessions);
      const messages = generatePersonalizedMessages(insights);
      this.bubbleMessages = messages.bubbles;
      this.tipMessages = messages.tips;
    } else {
      this.bubbleMessages = [];
      this.tipMessages = [];
    }
  }

  /** Start the animation loop */
  start(): void {
    this.startTime = Date.now();
    cliCursor.hide(process.stderr);
    this.render();
    this.animationTimer = setInterval(() => this.animationTick(), TICK_INTERVAL);
    this.animationTimer.unref();
  }

  /** Update progress from SSE event */
  update(stage: string, progress: number, message: string): void {
    this.targetProgress = Math.max(this.targetProgress, progress);
    this.currentStage = stage;
    this.currentMessage = message;

    // Update pipeline state from stage transitions
    this.updatePipelineFromStage(stage);

    if (progress >= 100) {
      this.displayedProgress = 100;
      this.render();
    }
  }

  /** Update pipeline state based on stage transitions */
  private updatePipelineFromStage(stage: string): void {
    if (stage === 'preparing' || stage === 'parsing') {
      this.pipelineState.phases[0] = 'active';
      this.showPipeline = true;
    } else if (stage === 'analyzing') {
      this.pipelineState.phases[0] = 'completed';
      // Phase 1 may already be set by addPhasePreview
      if (this.pipelineState.phases[1] === 'pending') {
        this.pipelineState.phases[1] = 'active';
      }
    } else if (stage === 'storing') {
      // All analysis phases complete
      this.pipelineState.phases[1] = 'completed';
      this.pipelineState.phases[2] = 'completed';
      this.pipelineState.phases[3] = 'completed';
      this.pipelineState.phases[4] = 'active';
      this.pipelineState.activeSubProgress = undefined;
    } else if (stage === 'complete') {
      for (let i = 0; i < 5; i++) this.pipelineState.phases[i] = 'completed';
      this.pipelineState.activeSubProgress = undefined;
    }
  }

  /** Add a phase preview (queued for streaming display) */
  addPhasePreview(phase: string, snippets: PreviewSnippet[]): void {
    this.messageQueue.push({ phase, snippets });
    this.updatePipelineFromPhase(phase);
  }

  /** Update pipeline state based on phase preview key */
  private updatePipelineFromPhase(phase: string): void {
    if (phase === 'session_summaries') {
      // Phase 1 complete, Phase 2 starts
      this.pipelineState.phases[1] = 'completed';
      this.pipelineState.phases[2] = 'active';
      this.phase2Count = 0;
      this.pipelineState.activeSubProgress = `0/${PHASE2_TOTAL}`;
    } else if (phase.startsWith('worker_') || phase === 'type_classification' || phase === 'project_summaries' || phase === 'weekly_insights') {
      // Phase 2 sub-task completed
      this.phase2Count = Math.min(this.phase2Count + 1, PHASE2_TOTAL);
      this.pipelineState.activeSubProgress = `${this.phase2Count}/${PHASE2_TOTAL}`;
    } else if (phase === 'narrative_ready') {
      // Phase 2 complete, Phase 3 starts
      this.pipelineState.phases[2] = 'completed';
      this.pipelineState.phases[3] = 'active';
      this.pipelineState.activeSubProgress = undefined;
    }
  }

  /**
   * Schedule progressive discovery messages to appear at intervals.
   * Messages are drip-fed into the chat queue with jitter to feel natural.
   */
  scheduleProgressiveMessages(
    messages: Array<{ phase: string; snippets: PreviewSnippet[] }>,
    intervalMs: number
  ): void {
    if (messages.length === 0) return;

    const queue = [...messages];
    let index = 0;

    const scheduleNext = () => {
      if (index >= queue.length) return;

      const jitter = Math.floor(Math.random() * 2000) - 1000; // ±1000ms
      const delay = intervalMs + jitter;

      this.discoveryTimer = setTimeout(() => {
        if (index < queue.length) {
          const msg = queue[index];
          this.addPhasePreview(msg.phase, msg.snippets);
          index++;
          scheduleNext();
        }
      }, delay);

      this.discoveryTimer.unref();
    };

    scheduleNext();
  }

  /** Mark as succeeded */
  succeed(message = 'Analysis complete!'): void {
    this.clearTimer();
    // Flush any remaining messages instantly
    this.flushAllMessages();
    const elapsed = this.formatElapsed();
    this.logUpdate(
      `${pc.green('\u2714')} ${pc.green(message)} ${pc.dim(`(${elapsed})`)}`,
    );
    this.logUpdate.done();
    cliCursor.show(process.stderr);
  }

  /** Mark as failed */
  fail(message = 'Analysis failed'): void {
    this.clearTimer();
    this.logUpdate(`${pc.red('\u2716')} ${pc.red(message)}`);
    this.logUpdate.done();
    cliCursor.show(process.stderr);
  }

  /** Stop without status */
  stop(): void {
    this.clearTimer();
    this.logUpdate.clear();
    cliCursor.show(process.stderr);
  }

  // -- Private Methods ----------------------------------------------------

  private clearTimer(): void {
    if (this.animationTimer !== null) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }
    if (this.discoveryTimer !== null) {
      clearTimeout(this.discoveryTimer);
      this.discoveryTimer = null;
    }
  }

  /** Flush all queued messages instantly (for succeed) */
  private flushAllMessages(): void {
    // Complete current streaming message
    if (this.streaming) {
      this.completedMessages.push({ lines: this.streaming.fullLines });
      this.streaming = null;
    }
    // Flush queue
    for (const msg of this.messageQueue) {
      const lines = formatChatMessage(msg.phase, msg.snippets, this.formatElapsed());
      this.completedMessages.push({ lines });
    }
    this.messageQueue = [];
    this.render();
  }

  /** Main animation tick (50ms) */
  private animationTick(): void {
    this.tick++;
    this.spinnerFrameIndex = (this.spinnerFrameIndex + 1) % SPINNER_FRAMES.length;

    // Progress smoothing
    const gap = this.targetProgress - this.displayedProgress;
    if (gap > 0) {
      const isSlow = this.displayedProgress < 40;
      if (!isSlow || this.tick % PROGRESS_SMOOTHING_DIVISOR === 0) {
        const step = isSlow ? 1 : gap > 20 ? 2 : 1;
        this.displayedProgress = Math.min(this.displayedProgress + step, this.targetProgress);
      }
    }

    // Milestone checking (analyzing phase only)
    if (this.currentStage === 'analyzing') {
      this.checkMilestones();
    }
    if (this.milestoneTicksRemaining > 0) {
      this.milestoneTicksRemaining--;
      if (this.milestoneTicksRemaining === 0) this.activeMilestone = null;
    }

    // Process streaming/queue
    this.processStreaming();

    // Render (bear only updates every 4th tick for CPU savings)
    this.render();
  }

  /** Process the streaming queue and character reveal */
  private processStreaming(): void {
    const now = Date.now();

    // If showing typing indicator, wait
    if (now < this.typingIndicatorUntil) return;

    // If nothing streaming and queue has items
    if (!this.streaming && this.messageQueue.length > 0) {
      if (!this.awaitingStreamStart) {
        // Show typing indicator first
        this.awaitingStreamStart = true;
        const next = this.messageQueue[0]; // peek, don't shift
        const delay = isTypeClassification(next.phase)
          ? TYPE_CLASSIFICATION_DELAY_MS
          : TYPING_INDICATOR_MS;
        this.typingIndicatorUntil = now + delay;
        return;
      }

      // Typing indicator completed — start streaming
      this.awaitingStreamStart = false;
      const next = this.messageQueue.shift()!;
      const elapsedStr = this.formatElapsed();
      const parts = getChatMessageParts(next.phase, next.snippets, elapsedStr);
      const fullLines = formatChatMessage(next.phase, next.snippets, elapsedStr);
      this.streaming = {
        phase: next.phase,
        snippets: next.snippets,
        fullLines,
        fullText: parts.contentText,  // content chars only (no box frame)
        parts,
        revealedChars: 0,
        pauseUntil: 0,
        startedAt: now,
      };
    }

    // Advance streaming if active
    if (this.streaming) {
      if (now < this.streaming.pauseUntil) return;

      const remaining = this.streaming.fullText.length - this.streaming.revealedChars;
      if (remaining <= 0) {
        // Message complete
        this.completedMessages.push({ lines: this.streaming.fullLines });
        this.streaming = null;
        this.typingIndicatorUntil = now + INTER_MESSAGE_GAP_MS;
        return;
      }

      // Reveal 2-4 characters
      const chunkSize = MIN_CHUNK + Math.floor(Math.random() * (MAX_CHUNK - MIN_CHUNK + 1));
      const newRevealed = Math.min(this.streaming.revealedChars + chunkSize, this.streaming.fullText.length);

      // Check for punctuation pause
      const revealedText = this.streaming.fullText.slice(0, newRevealed);
      const lastChar = revealedText[revealedText.length - 1];
      let pauseMs = 0;
      if (lastChar === ',' || lastChar === ';') pauseMs = COMMA_DELAY;
      else if (lastChar === '.' || lastChar === '!' || lastChar === '?') pauseMs = PERIOD_DELAY;
      else if (lastChar === '\n') pauseMs = NEWLINE_DELAY;

      // Add random variance
      if (pauseMs > 0) {
        pauseMs += Math.floor(Math.random() * VARIANCE * 2) - VARIANCE;
      }

      this.streaming.revealedChars = newRevealed;
      if (pauseMs > 0) {
        this.streaming.pauseUntil = now + pauseMs;
      }
    }
  }

  /** Check milestone thresholds */
  private checkMilestones(): void {
    for (const milestone of MILESTONES) {
      if (this.displayedProgress >= milestone.percent && this.lastMilestoneHit < milestone.percent) {
        this.lastMilestoneHit = milestone.percent;
        this.activeMilestone = milestone;
        this.milestoneTicksRemaining = MILESTONE_DISPLAY_TICKS;
      }
    }
  }

  /** Render the full terminal display */
  private render(): void {
    const termRows = process.stderr.rows || 40;
    const config = STAGE_CONFIGS[this.currentStage] || STAGE_CONFIGS.analyzing;
    const isAnalyzing = this.currentStage === 'analyzing';

    // Determine if we should use simple mode (small terminal)
    if (termRows < MIN_TERMINAL_ROWS) {
      this.renderSimple(config);
      return;
    }

    // -- Bear Expression --
    let expression: ChippyExpression;
    if (this.currentStage === 'complete') {
      expression = 'excited';
    } else if (this.activeMilestone) {
      expression = this.activeMilestone.expression;
    } else {
      // Use tick / BEAR_UPDATE_DIVISOR for bear frame to slow it down
      expression = getAnimationFrame(THINKING_FRAMES, Math.floor(this.tick / BEAR_UPDATE_DIVISOR));
    }

    // -- Bubble --
    let bubbleText: string | null = null;
    if (isAnalyzing && this.bubbleMessages.length > 0) {
      if (this.activeMilestone) {
        bubbleText = this.activeMilestone.bubble;
      } else {
        const bubbleIdx = Math.floor(this.tick / BUBBLE_ROTATION_TICKS) % this.bubbleMessages.length;
        bubbleText = this.bubbleMessages[bubbleIdx];
      }
    }

    const bearLines = getLargeChipCharacterWithBubble(expression, Math.floor(this.tick / BEAR_UPDATE_DIVISOR), bubbleText);

    // -- Spinner + Status --
    const spinnerChar = pc.cyan(SPINNER_FRAMES[this.spinnerFrameIndex]);
    let statusLine: string;
    if (isAnalyzing) {
      const statusMsg = getAnalyzingStatusMessage(Math.floor(this.tick / BEAR_UPDATE_DIVISOR));
      statusLine = `${spinnerChar}  ${config.color(statusMsg)}`;
    } else {
      const iconPart = config.icon ? `${config.icon} ` : '';
      statusLine = `${spinnerChar}  ${iconPart}${config.color(this.currentMessage)}`;
    }

    // -- Progress Bar --
    const elapsed = this.formatElapsed();
    const progressBar = this.renderProgressBar(this.displayedProgress);
    const shouldShowTimeHint = this.currentStage !== 'storing' && this.currentStage !== 'complete';
    const timeHint = shouldShowTimeHint ? pc.dim('  Usually takes 5-10 min') : '';
    const progressLine = `  ${progressBar}  ${pc.dim(`${elapsed} elapsed`)}${timeHint}`;

    // -- Tip Line --
    let tipLine = '';
    if (isAnalyzing && this.tipMessages.length > 0) {
      const tipIdx = Math.floor(this.tick / TIP_ROTATION_TICKS) % this.tipMessages.length;
      const tip = this.tipMessages[tipIdx];
      tipLine = `  ${tip.icon} ${pc.dim(tip.text)}`;
    }

    // -- Chat Messages --
    const termCols = process.stderr.columns || 80;
    const useBoxDiagram = termCols >= BOX_DIAGRAM_MIN_WIDTH;
    const pipelineExtraLines = this.showPipeline ? (useBoxDiagram ? 5 : 3) : 0;  // box: 4 lines + 1 spacer, flat: 2 lines + 1 spacer
    const effectiveChromeLines = FIXED_CHROME_LINES + pipelineExtraLines;
    const chatAreaHeight = Math.max(termRows - effectiveChromeLines, 3);
    const chatLines = this.buildChatLines(chatAreaHeight);

    // -- Assemble --
    const lines: string[] = [
      '',                                           // 0: spacer
      `  ${statusLine}`,                            // 1: status
      '',                                           // 2: spacer
      ...bearLines.map(l => `    ${l}`),             // 3-10: bear (8 lines)
    ];

    // Pipeline diagram (between bear and Live Results)
    if (this.showPipeline) {
      lines.push('');  // spacer
      const diagramLines = useBoxDiagram
        ? renderPipelineDiagram(this.pipelineState, this.tick)
        : renderFlatPipelineDiagram(this.pipelineState, this.tick);
      lines.push(...diagramLines);
    }

    // Only show chat section if we have messages or are streaming
    const hasChat = this.completedMessages.length > 0 || this.streaming || this.messageQueue.length > 0;
    if (hasChat) {
      lines.push(`  ${pc.dim('\u2500\u2500 Live Results \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500')}`);
      lines.push(...chatLines);
    }

    lines.push(progressLine);                       // progress bar
    lines.push(tipLine);                            // tip / blank

    this.logUpdate(lines.join('\n'));
  }

  /** Simple mode for small terminals (no chat, just progress) */
  private renderSimple(config: StageConfig): void {
    const spinnerChar = pc.cyan(SPINNER_FRAMES[this.spinnerFrameIndex]);
    const iconPart = config.icon ? `${config.icon} ` : '';
    const elapsed = this.formatElapsed();
    const progressBar = this.renderProgressBar(this.displayedProgress);

    const lines = [
      `${spinnerChar}  ${iconPart}${config.color(this.currentMessage)}`,
      `  ${progressBar}  ${pc.dim(`${elapsed} elapsed`)}`,
    ];

    this.logUpdate(lines.join('\n'));
  }

  /** Build the chat message lines for the visible area */
  private buildChatLines(maxLines: number): string[] {
    const allLines: string[] = [];

    // Completed messages
    for (const msg of this.completedMessages) {
      allLines.push(...msg.lines);
      allLines.push('');  // spacer between messages
    }

    // Currently streaming message (instant box frame + partial content)
    if (this.streaming) {
      const isComplete = this.streaming.revealedChars >= this.streaming.fullText.length;
      const cursorStr = isComplete ? null : pc.cyan(CURSOR_CHAR);
      const partialLines = renderPartialBoxMessage(
        this.streaming.parts,
        this.streaming.revealedChars,
        cursorStr
      );
      allLines.push(...partialLines);
      allLines.push('');
    } else if (Date.now() < this.typingIndicatorUntil && this.messageQueue.length > 0) {
      // Typing indicator
      const dots = '.'.repeat((Math.floor(this.tick / 6) % 3) + 1);
      allLines.push(`  ${pc.dim(`\u{1F43B} ${dots}`)}`);
      allLines.push('');
    }

    // Trim to fit visible area (keep newest)
    if (allLines.length > maxLines) {
      return allLines.slice(allLines.length - maxLines);
    }

    // Pad with empty lines if needed
    while (allLines.length < maxLines) {
      allLines.push('');
    }

    return allLines;
  }

  /** Format elapsed time as M:SS */
  private formatElapsed(): string {
    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const minutes = Math.floor(elapsed / 60);
    const seconds = elapsed % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }

  /** Render a progress bar */
  private renderProgressBar(progress: number): string {
    const width = 40;
    const filled = Math.floor((progress / 100) * width);
    const empty = width - filled;

    let colorFn: (text: string) => string;
    if (progress >= 90) colorFn = pc.green;
    else if (progress >= 75) colorFn = pc.blue;
    else if (progress >= 50) colorFn = pc.cyan;
    else colorFn = pc.yellow;

    const filledBar = colorFn('\u2588'.repeat(filled));
    const emptyBar = pc.dim('\u2591'.repeat(empty));
    const percentStr = `${progress}%`.padStart(4);
    return `${filledBar}${emptyBar}  ${percentStr}`;
  }
}

/**
 * Create a new chat display instance
 */
export function createChatDisplay(options: ChatDisplayOptions = {}): ChatDisplay {
  return new ChatDisplay(options);
}
