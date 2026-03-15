/**
 * get_growth_areas MCP Tool
 *
 * Returns the developer's top growth areas with recommendations.
 * Optionally filtered by domain.
 */
import type { UserSummary } from '../../lib/api-client.js';
export declare const definition: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {
            domain: {
                type: string;
                description: string;
                enum: string[];
            };
        };
        required: string[];
    };
};
export declare function formatResult(summary: UserSummary | null, args: {
    domain?: string;
}): string;
