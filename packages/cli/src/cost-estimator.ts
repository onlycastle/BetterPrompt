/**
 * Cost Estimator - Token counting and API cost calculation for CLI
 *
 * Estimates the cost of running analysis based on:
 * - Session content token count
 * - System prompt overhead
 * - Expected output tokens
 * - Model-specific pricing
 */

import pc from 'picocolors';
import type { ScanResult } from './scanner.js';

/**
 * Model pricing configuration (per token)
 * Gemini 3 Flash is used for the two-stage analysis pipeline
 */
const GEMINI_PRICING = {
  'gemini-3-flash-preview': {
    input: 0.5 / 1_000_000, // $0.50 per 1M tokens
    output: 3.0 / 1_000_000, // $3.00 per 1M tokens
    name: 'Gemini 3 Flash',
  },
};

/**
 * Fixed overhead estimates
 */
const ESTIMATED_SYSTEM_PROMPT_TOKENS = 2500;
const ESTIMATED_SCHEMA_OVERHEAD = 1500;
const ESTIMATED_OUTPUT_TOKENS = 6000;

export interface CostEstimate {
  totalInputTokens: number;
  estimatedOutputTokens: number;
  totalCost: number;
  breakdown: {
    sessionTokens: number;
    systemPromptTokens: number;
    schemaOverhead: number;
  };
  modelName: string;
}

/**
 * Count tokens using character-based heuristics
 * with adjustments for common patterns in JSONL content
 */
function countTokensAccurate(text: string): number {
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
 * Estimate the cost of running analysis on scanned sessions
 */
export function estimateAnalysisCost(scanResult: ScanResult): CostEstimate {
  const pricing = GEMINI_PRICING['gemini-3-flash-preview'];

  // Calculate session content tokens from raw JSONL
  let sessionTokens = 0;
  for (const session of scanResult.sessions) {
    sessionTokens += countTokensAccurate(session.content);
  }

  const totalInputTokens =
    sessionTokens + ESTIMATED_SYSTEM_PROMPT_TOKENS + ESTIMATED_SCHEMA_OVERHEAD;

  const totalCost =
    totalInputTokens * pricing.input + ESTIMATED_OUTPUT_TOKENS * pricing.output;

  return {
    totalInputTokens,
    estimatedOutputTokens: ESTIMATED_OUTPUT_TOKENS,
    totalCost,
    breakdown: {
      sessionTokens,
      systemPromptTokens: ESTIMATED_SYSTEM_PROMPT_TOKENS,
      schemaOverhead: ESTIMATED_SCHEMA_OVERHEAD,
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
  lines.push('');
  lines.push(`  ${pc.dim('Input tokens:')} ${pc.white(estimate.totalInputTokens.toLocaleString())}`);
  lines.push(`    ${pc.dim('├─ Session content:')} ${estimate.breakdown.sessionTokens.toLocaleString()}`);
  lines.push(`    ${pc.dim('├─ System prompt:')} ${estimate.breakdown.systemPromptTokens.toLocaleString()}`);
  lines.push(`    ${pc.dim('└─ Schema overhead:')} ${estimate.breakdown.schemaOverhead.toLocaleString()}`);
  lines.push(`  ${pc.dim('Output tokens (est):')} ${pc.white(estimate.estimatedOutputTokens.toLocaleString())}`);
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
