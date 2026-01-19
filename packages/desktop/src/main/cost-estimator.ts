/**
 * Cost Estimator - Token counting and API cost calculation
 *
 * Estimates the cost of running analysis based on:
 * - Session content token count (with truncation matching actual stages)
 * - System prompt overhead per stage
 * - Expected output tokens per stage
 * - Model-specific pricing
 *
 * Three-stage pipeline:
 * - Stage 1A: Data Analyst (input: sessions, output: StructuredAnalysisData)
 * - Stage 1B: Personality Analyst (input: sessions, output: PersonalityProfile)
 * - Stage 2: Content Writer (input: Stage 1A + 1B outputs, output: final report)
 *
 * Based on CLI package implementation, adapted for Electron (CJS).
 */

import type { ParsedSession } from './session-formatter';
import {
  countFormattedTokens,
  DATA_ANALYST_FORMAT,
  PERSONALITY_ANALYST_FORMAT,
} from './session-formatter';

/**
 * Model pricing configuration (per token)
 * Gemini 3 Flash is used for the three-stage analysis pipeline
 */
const GEMINI_PRICING = {
  'gemini-3-flash-preview': {
    input: 0.5 / 1_000_000, // $0.50 per 1M tokens
    output: 3.0 / 1_000_000, // $3.00 per 1M tokens
    name: 'Gemini 3 Flash',
  },
};

/**
 * System prompt tokens per stage (approximate)
 */
const SYSTEM_PROMPT_TOKENS_PER_STAGE = 2500;

/**
 * Schema overhead tokens per stage
 */
const SCHEMA_OVERHEAD_PER_STAGE = 1500;

/**
 * Number of LLM stages in the pipeline
 */
const PIPELINE_STAGES = 3;

/**
 * Estimated output tokens per stage (generous 2x buffer)
 * - Data Analyst: ~8000 (structured data extraction)
 * - Personality Analyst: ~4000 (personality profile)
 * - Content Writer: ~12000 (final narrative report)
 */
const ESTIMATED_OUTPUT_PER_STAGE = {
  dataAnalyst: 8000,
  personalityAnalyst: 4000,
  contentWriter: 12000,
};

/**
 * Content Writer receives Stage 1A + 1B outputs as input
 * Estimate based on typical output sizes
 */
const CONTENT_WRITER_INPUT_FROM_STAGES = 12000;

/**
 * Stage-specific breakdown for cost estimation
 */
export interface StageBreakdown {
  dataAnalystInput: number;
  personalityAnalystInput: number;
  contentWriterInput: number;
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
 * @deprecated Use countFormattedTokens for accurate estimation
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
 * Estimate the cost of running analysis on parsed sessions
 * Uses the same truncation logic as actual analysis stages
 */
export function estimateAnalysisCost(sessions: ParsedSession[]): CostEstimate {
  const pricing = GEMINI_PRICING['gemini-3-flash-preview'];

  // Calculate session tokens using the same truncation as actual stages
  const dataAnalystSessionTokens = countFormattedTokens(sessions, DATA_ANALYST_FORMAT);
  const personalitySessionTokens = countFormattedTokens(sessions, PERSONALITY_ANALYST_FORMAT);

  // System prompt and schema overhead for each stage
  const systemPromptOverhead = SYSTEM_PROMPT_TOKENS_PER_STAGE * PIPELINE_STAGES;
  const schemaOverhead = SCHEMA_OVERHEAD_PER_STAGE * PIPELINE_STAGES;

  // Total input tokens per stage
  const dataAnalystInput = dataAnalystSessionTokens + SYSTEM_PROMPT_TOKENS_PER_STAGE + SCHEMA_OVERHEAD_PER_STAGE;
  const personalityInput = personalitySessionTokens + SYSTEM_PROMPT_TOKENS_PER_STAGE + SCHEMA_OVERHEAD_PER_STAGE;
  const contentWriterInput = CONTENT_WRITER_INPUT_FROM_STAGES + SYSTEM_PROMPT_TOKENS_PER_STAGE + SCHEMA_OVERHEAD_PER_STAGE;

  const totalInputTokens = dataAnalystInput + personalityInput + contentWriterInput;

  // Total output tokens
  const totalOutputTokens =
    ESTIMATED_OUTPUT_PER_STAGE.dataAnalyst +
    ESTIMATED_OUTPUT_PER_STAGE.personalityAnalyst +
    ESTIMATED_OUTPUT_PER_STAGE.contentWriter;

  const totalCost = totalInputTokens * pricing.input + totalOutputTokens * pricing.output;

  return {
    totalInputTokens,
    estimatedOutputTokens: totalOutputTokens,
    totalCost,
    breakdown: {
      dataAnalystInput,
      personalityAnalystInput: personalityInput,
      contentWriterInput,
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
    dataAnalyst: number;
    personalityAnalyst: number;
    contentWriter: number;
  };
  outputBreakdown: {
    dataAnalyst: number;
    personalityAnalyst: number;
    contentWriter: number;
  };
} {
  return {
    sessionCount,
    modelName: estimate.modelName,
    pipeline: '3-stage (Data → Personality → Content)',
    totalInputTokens: estimate.totalInputTokens,
    totalOutputTokens: estimate.estimatedOutputTokens,
    totalCost: `$${estimate.totalCost.toFixed(4)}`,
    breakdown: {
      dataAnalyst: estimate.breakdown.dataAnalystInput,
      personalityAnalyst: estimate.breakdown.personalityAnalystInput,
      contentWriter: estimate.breakdown.contentWriterInput,
    },
    outputBreakdown: {
      dataAnalyst: ESTIMATED_OUTPUT_PER_STAGE.dataAnalyst,
      personalityAnalyst: ESTIMATED_OUTPUT_PER_STAGE.personalityAnalyst,
      contentWriter: ESTIMATED_OUTPUT_PER_STAGE.contentWriter,
    },
  };
}
