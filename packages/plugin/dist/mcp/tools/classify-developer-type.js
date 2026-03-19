/**
 * classify_developer_type MCP Tool
 *
 * Runs deterministic type classification from domain scores.
 * Uses Phase 1.2 rules (DeterministicTypeMapper) to determine
 * primary type and control level.
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { computeDeterministicScores } from '../../lib/core/deterministic-scorer.js';
import { computeDeterministicType } from '../../lib/core/deterministic-type-mapper.js';
import { getPluginDataDir } from '../../lib/core/session-scanner.js';
import { getAnalysisRun, saveTypeResult, getCurrentRunId, } from '../../lib/results-db.js';
export const definition = {
    name: 'classify_developer_type',
    description: 'Classify the developer\'s AI collaboration type using deterministic rules. ' +
        'Uses the 5x3 type matrix (architect/analyst/conductor/speedrunner/trendsetter ' +
        'x explorer/navigator/cartographer). Requires extract_data to have been run first. ' +
        'Returns the primary type, distribution, control level, and matrix name.',
};
export async function execute(_args) {
    const runId = getCurrentRunId();
    // Prefer the persisted run record so classification does not depend on the
    // legacy phase1-output.json artifact still existing on disk.
    let phase1Output;
    const existingRun = runId ? getAnalysisRun(runId) : null;
    if (existingRun?.phase1Output) {
        phase1Output = existingRun.phase1Output;
    }
    else {
        try {
            const phase1Path = join(getPluginDataDir(), 'phase1-output.json');
            const content = await readFile(phase1Path, 'utf-8');
            phase1Output = JSON.parse(content);
        }
        catch {
            return JSON.stringify({
                status: 'error',
                message: 'No Phase 1 data found. Call extract_data first.',
            });
        }
    }
    // Compute scores and type
    const scores = existingRun?.phase1Output
        ? existingRun.scores
        : computeDeterministicScores(phase1Output);
    const typeResult = computeDeterministicType(scores, phase1Output);
    // Save to DB
    if (runId) {
        saveTypeResult(runId, typeResult);
    }
    return JSON.stringify({
        status: 'ok',
        primaryType: typeResult.primaryType,
        controlLevel: typeResult.controlLevel,
        matrixName: typeResult.matrixName,
        matrixEmoji: typeResult.matrixEmoji,
        distribution: typeResult.distribution,
        controlScore: typeResult.controlScore,
        runId,
        message: `Developer type: ${typeResult.matrixEmoji} ${typeResult.matrixName} ` +
            `(${typeResult.primaryType} / ${typeResult.controlLevel}). ` +
            `Distribution: architect ${typeResult.distribution.architect}%, ` +
            `analyst ${typeResult.distribution.analyst}%, ` +
            `conductor ${typeResult.distribution.conductor}%, ` +
            `speedrunner ${typeResult.distribution.speedrunner}%, ` +
            `trendsetter ${typeResult.distribution.trendsetter}%.`,
    });
}
//# sourceMappingURL=classify-developer-type.js.map