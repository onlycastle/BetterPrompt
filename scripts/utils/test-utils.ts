/**
 * Shared Test Utilities
 *
 * Common utilities for test-phase scripts:
 * - Cache types and loaders (Phase 1, Phase 2)
 * - Config helpers (mock metrics, orchestrator config)
 * - Display helpers (token usage, text formatting)
 * - Cost calculation re-exports
 *
 * @module scripts/utils/test-utils
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

import type { Phase1Output } from '../../src/lib/models/phase1-output';
import type { AgentOutputs } from '../../src/lib/models/agent-outputs';
import type { SessionMetrics } from '../../src/lib/domain/models/analysis';
import type { OrchestratorConfig } from '../../src/lib/analyzer/orchestrator/types';
import type { TokenUsage } from '../../src/lib/analyzer/clients/gemini-client';
import type { NarrativeLLMResponse } from '../../src/lib/models/verbose-evaluation';

// Import and re-export cost calculation utilities
import { calculateActualCost, GEMINI_PRICING } from '../../src/lib/analyzer/cost-estimator';
export { calculateActualCost, GEMINI_PRICING };

// ============================================================================
// Path Configuration
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** Path to phase1-cache directory */
export const PHASE1_CACHE_DIR = path.join(__dirname, '..', 'fixtures', 'phase1-cache');
export const PHASE1_CACHE_FILE = path.join(PHASE1_CACHE_DIR, 'phase1-cache.json');

/** Path to phase2-cache directory */
export const PHASE2_CACHE_DIR = path.join(__dirname, '..', 'fixtures', 'phase2-cache');
export const PHASE2_CACHE_FILE = path.join(PHASE2_CACHE_DIR, 'phase2-cache.json');

/** Path to phase3-cache directory */
export const PHASE3_CACHE_DIR = path.join(__dirname, '..', 'fixtures', 'phase3-cache');
export const PHASE3_CACHE_FILE = path.join(PHASE3_CACHE_DIR, 'phase3-cache.json');

// ============================================================================
// Cache Types
// ============================================================================

/**
 * Metadata for a cached session entry
 */
export interface SessionCacheEntry {
  sessionId: string;
  projectPath: string;
  projectName: string;
  messageCount: number;
  filePath: string;
  source?: 'claude-code' | 'cursor';
}

/**
 * Phase 1 cache metadata
 */
export interface Phase1CacheMetadata {
  generatedAt: string;
  generatorVersion: string;
  scannerConfig: {
    maxSessions: number;
  };
  sessions: SessionCacheEntry[];
  stats: {
    totalSessions: number;
    totalMessages: number;
    phase1ExecutionMs: number;
    tokenUsage?: TokenUsage;
  };
}

/**
 * Phase 1 cache structure
 */
export interface Phase1Cache {
  metadata: Phase1CacheMetadata;
  phase1Output: Phase1Output;
}

/**
 * Phase 2 cache metadata
 */
export interface Phase2CacheMetadata {
  generatedAt: string;
  generatorVersion: string;
  phase1CacheSource: string;
  stats: {
    totalUtterances: number;
    phase2ExecutionMs: number;
    tokenUsage: TokenUsage;
  };
}

/**
 * Phase 2 cache structure - includes Phase 1 output + all agent outputs
 */
export interface Phase2Cache {
  metadata: Phase2CacheMetadata;
  phase1Output: Phase1Output;
  agentOutputs: AgentOutputs;
}

/**
 * Phase 3 cache metadata
 */
export interface Phase3CacheMetadata {
  generatedAt: string;
  generatorVersion: string;
  phase2CacheSource: string;
  stats: {
    totalUtterances: number;
    phase3ExecutionMs: number;
    tokenUsage: TokenUsage;
  };
}

/**
 * Phase 3 cache structure - includes Phase 1/2 outputs + ContentWriter narrative
 */
export interface Phase3Cache {
  metadata: Phase3CacheMetadata;
  phase1Output: Phase1Output;
  agentOutputs: AgentOutputs;
  narrativeResponse: NarrativeLLMResponse;
}

// ============================================================================
// Cache Loaders
// ============================================================================

/**
 * Load Phase 1 cache from disk
 *
 * @param cachePath - Optional custom cache path (defaults to PHASE1_CACHE_FILE)
 * @returns Phase1Cache object
 * @throws Error if cache file does not exist
 */
