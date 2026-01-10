/**
 * Style Analyzer - Main entry point for AI Coding Style analysis
 *
 * Orchestrates the full analysis pipeline:
 * 1. Parse sessions from ~/.claude logs
 * 2. Extract metrics from conversations
 * 3. Calculate type scores
 * 4. Extract evidence samples
 * 5. Generate TypeResult
 */

import {
  type ParsedSession,
  type TypeResult,
  type SessionMetrics,
  type TypeDistribution,
  type CodingStyleType,
  TYPE_METADATA,
} from '../models/index.js';
import {
  extractSessionMetrics,
  aggregateMetrics,
  calculateTypeScores,
  scoresToDistribution,
  getPrimaryType,
  getToolUsageHighlight,
} from './type-detector.js';
import { extractEvidence } from './evidence-extractor.js';

// ============================================================================
// Style Analyzer
// ============================================================================

export interface StyleAnalyzerOptions {
  maxEvidence?: number;
  minSessions?: number;
}

const DEFAULT_OPTIONS: Required<StyleAnalyzerOptions> = {
  maxEvidence: 8,
  minSessions: 1,
};

/**
 * Analyze sessions and determine AI Coding Style
 */
export function analyzeStyle(
  sessions: ParsedSession[],
  options: StyleAnalyzerOptions = {}
): TypeResult {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  if (sessions.length < opts.minSessions) {
    throw new Error(
      `Need at least ${opts.minSessions} session(s) for analysis, got ${sessions.length}`
    );
  }

  // Step 1: Aggregate metrics across all sessions
  const metrics = aggregateMetrics(sessions);

  // Step 2: Calculate type scores
  const scores = calculateTypeScores(metrics);

  // Step 3: Convert to distribution
  const distribution = scoresToDistribution(scores);

  // Step 4: Get primary type
  const primaryType = getPrimaryType(distribution);

  // Step 5: Extract evidence
  const evidence = extractEvidence(sessions, primaryType, opts.maxEvidence);

  // Step 6: Build result
  const result: TypeResult = {
    primaryType,
    distribution,
    metrics: {
      avgPromptLength: Math.round(metrics.avgPromptLength),
      avgFirstPromptLength: Math.round(metrics.avgFirstPromptLength),
      avgTurnsPerSession: Math.round(metrics.avgTurnsPerSession * 10) / 10,
      questionFrequency: Math.round(metrics.questionFrequency * 100) / 100,
      modificationRate: Math.round(metrics.modificationRate * 100) / 100,
      toolUsageHighlight: getToolUsageHighlight(metrics),
    },
    evidence: evidence.map((e) => ({
      type: e.type,
      quote: e.quote,
      timestamp: e.timestamp.toISOString(),
      explanation: e.explanation,
    })),
    sessionCount: sessions.length,
    analyzedAt: new Date().toISOString(),
  };

  return result;
}

/**
 * Get detailed analysis for a single session
 */
export function analyzeSession(session: ParsedSession): {
  metrics: SessionMetrics;
  distribution: TypeDistribution;
  primaryType: CodingStyleType;
} {
  const metrics = extractSessionMetrics(session);
  const scores = calculateTypeScores(metrics);
  const distribution = scoresToDistribution(scores);
  const primaryType = getPrimaryType(distribution);

  return { metrics, distribution, primaryType };
}

/**
 * Format a type result for display (CLI preview)
 */
export function formatTypeResultPreview(result: TypeResult): string {
  const meta = TYPE_METADATA[result.primaryType];
  const lines: string[] = [];

  lines.push('');
  lines.push(`  ${meta.emoji}  YOU ARE ${meta.name.toUpperCase()}`);
  lines.push('');
  lines.push(`  "${meta.tagline}"`);
  lines.push('');

  // Distribution chart
  lines.push('  Style Distribution:');
  for (const type of [
    'architect',
    'scientist',
    'collaborator',
    'speedrunner',
    'craftsman',
  ] as CodingStyleType[]) {
    const typeMeta = TYPE_METADATA[type];
    const pct = result.distribution[type];
    const barLength = Math.round(pct / 5); // 20 char max
    const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);
    const highlight = type === result.primaryType ? ' ←' : '';
    lines.push(
      `   ${typeMeta.emoji} ${typeMeta.name.padEnd(12)} ${bar} ${pct}%${highlight}`
    );
  }

  lines.push('');

  return lines.join('\n');
}

/**
 * Format a distribution bar for inline display
 */
export function formatDistributionBar(pct: number, width: number = 15): string {
  const filled = Math.round((pct / 100) * width);
  return '█'.repeat(filled) + '░'.repeat(width - filled);
}

// Re-export components for direct use
export {
  extractSessionMetrics,
  aggregateMetrics,
  calculateTypeScores,
  scoresToDistribution,
  getPrimaryType,
  getToolUsageHighlight,
} from './type-detector.js';

export { extractEvidence, findTypeEvidence, getBestEvidencePerType } from './evidence-extractor.js';
