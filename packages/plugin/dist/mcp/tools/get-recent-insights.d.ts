/**
 * get_recent_insights MCP Tool
 *
 * Returns strengths, anti-patterns, or KPT (Keep/Problem/Try) summary.
 */
import type { UserSummary } from '../../lib/api-client.js';
export declare const definition: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            category: {
                type: string;
                description: string;
                enum: string[];
                default: string;
            };
        };
        required: string[];
    };
};
export declare function formatResult(summary: UserSummary | null, args: {
    category?: string;
}): string;
