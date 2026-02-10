/**
 * Deterministic Type Mapper - Rule-based developer type classification
 *
 * Converts deterministic scores into type classification results,
 * replacing LLM-based type determination while preserving the same
 * output format for downstream consumers.
 *
 * Design: Pure function (DeterministicScores + Phase1Metrics → TypeResult)
 * - Deterministic: same input always produces same classification
 * - No LLM calls — type classification is fully rule-based
 * - LLM still generates personality narrative (reasoning) in TypeClassifier
 *
 * @module analyzer/stages/deterministic-type-mapper
 */

import type { DeterministicScores } from './deterministic-scorer';
import type { Phase1SessionMetrics } from '../../models/phase1-output';
import type { Phase1Output } from '../../models/phase1-output';
import {
  type CodingStyleType,
  type AIControlLevel,
  MATRIX_NAMES,
  MATRIX_METADATA,
} from '../../models/coding-style';

// ============================================================================
// Output Types
// ============================================================================

/**
 * Deterministic type classification result.
 * Provides the same fields as TypeClassifierOutput for downstream compatibility.
 */
export interface DeterministicTypeResult {
  primaryType: CodingStyleType;
  distribution: {
    architect: number;
    analyst: number;
    conductor: number;
    speedrunner: number;
    trendsetter: number;
  };
  controlLevel: AIControlLevel;
  controlScore: number;
  matrixName: string;
  matrixEmoji: string;
}

// ============================================================================
// Trend Keyword Detection (extracted from TypeClassifierWorker)
// ============================================================================

const TREND_KEYWORDS_KO = ['최신', '트렌드', '유행', '새로운', '업데이트된', '요즘'];
const TREND_KEYWORDS_EN = ['latest', 'newest', 'trending', 'modern', 'up-to-date', 'best practice', 'current version', 'recently released'];
const ALL_TREND_KEYWORDS = [...TREND_KEYWORDS_KO, ...TREND_KEYWORDS_EN];

/**
 * Compute trend keyword density from Phase 1 utterances.
 * Returns percentage (0-100).
 */
function computeTrendDensity(phase1Output: Phase1Output): number {
  const utterances = phase1Output.developerUtterances;
  if (utterances.length === 0) return 0;

  let totalMatches = 0;
  for (const utterance of utterances) {
    const text = (utterance.displayText || utterance.text).toLowerCase();
    for (const keyword of ALL_TREND_KEYWORDS) {
      const regex = new RegExp(keyword.toLowerCase(), 'g');
      const matches = text.match(regex);
      if (matches) totalMatches += matches.length;
    }
  }

  return (totalMatches / utterances.length) * 100;
}

// ============================================================================
// Type Affinity Calculation
// ============================================================================

const STYLE_TYPES: CodingStyleType[] = ['architect', 'analyst', 'conductor', 'speedrunner', 'trendsetter'];

/**
 * Compute raw affinity for each coding style type.
 *
 * Each type has a distinct affinity formula based on its defining signals:
 * - architect: planning behavior + structured approach + high control
 * - analyst: critical thinking + learning + verification
 * - conductor: slash command diversity + orchestration commands
 * - speedrunner: efficiency + concise communication
 * - trendsetter: trend keyword density + learning curiosity
 */
function computeAffinities(
  scores: DeterministicScores,
  metrics: Phase1SessionMetrics,
  trendDensity: number
): Record<CodingStyleType, number> {
  const slashCmds = metrics.slashCommandCounts ?? {};

  // ─────────────────────────────────────────────────────────────────────
  // Architect affinity: planning-heavy + structured + controlling
  // ─────────────────────────────────────────────────────────────────────
  const planCount = (slashCmds['plan'] ?? 0) + (slashCmds['review'] ?? 0);
  const planBonus = planCount > 0 ? Math.min(planCount * 8, 30) : 0;
  const architectAffinity = scores.thinkingQuality * 0.5 + scores.controlScore * 0.3 + planBonus;

  // ─────────────────────────────────────────────────────────────────────
  // Analyst affinity: thorough investigation + learning + low mistakes
  // ─────────────────────────────────────────────────────────────────────
  const analystAffinity =
    scores.thinkingQuality * 0.3 +
    scores.learningBehavior * 0.4 +
    scores.sessionOutcome * 0.2 +
    (metrics.questionRatio > 0.2 ? 10 : 0); // bonus for high questioning

  // ─────────────────────────────────────────────────────────────────────
  // Conductor affinity: slash command mastery
  // Only developer-initiated commands count (NOT tool usage)
  // ─────────────────────────────────────────────────────────────────────
  const uniqueCommands = Object.keys(slashCmds).length;
  const totalCommands = Object.values(slashCmds).reduce((sum, c) => sum + c, 0);
  const orchestrationCmds = (slashCmds['sisyphus'] ?? 0) + (slashCmds['orchestrator'] ?? 0) +
    (slashCmds['ultrawork'] ?? 0) + (slashCmds['ralph-loop'] ?? 0);

  // Unique commands >4 is the key conductor signal
  const commandDiversityScore = Math.min(uniqueCommands * 12, 60);
  const commandVolumeScore = Math.min(totalCommands * 2, 30);
  const orchestrationBonus = orchestrationCmds > 0 ? Math.min(orchestrationCmds * 10, 30) : 0;
  const conductorAffinity = commandDiversityScore + commandVolumeScore + orchestrationBonus;

  // ─────────────────────────────────────────────────────────────────────
  // Speedrunner affinity: efficiency + conciseness
  // ─────────────────────────────────────────────────────────────────────
  const avgLen = metrics.avgDeveloperMessageLength;
  // Shorter prompts = more speedrunner-like (inverted, capped)
  const concisenessScore = avgLen < 200 ? 40 : avgLen < 400 ? 25 : 10;
  const speedrunnerAffinity =
    scores.contextEfficiency * 0.5 +
    concisenessScore +
    (scores.sessionOutcome > 70 ? 15 : 0); // bonus for high success despite speed

  // ─────────────────────────────────────────────────────────────────────
  // Trendsetter affinity: trend keywords + learning curiosity
  // Requires quantitative evidence — no guessing
  // ─────────────────────────────────────────────────────────────────────
  // trendDensity > 3% is the threshold from the prompt
  const trendKeywordScore = trendDensity > 3 ? Math.min(trendDensity * 15, 60) : trendDensity * 5;
  const learningCuriosityBonus = scores.learningBehavior > 70 ? 15 : 0;
  const trendsetterAffinity = trendKeywordScore + learningCuriosityBonus;

  return {
    architect: architectAffinity,
    analyst: analystAffinity,
    conductor: conductorAffinity,
    speedrunner: speedrunnerAffinity,
    trendsetter: trendsetterAffinity,
  };
}

