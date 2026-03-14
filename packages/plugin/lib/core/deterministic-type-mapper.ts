/**
 * Deterministic Type Mapper - Rule-based developer type classification
 *
 * Pure function: DeterministicScores + Phase1Output -> DeterministicTypeResult
 * Deterministic: same input always produces same classification.
 *
 * Ported from: src/lib/analyzer/stages/deterministic-type-mapper.ts
 *
 * @module plugin/lib/core/deterministic-type-mapper
 */

import type {
  DeterministicScores,
  Phase1Output,
  Phase1SessionMetrics,
  DeterministicTypeResult,
  CodingStyleType,
  AIControlLevel,
} from './types.js';
import { MATRIX_NAMES, MATRIX_METADATA } from './types.js';

// ============================================================================
// Trend Keyword Detection
// ============================================================================

const TREND_KEYWORDS_KO = ['최신', '트렌드', '유행', '새로운', '업데이트된', '요즘'];
const TREND_KEYWORDS_EN = ['latest', 'newest', 'trending', 'modern', 'up-to-date', 'best practice', 'current version', 'recently released'];
const ALL_TREND_KEYWORDS = [...TREND_KEYWORDS_KO, ...TREND_KEYWORDS_EN];

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

function computeAffinities(
  scores: DeterministicScores,
  metrics: Phase1SessionMetrics,
  trendDensity: number,
): Record<CodingStyleType, number> {
  const slashCmds = metrics.slashCommandCounts ?? {};

  // Architect: planning-heavy + structured + controlling
  const planCount = (slashCmds['plan'] ?? 0) + (slashCmds['review'] ?? 0);
  const planBonus = planCount > 0 ? Math.min(planCount * 8, 30) : 0;
  const architectAffinity = scores.thinkingQuality * 0.5 + scores.controlScore * 0.3 + planBonus;

  // Analyst: thorough investigation + learning + low mistakes
  const analystAffinity =
    scores.thinkingQuality * 0.3 +
    scores.learningBehavior * 0.4 +
    scores.sessionOutcome * 0.2 +
    (metrics.questionRatio > 0.2 ? 10 : 0);

  // Conductor: slash command mastery
  const uniqueCommands = Object.keys(slashCmds).length;
  const totalCommands = Object.values(slashCmds).reduce((sum, c) => sum + c, 0);
  const orchestrationCmds = (slashCmds['sisyphus'] ?? 0) + (slashCmds['orchestrator'] ?? 0) +
    (slashCmds['ultrawork'] ?? 0) + (slashCmds['ralph-loop'] ?? 0);
  const commandDiversityScore = Math.min(uniqueCommands * 12, 60);
  const commandVolumeScore = Math.min(totalCommands * 2, 30);
  const orchestrationBonus = orchestrationCmds > 0 ? Math.min(orchestrationCmds * 10, 30) : 0;
  const conductorAffinity = commandDiversityScore + commandVolumeScore + orchestrationBonus;

  // Speedrunner: efficiency + conciseness
  const avgLen = metrics.avgDeveloperMessageLength;
  const concisenessScore = avgLen < 200 ? 40 : avgLen < 400 ? 25 : 10;
  const speedrunnerAffinity =
    scores.contextEfficiency * 0.5 +
    concisenessScore +
    (scores.sessionOutcome > 70 ? 15 : 0);

  // Trendsetter: trend keywords + learning curiosity
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

function normalizeToDistribution(affinities: Record<CodingStyleType, number>): Record<CodingStyleType, number> {
  const MIN_PERCENT = 5;
  const totalAffinity = STYLE_TYPES.reduce((sum, t) => sum + Math.max(affinities[t], 0), 0);

  if (totalAffinity === 0) {
    return { architect: 20, analyst: 20, conductor: 20, speedrunner: 20, trendsetter: 20 };
  }

  const raw: Record<string, number> = {};
  for (const type of STYLE_TYPES) {
    raw[type] = Math.max((affinities[type] / totalAffinity) * 100, 0);
  }

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

  if (totalBelow > 0 && totalAbove > 0) {
    for (const type of aboveTypes) {
      raw[type] -= totalBelow * (raw[type] / totalAbove);
    }
  }

  const result: Record<string, number> = {};
  let sum = 0;
  for (const type of STYLE_TYPES) {
    result[type] = Math.round(raw[type]);
    sum += result[type];
  }

  if (sum !== 100) {
    const maxType = STYLE_TYPES.reduce((a, b) => result[a] >= result[b] ? a : b);
    result[maxType] += 100 - sum;
  }

  return result as Record<CodingStyleType, number>;
}

function controlLevelFromScore(score: number): AIControlLevel {
  if (score <= 34) return 'explorer';
  if (score <= 64) return 'navigator';
  return 'cartographer';
}

// ============================================================================
// Main Entry Point
// ============================================================================

/**
 * Compute deterministic type classification from scores and Phase 1 output.
 * Pure function: same inputs always produce same classification.
 */
export function computeDeterministicType(
  scores: DeterministicScores,
  phase1Output: Phase1Output,
): DeterministicTypeResult {
  const metrics = phase1Output.sessionMetrics;
  const trendDensity = computeTrendDensity(phase1Output);

  const affinities = computeAffinities(scores, metrics, trendDensity);
  const distribution = normalizeToDistribution(affinities);

  const primaryType = STYLE_TYPES.reduce((a, b) =>
    affinities[a] >= affinities[b] ? a : b,
  );

  const controlLevel = controlLevelFromScore(scores.controlScore);
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
