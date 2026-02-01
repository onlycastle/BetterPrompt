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

  // Novelty signals
  uniqueFilesRead: Set<string>;
  uniqueFilesModified: Set<string>;
  promptVocabularySize: number;
  totalPromptWords: number;
}

/**
 * Scoring weights (must sum to 1.0)
 *
 * Rebalanced to include novelty scoring:
 * - Dialogue quality: 40%
 * - Problem complexity: 30%
 * - Novelty: 30%
 */
const WEIGHTS = {
  // Dialogue quality (40%)
  turnBalance: 0.10,
  promptLength: 0.08,
  questionDensity: 0.08,
  iterationPatterns: 0.10,
  conversationDepth: 0.04,

  // Problem complexity (30%)
  toolDiversity: 0.08,
  editWriteRatio: 0.08,
  errorRecovery: 0.08,
  searchExploration: 0.03,
  contextUtilization: 0.03,

  // Novelty (30%)
  noveltyScore: 0.30,
} as const;

/**
 * Penalty factors
 */
const PENALTIES = {
  readOnlySession: 0.2, // No Edit/Write tools
  singleToolSession: 0.15, // Only one unique tool
  veryShortSession: 0.1, // Less than 10 messages
  highErrorRate: 0.1, // Many errors without recovery
  lowNovelty: 0.15, // Novelty score < 30
  singleFileSession: 0.10, // Only modifying one file repeatedly
} as const;

/**
 * Thresholds for novelty scoring
 */
