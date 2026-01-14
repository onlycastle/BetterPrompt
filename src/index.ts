/**
 * NoMoreAISlop - Claude Code Plugin
 *
 * Analyze your Claude Code sessions to improve AI collaboration skills.
 * Uses Verbose Mode as the default analysis approach.
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
// Analyzer (Verbose Mode - Default)
// ============================================================================
export {
  // Verbose Analyzer (primary)
  VerboseAnalyzer,
  VerboseAnalysisError,
  createVerboseAnalyzer,
  buildVerboseUserPrompt,
  type VerboseAnalyzerConfig,
  // Unified Analyzer
  UnifiedAnalyzer,
  createUnifiedAnalyzer,
  analyzeUnified,
  createUnifiedAnalyzerWithKB,
  type UnifiedAnalyzerConfig,
  type AnalyzeOptions,
  type UnifiedAnalysisResult,
  // Knowledge Linking
  KnowledgeLinker,
  MockKnowledgeSource,
  createKnowledgeLinker,
  SupabaseKnowledgeSource,
  createSupabaseKnowledgeSource,
  type KnowledgeSource,
  type LinkedKnowledge,
  type LinkedInsight,
  type DimensionKnowledge,
  type KnowledgeContext,
  type SupabaseKnowledgeSourceConfig,
  // Dimension utilities
  DIMENSION_KEYWORDS,
  getKeywordConfig,
  getDimensionCategories,
  getModeFromScore,
  getResourceLevel,
  type InsightMode,
  type ResourceLevel,
  type TopicCategory,
  type DimensionKeywordConfig,
  type DimensionMapping,
  // Quote extraction
  extractDimensionQuotes,
  extractAllDimensionQuotes,
  toConversationInsight,
  toEvidenceQuote,
  type ExtractedQuote,
  // Insight generation
  InsightGenerator,
  createInsightGenerator,
  generateAdvice,
  generateQuoteAdvice,
  formatProfessionalInsight,
  getDimensionDescription,
  generateInterpretation,
  buildInsightPrompt,
  INSIGHT_GENERATION_SYSTEM_PROMPT,
  type InsightGeneratorConfig,
  type GeneratedInsights,
  // Schema utilities
  getEvaluationJsonSchema,
  getEvaluationTool,
} from './analyzer/index.js';

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

export { computeFileHash } from './utils/hash.js';

// ============================================================================
// CLI (Verbose Mode - Default)
// ============================================================================
export {
  // Utility components
  createSpinner,
  ProgressSpinner,
  // Verbose Report renderer (default)
  renderVerboseReport,
  // Unified Report renderer
  renderUnifiedReportCLI,
  // v2.0 Style components
  renderTypeResult,
  renderDistribution,
  renderMetricsSummary,
  renderStrengths,
  renderGrowthPoints,
  renderStyleEvidence,
  renderLockedTeaser,
  renderWebLink,
  // Utility components
  renderRecommendations,
  renderFooter,
  confirmCost,
  // Options
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
  type TopicCategory as SearchTopicCategory,
  type ContentType,
  type SearchQuery,
  type RelevanceAssessment,
  type JudgmentResult,
} from './search-agent/index.js';

// ============================================================================
// Helper Functions
// ============================================================================

import { sessionParser } from './parser/index.js';

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
  const { storageManager } = await import('./utils/storage.js');
  const analyses = await storageManager.listAnalyses();
  return generateHistoryList(analyses);
}
