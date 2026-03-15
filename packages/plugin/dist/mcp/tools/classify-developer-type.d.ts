/**
 * classify_developer_type MCP Tool
 *
 * Runs deterministic type classification from domain scores.
 * Uses Phase 1.2 rules (DeterministicTypeMapper) to determine
 * primary type and control level.
 */
export declare const definition: {
    name: string;
    description: string;
};
export declare function execute(_args: Record<string, unknown>): Promise<string>;
