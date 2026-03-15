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
export declare const TextBlockSchema: z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "text";
    text: string;
}, {
    type: "text";
    text: string;
}>;
export declare const ToolUseBlockSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool_use">;
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}, {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}>;
export declare const ToolResultBlockSchema: z.ZodObject<{
    type: z.ZodLiteral<"tool_result">;
    tool_use_id: z.ZodString;
    content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnknown, "many">]>;
    is_error: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "tool_result";
    tool_use_id: string;
    content: string | unknown[];
    is_error?: boolean | undefined;
}, {
    type: "tool_result";
    tool_use_id: string;
    content: string | unknown[];
    is_error?: boolean | undefined;
}>;
export declare const ContentBlockSchema: z.ZodUnion<[z.ZodObject<{
    type: z.ZodLiteral<"text">;
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    type: "text";
    text: string;
}, {
    type: "text";
    text: string;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool_use">;
    id: z.ZodString;
    name: z.ZodString;
    input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
}, "strip", z.ZodTypeAny, {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}, {
    type: "tool_use";
    id: string;
    name: string;
    input: Record<string, unknown>;
}>, z.ZodObject<{
    type: z.ZodLiteral<"tool_result">;
    tool_use_id: z.ZodString;
    content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnknown, "many">]>;
    is_error: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    type: "tool_result";
    tool_use_id: string;
    content: string | unknown[];
    is_error?: boolean | undefined;
}, {
    type: "tool_result";
    tool_use_id: string;
    content: string | unknown[];
    is_error?: boolean | undefined;
}>]>;
export declare const TokenUsageSchema: z.ZodObject<{
    input_tokens: z.ZodNumber;
    output_tokens: z.ZodNumber;
    cache_creation_input_tokens: z.ZodOptional<z.ZodNumber>;
    cache_read_input_tokens: z.ZodOptional<z.ZodNumber>;
    cache_creation: z.ZodOptional<z.ZodObject<{
        ephemeral_5m_input_tokens: z.ZodNumber;
        ephemeral_1h_input_tokens: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
    }, {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
    }>>;
    service_tier: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | undefined;
    cache_read_input_tokens?: number | undefined;
    cache_creation?: {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
    } | undefined;
    service_tier?: string | undefined;
}, {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number | undefined;
    cache_read_input_tokens?: number | undefined;
    cache_creation?: {
        ephemeral_5m_input_tokens: number;
        ephemeral_1h_input_tokens: number;
    } | undefined;
    service_tier?: string | undefined;
}>;
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
        content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            text: string;
        }, {
            type: "text";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnknown, "many">]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }>]>, "many">]>;
    }, "strip", z.ZodTypeAny, {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    }, {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    }>;
}, "strip", z.ZodTypeAny, {
    message: {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    };
    type: "user";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    cwd?: string | undefined;
    version?: string | undefined;
    gitBranch?: string | undefined;
    userType?: string | undefined;
    isSidechain?: boolean | undefined;
}, {
    message: {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    };
    type: "user";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    cwd?: string | undefined;
    version?: string | undefined;
    gitBranch?: string | undefined;
    userType?: string | undefined;
    isSidechain?: boolean | undefined;
}>;
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
        content: z.ZodArray<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            text: string;
        }, {
            type: "text";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnknown, "many">]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }>]>, "many">;
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
            }, "strip", z.ZodTypeAny, {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            }, {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            }>>;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        }, {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    }, {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    message: {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    };
    type: "assistant";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    isSidechain?: boolean | undefined;
}, {
    message: {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    };
    type: "assistant";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    isSidechain?: boolean | undefined;
}>;
/** Supported JSONL line types */
export declare const JSONLLineSchema: z.ZodDiscriminatedUnion<"type", [z.ZodObject<{
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
        content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            text: string;
        }, {
            type: "text";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnknown, "many">]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }>]>, "many">]>;
    }, "strip", z.ZodTypeAny, {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    }, {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    }>;
}, "strip", z.ZodTypeAny, {
    message: {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    };
    type: "user";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    cwd?: string | undefined;
    version?: string | undefined;
    gitBranch?: string | undefined;
    userType?: string | undefined;
    isSidechain?: boolean | undefined;
}, {
    message: {
        content: string | ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "user";
    };
    type: "user";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    cwd?: string | undefined;
    version?: string | undefined;
    gitBranch?: string | undefined;
    userType?: string | undefined;
    isSidechain?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"assistant">;
    sessionId: z.ZodString;
    timestamp: z.ZodString;
    uuid: z.ZodString;
    parentUuid: z.ZodNullable<z.ZodString>;
    isSidechain: z.ZodOptional<z.ZodBoolean>;
    message: z.ZodObject<{
        id: z.ZodOptional<z.ZodString>;
        role: z.ZodLiteral<"assistant">;
        content: z.ZodArray<z.ZodUnion<[z.ZodObject<{
            type: z.ZodLiteral<"text">;
            text: z.ZodString;
        }, "strip", z.ZodTypeAny, {
            type: "text";
            text: string;
        }, {
            type: "text";
            text: string;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_use">;
            id: z.ZodString;
            name: z.ZodString;
            input: z.ZodRecord<z.ZodString, z.ZodUnknown>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }, {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        }>, z.ZodObject<{
            type: z.ZodLiteral<"tool_result">;
            tool_use_id: z.ZodString;
            content: z.ZodUnion<[z.ZodString, z.ZodArray<z.ZodUnknown, "many">]>;
            is_error: z.ZodOptional<z.ZodBoolean>;
        }, "strip", z.ZodTypeAny, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }, {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        }>]>, "many">;
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
            }, "strip", z.ZodTypeAny, {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            }, {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            }>>;
            service_tier: z.ZodOptional<z.ZodString>;
        }, "strip", z.ZodTypeAny, {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        }, {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        }>>;
    }, "strip", z.ZodTypeAny, {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    }, {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    }>;
}, "strip", z.ZodTypeAny, {
    message: {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    };
    type: "assistant";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    isSidechain?: boolean | undefined;
}, {
    message: {
        content: ({
            type: "text";
            text: string;
        } | {
            type: "tool_use";
            id: string;
            name: string;
            input: Record<string, unknown>;
        } | {
            type: "tool_result";
            tool_use_id: string;
            content: string | unknown[];
            is_error?: boolean | undefined;
        })[];
        role: "assistant";
        id?: string | undefined;
        model?: string | undefined;
        stop_reason?: string | undefined;
        usage?: {
            input_tokens: number;
            output_tokens: number;
            cache_creation_input_tokens?: number | undefined;
            cache_read_input_tokens?: number | undefined;
            cache_creation?: {
                ephemeral_5m_input_tokens: number;
                ephemeral_1h_input_tokens: number;
            } | undefined;
            service_tier?: string | undefined;
        } | undefined;
    };
    type: "assistant";
    sessionId: string;
    timestamp: string;
    uuid: string;
    parentUuid: string | null;
    isSidechain?: boolean | undefined;
}>, z.ZodObject<{
    type: z.ZodLiteral<"queue-operation">;
    timestamp: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"queue-operation">;
    timestamp: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"queue-operation">;
    timestamp: z.ZodString;
}, z.ZodTypeAny, "passthrough">>, z.ZodObject<{
    type: z.ZodLiteral<"file-history-snapshot">;
    timestamp: z.ZodString;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    type: z.ZodLiteral<"file-history-snapshot">;
    timestamp: z.ZodString;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    type: z.ZodLiteral<"file-history-snapshot">;
    timestamp: z.ZodString;
}, z.ZodTypeAny, "passthrough">>]>;
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
export interface UserUtterance {
    id: string;
    text: string;
    displayText?: string;
    timestamp: string;
    sessionId: string;
    turnIndex: number;
    characterCount: number;
    wordCount: number;
    hasCodeBlock: boolean;
    hasQuestion: boolean;
    isSessionStart?: boolean;
    isContinuation?: boolean;
    machineContentRatio?: number;
    precedingAIToolCalls?: string[];
    precedingAIHadError?: boolean;
}
export interface AIInsightBlock {
    sessionId: string;
    turnIndex: number;
    content: string;
    triggeringUtteranceId?: string;
}
export interface FrictionSignals {
    toolFailureCount: number;
    userRejectionSignals: number;
    excessiveIterationSessions: number;
    contextOverflowSessions: number;
    frustrationExpressionCount: number;
    repeatedToolErrorPatterns: number;
    bareRetryAfterErrorCount: number;
    errorChainMaxLength: number;
}
export interface SessionHints {
    avgTurnsPerSession: number;
    shortSessions: number;
    mediumSessions: number;
    longSessions: number;
}
export interface Phase1SessionMetrics {
    totalSessions: number;
    totalMessages: number;
    totalDeveloperUtterances: number;
    totalAIResponses: number;
    avgMessagesPerSession: number;
    avgDeveloperMessageLength: number;
    questionRatio: number;
    codeBlockRatio: number;
    dateRange: {
        earliest: string;
        latest: string;
    };
    slashCommandCounts?: Record<string, number>;
    avgContextFillPercent?: number;
    maxContextFillPercent?: number;
    contextFillExceeded90Count?: number;
    frictionSignals?: FrictionSignals;
    sessionHints?: SessionHints;
    aiInsightBlockCount?: number;
}
export interface Phase1Output {
    developerUtterances: UserUtterance[];
    sessionMetrics: Phase1SessionMetrics;
    aiInsightBlocks?: AIInsightBlock[];
}
export interface DeterministicScores {
    contextEfficiency: number;
    sessionOutcome: number;
    thinkingQuality: number;
    learningBehavior: number;
    communicationPatterns: number;
    controlScore: number;
}
export type CodingStyleType = 'architect' | 'analyst' | 'conductor' | 'speedrunner' | 'trendsetter';
export type AIControlLevel = 'explorer' | 'navigator' | 'cartographer';
export interface DeterministicTypeResult {
    primaryType: CodingStyleType;
    distribution: {
        architect: number;
        analyst: number;
        conductor: number;
        speedrunner: number;
        trendsetter: number;
    };
    controlLevel: AIControlLevel;
    controlScore: number;
    matrixName: string;
    matrixEmoji: string;
}
export interface DomainStrength {
    title: string;
    description: string;
    evidence: Array<{
        utteranceId: string;
        quote: string;
        context?: string;
    }>;
}
export interface DomainGrowthArea {
    title: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
    recommendation: string;
    evidence: Array<{
        utteranceId: string;
        quote: string;
        context?: string;
    }>;
}
export interface DomainResult {
    domain: string;
    overallScore: number;
    confidenceScore: number;
    strengths: DomainStrength[];
    growthAreas: DomainGrowthArea[];
    /** Domain-specific extra data (varies per domain) */
    data?: Record<string, unknown>;
    analyzedAt: string;
}
export interface AnalysisReport {
    userId: string;
    analyzedAt: string;
    phase1Metrics: Phase1SessionMetrics;
    deterministicScores: DeterministicScores;
    typeResult: DeterministicTypeResult;
    domainResults: DomainResult[];
    content?: {
        topFocusAreas?: Array<{
            title: string;
            narrative: string;
            actions: {
                start: string;
                stop: string;
                continue: string;
            };
        }>;
        personalitySummary?: string[];
    };
}
export declare const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>>;
export declare const MATRIX_METADATA: Record<CodingStyleType, Record<AIControlLevel, {
    emoji: string;
}>>;
