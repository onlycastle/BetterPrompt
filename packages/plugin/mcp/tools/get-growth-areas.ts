/**
 * get_growth_areas MCP Tool
 *
 * Returns the developer's top growth areas with recommendations.
 * Optionally filtered by domain.
 */

import type { UserSummary } from '../../lib/api-client.js';

export const definition = {
  name: 'get_growth_areas',
  description:
    'Get the developer\'s top growth areas — specific areas where they can improve ' +
    'their AI collaboration skills. Each area includes a title, domain, severity, ' +
    'and actionable recommendation. Optionally filter by domain ' +
    '(thinkingQuality, communicationPatterns, learningBehavior, contextEfficiency, sessionOutcome).',
  inputSchema: {
    type: 'object' as const,
    properties: {
      domain: {
        type: 'string',
        description:
          'Filter by domain key. One of: thinkingQuality, communicationPatterns, ' +
          'learningBehavior, contextEfficiency, sessionOutcome',
        enum: [
          'thinkingQuality',
          'communicationPatterns',
          'learningBehavior',
          'contextEfficiency',
          'sessionOutcome',
        ],
      },
    },
    required: [] as string[],
  },
};

export function formatResult(
  summary: UserSummary | null,
  args: { domain?: string },
): string {
  if (!summary) {
    return JSON.stringify({
      status: 'no_data',
      message:
        'No analysis available yet. The developer needs to run at least one analysis first.',
    });
  }

  let areas = summary.growthAreas;

  if (args.domain) {
    areas = areas.filter((a) => a.domain === args.domain);
  }

  // Return top 3 most actionable
  const top = areas.slice(0, 3);

  return JSON.stringify({
    growthAreas: top.map((a) => ({
      title: a.title,
      domain: a.domain,
      severity: a.severity,
      recommendation: a.recommendation,
    })),
    totalCount: areas.length,
    analyzedAt: summary.analyzedAt,
  });
}
