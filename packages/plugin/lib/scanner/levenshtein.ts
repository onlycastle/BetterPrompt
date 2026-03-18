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
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) {
    prev[j] = j;
  }

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + cost
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}
