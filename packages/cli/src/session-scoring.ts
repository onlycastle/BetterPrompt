/**
 * Session Quality Scoring
 *
 * Evaluates session quality based on dialogue patterns and problem complexity
 * to select the most meaningful sessions for analysis.
 */

/**
 * Raw metrics extracted from session content
 */
export interface SessionQualityMetrics {
  // Dialogue quality signals
  userMessageCount: number;
  assistantMessageCount: number;
  totalUserTextLength: number;
  questionCount: number;
  iterationCount: number;

  // Problem complexity signals
  uniqueToolsUsed: Set<string>;
  editWriteCount: number;
  searchToolCount: number;
  errorCount: number;
  errorRecoveryCount: number;
}

/**
 * Scoring weights (must sum to 1.0)
 */
const WEIGHTS = {
  // Dialogue quality (60%)
  turnBalance: 0.15,
  promptLength: 0.1,
  questionDensity: 0.1,
  iterationPatterns: 0.15,
  conversationDepth: 0.1,

  // Problem complexity (40%)
  toolDiversity: 0.1,
  editWriteRatio: 0.1,
  errorRecovery: 0.1,
  searchExploration: 0.05,
  contextUtilization: 0.05,
} as const;

/**
 * Penalty factors
 */
const PENALTIES = {
  readOnlySession: 0.2, // No Edit/Write tools
  singleToolSession: 0.15, // Only one unique tool
  veryShortSession: 0.1, // Less than 10 messages
  highErrorRate: 0.1, // Many errors without recovery
} as const;

/**
 * Patterns for detecting questions in user prompts
 */
const QUESTION_PATTERNS = [
  /\?/g,
  /\b(why|how|what|when|where|which|who|can you|could you|would you)\b/gi,
];

/**
 * Patterns for detecting iteration/refinement requests
 */
const ITERATION_PATTERNS = [
  /\b(change|fix|update|modify|adjust|instead|but|however|actually|wait)\b/gi,
  /\b(try again|one more|not quite|almost|close but)\b/gi,
];

/**
 * Code modification tools that indicate active development
 */
const EDIT_WRITE_TOOLS = new Set(['Edit', 'Write', 'NotebookEdit']);

/**
 * Search/exploration tools
 */
const SEARCH_TOOLS = new Set(['Grep', 'Glob', 'Read']);

/**
 * Extract quality metrics from JSONL session content
 * Performs single-pass parsing for efficiency
 */
export function extractQualityMetrics(content: string): SessionQualityMetrics {
  const metrics: SessionQualityMetrics = {
    userMessageCount: 0,
    assistantMessageCount: 0,
    totalUserTextLength: 0,
    questionCount: 0,
    iterationCount: 0,
    uniqueToolsUsed: new Set(),
    editWriteCount: 0,
    searchToolCount: 0,
    errorCount: 0,
    errorRecoveryCount: 0,
  };

  const lines = content.split('\n');
  let lastWasError = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    try {
      const parsed = JSON.parse(trimmed);

      if (parsed.type === 'user') {
        metrics.userMessageCount++;
        const text = extractTextFromMessage(parsed.message);
        metrics.totalUserTextLength += text.length;

        // Count questions
        for (const pattern of QUESTION_PATTERNS) {
          const matches = text.match(pattern);
          if (matches) metrics.questionCount += matches.length;
        }

        // Count iteration patterns
        for (const pattern of ITERATION_PATTERNS) {
          const matches = text.match(pattern);
          if (matches) metrics.iterationCount += matches.length;
        }
      }

      if (parsed.type === 'assistant') {
        metrics.assistantMessageCount++;

        // Extract tool usage from assistant messages
        const tools = extractToolsFromMessage(parsed.message);
        for (const tool of tools) {
          metrics.uniqueToolsUsed.add(tool);

          if (EDIT_WRITE_TOOLS.has(tool)) {
            metrics.editWriteCount++;
            // If there was an error before this edit, count as recovery
            if (lastWasError) {
              metrics.errorRecoveryCount++;
              lastWasError = false;
            }
          }

          if (SEARCH_TOOLS.has(tool)) {
            metrics.searchToolCount++;
          }
        }

        // Check for errors in tool results
        if (hasToolErrors(parsed.message)) {
          metrics.errorCount++;
          lastWasError = true;
        }
      }
    } catch {
      // Skip unparseable lines
    }
  }

  return metrics;
}

/**
 * Extract text content from a message (handles various content block formats)
 */
function extractTextFromMessage(message: unknown): string {
  if (!message) return '';

  if (typeof message === 'string') return message;

  if (Array.isArray(message)) {
    return message
      .map(block => {
        if (typeof block === 'string') return block;
        if (block && typeof block === 'object' && 'text' in block) {
          return String(block.text);
        }
        return '';
      })
      .join(' ');
  }

  if (typeof message === 'object' && 'content' in message) {
    return extractTextFromMessage((message as { content: unknown }).content);
  }

  return '';
}

