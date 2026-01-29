/**
 * Cost Estimator - Token counting and API cost calculation
 *
 * Estimates the cost of running verbose analysis based on:
 * - Phase1Output size (estimated from session message counts)
 * - System prompt overhead per LLM stage
 * - Expected output tokens per stage
 * - Model-specific pricing
 *
 * Multi-phase pipeline (6-7 LLM calls):
 * - Phase 1: DataExtractor (deterministic, no LLM)
 * - Phase 2: 4 insight workers in parallel (TrustVerification,
 *            WorkflowHabit, KnowledgeGap, ContextEfficiency)
 * - Phase 2.5: TypeClassifier (1 LLM call)
 * - Phase 3: ContentWriter (1 LLM call, always English)
 * - Phase 4: Translator (1 LLM call, conditional — only for non-English users)
 */

import { type ParsedSession } from '../domain/models/analysis';
import { PHASE1_MAX_UTTERANCES, PHASE1_MAX_AI_RESPONSES } from './shared/constants';

/**
 * Model pricing configuration
 */
type ModelPricing = Record<string, { input: number; output: number; name: string }>;

/**
 * Google Gemini pricing as of 2025 (per token)
 * Source: https://ai.google.dev/gemini-api/docs/pricing
 */
export const GEMINI_PRICING: ModelPricing = {
  'gemini-3-flash-preview': {
    input: 0.5 / 1_000_000, // $0.50 per 1M tokens
    output: 3.0 / 1_000_000, // $3.00 per 1M tokens
    name: 'Gemini 3 Flash',
  },
  'gemini-3-flash': {
    input: 0.5 / 1_000_000,
    output: 3.0 / 1_000_000,
    name: 'Gemini 3 Flash',
  },
};

/**
 * Stage-specific breakdown for cost estimation
 *
 * Reflects the current multi-phase pipeline:
 * - phase2Workers: 4 parallel LLM calls (TrustVerification, WorkflowHabit, KnowledgeGap, ContextEfficiency)
 * - typeClassifier: Phase 2.5 (1 LLM call)
 * - contentWriter: Phase 3 (1 LLM call)
 * - translator: Phase 4 (1 LLM call, conditional)
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
  model: string;
  modelName: string;
}

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
 * Number of LLM stages in the pipeline (6 base, +1 conditional translator)
 * - Phase 2: 4 workers (TrustVerification, WorkflowHabit, KnowledgeGap, ContextEfficiency)
 * - Phase 2.5: TypeClassifier (1 call)
 * - Phase 3: ContentWriter (1 call)
 * - Phase 4: Translator (1 call, conditional)
 */
const PIPELINE_LLM_STAGES = 7;

/**
 * Estimated output tokens per stage
 */
const ESTIMATED_OUTPUT_PER_STAGE = {
  trustVerification: 8000,
  workflowHabit: 8000,
  knowledgeGap: 4000,
  contextEfficiency: 4000,
  typeClassifier: 2000,
  contentWriter: 12000,
  translator: 10000,
};

/**
 * Phase1Output token estimation constants
 * Per-utterance: ~250 tokens (text + metadata)
 * Per-AI-response: ~100 tokens (summary)
 */
const TOKENS_PER_UTTERANCE = 250;
const TOKENS_PER_AI_RESPONSE = 100;

/**
 * Estimate Phase1Output token count from session data
 *
 * Phase1Output contains sampled developer utterances and AI response summaries.
 * DataExtractor samples up to PHASE1_MAX_UTTERANCES and PHASE1_MAX_AI_RESPONSES.
 */
export function estimatePhase1OutputTokens(sessions: ParsedSession[]): number {
  // Count total messages across all sessions
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
 * Estimate the cost of running verbose analysis
 *
 * Default model is Gemini 3 Flash (multi-phase pipeline).
 * Falls back to Gemini pricing for unknown models.
 */
export function estimateAnalysisCost(
  sessions: ParsedSession[],
  model: string = 'gemini-3-flash-preview'
): CostEstimate {
  const pricing = GEMINI_PRICING[model];
  if (!pricing) {
    const fallbackPricing = GEMINI_PRICING['gemini-3-flash-preview'];
    return estimateWithPricing(sessions, model, fallbackPricing, 'Unknown Model');
  }

  return estimateWithPricing(sessions, model, pricing, pricing.name);
}

function estimateWithPricing(
  sessions: ParsedSession[],
  model: string,
  pricing: { input: number; output: number },
  modelName: string
): CostEstimate {
  // Estimate Phase1Output size (shared input for Phase 2 workers)
  const phase1OutputTokens = estimatePhase1OutputTokens(sessions);

  // System prompt and schema overhead across all LLM stages
  const systemPromptOverhead = SYSTEM_PROMPT_TOKENS_PER_STAGE * PIPELINE_LLM_STAGES;
  const schemaOverhead = SCHEMA_OVERHEAD_PER_STAGE * PIPELINE_LLM_STAGES;

  // Phase 2: 4 workers, each receives Phase1Output + overhead
  const phase2WorkersInput = 4 * (phase1OutputTokens + STAGE_OVERHEAD);

  // Phase 2.5: TypeClassifier receives ~6K tokens (agent output summaries + overhead)
  const typeClassifierInput = 6000 + STAGE_OVERHEAD;

  // Phase 3: ContentWriter receives Phase1Output + AgentOutputs (~9.5K combined)
  const contentWriterInput = 9500 + STAGE_OVERHEAD;

  // Phase 4: Translator (conditional — receives ContentWriter output ~14K)
  const translatorInput = 14000 + STAGE_OVERHEAD;

  const totalInputTokens = phase2WorkersInput + typeClassifierInput + contentWriterInput + translatorInput;

  // Total output tokens
  const totalOutputTokens =
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
    model,
    modelName,
  };
}

