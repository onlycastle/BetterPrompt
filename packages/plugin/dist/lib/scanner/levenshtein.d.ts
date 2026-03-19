/**
 * Levenshtein Distance
 *
 * Simple edit distance implementation for fuzzy directory name matching.
 * Used by project-name-resolver to merge renamed project directories
 * (e.g. "alfreadworks" → "alfredworks").
 *
 * No external dependencies.
 *
 * @module levenshtein
 */
/**
 * Compute the Levenshtein (edit) distance between two strings.
 * Returns the minimum number of single-character edits (insertions,
 * deletions, or substitutions) needed to transform `a` into `b`.
 */
export declare function levenshteinDistance(a: string, b: string): number;
