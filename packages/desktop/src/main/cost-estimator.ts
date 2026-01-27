/**
 * Cost Estimator - Token counting and API cost calculation
 *
 * Estimates the cost of running analysis based on:
 * - Phase1Output size (estimated from session message counts)
 * - System prompt overhead per LLM stage
 * - Expected output tokens per stage
 * - Model-specific pricing
 *
 * Multi-phase pipeline (7-8 LLM calls):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: 5 insight workers in parallel (StrengthGrowth, TrustVerification,
 *            WorkflowHabit, KnowledgeGap, ContextEfficiency)
 * - Phase 2.5: TypeClassifier (1 LLM call)
 * - Phase 3: ContentWriter (1 LLM call, always English)
 * - Phase 4: Translator (1 LLM call, conditional — only for non-English users)
 *
 * Based on CLI package implementation, adapted for Electron (CJS).
 * // SYNC: Keep in sync with src/lib/analyzer/cost-estimator.ts
 */

import type { ParsedSession } from './session-formatter';

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
 * Number of LLM stages in the pipeline (7 base, +1 conditional translator)
 */
const PIPELINE_LLM_STAGES = 8;

/**
 * Estimated output tokens per stage
 */
const ESTIMATED_OUTPUT_PER_STAGE = {
  strengthGrowth: 8000,
  trustVerification: 8000,
  workflowHabit: 8000,
  knowledgeGap: 4000,
  contextEfficiency: 4000,
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
 * Legacy token counter for raw content (used during scanning)
 * @deprecated Use estimatePhase1OutputTokens for accurate estimation
 */
export function countTokensAccurate(text: string): number {
  if (!text) return 0;

  let baseCount = text.length / 4;

  const codeBlockMatches = text.match(/```[\s\S]*?```/g);
  const codeBlockCount = codeBlockMatches ? codeBlockMatches.length : 0;
  baseCount += codeBlockCount * 50;

  const jsonBraceMatches = text.match(/[{}[\]]/g);
  const jsonBraceCount = jsonBraceMatches ? jsonBraceMatches.length : 0;
  baseCount += jsonBraceCount * 0.5;

  const newlineMatches = text.match(/\n/g);
  const newlineCount = newlineMatches ? newlineMatches.length : 0;
  baseCount += newlineCount * 0.1;

  const specialCharMatches = text.match(/[<>()=;:,."'`]/g);
  const specialCharCount = specialCharMatches ? specialCharMatches.length : 0;
  baseCount += specialCharCount * 0.1;

  return Math.ceil(baseCount);
}

/**
 * Estimate Phase1Output token count from session data
 */
function estimatePhase1OutputTokens(sessions: ParsedSession[]): number {
  const totalMessages = sessions.reduce((sum, s) => sum + s.messages.length, 0);

  // Approximate: ~60% user messages, ~40% assistant messages
  const userMessages = Math.ceil(totalMessages * 0.6);
  const assistantMessages = totalMessages - userMessages;

  // Apply Phase 1 sampling limits
  const sampledUtterances = Math.min(userMessages, PHASE1_MAX_UTTERANCES);
  const sampledAiResponses = Math.min(assistantMessages, PHASE1_MAX_AI_RESPONSES);

  // Session metrics overhead (~500 tokens for structured metadata)
  const metricsOverhead = 500;

  return (sampledUtterances * TOKENS_PER_UTTERANCE) +
    (sampledAiResponses * TOKENS_PER_AI_RESPONSE) +
    metricsOverhead;
}

/**
 * Estimate the cost of running analysis on parsed sessions
 */
export function estimateAnalysisCost(sessions: ParsedSession[]): CostEstimate {
  const pricing = GEMINI_PRICING['gemini-3-flash-preview'];

  // Estimate Phase1Output size (shared input for Phase 2 workers)
  const phase1OutputTokens = estimatePhase1OutputTokens(sessions);

  // System prompt and schema overhead across all LLM stages
  const systemPromptOverhead = SYSTEM_PROMPT_TOKENS_PER_STAGE * PIPELINE_LLM_STAGES;
  const schemaOverhead = SCHEMA_OVERHEAD_PER_STAGE * PIPELINE_LLM_STAGES;

  // Phase 2: 5 workers, each receives Phase1Output + overhead
  const phase2WorkersInput = 5 * (phase1OutputTokens + STAGE_OVERHEAD);

  // Phase 2.5: TypeClassifier receives ~6K tokens (agent output summaries + overhead)
  const typeClassifierInput = 6000 + STAGE_OVERHEAD;

  // Phase 3: ContentWriter receives Phase1Output + AgentOutputs (~9.5K combined)
  const contentWriterInput = 9500 + STAGE_OVERHEAD;

  // Phase 4: Translator (conditional — receives ContentWriter output ~14K)
  const translatorInput = 14000 + STAGE_OVERHEAD;

  const totalInputTokens = phase2WorkersInput + typeClassifierInput + contentWriterInput + translatorInput;

  // Total output tokens
  const totalOutputTokens =
    ESTIMATED_OUTPUT_PER_STAGE.strengthGrowth +
    ESTIMATED_OUTPUT_PER_STAGE.trustVerification +
    ESTIMATED_OUTPUT_PER_STAGE.workflowHabit +
    ESTIMATED_OUTPUT_PER_STAGE.knowledgeGap +
    ESTIMATED_OUTPUT_PER_STAGE.contextEfficiency +
    ESTIMATED_OUTPUT_PER_STAGE.typeClassifier +
    ESTIMATED_OUTPUT_PER_STAGE.contentWriter +
    ESTIMATED_OUTPUT_PER_STAGE.translator;

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
 * Format cost estimate for display in UI
 * Returns plain object (React UI will handle formatting)
 */
export function formatCostEstimateForUI(
  estimate: CostEstimate,
  sessionCount: number
): {
  sessionCount: number;
  modelName: string;
  pipeline: string;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCost: string;
  breakdown: {
    phase2Workers: number;
    typeClassifier: number;
    contentWriter: number;
    translator: number;
  };
  outputBreakdown: {
    phase2Workers: number;
    typeClassifier: number;
    contentWriter: number;
    translator: number;
  };
} {
  return {
    sessionCount,
    modelName: estimate.modelName,
    pipeline: '7-8 LLM calls (Workers → TypeClassifier → Content → Translator)',
    totalInputTokens: estimate.totalInputTokens,
    totalOutputTokens: estimate.estimatedOutputTokens,
    totalCost: `$${estimate.totalCost.toFixed(4)}`,
    breakdown: {
      phase2Workers: estimate.breakdown.phase2WorkersInput,
      typeClassifier: estimate.breakdown.typeClassifierInput,
      contentWriter: estimate.breakdown.contentWriterInput,
      translator: estimate.breakdown.translatorInput,
    },
    outputBreakdown: {
      phase2Workers:
        ESTIMATED_OUTPUT_PER_STAGE.strengthGrowth +
        ESTIMATED_OUTPUT_PER_STAGE.trustVerification +
        ESTIMATED_OUTPUT_PER_STAGE.workflowHabit +
        ESTIMATED_OUTPUT_PER_STAGE.knowledgeGap +
        ESTIMATED_OUTPUT_PER_STAGE.contextEfficiency,
      typeClassifier: ESTIMATED_OUTPUT_PER_STAGE.typeClassifier,
      contentWriter: ESTIMATED_OUTPUT_PER_STAGE.contentWriter,
      translator: ESTIMATED_OUTPUT_PER_STAGE.translator,
    },
  };
}