export function loadPhase1Cache(cachePath?: string): Phase1Cache {
  const filePath = cachePath ?? PHASE1_CACHE_FILE;

  if (!fs.existsSync(filePath)) {
    console.error('Phase 1 cache file not found at:', filePath);
    console.error('');
    console.error('Generate the cache first:');
    console.error('  npx tsx scripts/generate-phase1-cache.ts');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Phase1Cache;
}

/**
 * Load Phase 2 cache from disk
 *
 * @param cachePath - Optional custom cache path (defaults to PHASE2_CACHE_FILE)
 * @returns Phase2Cache object
 * @throws Error if cache file does not exist
 */
export function loadPhase2Cache(cachePath?: string): Phase2Cache {
  const filePath = cachePath ?? PHASE2_CACHE_FILE;

  if (!fs.existsSync(filePath)) {
    console.error('Phase 2 cache file not found at:', filePath);
    console.error('');
    console.error('Generate the cache first:');
    console.error('  npx tsx scripts/generate-phase2-cache.ts');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Phase2Cache;
}

/**
 * Load Phase 3 cache from disk
 *
 * @param cachePath - Optional custom cache path (defaults to PHASE3_CACHE_FILE)
 * @returns Phase3Cache object
 * @throws Error if cache file does not exist
 */
export function loadPhase3Cache(cachePath?: string): Phase3Cache {
  const filePath = cachePath ?? PHASE3_CACHE_FILE;

  if (!fs.existsSync(filePath)) {
    console.error('Phase 3 cache file not found at:', filePath);
    console.error('');
    console.error('Generate the cache first:');
    console.error('  npx tsx scripts/generate-phase3-cache.ts');
    process.exit(1);
  }

  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content) as Phase3Cache;
}

// ============================================================================
// Config Helpers
// ============================================================================

/**
 * Create mock SessionMetrics for testing
 *
 * Returns a SessionMetrics object with all fields set to 0.
 * Useful when metrics are not needed for the test.
 */
export function createMockMetrics(): SessionMetrics {
  return {
    avgPromptLength: 0,
    avgFirstPromptLength: 0,
    maxPromptLength: 0,
    avgTurnsPerSession: 0,
    totalTurns: 0,
    questionFrequency: 0,
    whyHowWhatCount: 0,
    toolUsage: {
      read: 0,
      grep: 0,
      glob: 0,
      task: 0,
      plan: 0,
      bash: 0,
      write: 0,
      edit: 0,
      total: 0,
    },
    modificationRequestCount: 0,
    modificationRate: 0,
    refactorKeywordCount: 0,
    styleKeywordCount: 0,
    qualityTermCount: 0,
    positiveFeedbackCount: 0,
    negativeFeedbackCount: 0,
    avgCycleTimeSeconds: 0,
    sessionDurationSeconds: 0,
  };
}

/**
 * Create OrchestratorConfig from environment variables
 *
 * @throws Error if GOOGLE_GEMINI_API_KEY is not set
 */
export function createOrchestratorConfig(): OrchestratorConfig {
  const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_GEMINI_API_KEY is required');
  }
  return {
    geminiApiKey: apiKey,
    verbose: true,
  };
}

// ============================================================================
// Display Helpers
// ============================================================================

/**
 * Print token usage to console
 *
 * @param usage - TokenUsage object (or null)
 * @param label - Label for the output (e.g., "Phase 1", "ThinkingQuality")
 */
export function printTokenUsage(usage: TokenUsage | null, label: string): void {
  if (usage) {
    const cachedInfo = usage.cachedTokens ? `, ${usage.cachedTokens} cached` : '';
    console.log(`${label} Token Usage:`);
    console.log(`  - Prompt tokens: ${usage.promptTokens}`);
    console.log(`  - Completion tokens: ${usage.completionTokens}`);
    console.log(`  - Total tokens: ${usage.totalTokens}${cachedInfo}`);
  }
}

/**
 * Convert snake_case to Title Case for human-readable labels
 *
 * Examples:
 *   structure_first → "Structure First"
 *   verification_request → "Verification Request"
 *   vibe_coder → "Vibe Coder"
 */
export function toTitleCase(snakeCase: string): string {
  return snakeCase
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/**
 * Truncate text to a maximum length with ellipsis
 *
 * @param text - Text to truncate
 * @param maxLength - Maximum length (default: 100)
 * @returns Truncated text with "..." if exceeded
 */
export function truncateText(text: string, maxLength: number = 100): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Wrap text to fit within a specified width
 *
 * @param text - Text to wrap
 * @param width - Maximum line width (default: 80)
 * @returns Text with line breaks inserted
 */
export function wrapText(text: string, width: number = 80): string {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.join('\n');
}

/**
 * Format evidence for display
 *
 * Returns formatted string with utteranceId if available.
 */
export function formatEvidence(
  evidence: string | { quote?: string; utteranceId?: string; context?: string }
): string {
  if (typeof evidence === 'string') return evidence;
  const quote = evidence.quote ?? '';
  const id = evidence.utteranceId;
  return id ? `${quote} (${id})` : quote;
}

/**
 * Print a section separator with title
 */
export function printSectionHeader(title: string, char: string = '─', width: number = 60): void {
  console.log('\n' + char.repeat(width));
  console.log(title);
  console.log(char.repeat(width));
}

/**
 * Print cost summary for token usage
 *
 * @param totalPrompt - Total prompt tokens
 * @param totalCompletion - Total completion tokens
 * @param totalCached - Total cached tokens
 */
export function printCostSummary(
  totalPrompt: number,
  totalCompletion: number,
  totalCached: number = 0
): void {
  const pricing = GEMINI_PRICING['gemini-3-flash-preview'];
  const cost = calculateActualCost({
    promptTokens: totalPrompt,
    completionTokens: totalCompletion,
    cachedTokens: totalCached,
  });

  console.log('\nEstimated Cost (Gemini 3 Flash):');
  console.log(
    `  Input:  $${cost.inputCost.toFixed(6)} (${totalPrompt - totalCached} tokens × $${(pricing.input * 1_000_000).toFixed(2)}/1M)`
  );
  if (totalCached > 0) {
    console.log(
      `  Cached: $${cost.cachedCost.toFixed(6)} (${totalCached} tokens × $${(pricing.cached * 1_000_000).toFixed(2)}/1M)`
    );
  }
  console.log(
    `  Output: $${cost.outputCost.toFixed(6)} (${totalCompletion} tokens × $${(pricing.output * 1_000_000).toFixed(2)}/1M)`
  );
  console.log(`  TOTAL:  $${cost.totalCost.toFixed(6)}`);
}

// ============================================================================
// Worker Type Definition
// ============================================================================

export type WorkerName =
  | 'ThinkingQuality'
  | 'LearningBehavior'
  | 'ContextEfficiency'
  | 'TypeClassifier';

export const VALID_WORKERS: WorkerName[] = [
  'ThinkingQuality',
  'LearningBehavior',
  'ContextEfficiency',
  'TypeClassifier',
];
