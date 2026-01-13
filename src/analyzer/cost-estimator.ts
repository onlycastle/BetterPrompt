/**
 * Cost Estimator - Token counting and API cost calculation
 *
 * Estimates the cost of running verbose analysis based on:
 * - Session content token count
 * - System prompt overhead
 * - Expected output tokens
 * - Model-specific pricing
 */

import { type ParsedSession } from '../domain/models/analysis.js';

/**
 * Anthropic pricing as of 2025 (per token)
 */
export const ANTHROPIC_PRICING: Record<
  string,
  { input: number; output: number; name: string }
> = {
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

export interface CostEstimate {
  totalInputTokens: number;
  estimatedOutputTokens: number;
  totalCost: number;
  breakdown: {
    sessionTokens: number;
    systemPromptTokens: number;
    schemaOverhead: number;
  };
  model: string;
  modelName: string;
}

/**
 * Count tokens more accurately using character-based heuristics
 * with adjustments for common patterns
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
  const jsonBraceMatches = text.match(/[{}\[\]]/g);
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
 * Format a session for token counting
 */
function formatSessionForCounting(session: ParsedSession): string {
  const lines: string[] = [];

  for (const message of session.messages) {
    const role = message.role === 'user' ? 'DEVELOPER' : 'CLAUDE';
    lines.push(`[${role}]:`);

    if (message.content) {
      lines.push(message.content);
    }

    if (message.toolCalls?.length) {
      for (const tool of message.toolCalls) {
        lines.push(`[Tool: ${tool.name}]`);
        if (tool.result) {
          const result =
            tool.result.length > 500 ? tool.result.slice(0, 500) + '...' : tool.result;
          lines.push(`[Result: ${result}]`);
        }
      }
    }
  }

  return lines.join('\n');
}

/**
 * Estimate system prompt tokens (approximate)
 */
const ESTIMATED_SYSTEM_PROMPT_TOKENS = 2500;

/**
 * Estimate schema overhead tokens
 */
const ESTIMATED_SCHEMA_OVERHEAD = 1500;

/**
 * Estimate output tokens for verbose analysis
 */
const ESTIMATED_OUTPUT_TOKENS = 6000;

/**
 * Estimate the cost of running verbose analysis
 */
export function estimateAnalysisCost(
  sessions: ParsedSession[],
  model: string = 'claude-sonnet-4-20250514'
): CostEstimate {
  const pricing = ANTHROPIC_PRICING[model];
  if (!pricing) {
    // Fallback to sonnet pricing
    const fallbackPricing = ANTHROPIC_PRICING['claude-sonnet-4-20250514'];
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
  // Calculate session content tokens
  let sessionTokens = 0;
  for (const session of sessions) {
    const formatted = formatSessionForCounting(session);
    sessionTokens += countTokensAccurate(formatted);
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
  lines.push(`  - Session Content: ${estimate.breakdown.sessionTokens.toLocaleString()}`);
  lines.push(`  - System Prompt: ${estimate.breakdown.systemPromptTokens.toLocaleString()}`);
  lines.push(`  - Schema Overhead: ${estimate.breakdown.schemaOverhead.toLocaleString()}`);
  lines.push(`Output Tokens (est): ${estimate.estimatedOutputTokens.toLocaleString()}`);
  lines.push(`Estimated Cost: $${estimate.totalCost.toFixed(4)}`);

  return lines.join('\n');
}