/**
 * Format cost estimate for display
 */
export function formatCostEstimate(estimate: CostEstimate): string {
  const lines: string[] = [];

  lines.push(`Model: ${estimate.modelName}`);
  lines.push(`Input Tokens: ${estimate.totalInputTokens.toLocaleString()}`);
  lines.push(`  - Phase 2 Workers (4x): ${estimate.breakdown.phase2WorkersInput.toLocaleString()}`);
  lines.push(`  - TypeClassifier: ${estimate.breakdown.typeClassifierInput.toLocaleString()}`);
  lines.push(`  - Content Writer: ${estimate.breakdown.contentWriterInput.toLocaleString()}`);
  lines.push(`  - Translator: ${estimate.breakdown.translatorInput.toLocaleString()}`);
  lines.push(`Output Tokens (est): ${estimate.estimatedOutputTokens.toLocaleString()}`);
  lines.push(`Estimated Cost: $${estimate.totalCost.toFixed(4)}`);

  return lines.join('\n');
}

// ============================================================================
// ACTUAL TOKEN USAGE TRACKING (from API responses)
// ============================================================================

/**
 * Token usage for a single stage
 */
export interface StageTokenUsage {
  stage: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

/**
 * Aggregated token usage across all pipeline stages
 */
export interface PipelineTokenUsage {
  stages: StageTokenUsage[];
  totals: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: {
    inputCost: number;
    outputCost: number;
    totalCost: number;
  };
  model: string;
  modelName: string;
}

/**
 * Calculate actual cost from token usage
 */
export function calculateActualCost(
  usage: { promptTokens: number; completionTokens: number },
  model: string = 'gemini-3-flash-preview'
): { inputCost: number; outputCost: number; totalCost: number } {
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING['gemini-3-flash-preview'];

  const inputCost = usage.promptTokens * pricing.input;
  const outputCost = usage.completionTokens * pricing.output;
  const totalCost = inputCost + outputCost;

  return { inputCost, outputCost, totalCost };
}

/**
 * Aggregate token usage from multiple stages into a single summary
 */
export function aggregateTokenUsage(
  stages: StageTokenUsage[],
  model: string = 'gemini-3-flash-preview'
): PipelineTokenUsage {
  const totals = stages.reduce(
    (acc, stage) => ({
      promptTokens: acc.promptTokens + stage.promptTokens,
      completionTokens: acc.completionTokens + stage.completionTokens,
      totalTokens: acc.totalTokens + stage.totalTokens,
    }),
    { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  );

  const cost = calculateActualCost(totals, model);
  const pricing = GEMINI_PRICING[model] || GEMINI_PRICING['gemini-3-flash-preview'];

  return {
    stages,
    totals,
    cost,
    model,
    modelName: pricing.name,
  };
}

/**
 * Format actual token usage for logging
 */
export function formatActualUsage(usage: PipelineTokenUsage): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════════════════════');
  lines.push('  LLM PIPELINE TOKEN USAGE (Actual)');
  lines.push('═══════════════════════════════════════════════════════════');
  lines.push(`Model: ${usage.modelName}`);
  lines.push('');
  lines.push('Per-Stage Breakdown:');

  for (const stage of usage.stages) {
    lines.push(`  ${stage.stage}:`);
    lines.push(`    Input:  ${stage.promptTokens.toLocaleString()} tokens`);
    lines.push(`    Output: ${stage.completionTokens.toLocaleString()} tokens`);
  }

  lines.push('');
  lines.push('Totals:');
  lines.push(`  Input Tokens:  ${usage.totals.promptTokens.toLocaleString()}`);
  lines.push(`  Output Tokens: ${usage.totals.completionTokens.toLocaleString()}`);
  lines.push(`  Total Tokens:  ${usage.totals.totalTokens.toLocaleString()}`);
  lines.push('');
  lines.push('Cost:');
  lines.push(`  Input Cost:  $${usage.cost.inputCost.toFixed(6)}`);
  lines.push(`  Output Cost: $${usage.cost.outputCost.toFixed(6)}`);
  lines.push(`  Total Cost:  $${usage.cost.totalCost.toFixed(6)}`);
  lines.push('═══════════════════════════════════════════════════════════');

  return lines.join('\n');
}
