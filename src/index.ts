/**
 * NoMoreAISlop - Claude Code Plugin
 *
 * Analyze your Claude Code sessions to improve AI collaboration skills.
 *
 * @module nomoreaislop
 */

// ============================================================================
// Models
// ============================================================================
export * from './models/index.js';

// ============================================================================
// Parser
// ============================================================================
export { SessionParser, sessionParser } from './parser/index.js';
export {
  readJSONLFile,
  findSessionFile,
  listAllSessions,
  getSessionMetadata,
  decodeProjectPath,
  encodeProjectPath,
  getProjectName,
  CLAUDE_PROJECTS_DIR,
} from './parser/jsonl-reader.js';

// ============================================================================
// Analyzer
// ============================================================================
export {
  LLMAnalyzer,
  AnalysisError,
  createAnalyzer,
  formatConversation,
  buildUserPrompt,
  estimateTokens,
  getEvaluationJsonSchema,
  getEvaluationTool,
} from './analyzer/index.js';
export type { AnalyzerConfig } from './analyzer/index.js';

// ============================================================================
// Utils
// ============================================================================
export {
  generateSessionsTable,
  generateHistoryList,
} from './utils/reporter.js';

export {
  StorageManager,
  storageManager,
  DEFAULT_STORAGE_PATH,
} from './utils/storage.js';

// ============================================================================
// CLI
// ============================================================================
export {
  createSpinner,
  ProgressSpinner,
  renderReport,
  renderCompactSummary,
  renderJson,
  renderError,
  type RenderOptions,
} from './cli/index.js';

// ============================================================================
// Config
// ============================================================================
export {
  ConfigManager,
  configManager,
  DEFAULT_CONFIG_PATH,
} from './config/manager.js';

// ============================================================================
// Search Agent
// ============================================================================
export {
  // Skills
  BaseSkill,
  SkillError,
  GathererSkill,
  JudgeSkill,
  OrganizerSkill,
  createGatherer,
  createJudge,
  createOrganizer,
  createSearchQuery,
  // Storage
  KnowledgeStore,
  knowledgeStore,
  KNOWLEDGE_BASE_PATH,
  // Orchestration
  learn,
  searchKnowledge,
  getKnowledgeStats,
  getTopKnowledge,
  // Models
  TopicCategorySchema,
  ContentTypeSchema,
  KnowledgeItemSchema,
  SearchQuerySchema,
  RelevanceAssessmentSchema,
  JudgmentResultSchema,
  // Constants
  RELEVANCE_CRITERIA,
  KNOWLEDGE_TAXONOMY,
  TOPIC_DISPLAY_NAMES,
  DEFAULT_SEARCH_TOPICS,
  RELEVANCE_THRESHOLDS,
  // Types
  type SkillResult,
  type SkillConfig,
  type GathererInput,
  type GathererOutput,
  type JudgeInput,
  type JudgeOutput,
  type OrganizerInput,
  type OrganizerOutput,
  type WebSearchItem,
  type RawContent,
  type LearnConfig,
  type LearnResult,
  type KnowledgeItem,
  type KnowledgeStats,
  type TopicCategory,
  type ContentType,
  type SearchQuery,
  type RelevanceAssessment,
  type JudgmentResult,
} from './search-agent/index.js';

// ============================================================================
// Main Function
// ============================================================================

import { sessionParser } from './parser/index.js';
import { createAnalyzer } from './analyzer/index.js';
import { storageManager } from './utils/storage.js';
import { configManager } from './config/manager.js';
import type { Evaluation, ParsedSession } from './models/index.js';

/**
 * Analyze result with evaluation, session, and save path
 */
export interface AnalyzeResult {
  evaluation: Evaluation;
  session: ParsedSession;
  savePath: string;
}

/**
 * Analyze a Claude Code session
 *
 * @param sessionId - The session ID to analyze (optional, defaults to current/most recent)
 * @returns The analysis result with evaluation, session, and save path
 */
export async function analyzeSession(sessionId?: string): Promise<AnalyzeResult> {
  // Get session ID
  const targetId = sessionId || (await sessionParser.getCurrentSessionId());
  if (!targetId) {
    throw new Error('No session found. Please specify a session ID.');
  }

  // Parse session
  const session = await sessionParser.parseSession(targetId);

  // Get API key from config
  const apiKey = await configManager.getApiKey();
  const model = await configManager.getModel();

  // Create analyzer and run analysis
  const analyzer = createAnalyzer({ apiKey: apiKey || undefined, model });
  const evaluation = await analyzer.analyze(session);

  // Save analysis
  const savePath = await storageManager.saveAnalysis(evaluation, session);

  return { evaluation, session, savePath };
}

/**
 * List available Claude Code sessions
 *
 * @returns Markdown table of sessions
 */
export async function listSessions(): Promise<string> {
  const { generateSessionsTable } = await import('./utils/reporter.js');
  const sessions = await sessionParser.listSessions();
  return generateSessionsTable(sessions);
}

/**
 * List past analysis history
 *
 * @returns Markdown table of past analyses
 */
export async function listHistory(): Promise<string> {
  const { generateHistoryList } = await import('./utils/reporter.js');
  const analyses = await storageManager.listAnalyses();
  return generateHistoryList(analyses);
}
