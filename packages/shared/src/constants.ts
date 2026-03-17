/**
 * Shared Constants
 *
 * Matrix names, metadata, and other constants used across
 * the plugin and server.
 *
 * @module @betterprompt/shared/constants
 */

import type { CodingStyleType, AIControlLevel } from './schemas/deterministic-scores.js';

export const CONTEXT_WINDOW_SIZE = 200_000;

export const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>> = {
  architect: {
    explorer: 'Visionary',
    navigator: 'Strategist',
    cartographer: 'Systems Architect',
  },
  analyst: {
    explorer: 'Questioner',
    navigator: 'Research Lead',
    cartographer: 'Quality Sentinel',
  },
  conductor: {
    explorer: 'Improviser',
    navigator: 'Arranger',
    cartographer: 'Maestro',
  },
  speedrunner: {
    explorer: 'Experimenter',
    navigator: 'Rapid Prototyper',
    cartographer: 'Velocity Expert',
  },
  trendsetter: {
    explorer: 'Early Adopter',
    navigator: 'Tech Radar',
    cartographer: 'Innovation Lead',
  },
};

export const MATRIX_METADATA: Record<
  CodingStyleType,
  Record<AIControlLevel, { emoji: string }>
> = {
  architect: {
    explorer: { emoji: '💭' },
    navigator: { emoji: '📐' },
    cartographer: { emoji: '🏛️' },
  },
  analyst: {
    explorer: { emoji: '🔎' },
    navigator: { emoji: '🧪' },
    cartographer: { emoji: '🔬' },
  },
  conductor: {
    explorer: { emoji: '🎵' },
    navigator: { emoji: '🎼' },
    cartographer: { emoji: '🎹' },
  },
  speedrunner: {
    explorer: { emoji: '🎲' },
    navigator: { emoji: '🏃' },
    cartographer: { emoji: '⚡' },
  },
  trendsetter: {
    explorer: { emoji: '🌱' },
    navigator: { emoji: '📡' },
    cartographer: { emoji: '🚀' },
  },
};
