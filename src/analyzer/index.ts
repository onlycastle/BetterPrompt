import Anthropic from '@anthropic-ai/sdk';
import {
  type ParsedSession,
  type Evaluation,
  type LLMResponse,
  LLMResponseSchema,
} from '../models/index.js';
import { SYSTEM_PROMPT, buildUserPrompt, truncateConversation } from './prompts.js';
import { getEvaluationTool } from './schema-converter.js';

/**
 * Error types for analysis failures
 */
export class AnalysisError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'AnalysisError';
  }
}

/**
 * Configuration for the LLM analyzer
 */
export interface AnalyzerConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
  maxTokens?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<AnalyzerConfig> = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  maxRetries: 1,
  maxTokens: 4096,
};

/**
 * LLMAnalyzer - Sends session data to Claude API for evaluation
 *
 * Uses Anthropic's Structured Outputs feature (November 2025) to
 * guarantee valid JSON responses matching the evaluation schema.
 */
export class LLMAnalyzer {
  private client: Anthropic;
  private config: Required<AnalyzerConfig>;

  constructor(config: AnalyzerConfig = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Get API key from config or environment
    const apiKey = this.config.apiKey || process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new AnalysisError(
        'API key required. Set ANTHROPIC_API_KEY environment variable or pass apiKey in config.',
        'NO_API_KEY'
      );
    }

    this.client = new Anthropic({ apiKey });
  }

  /**
   * Analyze a parsed session and return an evaluation
   */
  async analyze(session: ParsedSession): Promise<Evaluation> {
    // Truncate conversation if too long
    const truncatedMessages = truncateConversation(session.messages);
    const truncatedSession: ParsedSession = {
      ...session,
      messages: truncatedMessages,
    };

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const response = await this.callLLM(truncatedSession);
        const parsed = this.parseResponse(response);

        // Add metadata to create full Evaluation
        return {
          sessionId: session.sessionId,
          analyzedAt: new Date().toISOString(),
          ...parsed,
        };
      } catch (error) {
        lastError = error as Error;

        if (error instanceof AnalysisError && !error.retryable) {
          throw error;
        }

        if (attempt < this.config.maxRetries) {
          // Exponential backoff
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new AnalysisError(
      `Analysis failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      'MAX_RETRIES_EXCEEDED'
    );
  }

  /**
   * Call the Anthropic API with structured output
   */
  private async callLLM(session: ParsedSession): Promise<Anthropic.Message> {
    const userPrompt = buildUserPrompt(session);
    const tool = getEvaluationTool();

    try {
      const response = await this.client.messages.create(
        {
          model: this.config.model,
          max_tokens: this.config.maxTokens,
          temperature: 0.3, // Lower temperature for more consistent ratings
          system: SYSTEM_PROMPT,
          tools: [
            {
              name: tool.name,
              description: tool.description,
              input_schema: tool.input_schema as Anthropic.Tool.InputSchema,
            },
          ],
          tool_choice: { type: 'tool', name: tool.name },
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
        throw new AnalysisError(
          'Rate limit exceeded. Please try again later.',
          'RATE_LIMIT',
          true
        );
      }

      if (error instanceof Anthropic.AuthenticationError) {
        throw new AnalysisError(
          'Invalid API key. Please check your ANTHROPIC_API_KEY.',
          'AUTH_ERROR'
        );
      }

      if (error instanceof Anthropic.APIError) {
        throw new AnalysisError(
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
  private parseResponse(response: Anthropic.Message): LLMResponse {
    // Find the tool use block
    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    if (!toolUse) {
      throw new AnalysisError(
        'No tool use found in response',
        'PARSE_ERROR'
      );
    }

    // Validate against schema
    const result = LLMResponseSchema.safeParse(toolUse.input);

    if (!result.success) {
      throw new AnalysisError(
        `Schema validation failed: ${result.error.message}`,
        'VALIDATION_ERROR'
      );
    }

    return result.data;
  }

  /**
   * Sleep helper for retry backoff
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export factory function for convenience
export function createAnalyzer(config?: AnalyzerConfig): LLMAnalyzer {
  return new LLMAnalyzer(config);
}

// Re-export prompts utilities
export { formatConversation, buildUserPrompt, estimateTokens } from './prompts.js';
export { getEvaluationJsonSchema, getEvaluationTool } from './schema-converter.js';
