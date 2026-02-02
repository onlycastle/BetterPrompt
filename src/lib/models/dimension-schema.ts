/**
 * Dimension Schema - Shared dimension definitions
 *
 * This file exists to break circular dependencies between modules.
 * By extracting DimensionNameEnumSchema to its own file with NO imports
 * from other model modules, we break the circular dependency chain.
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

// ============================================================================
// Dimension Validation
// ============================================================================

/**
 * Runtime type guard for dimension names.
 */
export function isValidDimension(value: string): value is DimensionNameEnum {
  return (DIMENSION_NAMES as readonly string[]).includes(value);
}

/**
 * Validate a dimension string from LLM output.
 * - Valid dimension → returned as-is
 * - Unknown value → falls back to 'aiCollaboration'
 */
export function validateDimension(
  value: string | undefined,
  context?: string,
): DimensionNameEnum {
  const trimmed = value?.trim() || '';

  if (isValidDimension(trimmed)) return trimmed;

  console.warn(`[DimensionValidation] Unknown dimension "${trimmed}", defaulting to "aiCollaboration"${context ? ` (${context})` : ''}`);
  return 'aiCollaboration';
}
