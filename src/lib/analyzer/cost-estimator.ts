/**
 * Cost Estimator - Token counting and API cost calculation
 *
 * Estimates the cost of running verbose analysis based on:
 * - Session content token count (using same truncation as actual stages)
 * - System prompt overhead per stage
 * - Expected output tokens per stage
 * - Model-specific pricing
 *
 * Three-stage pipeline:
 * - Stage 1A: Data Analyst (input: sessions, output: StructuredAnalysisData)
 * - Stage 1B: Personality Analyst (input: sessions, output: PersonalityProfile)
 * - Stage 2: Content Writer (input: Stage 1A + 1B outputs, output: final report)
 */

import { type ParsedSession } from '../domain/models/analysis';
import {
  countFormattedTokens,
  DATA_ANALYST_FORMAT,
  PERSONALITY_ANALYST_FORMAT,
} from './shared/session-formatter';

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
 * Anthropic pricing as of 2025 (per token)
 * Used for legacy single-stage mode fallback
 */
export const ANTHROPIC_PRICING: ModelPricing = {
  'claude-sonnet-4-20250514': {
    input: 3.0 / 1_000_000,
    output: 15.0 / 1_000_000,
    name: 'Claude Sonnet 4',
  },
  'claude-opus-4-20250514': {
    input: 15.0 / 1_000_000,
    output: 75.0 / 1_000_000,
    name: 'Claude Opus 4',
  },
  'claude-opus-4-5-20251101': {
    input: 15.0 / 1_000_000,
    output: 75.0 / 1_000_000,
    name: 'Claude Opus 4.5',
  },
  'claude-3-5-haiku-20241022': {
    input: 0.8 / 1_000_000,
    output: 4.0 / 1_000_000,
    name: 'Claude 3.5 Haiku',
  },
};

/**
 * Combined pricing lookup (Gemini first, then Anthropic for legacy)
 */
export const ALL_PRICING: ModelPricing = {
  ...GEMINI_PRICING,
  ...ANTHROPIC_PRICING,
};

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
  model: string;
  modelName: string;
}

/**
 * Count tokens more accurately using character-based heuristics
 * with adjustments for common patterns
 *
 * @deprecated Use countFormattedTokens from shared/session-formatter instead
 */
export function countTokensAccurate(text: string): number {
  if (!text) return 0;

  // Base estimate: ~4 chars per token for English
  let baseCount = text.length / 4;

  // Adjustments for code (more tokens due to symbols)
  const codeBlockMatches = text.match(/```[\s\S]*?```/g);
  const codeBlockCount = codeBlockMatches ? codeBlockMatches.length : 0;
  baseCount += codeBlockCount * 50; // Code blocks are token-heavy

  // JSON structure overhead
  const jsonBraceMatches = text.match(/[{}[\]]/g);
  const jsonBraceCount = jsonBraceMatches ? jsonBraceMatches.length : 0;
  baseCount += jsonBraceCount * 0.5;

  // Newlines and whitespace
  const newlineMatches = text.match(/\n/g);
  const newlineCount = newlineMatches ? newlineMatches.length : 0;
  baseCount += newlineCount * 0.1;

  // Special characters in code
  const specialCharMatches = text.match(/[<>()=;:,."'`]/g);
  const specialCharCount = specialCharMatches ? specialCharMatches.length : 0;
  baseCount += specialCharCount * 0.1;

  return Math.ceil(baseCount);
}

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
 * - Data Analyst (Stage 1A)
 * - Personality Analyst (Stage 1B)
 * - Content Writer (Stage 2)
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
 * Estimate based on typical output sizes (generous 2x buffer)
 */
const CONTENT_WRITER_INPUT_FROM_STAGES = 12000; // ~8000 + ~4000 from prior stages

/**
 * Estimate the cost of running verbose analysis
 *
 * Default model is Gemini 3 Flash (three-stage pipeline).
 * Falls back to Gemini pricing for unknown models.
 */
export function estimateAnalysisCost(
  sessions: ParsedSession[],
  model: string = 'gemini-3-flash-preview'
): CostEstimate {
  const pricing = ALL_PRICING[model];
  if (!pricing) {
    // Fallback to Gemini 3 Flash pricing for unknown models
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
  lines.push(`  - Data Analyst: ${estimate.breakdown.dataAnalystInput.toLocaleString()}`);
  lines.push(`  - Personality Analyst: ${estimate.breakdown.personalityAnalystInput.toLocaleString()}`);
  lines.push(`  - Content Writer: ${estimate.breakdown.contentWriterInput.toLocaleString()}`);
  lines.push(`Output Tokens (est): ${estimate.estimatedOutputTokens.toLocaleString()}`);
  lines.push(`Estimated Cost: $${estimate.totalCost.toFixed(4)}`);

  return lines.join('\n');
}
