/**
 * save_stage_output MCP Tool
 *
 * Accepts and validates pipeline stage outputs (session summaries,
 * project summaries, weekly insights, evidence verification, etc.)
 * and persists them in the local results database.
 *
 * Called by stage-specific analysis skills after the host LLM
 * completes each pipeline stage.
 *
 * @module plugin/mcp/tools/save-stage-output
 */
import { z } from 'zod';
export declare const definition: {
    name: string;
    description: string;
};
export declare const StageOutputInputSchema: z.ZodObject<{
    stage: z.ZodEnum<{
        sessionSummaries: "sessionSummaries";
        projectSummaries: "projectSummaries";
        weeklyInsights: "weeklyInsights";
        typeClassification: "typeClassification";
        evidenceVerification: "evidenceVerification";
        contentWriter: "contentWriter";
        translator: "translator";
    }>;
    data: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare function execute(args: Record<string, unknown>): Promise<string>;