/**
 * Extract tool names from an assistant message
 */
function extractToolsFromMessage(message: unknown): string[] {
  const tools: string[] = [];

  if (!message || !Array.isArray(message)) return tools;

  for (const block of message) {
    if (
      block &&
      typeof block === 'object' &&
      'type' in block &&
      block.type === 'tool_use' &&
      'name' in block
    ) {
      tools.push(String(block.name));
    }
  }

  return tools;
}

/**
 * Check if a message contains tool errors
 */
function hasToolErrors(message: unknown): boolean {
  if (!message || !Array.isArray(message)) return false;

  for (const block of message) {
    if (
      block &&
      typeof block === 'object' &&
      'type' in block &&
      block.type === 'tool_result' &&
      'is_error' in block &&
      block.is_error === true
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Calculate quality score from metrics (0-100)
 */
export function calculateQualityScore(metrics: SessionQualityMetrics): number {
  const totalMessages = metrics.userMessageCount + metrics.assistantMessageCount;
  if (totalMessages < 2) return 0;

  let score = 0;

  // 1. Turn Balance (15%) - ideal ratio is 0.3-0.7 user messages
  const turnRatio = metrics.userMessageCount / totalMessages;
  const turnBalanceScore = turnRatio >= 0.3 && turnRatio <= 0.7 ? 100 : Math.max(0, 100 - Math.abs(turnRatio - 0.5) * 200);
  score += turnBalanceScore * WEIGHTS.turnBalance;

  // 2. Prompt Length (10%) - longer prompts indicate more context
  const avgPromptLength =
    metrics.userMessageCount > 0 ? metrics.totalUserTextLength / metrics.userMessageCount : 0;
  const promptLengthScore = Math.min(100, (avgPromptLength / 200) * 100);
  score += promptLengthScore * WEIGHTS.promptLength;

  // 3. Question Density (10%) - questions indicate engagement
  const questionsPerMessage = metrics.userMessageCount > 0 ? metrics.questionCount / metrics.userMessageCount : 0;
  const questionScore = Math.min(100, questionsPerMessage * 50);
  score += questionScore * WEIGHTS.questionDensity;

  // 4. Iteration Patterns (15%) - refinements indicate collaborative work
  const iterationsPerMessage =
    metrics.userMessageCount > 0 ? metrics.iterationCount / metrics.userMessageCount : 0;
  const iterationScore = Math.min(100, iterationsPerMessage * 40);
  score += iterationScore * WEIGHTS.iterationPatterns;

  // 5. Conversation Depth (10%) - more turns = more complex
  const depthScore = Math.min(100, (totalMessages / 30) * 100);
  score += depthScore * WEIGHTS.conversationDepth;

  // 6. Tool Diversity (10%) - using different tools indicates exploration
  const toolDiversityScore = Math.min(100, (metrics.uniqueToolsUsed.size / 8) * 100);
  score += toolDiversityScore * WEIGHTS.toolDiversity;

  // 7. Edit/Write Ratio (10%) - code modifications indicate active work
  const editRatio = totalMessages > 0 ? metrics.editWriteCount / totalMessages : 0;
  const editWriteScore = Math.min(100, editRatio * 200);
  score += editWriteScore * WEIGHTS.editWriteRatio;

  // 8. Error Recovery (10%) - recovering from errors shows problem-solving
  const recoveryRate = metrics.errorCount > 0 ? metrics.errorRecoveryCount / metrics.errorCount : 1;
  const errorRecoveryScore = recoveryRate * 100;
  score += errorRecoveryScore * WEIGHTS.errorRecovery;

  // 9. Search Exploration (5%) - searching indicates understanding-seeking
  const searchRatio = totalMessages > 0 ? metrics.searchToolCount / totalMessages : 0;
  const searchScore = Math.min(100, searchRatio * 150);
  score += searchScore * WEIGHTS.searchExploration;

  // 10. Context Utilization (5%) - approximated by message density
  const contextScore = Math.min(100, (metrics.totalUserTextLength / 5000) * 100);
  score += contextScore * WEIGHTS.contextUtilization;

  // Apply penalties
  if (metrics.editWriteCount === 0) {
    score *= 1 - PENALTIES.readOnlySession;
  }

  if (metrics.uniqueToolsUsed.size <= 1) {
    score *= 1 - PENALTIES.singleToolSession;
  }

  if (totalMessages < 10) {
    score *= 1 - PENALTIES.veryShortSession;
  }

  if (metrics.errorCount > 0 && metrics.errorRecoveryCount === 0) {
    score *= 1 - PENALTIES.highErrorRate;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}
