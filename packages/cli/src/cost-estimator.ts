/**
 * Cost Estimator - Token counting and API cost calculation for CLI
 *
 * Estimates the cost of running analysis based on:
 * - Phase1Output size (estimated from session message counts)
 * - System prompt overhead per LLM stage
 * - Expected output tokens per stage
 * - Model-specific pricing
 *
 * Multi-phase pipeline (5-6 LLM calls):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: 3 insight workers in parallel (ThinkingQuality,
 *            LearningBehavior, ContextEfficiency)
 * - Phase 2.5: TypeClassifier (1 LLM call)
 * - Phase 3: ContentWriter (1 LLM call, always English)
 * - Phase 4: Translator (1 LLM call, conditional — only for non-English users)
 *
 * // SYNC: Keep in sync with src/lib/analyzer/cost-estimator.ts
 */

import pc from 'picocolors';
import type { ParsedSession } from './session-formatter.js';

/**
 * Model pricing configuration (per token)
 * Gemini 3 Flash is used for the multi-phase analysis pipeline
 */
const GEMINI_PRICING = {
  'gemini-3-flash-preview': {
    input: 0.5 / 1_000_000, // $0.50 per 1M tokens
    output: 3.0 / 1_000_000, // $3.00 per 1M tokens
    name: 'Gemini 3 Flash',
  },
};

/**
 * System prompt tokens per LLM stage (approximate)
 */
const SYSTEM_PROMPT_TOKENS_PER_STAGE = 2500;

/**
 * Schema overhead tokens per LLM stage
 */
const SCHEMA_OVERHEAD_PER_STAGE = 1500;

/**
 * Per-stage overhead (system prompt + schema)
 */
const STAGE_OVERHEAD = SYSTEM_PROMPT_TOKENS_PER_STAGE + SCHEMA_OVERHEAD_PER_STAGE;

/**
 * Number of LLM stages in the pipeline (5 base, +1 conditional translator)
 */
const PIPELINE_LLM_STAGES = 6;

/**
 * Estimated output tokens per stage
 */
const ESTIMATED_OUTPUT_PER_STAGE = {
  thinkingQuality: 10000,    // Anti-patterns, habits, patterns
  learningBehavior: 8000,    // Mistakes, knowledge gaps
  contextEfficiency: 4000,   // Token efficiency
  typeClassifier: 2000,
  contentWriter: 12000,
  translator: 10000,
};

/**
 * Phase1 sampling limits (must match src/lib/analyzer/shared/constants.ts)
 */
const PHASE1_MAX_UTTERANCES = 500;
const PHASE1_MAX_AI_RESPONSES = 350;

/**
 * Phase1Output token estimation constants
 */
const TOKENS_PER_UTTERANCE = 250;
const TOKENS_PER_AI_RESPONSE = 100;

/**
 * Stage-specific breakdown for cost estimation
 */
export interface StageBreakdown {
  phase2WorkersInput: number;
  typeClassifierInput: number;
  contentWriterInput: number;
  translatorInput: number;
  systemPromptOverhead: number;
  schemaOverhead: number;
}

export interface CostEstimate {
  totalInputTokens: number;
  estimatedOutputTokens: number;
  totalCost: number;
  breakdown: StageBreakdown;
  modelName: string;
}

/**
 * Count regex matches in text, returning 0 if no matches
 */
function countMatches(text: string, pattern: RegExp): number {
  return text.match(pattern)?.length ?? 0;
}

/**
 * Legacy token counter for raw content (used during scanning)
 * @deprecated Use estimatePhase1OutputTokens for accurate estimation
 */
