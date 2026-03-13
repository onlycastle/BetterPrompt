/**
 * BetterPrompt - Claude Code Plugin
 *
 * Analyze your Claude Code sessions to improve AI collaboration skills.
 * Uses Verbose Mode as the default analysis approach.
 *
 * @module betterprompt
 */

// ============================================================================
// Models
// ============================================================================
export * from './lib/models/index';

// ============================================================================
// Parser
// ============================================================================
export { SessionParser, sessionParser } from './lib/parser/index';
export {
  readJSONLFile,
  findSessionFile,
  listAllSessions,
  getSessionMetadata,
  decodeProjectPath,
  encodeProjectPath,
  getProjectName,
  CLAUDE_PROJECTS_DIR,
} from './lib/parser/jsonl-reader';

// ============================================================================
// Analyzer (Verbose Mode - Default)
// ============================================================================
export {
  VerboseAnalyzer,
  VerboseAnalysisError,
  createVerboseAnalyzer,
  type VerboseAnalyzerConfig,
} from './lib/analyzer/index';

// ============================================================================
// Utils
// ============================================================================
export {
  generateSessionsTable,
  generateHistoryList,
} from './lib/utils/reporter';

export {
  StorageManager,
  storageManager,
  DEFAULT_STORAGE_PATH,
} from './lib/utils/storage';

export { computeFileHash } from './lib/utils/hash';

// ============================================================================
// Config
// ============================================================================
export {
  ConfigManager,
  configManager,
  DEFAULT_CONFIG_PATH,
} from './lib/config/manager';

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
  type TopicCategory as SearchTopicCategory,
  type ContentType,
  type SearchQuery,
  type RelevanceAssessment,
  type JudgmentResult,
} from './lib/search-agent/index';

// ============================================================================
// Helper Functions
// ============================================================================

import { sessionParser } from './lib/parser/index';

/**
 * List available Claude Code sessions
 *
 * @returns Markdown table of sessions
 */
export async function listSessions(): Promise<string> {
  const { generateSessionsTable } = await import('./lib/utils/reporter.js');
  const sessions = await sessionParser.listSessions();
  return generateSessionsTable(sessions);
}

/**
 * List past analysis history
 *
 * @returns Markdown table of past analyses
 */
export async function listHistory(): Promise<string> {
  const { generateHistoryList } = await import('./lib/utils/reporter.js');
  const { storageManager } = await import('./lib/utils/storage.js');
  const analyses = await storageManager.listAnalyses();
  return generateHistoryList(analyses);
}
