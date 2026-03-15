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
import type { DeterministicScores, Phase1Output, DeterministicTypeResult } from './types.js';
/**
 * Compute deterministic type classification from scores and Phase 1 output.
 * Pure function: same inputs always produce same classification.
 */
export declare function computeDeterministicType(scores: DeterministicScores, phase1Output: Phase1Output): DeterministicTypeResult;
