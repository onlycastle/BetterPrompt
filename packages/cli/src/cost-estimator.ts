/**
 * Cost Estimator - Token counting and API cost calculation for CLI
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
 */

import pc from 'picocolors';
import type { ParsedSession } from './session-formatter.js';
import {
  countFormattedTokens,
  DATA_ANALYST_FORMAT,
  PERSONALITY_ANALYST_FORMAT,
} from './session-formatter.js';

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
  lines.push(`  ${pc.dim('Pipeline:')} ${pc.white('3-stage (Data → Personality → Content)')}`);
  lines.push('');
  lines.push(`  ${pc.dim('Input tokens:')} ${pc.white(estimate.totalInputTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('├─ Data Analyst:')} ${estimate.breakdown.dataAnalystInput.toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ Personality Analyst:')} ${estimate.breakdown.personalityAnalystInput.toLocaleString()}`);
  lines.push(`    ${pc.dim('└─ Content Writer:')} ${estimate.breakdown.contentWriterInput.toLocaleString()}`);
  lines.push(`  ${pc.dim('Output tokens (est):')} ${pc.white(estimate.estimatedOutputTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('├─ Data Analyst:')} ${ESTIMATED_OUTPUT_PER_STAGE.dataAnalyst.toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ Personality Analyst:')} ${ESTIMATED_OUTPUT_PER_STAGE.personalityAnalyst.toLocaleString()}`);
  lines.push(`    ${pc.dim('└─ Content Writer:')} ${ESTIMATED_OUTPUT_PER_STAGE.contentWriter.toLocaleString()}`);
  lines.push('');

  // Cost box
  const costStr = `$${estimate.totalCost.toFixed(4)}`;
  lines.push(pc.green(`  ╔══════════════════════════════════╗`));
  lines.push(pc.green(`  ║  ${pc.bold('Estimated Cost:')} ${pc.bold(pc.yellow(costStr.padEnd(15)))} ║`));
  lines.push(pc.green(`  ╚══════════════════════════════════╝`));
  lines.push('');
  lines.push(pc.dim('  Note: Actual cost may vary slightly.'));
  lines.push('');

  return lines.join('\n');
}
