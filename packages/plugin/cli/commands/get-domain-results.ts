/**
 * get-domain-results CLI command
 *
 * Reads previously saved domain analysis results. Writes output to a tmp file.
 *
 * Usage: betterprompt-cli get-domain-results [--domain aiPartnership]
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getCurrentRunId, getDomainResult, getDomainResults } from '../../lib/results-db.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';

export async function execute(args: Record<string, unknown>): Promise<string> {
  const runId = getCurrentRunId();

  if (!runId) {
    return JSON.stringify({
      status: 'error',
      message: 'No active analysis run. Run extract-data first.',
    });
  }

  const tmpDir = join(getPluginDataDir(), 'tmp');
  await mkdir(tmpDir, { recursive: true });

  if (typeof args.domain === 'string') {
    const result = getDomainResult(runId, args.domain);
    if (!result) {
      return JSON.stringify({
        status: 'not_found',
        domain: args.domain,
        runId,
        message: `No ${args.domain} result found for run #${runId}.`,
      });
    }

    const output = { status: 'ok', domain: args.domain, runId, data: result };
    const outputFile = join(tmpDir, `domain-${args.domain}.json`);
    await writeFile(outputFile, JSON.stringify(output, null, 2), 'utf-8');

    return JSON.stringify({
      status: 'ok',
      domain: args.domain,
      runId,
      outputFile,
      message: `Domain result written to ${outputFile}.`,
    });
  }

  const results = getDomainResults(runId);
  const output = { status: 'ok', runId, domainsAvailable: results.map(r => r.domain), data: results };
  const outputFile = join(tmpDir, 'domain-all.json');
  await writeFile(outputFile, JSON.stringify(output, null, 2), 'utf-8');

  return JSON.stringify({
    status: 'ok',
    runId,
    domainsAvailable: results.map(r => r.domain),
    outputFile,
    message: `All domain results written to ${outputFile}.`,
  });
}
