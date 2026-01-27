/**
 * Strategic Sampling Utilities
 *
 * Shared sampling logic used by Phase 1 (DataExtractor) and Phase 2 workers
 * to reduce data volume while preserving temporal distribution.
 *
 * Strategy: Bookend + Even Spacing
 * - Keep first + last utterance per session (preserves session boundaries)
 * - Fill remaining slots with evenly-spaced middle utterances
 * - Maintains chronological order in output
 *
 * @module analyzer/shared/sampling-utils
 */

import type { DeveloperUtterance, AIResponse } from '../../models/phase1-output';

/**
 * Strategic sampling of developer utterances.
 *
 * Keeps first + last utterance per session (bookends), fills remaining
 * slots with evenly-spaced middle utterances. Preserves chronological order.
 */
export function strategicSampleUtterances(
  all: DeveloperUtterance[],
  maxCount: number
): DeveloperUtterance[] {
  if (all.length <= maxCount) return all;

  // Group by session
  const bySession = new Map<string, DeveloperUtterance[]>();
  for (const u of all) {
    const group = bySession.get(u.sessionId) ?? [];
    group.push(u);
    bySession.set(u.sessionId, group);
  }

  const sampled: Set<DeveloperUtterance> = new Set();

  // Keep first + last per session (bookends)
  for (const group of bySession.values()) {
    sampled.add(group[0]);
    if (group.length > 1) {
      sampled.add(group[group.length - 1]);
    }
  }

  // Fill remaining slots with evenly-spaced middle utterances
  const remaining = maxCount - sampled.size;
  if (remaining > 0) {
    const unsampled = all.filter(u => !sampled.has(u));
    const step = Math.max(1, Math.floor(unsampled.length / remaining));
    for (let i = 0; i < unsampled.length && sampled.size < maxCount; i += step) {
      sampled.add(unsampled[i]);
    }
  }

  // Return in original chronological order
  return all.filter(u => sampled.has(u));
}

/**
 * Strategic sampling of AI responses.
 *
 * Prioritizes error responses (up to half the limit), fills rest with
 * evenly-spaced non-error responses. Preserves chronological order.
 */
export function strategicSampleAIResponses(
  all: AIResponse[],
  maxCount: number
): AIResponse[] {
  if (all.length <= maxCount) return all;

  const sampled: Set<AIResponse> = new Set();
  const errorResponses = all.filter(r => r.hadError);
  const nonErrorResponses = all.filter(r => !r.hadError);

  // Prioritize error responses (up to half the limit)
  const errorLimit = Math.floor(maxCount / 2);
  const errorSample = errorResponses.slice(0, errorLimit);
  for (const r of errorSample) sampled.add(r);

  // Fill rest with evenly-spaced non-error responses
  const remaining = maxCount - sampled.size;
  if (remaining > 0 && nonErrorResponses.length > 0) {
    const step = Math.max(1, Math.floor(nonErrorResponses.length / remaining));
    for (let i = 0; i < nonErrorResponses.length && sampled.size < maxCount; i += step) {
      sampled.add(nonErrorResponses[i]);
    }
  }

  // Return in original chronological order
  return all.filter(r => sampled.has(r));
}
