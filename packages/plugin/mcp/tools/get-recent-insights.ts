/**
 * get_recent_insights MCP Tool
 *
 * Returns strengths, anti-patterns, or KPT (Keep/Problem/Try) summary.
 */

import type { UserSummary } from '../../lib/api-client.js';

export const definition = {
  name: 'get_recent_insights',
  description:
    'Get the developer\'s recent analysis insights. Choose a category: ' +
    '"strengths" for top skills, "anti_patterns" for inefficiency patterns to avoid, ' +
    'or "kpt" for a Keep/Problem/Try summary. Defaults to "kpt" which gives the ' +
    'most actionable overview.',
  inputSchema: {
    type: 'object' as const,
    properties: {
      category: {
        type: 'string',
        description:
          'Category of insights to return. ' +
          '"strengths" = top strengths by domain, ' +
          '"anti_patterns" = inefficiency patterns detected, ' +
          '"kpt" = Keep/Problem/Try actionable summary',
        enum: ['strengths', 'anti_patterns', 'kpt'],
        default: 'kpt',
      },
    },
    required: [] as string[],
  },
};

export function formatResult(
  summary: UserSummary | null,
  args: { category?: string },
): string {
  if (!summary) {
    return JSON.stringify({
      status: 'no_data',
      message:
        'No analysis available yet. The developer needs to run at least one analysis first.',
    });
  }

  const category = args.category ?? 'kpt';

  switch (category) {
    case 'strengths':
      return JSON.stringify({
        strengths: summary.strengths.map((s) => ({
          domain: s.domain,
          domainLabel: s.domainLabel,
          topStrength: s.topStrength,
          score: s.domainScore,
        })),
        analyzedAt: summary.analyzedAt,
      });

    case 'anti_patterns':
      return JSON.stringify({
        antiPatterns: summary.antiPatterns.map((ap) => ({
          pattern: ap.pattern,
          frequency: ap.frequency,
          impact: ap.impact,
        })),
        analyzedAt: summary.analyzedAt,
      });

    case 'kpt':
    default:
      return JSON.stringify({
        keep: summary.kpt.keep,
        problem: summary.kpt.problem,
        tryNext: summary.kpt.tryNext,
        analyzedAt: summary.analyzedAt,
      });
  }
}
