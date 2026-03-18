/**
 * Core Types for Plugin-First Architecture
 *
 * Re-exports canonical types from @betterprompt/shared for Phase 1,
 * deterministic scoring, domain results, and constants.
 *
 * Plugin-specific types (JSONL parsing, session metadata) remain here.
 *
 * @module plugin/lib/core/types
 */
import { z } from 'zod';
export type { UserUtterance, AIInsightBlock, FrictionSignals, SessionHints, Phase1SessionMetrics, Phase1Output, ReportActivitySession, DeterministicScores, CodingStyleType, AIControlLevel, DeterministicTypeResult, DomainStrength, DomainGrowthArea, DomainResult, AnalysisReport, CanonicalStageOutputs, CanonicalEvaluationPayload, CanonicalAnalysisRun, CanonicalAnalysisRunParts, } from '@betterprompt/shared/schemas';
export { CONTEXT_WINDOW_SIZE, MATRIX_NAMES, MATRIX_METADATA, } from '@betterprompt/shared';
export declare const TextBlockSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, z.core.$strip>;
export declare const ToolUseBlockSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool_use">;
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>;
export declare const ToolResultBlockSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool_result">;
    tool_use_id: z.ZodString;
    content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnknown>]>;
    is_error: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>;
export declare const ContentBlockSchema: z.ZodUnion<readonly [z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"tool_use">;
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"tool_result">;
    tool_use_id: z.ZodString;
    content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnknown>]>;
    is_error: z.ZodOptional<z.ZodBoolean>;
}, z.core.$strip>]>;
export declare const TokenUsageSchema: z.ZodObject<{
    input_tokens: z.ZodNumber;
    output_tokens: z.ZodNumber;
    cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
    cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
    cache_creation: z.ZodOptional<z.ZodObject<{
        ephemeral_5m_input_tokens: z.ZodNumber;
        ephemeral_1h_input_tokens: z.ZodNumber;
    }, z.core.$strip>>;
    service_tier: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type SessionSourceType = 'claude-code' | 'cursor' | 'cursor-composer';
export interface ToolCall {
    id: string;
    name: string;
    input: Record<string, unknown>;
    result?: string;
    isError?: boolean;
}
export interface ParsedMessage {
    uuid: string;
    role: 'user' | 'assistant';
    timestamp: string;
    content: string;
    toolCalls?: ToolCall[];
    tokenUsage?: {
        input: number;
        output: number;
    };
}
export interface SessionStats {
    userMessageCount: number;
    assistantMessageCount: number;
    toolCallCount: number;
    uniqueToolsUsed: string[];
    totalInputTokens: number;
    totalOutputTokens: number;
}
export interface ParsedSession {
    sessionId: string;
    projectPath: string;
    projectName?: string;
    startTime: string;
    endTime: string;
    durationSeconds: number;
    claudeCodeVersion: string;
    messages: ParsedMessage[];
    stats: SessionStats;
    source?: SessionSourceType;
}
export declare const UserMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"user">;
    sessionId: z.ZodString;
    timestamp: z.ZodString;
    uuid: z.ZodString;
    parentUuid: z.ZodNullable<z.ZodString>;
    cwd: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    gitBranch: z.ZodOptional<z.ZodString>;
    userType: z.ZodOptional<z.ZodString>;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    message: z.ZodObject<{
        role: z.ZodLiteral<"user">;
        content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnknown>]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>>]>;
    }, z.core.$strip>;
}, z.core.$strip>;
export declare const AssistantMessageSchema: z.ZodObject<{
    type: z.ZodLiteral<"assistant">;
    sessionId: z.ZodString;
    timestamp: z.ZodString;
    uuid: z.ZodString;
    parentUuid: z.ZodNullable<z.ZodString>;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    message: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        role: z.ZodLiteral<"assistant">;
        content: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnknown>]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>>;
        model: z.ZodOptional<z.ZodString>;
        stop_reason: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            output_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_creation: z.ZodOptional<z.ZodObject<{
                ephemeral_5m_input_tokens: z.ZodNumber;
                ephemeral_1h_input_tokens: z.ZodNumber;
            }, z.core.$strip>>;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>;
/** Supported JSONL line types */
export declare const JSONLLineSchema: z.ZodDiscriminatedUnion<[z.ZodObject<{
    type: z.ZodLiteral<"user">;
    sessionId: z.ZodString;
    timestamp: z.ZodString;
    uuid: z.ZodString;
    parentUuid: z.ZodNullable<z.ZodString>;
    cwd: z.ZodOptional<z.ZodString>;
    version: z.ZodOptional<z.ZodString>;
    gitBranch: z.ZodOptional<z.ZodString>;
    userType: z.ZodOptional<z.ZodString>;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    message: z.ZodObject<{
        role: z.ZodLiteral<"user">;
        content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnknown>]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>>]>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"assistant">;
    sessionId: z.ZodString;
    timestamp: z.ZodString;
    uuid: z.ZodString;
    parentUuid: z.ZodNullable<z.ZodString>;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    message: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        role: z.ZodLiteral<"assistant">;
        content: z.ZodArray<z.ZodUnion<readonly [z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, z.core.$strip>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodUnknown>]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, z.core.$strip>]>>;
        model: z.ZodOptional<z.ZodString>;
        stop_reason: z.ZodOptional<z.ZodString>;
        usage: z.ZodOptional<z.ZodObject<{
            input_tokens: z.ZodNumber;
            output_tokens: z.ZodNumber;
            cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
            cache_creation: z.ZodOptional<z.ZodObject<{
                ephemeral_5m_input_tokens: z.ZodNumber;
                ephemeral_1h_input_tokens: z.ZodNumber;
            }, z.core.$strip>>;
            service_tier: z.ZodOptional<z.ZodString>;
        }, z.core.$strip>>;
    }, z.core.$strip>;
}, z.core.$strip>, z.ZodObject<{
    type: z.ZodLiteral<"queue-operation">;
    timestamp: z.ZodString;
}, z.core.$loose>, z.ZodObject<{
    type: z.ZodLiteral<"file-history-snapshot">;
    timestamp: z.ZodString;
}, z.core.$loose>], "type">;
export type JSONLLine = z.infer<typeof JSONLLineSchema>;
export interface SessionMetadata {
    sessionId: string;
    projectPath: string;
    projectName: string;
    timestamp: Date;
    messageCount: number;
    durationSeconds: number;
    filePath: string;
    avgContextUtilization?: number;
    maxContextUtilization?: number;
}
