/**
 * Deterministic Scorer - Rubric-based scoring from Phase 1 metrics
 *
 * Pure function: Phase1Output -> DeterministicScores
 * Same input always produces same output. No LLM calls, no external state.
 *
 * Ported from: src/lib/analyzer/stages/deterministic-scorer.ts
 *
 * @module plugin/lib/core/deterministic-scorer
 */
import type { Phase1Output, DeterministicScores } from './types.js';
/**
 * Compute deterministic scores from Phase 1 output.
 *
 * Pure function: same Phase1Output always produces same DeterministicScores.
 */
export declare function computeDeterministicScores(phase1Output: Phase1Output): DeterministicScores;