const NOVELTY_THRESHOLDS = {
  LOW_NOVELTY_SCORE: 30,
  MIN_FILES_FOR_DIVERSITY: 2,
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
    // Novelty metrics
    uniqueFilesRead: new Set(),
    uniqueFilesModified: new Set(),
    promptVocabularySize: 0,
    totalPromptWords: 0,
  };

  // Track all words from user prompts for vocabulary diversity
  const vocabularySet = new Set<string>();

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

        // Track vocabulary for novelty scoring
        const words = extractWords(text);
        metrics.totalPromptWords += words.length;
        for (const word of words) {
          vocabularySet.add(word.toLowerCase());
        }
      }

      if (parsed.type === 'assistant') {
        metrics.assistantMessageCount++;

        // Extract tool usage from assistant messages
        const toolsWithFiles = extractToolsWithFiles(parsed.message);
        for (const { tool, filePath } of toolsWithFiles) {
          metrics.uniqueToolsUsed.add(tool);

          if (EDIT_WRITE_TOOLS.has(tool)) {
            metrics.editWriteCount++;
            // Track modified files for novelty
            if (filePath) {
              metrics.uniqueFilesModified.add(filePath);
            }
            // If there was an error before this edit, count as recovery
            if (lastWasError) {
              metrics.errorRecoveryCount++;
              lastWasError = false;
            }
          }

          if (SEARCH_TOOLS.has(tool)) {
            metrics.searchToolCount++;
            // Track read files for novelty (Read tool)
            if (tool === 'Read' && filePath) {
              metrics.uniqueFilesRead.add(filePath);
            }
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

  // Set vocabulary size after processing
  metrics.promptVocabularySize = vocabularySet.size;

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
 * Extract words from text for vocabulary analysis
 */
function extractWords(text: string): string[] {
  // Match word characters, filter out very short words and numbers
  const words = text.match(/\b[a-zA-Z]{3,}\b/g) || [];
  return words;
}

/**
 * Tool usage with optional file path
 */
interface ToolWithFile {
  tool: string;
  filePath: string | null;
}

/**
 * Get content blocks from a message (handles nested message.content structure)
 */
function getContentBlocks(message: unknown): unknown[] {
  if (!message) return [];

  // Direct array of content blocks
  if (Array.isArray(message)) return message;

  // Nested structure: message.content is the array
  if (typeof message === 'object' && 'content' in message) {
    const content = (message as { content: unknown }).content;
    if (Array.isArray(content)) return content;
  }

  return [];
}

/**
 * Extract tool names and file paths from an assistant message
 */
function extractToolsWithFiles(message: unknown): ToolWithFile[] {
  const tools: ToolWithFile[] = [];
  const blocks = getContentBlocks(message);

  for (const block of blocks) {
    if (
      block &&
      typeof block === 'object' &&
      'type' in block &&
      block.type === 'tool_use' &&
      'name' in block
    ) {
      const tool = String(block.name);
      let filePath: string | null = null;

      // Extract file path from tool input
      if ('input' in block && block.input && typeof block.input === 'object') {
        const input = block.input as Record<string, unknown>;
        // Different tools use different parameter names for file path
        if ('file_path' in input && typeof input.file_path === 'string') {
          filePath = input.file_path;
        } else if ('path' in input && typeof input.path === 'string') {
          filePath = input.path;
        }
      }

      tools.push({ tool, filePath });
    }
  }

  return tools;
}

/**
 * Check if a message contains tool errors
 */
function hasToolErrors(message: unknown): boolean {
  const blocks = getContentBlocks(message);

  for (const block of blocks) {
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
 * Calculate novelty score from metrics (0-100)
 *
 * Novelty is measured by:
 * - File diversity: working on multiple files
 * - Vocabulary diversity: using varied language in prompts
 *
 * Low novelty indicates repetitive work on the same files with similar prompts
 */
export function calculateNoveltyScore(metrics: SessionQualityMetrics): number {
  let score = 0;

  // 1. File diversity (50% of novelty score)
  // Combines both read and modified files
  const totalUniqueFiles = metrics.uniqueFilesRead.size + metrics.uniqueFilesModified.size;
  const modifiedFileCount = metrics.uniqueFilesModified.size;

  // Score based on number of unique files worked with
  // 10+ files = max score
  const fileDiversityScore = Math.min(100, (totalUniqueFiles / 10) * 100);

  // Bonus for modifying multiple files (not just reading)
  const modifyDiversityBonus = modifiedFileCount >= 3 ? 20 : modifiedFileCount * 6;

  score += (fileDiversityScore + Math.min(20, modifyDiversityBonus)) * 0.5;

  // 2. Vocabulary diversity (50% of novelty score)
  // Higher ratio of unique words to total words = more diverse prompts
  if (metrics.totalPromptWords > 0) {
    const vocabRatio = metrics.promptVocabularySize / metrics.totalPromptWords;
    // Typical ratio is 0.2-0.6, with higher being more diverse
    const vocabScore = Math.min(100, vocabRatio * 200);

    // Also consider absolute vocabulary size
    // 100+ unique words indicates substantial, varied discussion
    const vocabSizeBonus = Math.min(30, (metrics.promptVocabularySize / 100) * 30);

    score += (vocabScore + vocabSizeBonus) * 0.5;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
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

  // 11. Novelty Score (30%) - file and vocabulary diversity
  const noveltyScore = calculateNoveltyScore(metrics);
  score += noveltyScore * WEIGHTS.noveltyScore;

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

  // Novelty penalties
  if (noveltyScore < NOVELTY_THRESHOLDS.LOW_NOVELTY_SCORE) {
    score *= 1 - PENALTIES.lowNovelty;
  }

  if (metrics.uniqueFilesModified.size < NOVELTY_THRESHOLDS.MIN_FILES_FOR_DIVERSITY) {
    score *= 1 - PENALTIES.singleFileSession;
  }

  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Extract quality metrics from a parsed session (for SQLite sources like Cursor)
 * This is a simplified version that works with already-parsed data
 */
export function extractQualityMetricsFromParsed(parsed: {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string;
    toolCalls?: Array<{ name: string; isError?: boolean; input?: Record<string, unknown> }>;
  }>;
  stats: {
    userMessageCount: number;
    assistantMessageCount: number;
    toolCallCount: number;
    uniqueToolsUsed: string[];
  };
}): SessionQualityMetrics {
  const metrics: SessionQualityMetrics = {
    userMessageCount: parsed.stats.userMessageCount,
    assistantMessageCount: parsed.stats.assistantMessageCount,
    totalUserTextLength: 0,
    questionCount: 0,
    iterationCount: 0,
    uniqueToolsUsed: new Set(parsed.stats.uniqueToolsUsed),
    editWriteCount: 0,
    searchToolCount: 0,
    errorCount: 0,
    errorRecoveryCount: 0,
    uniqueFilesRead: new Set(),
    uniqueFilesModified: new Set(),
    promptVocabularySize: 0,
    totalPromptWords: 0,
  };

  const vocabularySet = new Set<string>();

  for (const msg of parsed.messages) {
    if (msg.role === 'user') {
      metrics.totalUserTextLength += msg.content.length;

      // Count questions
      for (const pattern of QUESTION_PATTERNS) {
        const matches = msg.content.match(pattern);
        if (matches) metrics.questionCount += matches.length;
      }

      // Count iteration patterns
      for (const pattern of ITERATION_PATTERNS) {
        const matches = msg.content.match(pattern);
        if (matches) metrics.iterationCount += matches.length;
      }

      // Track vocabulary
      const words = msg.content.match(/\b[a-zA-Z]{3,}\b/g) || [];
      metrics.totalPromptWords += words.length;
      for (const word of words) {
        vocabularySet.add(word.toLowerCase());
      }
    } else if (msg.role === 'assistant' && msg.toolCalls) {
      for (const tool of msg.toolCalls) {
        if (EDIT_WRITE_TOOLS.has(tool.name)) {
          metrics.editWriteCount++;
          const filePath = tool.input?.file_path as string | undefined;
          if (filePath) metrics.uniqueFilesModified.add(filePath);
        }
        if (SEARCH_TOOLS.has(tool.name)) {
          metrics.searchToolCount++;
          if (tool.name === 'Read') {
            const filePath = tool.input?.file_path as string | undefined;
            if (filePath) metrics.uniqueFilesRead.add(filePath);
          }
        }
        if (tool.isError) {
          metrics.errorCount++;
        }
      }
    }
  }

  metrics.promptVocabularySize = vocabularySet.size;

  return metrics;
}
