/**
 * Base Skill
 *
 * Abstract base class for all search-agent skills.
 * Provides common functionality: LLM client, retry logic, error handling.
 */

import Anthropic from '@anthropic-ai/sdk';

/**
 * Skill execution result
 */
export interface SkillResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: {
    executionTimeMs: number;
    tokensUsed?: number;
  };
}

/**
 * Skill configuration
 */
export interface SkillConfig {
  apiKey?: string;
  model?: string;
  maxRetries?: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: Required<SkillConfig> = {
  apiKey: '',
  model: 'claude-sonnet-4-20250514',
  maxRetries: 2,
};

/**
 * Skill error with additional context
 */
export class SkillError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly retryable: boolean = false
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

/**
 * Abstract base class for all search-agent skills
 *
 * Provides common functionality:
 * - LLM client initialization
 * - Retry logic with exponential backoff
 * - Error handling
 * - Metrics collection
 */
export abstract class BaseSkill<TInput, TOutput> {
  protected client: Anthropic;
  protected config: Required<SkillConfig>;

  abstract readonly name: string;
  abstract readonly description: string;

  constructor(config: SkillConfig = {}) {
    this.config = {
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY || DEFAULT_CONFIG.apiKey,
      model: config.model || DEFAULT_CONFIG.model,
      maxRetries: config.maxRetries ?? DEFAULT_CONFIG.maxRetries,
    };

    // Initialize client only if API key is available
    // Some skills may not need LLM calls
    if (this.config.apiKey) {
      this.client = new Anthropic({ apiKey: this.config.apiKey });
    } else {
      // Create placeholder that will error if used without API key
      this.client = null as unknown as Anthropic;
    }
  }

  /**
   * Execute the skill with input and return result
   */
  abstract execute(input: TInput): Promise<SkillResult<TOutput>>;

  /**
   * Check if the skill has an LLM client configured
   */
  protected hasLLMClient(): boolean {
    return this.client !== null && this.config.apiKey !== '';
  }

  /**
   * Ensure LLM client is available
   */
  protected ensureLLMClient(): void {
    if (!this.hasLLMClient()) {
      throw new SkillError(
        'API key required. Set ANTHROPIC_API_KEY environment variable.',
        'NO_API_KEY'
      );
    }
  }

  /**
   * Call LLM with retry logic and exponential backoff
   */
  protected async callLLM(
    systemPrompt: string,
    userPrompt: string,
    options?: {
      temperature?: number;
      maxTokens?: number;
      tools?: Anthropic.Tool[];
      toolChoice?: Anthropic.ToolChoice;
    }
  ): Promise<Anthropic.Message> {
    this.ensureLLMClient();

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        const params: Anthropic.MessageCreateParams = {
          model: this.config.model,
          max_tokens: options?.maxTokens ?? 4096,
          temperature: options?.temperature ?? 0.3,
          system: systemPrompt,
          messages: [{ role: 'user', content: userPrompt }],
        };

        if (options?.tools) {
          params.tools = options.tools;
        }

        if (options?.toolChoice) {
          params.tool_choice = options.toolChoice;
        }

        return await this.client.messages.create(params);
      } catch (error) {
        lastError = error as Error;

        // Check for non-retryable errors
        if (error instanceof Anthropic.AuthenticationError) {
          throw new SkillError(
            'Invalid API key. Please check your ANTHROPIC_API_KEY.',
            'AUTH_ERROR'
          );
        }

        if (error instanceof Anthropic.RateLimitError) {
          // Rate limit is retryable with longer backoff
          if (attempt < this.config.maxRetries) {
            await this.sleep(Math.pow(2, attempt + 2) * 1000);
            continue;
          }
        }

        // Other API errors with exponential backoff
        if (attempt < this.config.maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 1000);
        }
      }
    }

    throw new SkillError(
      `LLM call failed after ${this.config.maxRetries + 1} attempts: ${lastError?.message}`,
      'MAX_RETRIES_EXCEEDED'
    );
  }

  /**
   * Extract text content from LLM response
   */
  protected extractText(response: Anthropic.Message): string {
    const textBlock = response.content.find((b) => b.type === 'text');
    if (!textBlock || textBlock.type !== 'text') {
      throw new SkillError('No text content in LLM response', 'PARSE_ERROR');
    }
    return textBlock.text;
  }

  /**
   * Extract tool use from LLM response
   */
  protected extractToolUse(response: Anthropic.Message): Anthropic.ToolUseBlock {
    const toolUse = response.content.find((b) => b.type === 'tool_use');
    if (!toolUse || toolUse.type !== 'tool_use') {
      throw new SkillError('No tool use in LLM response', 'PARSE_ERROR');
    }
    return toolUse;
  }

  /**
   * Parse JSON from text, handling markdown code blocks
   */
  protected parseJSON<T>(text: string): T {
    // Try to extract JSON from markdown code block
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();

    try {
      return JSON.parse(jsonStr) as T;
    } catch {
      throw new SkillError(`Failed to parse JSON: ${jsonStr.slice(0, 100)}...`, 'PARSE_ERROR');
    }
  }

  /**
   * Sleep helper for retry backoff
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Measure execution time of an async function
   */
  protected async withTiming<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; timeMs: number }> {
    const start = Date.now();
    const result = await fn();
    return { result, timeMs: Date.now() - start };
  }
}
