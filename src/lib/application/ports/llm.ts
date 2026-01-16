/**
 * LLM Port Interface
 *
 * Defines the contract for LLM operations.
 * Implemented by Anthropic, mock, and cached adapters.
 *
 * @module application/ports/llm
 */

import type { Result } from '../../result';
import type { AnalysisError, SkillError } from '../../domain/errors/index';
import type {
  ParsedSession,
  LLMResponse,
  TypeResult,
  Dimensions,
  KnowledgeItem,
} from '../../domain/models/index';

// ============================================================================
// LLM Configuration
// ============================================================================

/**
 * LLM configuration options
 */
export interface LLMConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  timeout?: number;
}

/**
 * Token usage information
 */
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cachedTokens?: number;
}

/**
 * LLM response metadata
 */
export interface LLMMetadata {
  model: string;
  usage: TokenUsage;
  durationMs: number;
  requestId?: string;
}

// ============================================================================
// Structured Output Types
// ============================================================================

/**
 * Tool definition for structured outputs
 */
export interface ToolDefinition {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

/**
 * Structured output response
 */
export interface StructuredResponse<T> {
  data: T;
  metadata: LLMMetadata;
}

// ============================================================================
// LLM Port Interface
// ============================================================================

/**
 * Port for LLM operations
 */
export interface ILLMPort {
  /**
   * Check if the LLM client is available
   */
  isAvailable(): boolean;

  /**
   * Get the current model name
   */
  getModel(): string;

  /**
   * Evaluate a session for planning, critical thinking, code understanding
   */
  evaluateSession(
    session: ParsedSession,
    options?: { maxTokens?: number }
  ): Promise<Result<StructuredResponse<LLMResponse>, AnalysisError>>;

  /**
   * Detect coding style type from session(s)
   */
  detectCodingStyle(
    sessions: ParsedSession[],
    options?: { maxTokens?: number }
  ): Promise<Result<StructuredResponse<TypeResult>, AnalysisError>>;

  /**
   * Calculate analysis dimensions
   */
  calculateDimensions(
    sessions: ParsedSession[],
    options?: { maxTokens?: number }
  ): Promise<Result<StructuredResponse<Dimensions>, AnalysisError>>;

  /**
   * Extract knowledge from content
   */
  extractKnowledge(
    content: string,
    options?: {
      url?: string;
      platform?: string;
      maxTokens?: number;
    }
  ): Promise<Result<StructuredResponse<Partial<KnowledgeItem>>, SkillError>>;

  /**
   * Score content relevance
   */
  scoreRelevance(
    content: string,
    criteria: string[],
    options?: { maxTokens?: number }
  ): Promise<Result<StructuredResponse<{
    score: number;
    confidence: number;
    reasoning: string;
  }>, SkillError>>;

  /**
   * Generate recommendations based on analysis
   */
  generateRecommendations(
    analysis: {
      typeResult: TypeResult;
      dimensions: Dimensions;
    },
    knowledgeItems?: KnowledgeItem[],
    options?: { maxTokens?: number }
  ): Promise<Result<StructuredResponse<string[]>, AnalysisError>>;

  /**
   * Raw completion (for custom prompts)
   */
  complete(
    prompt: string,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<Result<StructuredResponse<string>, AnalysisError>>;

  /**
   * Structured output with tool use
   */
  structuredOutput<T>(
    prompt: string,
    tool: ToolDefinition,
    options?: {
      systemPrompt?: string;
      maxTokens?: number;
    }
  ): Promise<Result<StructuredResponse<T>, AnalysisError>>;

  /**
   * Estimate tokens for a string
   */
  estimateTokens(text: string): number;

  /**
   * Get rate limit status
   */
  getRateLimitStatus(): {
    remaining: number;
    resetAt: Date | null;
    isLimited: boolean;
  };
}

// ============================================================================
// Cache Port Interface (for caching LLM responses)
// ============================================================================

/**
 * Cache key generator
 */
export type CacheKeyGenerator = (input: unknown) => string;

/**
 * Cache options
 */
export interface CacheOptions {
  ttlMs?: number; // Time to live in milliseconds
  skipCache?: boolean; // Bypass cache for this request
}

/**
 * Port for caching LLM responses
 */
export interface ILLMCachePort {
  /**
   * Get cached response
   */
  get<T>(key: string): Promise<T | null>;

  /**
   * Set cached response
   */
  set<T>(key: string, value: T, options?: CacheOptions): Promise<void>;

  /**
   * Check if key exists
   */
  has(key: string): Promise<boolean>;

  /**
   * Delete cached response
   */
  delete(key: string): Promise<void>;

  /**
   * Clear all cached responses
   */
  clear(): Promise<void>;

  /**
   * Get cache statistics
   */
  getStats(): {
    hits: number;
    misses: number;
    size: number;
  };
}

// ============================================================================
// Cached LLM Port (decorator pattern)
// ============================================================================

/**
 * Configuration for cached LLM
 */
export interface CachedLLMConfig {
  llm: ILLMPort;
  cache: ILLMCachePort;
  defaultTTL?: number;
  keyGenerator?: CacheKeyGenerator;
}

/**
 * Factory function type for creating LLM ports
 */
export type LLMPortFactory = (config: LLMConfig) => ILLMPort;

// ============================================================================
// Mock LLM Types (for testing)
// ============================================================================

/**
 * Mock response configuration
 */
export interface MockLLMResponse<T> {
  data: T;
  delay?: number; // Simulated delay in ms
  shouldFail?: boolean;
  errorMessage?: string;
}

/**
 * Mock LLM configuration
 */
export interface MockLLMConfig {
  responses?: Map<string, MockLLMResponse<unknown>>;
  defaultDelay?: number;
  defaultResponse?: unknown;
}