/**
 * Normalize affinities to a distribution summing to 100.
 * Ensures no type gets less than 5% (minimum visibility).
 */
function normalizeToDistribution(affinities: Record<CodingStyleType, number>): Record<CodingStyleType, number> {
  const MIN_PERCENT = 5;
  const totalAffinity = STYLE_TYPES.reduce((sum, t) => sum + Math.max(affinities[t], 0), 0);

  if (totalAffinity === 0) {
    // Uniform distribution fallback
    return { architect: 20, analyst: 20, conductor: 20, speedrunner: 20, trendsetter: 20 };
  }

  // First pass: proportional scaling
  const raw: Record<string, number> = {};
  for (const type of STYLE_TYPES) {
    raw[type] = Math.max((affinities[type] / totalAffinity) * 100, 0);
  }

  // Second pass: enforce minimum and redistribute
  let totalBelow = 0;
  let totalAbove = 0;
  const aboveTypes: CodingStyleType[] = [];

  for (const type of STYLE_TYPES) {
    if (raw[type] < MIN_PERCENT) {
      totalBelow += MIN_PERCENT - raw[type];
      raw[type] = MIN_PERCENT;
    } else {
      totalAbove += raw[type];
      aboveTypes.push(type);
    }
  }

  // Redistribute the deficit from above-minimum types
  if (totalBelow > 0 && totalAbove > 0) {
    for (const type of aboveTypes) {
      raw[type] -= totalBelow * (raw[type] / totalAbove);
    }
  }

  // Round and adjust for exact sum of 100
  const result: Record<string, number> = {};
  let sum = 0;
  for (const type of STYLE_TYPES) {
    result[type] = Math.round(raw[type]);
    sum += result[type];
  }

  // Adjust largest value to ensure exact sum of 100
  if (sum !== 100) {
    const maxType = STYLE_TYPES.reduce((a, b) => result[a] >= result[b] ? a : b);
    result[maxType] += 100 - sum;
  }

  return result as Record<CodingStyleType, number>;
}

// ============================================================================
// Control Level Mapping
// ============================================================================

function controlLevelFromScore(score: number): AIControlLevel {
  if (score <= 34) return 'explorer';
  if (score <= 64) return 'navigator';
  return 'cartographer';
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute deterministic type classification from scores and metrics.
 *
 * Pure function: same inputs always produce same classification.
 * No LLM calls — fully rule-based.
 *
 * @param scores - Deterministic domain scores (from DeterministicScorer)
 * @param phase1Output - Full Phase 1 output (for trend keyword density)
 * @returns DeterministicTypeResult with type classification
 */
export function computeDeterministicType(
  scores: DeterministicScores,
  phase1Output: Phase1Output
): DeterministicTypeResult {
  const metrics = phase1Output.sessionMetrics;
  const trendDensity = computeTrendDensity(phase1Output);

  // Compute raw affinities
  const affinities = computeAffinities(scores, metrics, trendDensity);

  // Normalize to distribution (sum = 100)
  const distribution = normalizeToDistribution(affinities);

  // Primary type = highest affinity
  const primaryType = STYLE_TYPES.reduce((a, b) =>
    affinities[a] >= affinities[b] ? a : b
  );

  // Control level from deterministic control score
  const controlLevel = controlLevelFromScore(scores.controlScore);

  // Matrix name and emoji from coding-style.ts lookup
  const matrixName = MATRIX_NAMES[primaryType][controlLevel];
  const matrixEmoji = MATRIX_METADATA[primaryType][controlLevel].emoji;

  return {
    primaryType,
    distribution: distribution as DeterministicTypeResult['distribution'],
    controlLevel,
    controlScore: scores.controlScore,
    matrixName,
    matrixEmoji,
  };
}
