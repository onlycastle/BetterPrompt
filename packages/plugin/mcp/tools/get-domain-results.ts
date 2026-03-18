/**
 * get_domain_results MCP Tool
 *
 * Reads previously saved domain analysis results from the local DB.
 * Used by downstream skills that need the full domain payloads
 * (evidence verification, content writer, translator).
 *
 * @module plugin/mcp/tools/get-domain-results
 */

import { z } from 'zod';
import { getCurrentRunId, getDomainResult, getDomainResults } from '../../lib/results-db.js';

export const definition = {
  name: 'get_domain_results',
  description:
    'Read previously saved domain analysis results from the current local analysis run. ' +
    'Provide a domain name to get one domain, or omit it to get all saved domains. ' +
    'Available domains: thinkingQuality, communicationPatterns, learningBehavior, ' +
    'contextEfficiency, sessionOutcome, content.',
};

export const GetDomainResultsInputSchema = z.object({
  domain: z.enum([
    'thinkingQuality',
    'communicationPatterns',
    'learningBehavior',
    'contextEfficiency',
    'sessionOutcome',
    'content',
  ]).optional(),
});

export async function execute(args: { domain?: string }): Promise<string> {
  const runId = getCurrentRunId();

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Call extract_data first.',
    });
  }

  if (args.domain) {
    const result = getDomainResult(runId, args.domain);
    if (!result) {
      return JSON.stringify({
        status: 'not_found',
        domain: args.domain,
        runId,
        message: `No ${args.domain} result found for run #${runId}. This domain may not have been analyzed yet.`,
      });
    }

    return JSON.stringify({
      status: 'ok',
      domain: args.domain,
      runId,
      data: result,
    });
  }

  const results = getDomainResults(runId);

  return JSON.stringify({
    status: 'ok',
    runId,
    domainsAvailable: results.map(result => result.domain),
    data: results,
  });
}
