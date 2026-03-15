/**
 * get_developer_profile MCP Tool
 *
 * Returns the developer's AI collaboration profile:
 * primaryType, controlLevel, domain scores, personality summary.
 */
import type { UserSummary } from '../../lib/api-client.js';
export declare const definition: {
    name: string;
    description: string;
    inputSchema: {
        type: "object";
        properties: {};
        required: string[];
    };
};
export declare function formatResult(summary: UserSummary | null): string;
