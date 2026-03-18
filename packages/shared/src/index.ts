/**
 * @betterprompt/shared - Shared types, schemas, and deterministic logic
 *
 * Canonical source of truth for types shared between the plugin and server.
 *
 * @module @betterprompt/shared
 */

// Schemas (re-export everything from schemas barrel)
export * from './schemas/index.js';

// Evaluation assembly
export * from './evaluation/index.js';

// Scoring
export { computeDeterministicScores } from './scoring/deterministic-scorer.js';
export { computeDeterministicType } from './scoring/deterministic-type-mapper.js';

// Knowledge resource matching
export * from './matching/index.js';

// Constants
export { CONTEXT_WINDOW_SIZE, MATRIX_NAMES, MATRIX_METADATA } from './constants.js';
