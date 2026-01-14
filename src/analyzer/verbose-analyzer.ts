/**
 * Verbose Analyzer - Hyper-personalized multi-session analysis
 *
 * Extends the standard analyzer with deep behavioral insights and personalization.
 * Uses Anthropic's Structured Outputs to guarantee valid JSON matching the verbose schema.
 */

import Anthropic from '@anthropic-ai/sdk';
import { type ParsedSession, type SessionMetrics } from '../domain/models/analysis.js';
import {
  type VerboseEvaluation,
  type VerboseLLMResponse,
  VerboseLLMResponseSchema,
} from '../models/verbose-evaluation.js';
import {
  VERBOSE_SYSTEM_PROMPT,
  buildVerboseUserPrompt,
  getVerboseToolDefinition,
} from './verbose-prompts.js';
import { zodToJsonSchema } from 'zod-to-json-schema';

/**
 * Error types for verbose analysis failures
 */
export class VerboseAnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'VerboseAnalysisError';
  }
}

/**
 * Configuration for the verbose analyzer
 */
export interface VerboseAnalyzerConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  maxTokens?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<VerboseAnalyzerConfig> = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  maxRetries: 1,
  maxTokens: 8192, // Higher token limit for verbose output
};

/**
 * VerboseAnalyzer - Sends multiple session data to Claude API for hyper-personalized evaluation
 *
 * Uses Anthropic's Structured Outputs feature to guarantee valid JSON responses
 * matching the VerboseEvaluation schema.
 */
export class VerboseAnalyzer {
  private client: Anthropic;
  private config: Required<VerboseAnalyzerConfig>;

  constructor(config: VerboseAnalyzerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Get API key from config or environment
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new VerboseAnalysisError(
        'API key required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config.',
        'NO_API_KEY'
      );
    }

    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analyze multiple sessions and return a verbose evaluation
   */
  async analyzeVerbose(
    sessions: ParsedSession[],
    metrics: SessionMetrics
  ): Promise<VerboseEvaluation> {
    if (sessions.length === 0) {
      throw new VerboseAnalysisError(
        'At least one session is required for verbose analysis',
        'NO_SESSIONS'
      );
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.callLLM(sessions, metrics);
        const parsed = this.parseResponse(response);

        // Add metadata to create full VerboseEvaluation
        return {
          sessionId: sessions[sessions.length - 1].sessionId, // Use last session ID
          analyzedAt: new Date().toISOString(),
          sessionsAnalyzed: sessions.length,
          ...parsed,
        };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof VerboseAnalysisError && !error.retryable) {
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new VerboseAnalysisError(
      `Verbose analysis failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      'MAX_RETRIES_EXCEEDED'
    );
  }

  /**
   * Call the Anthropic API with structured output
   */
  private async callLLM(
    sessions: ParsedSession[],
    metrics: SessionMetrics
  ): Promise<Anthropic.Message> {
    const userPrompt = buildVerboseUserPrompt(sessions, metrics);
    const toolDef = getVerboseToolDefinition();
    const schema = this.getVerboseJsonSchema();

    try {
      const response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: 0.4, // Slightly higher for more creative personalization
          system: VERBOSE_SYSTEM_PROMPT,
          tools: [
            {
              name: toolDef.name,
              description: toolDef.description,
              input_schema: schema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: 'tool', name: toolDef.name },
          messages: [{ role: 'user', content: userPrompt }],
        },
        {
          headers: {
            'anthropic-beta': 'structured-outputs-2025-11-13',
          },
        }
      );

      return response;
    } catch (error) {
      if (error instanceof Anthropic.RateLimitError) {
        throw new VerboseAnalysisError(
          'Rate limit exceeded. Please try again later.',
          'RATE_LIMIT',
          true
        );
      }

      if (error instanceof Anthropic.AuthenticationError) {
        throw new VerboseAnalysisError(
          'Invalid API key. Please check your ANTHROPIC_API_KEY.',
          'AUTH_ERROR'
        );
      }

      if (error instanceof Anthropic.APIError) {
        throw new VerboseAnalysisError(
          `API error: ${error.message}`,
          'API_ERROR',
          error.status === 500 || error.status === 503
        );
      }

      throw error;
    }
  }

  /**
   * Parse the API response and validate against schema
   */
  private parseResponse(response: Anthropic.Message): VerboseLLMResponse {
    // Find the tool use block
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUse) {
      throw new VerboseAnalysisError(
        'No tool use found in response',
        'PARSE_ERROR'
      );
    }

    // Validate against schema
    const result = VerboseLLMResponseSchema.safeParse(toolUse.input);

    if (!result.success) {
      throw new VerboseAnalysisError(
        `Schema validation failed: ${result.error.message}`,
        'VALIDATION_ERROR'
      );
    }

    return result.data;
  }

  /**
   * Convert the VerboseLLMResponse schema to JSON Schema format
   * for use with Anthropic's structured outputs
   */
  private getVerboseJsonSchema(): Record<string, unknown> {
    const fullSchema = zodToJsonSchema(VerboseLLMResponseSchema, {
      $refStrategy: 'none', // Inline all refs
    });

    // Remove $schema as Anthropic doesn't need it
    const { $schema: _$schema, ...schema } = fullSchema as Record<string, unknown>;

    return schema;
  }

  /**
   * Sleep helper for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

/**
 * Export factory function for convenience
 */
export function createVerboseAnalyzer(config?: VerboseAnalyzerConfig): VerboseAnalyzer {
  return new VerboseAnalyzer(config);
}

// Re-export prompts utilities
export { buildVerboseUserPrompt } from './verbose-prompts.js';
