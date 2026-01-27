/**
 * Dimension Schema - Shared dimension definitions
 *
 * This file exists to break circular dependencies between:
 * - verbose-evaluation.ts (needs DimensionNameEnumSchema)
 * - agent-outputs.ts (imports from strength-growth-data.ts)
 * - strength-growth-data.ts (needs DimensionNameEnumSchema)
 *
 * By extracting DimensionNameEnumSchema to its own file with NO imports
 * from the above modules, we break the circular dependency chain.
 *
 * @module models/dimension-schema
 */

import { z } from 'zod';

/**
 * The 6 analysis dimensions
 */
export const DimensionNameEnumSchema = z.enum([
  'aiCollaboration',
  'contextEngineering',
  'toolMastery',
  'burnoutRisk',
  'aiControl',
  'skillResilience',
]);
export type DimensionNameEnum = z.infer<typeof DimensionNameEnumSchema>;

/**
 * Array of all dimension names, derived from the schema
 * Use this constant instead of hardcoding dimension arrays
 */
export const DIMENSION_NAMES = DimensionNameEnumSchema.options;

/**
 * Type for dimension names (string union)
 */
export type DimensionName = DimensionNameEnum;
