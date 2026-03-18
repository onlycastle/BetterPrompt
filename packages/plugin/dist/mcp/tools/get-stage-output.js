/**
 * get_stage_output MCP Tool
 *
 * Reads a previously saved pipeline stage output from the local DB.
 * Used by downstream skills to access results from earlier stages
 * (e.g., project summarizer reads session summaries from Phase 1.5).
 *
 * @module plugin/mcp/tools/get-stage-output
 */
import { getCurrentRunId } from '../../lib/results-db.js';
import { getStageOutput, getAllStageOutputs } from '../../lib/stage-db.js';
export const definition = {
    name: 'get_stage_output',
    description: 'Read a previously saved pipeline stage output. ' +
        'Provide a stage name to get that specific output, or omit to get all stages. ' +
        'Available stages: sessionSummaries, projectSummaries, weeklyInsights, ' +
        'typeClassification, evidenceVerification, contentWriter, translator.',
};
export async function execute(args) {
    const runId = getCurrentRunId();
    if (!runId) {
        return JSON.stringify({
            status: 'error',
            message: 'No active analysis run. Call extract_data first.',
        });
    }
    if (args.stage) {
        const data = getStageOutput(runId, args.stage);
        if (!data) {
            return JSON.stringify({
                status: 'not_found',
                stage: args.stage,
                runId,
                message: `No ${args.stage} output found for run #${runId}. This stage may not have been executed yet.`,
            });
        }
        return JSON.stringify({
            status: 'ok',
            stage: args.stage,
            runId,
            data,
        });
    }
    const all = getAllStageOutputs(runId);
    const stages = Object.keys(all);
    return JSON.stringify({
        status: 'ok',
        runId,
        stagesAvailable: stages,
        data: all,
    });
}
//# sourceMappingURL=get-stage-output.js.map