export function countTokensAccurate(text: string): number {
  if (!text) return 0;

  const baseCount = text.length / 4;
  const codeBlockBonus = countMatches(text, /```[\s\S]*?```/g) * 50;
  const jsonBraceBonus = countMatches(text, /[{}[\]]/g) * 0.5;
  const newlineBonus = countMatches(text, /\n/g) * 0.1;
  const specialCharBonus = countMatches(text, /[<>()=;:,."'`]/g) * 0.1;

  return Math.ceil(baseCount + codeBlockBonus + jsonBraceBonus + newlineBonus + specialCharBonus);
}

/** Session metrics overhead for structured metadata */
const METRICS_OVERHEAD_TOKENS = 500;

/** Approximate ratio of user messages in a session */
const USER_MESSAGE_RATIO = 0.6;

/**
 * Estimate Phase1Output token count from session data
 */
function estimatePhase1OutputTokens(sessions: ParsedSession[]): number {
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

  const userMessages = Math.ceil(totalMessages * USER_MESSAGE_RATIO);
  const assistantMessages = totalMessages - userMessages;

  const sampledUtterances = Math.min(userMessages, PHASE1_MAX_UTTERANCES);
  const sampledAiResponses = Math.min(assistantMessages, PHASE1_MAX_AI_RESPONSES);

  return (
    sampledUtterances * TOKENS_PER_UTTERANCE +
    sampledAiResponses * TOKENS_PER_AI_RESPONSE +
    METRICS_OVERHEAD_TOKENS
  );
}

/** Fixed input token estimates for specific stages */
const STAGE_INPUT_ESTIMATES = {
  typeClassifier: 6000,
  contentWriter: 9500,
  translator: 14000,
  phase2WorkerCount: 3,
} as const;

/**
 * Calculate total output tokens across all stages
 */
function calculateTotalOutputTokens(): number {
  return Object.values(ESTIMATED_OUTPUT_PER_STAGE).reduce((sum, tokens) => sum + tokens, 0);
}

/**
 * Estimate the cost of running analysis on parsed sessions
 */
export function estimateAnalysisCost(sessions: ParsedSession[]): CostEstimate {
  const pricing = GEMINI_PRICING['gemini-3-flash-preview'];
  const phase1OutputTokens = estimatePhase1OutputTokens(sessions);

  const systemPromptOverhead = SYSTEM_PROMPT_TOKENS_PER_STAGE * PIPELINE_LLM_STAGES;
  const schemaOverhead = SCHEMA_OVERHEAD_PER_STAGE * PIPELINE_LLM_STAGES;

  const phase2WorkersInput = STAGE_INPUT_ESTIMATES.phase2WorkerCount * (phase1OutputTokens + STAGE_OVERHEAD);
  const typeClassifierInput = STAGE_INPUT_ESTIMATES.typeClassifier + STAGE_OVERHEAD;
  const contentWriterInput = STAGE_INPUT_ESTIMATES.contentWriter + STAGE_OVERHEAD;
  const translatorInput = STAGE_INPUT_ESTIMATES.translator + STAGE_OVERHEAD;

  const totalInputTokens = phase2WorkersInput + typeClassifierInput + contentWriterInput + translatorInput;
  const totalOutputTokens = calculateTotalOutputTokens();
  const totalCost = totalInputTokens * pricing.input + totalOutputTokens * pricing.output;

  return {
    totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    totalCost,
    breakdown: {
      phase2WorkersInput,
      typeClassifierInput,
      contentWriterInput,
      translatorInput,
      systemPromptOverhead,
      schemaOverhead,
    },
    modelName: pricing.name,
  };
}

/**
 * Render the cost estimate for terminal display
 */
export function renderCostEstimate(
  estimate: CostEstimate,
  sessionCount: number
): string {
  const lines: string[] = [];

  lines.push('');
  lines.push(pc.bold(pc.cyan('  💰 Analysis Cost Estimate')));
  lines.push('');
  lines.push(`  ${pc.dim('Sessions to analyze:')} ${pc.white(sessionCount.toString())}`);
  lines.push(`  ${pc.dim('Model:')} ${pc.white(estimate.modelName)}`);
  lines.push(`  ${pc.dim('Pipeline:')} ${pc.white('6-7 LLM calls (Workers → TypeClassifier → Content → Translator)')}`);
  lines.push('');
  lines.push(`  ${pc.dim('Input tokens:')} ${pc.white(estimate.totalInputTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('├─ Phase 2 Workers (4x):')} ${estimate.breakdown.phase2WorkersInput.toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ TypeClassifier:')} ${estimate.breakdown.typeClassifierInput.toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ Content Writer:')} ${estimate.breakdown.contentWriterInput.toLocaleString()}`);
  lines.push(`    ${pc.dim('└─ Translator:')} ${estimate.breakdown.translatorInput.toLocaleString()}`);
  lines.push(`  ${pc.dim('Output tokens (est):')} ${pc.white(estimate.estimatedOutputTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('├─ Phase 2 Workers:')} ${(ESTIMATED_OUTPUT_PER_STAGE.thinkingQuality + ESTIMATED_OUTPUT_PER_STAGE.learningBehavior + ESTIMATED_OUTPUT_PER_STAGE.contextEfficiency).toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ TypeClassifier:')} ${ESTIMATED_OUTPUT_PER_STAGE.typeClassifier.toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ Content Writer:')} ${ESTIMATED_OUTPUT_PER_STAGE.contentWriter.toLocaleString()}`);
  lines.push(`    ${pc.dim('└─ Translator:')} ${ESTIMATED_OUTPUT_PER_STAGE.translator.toLocaleString()}`);
  lines.push('');

  // Cost box
  const costStr = `$${estimate.totalCost.toFixed(4)}`;
  lines.push(pc.green(`  ╔══════════════════════════════════╗`));
  lines.push(pc.green(`  ║  ${pc.bold('Estimated Cost:')} ${pc.bold(pc.yellow(costStr.padEnd(15)))} ║`));
  lines.push(pc.green(`  ╚══════════════════════════════════╝`));
  lines.push('');
  lines.push(pc.dim('  Note: Actual cost may vary. Translator runs only for non-English users.'));
  lines.push('');

  return lines.join('\n');
}
