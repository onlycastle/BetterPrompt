/**
 * Core Types for Plugin-First Architecture
 *
 * Minimal type definitions needed by MCP tools and core modules.
 * These mirror the types from src/lib/models/ but are standalone
 * to avoid cross-compilation boundary issues.
 *
 * @module plugin/lib/core/types
 */
import { z } from 'zod';
// ============================================================================
// Session Types (from src/lib/models/session.ts)
// ============================================================================
export const TextBlockSchema = z.object({
    type: z.literal('text'),
    text: z.string(),
});
export const ToolUseBlockSchema = z.object({
    type: z.literal('tool_use'),
    id: z.string(),
    name: z.string(),
    input: z.record(z.string(), z.unknown()),
});
export const ToolResultBlockSchema = z.object({
    type: z.literal('tool_result'),
    tool_use_id: z.string(),
    content: z.union([z.string(), z.array(z.unknown())]),
    is_error: z.boolean().optional(),
});
export const ContentBlockSchema = z.union([
    TextBlockSchema,
    ToolUseBlockSchema,
    ToolResultBlockSchema,
]);
export const TokenUsageSchema = z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
    cache_creation_input_tokens: z.number().optional(),
    cache_read_input_tokens: z.number().optional(),
    cache_creation: z
        .object({
        ephemeral_5m_input_tokens: z.number(),
        ephemeral_1h_input_tokens: z.number(),
    })
        .optional(),
    service_tier: z.string().optional(),
});
export const UserMessageSchema = z.object({
    type: z.literal('user'),
    sessionId: z.string(),
    timestamp: z.string(),
    uuid: z.string(),
    parentUuid: z.string().nullable(),
    cwd: z.string().optional(),
    version: z.string().optional(),
    gitBranch: z.string().optional(),
    userType: z.string().optional(),
    isSidechain: z.boolean().optional(),
    message: z.object({
        role: z.literal('user'),
        content: z.union([z.string(), z.array(ContentBlockSchema)]),
    }),
});
export const AssistantMessageSchema = z.object({
    type: z.literal('assistant'),
    sessionId: z.string(),
    timestamp: z.string(),
    uuid: z.string(),
    parentUuid: z.string().nullable(),
    isSidechain: z.boolean().optional(),
    message: z.object({
        id: z.string().optional(),
        role: z.literal('assistant'),
        content: z.array(ContentBlockSchema),
        model: z.string().optional(),
        stop_reason: z.string().optional(),
        usage: TokenUsageSchema.optional(),
    }),
});
/** Supported JSONL line types */
export const JSONLLineSchema = z.discriminatedUnion('type', [
    UserMessageSchema,
    AssistantMessageSchema,
    // Queue operations and file history are parsed but not analyzed
    z.object({ type: z.literal('queue-operation'), timestamp: z.string() }).passthrough(),
    z.object({ type: z.literal('file-history-snapshot'), timestamp: z.string() }).passthrough(),
]);
// ============================================================================
// Matrix Names & Metadata (from src/lib/models/coding-style.ts)
// ============================================================================
// ============================================================================
// Shared Constants
// ============================================================================
export const CONTEXT_WINDOW_SIZE = 200_000;
export const MATRIX_NAMES = {
    architect: {
        explorer: 'Sketch Architect',
        navigator: 'Blueprint Architect',
        cartographer: 'Master Architect',
    },
    analyst: {
        explorer: 'Curious Analyst',
        navigator: 'Systematic Analyst',
        cartographer: 'Forensic Analyst',
    },
    conductor: {
        explorer: 'Jam Session Conductor',
        navigator: 'Ensemble Conductor',
        cartographer: 'Symphony Conductor',
    },
    speedrunner: {
        explorer: 'Freestyle Speedrunner',
        navigator: 'Route Speedrunner',
        cartographer: 'TAS Speedrunner',
    },
    trendsetter: {
        explorer: 'Vibe Trendsetter',
        navigator: 'Wave Trendsetter',
        cartographer: 'Signal Trendsetter',
    },
};
export const MATRIX_METADATA = {
    architect: {
        explorer: { emoji: '✏️' },
        navigator: { emoji: '📐' },
        cartographer: { emoji: '🏗️' },
    },
    analyst: {
        explorer: { emoji: '🔍' },
        navigator: { emoji: '🔬' },
        cartographer: { emoji: '🧬' },
    },
    conductor: {
        explorer: { emoji: '🎸' },
        navigator: { emoji: '🎼' },
        cartographer: { emoji: '🎻' },
    },
    speedrunner: {
        explorer: { emoji: '🏄' },
        navigator: { emoji: '⚡' },
        cartographer: { emoji: '🎮' },
    },
    trendsetter: {
        explorer: { emoji: '🌊' },
        navigator: { emoji: '📡' },
        cartographer: { emoji: '🔮' },
    },
};
//# sourceMappingURL=types.js.map