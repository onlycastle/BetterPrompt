/**
 * NoMoreAISlop - Analyzer Module
 *
 * This module exports the analyzers and utilities for evaluating
 * developer-AI collaboration sessions.
 *
 * The primary analyzer is VerboseAnalyzer for hyper-personalized multi-session analysis.
 */

// Re-export schema converter utilities
export { getEvaluationJsonSchema, getEvaluationTool } from './schema-converter';

// Re-export knowledge linking utilities
export {
  type InsightMode,
  type ResourceLevel,
  type DimensionKeywordConfig,
  type DimensionMapping,
  DIMENSION_KEYWORDS,
  getKeywordConfig,
  getModeFromScore,
  getResourceLevel,
} from './dimension-keywords';

export {
  type LinkedKnowledge,
  type LinkedInsight,
  type DimensionKnowledge,
  type KnowledgeContext,
  type KnowledgeSource,
  KnowledgeLinker,
  MockKnowledgeSource,
  createKnowledgeLinker,
  // Supabase KB integration
  SupabaseKnowledgeSource,
  createSupabaseKnowledgeSource,
  type SupabaseKnowledgeSourceConfig,
} from './knowledge-linker';

// Re-export verbose analyzer
export {
  type VerboseAnalyzerConfig,
  VerboseAnalyzer,
  VerboseAnalysisError,
  createVerboseAnalyzer,
  buildVerboseUserPrompt,
} from './verbose-analyzer';

// Re-export content gateway
export {
  type Tier,
  type PremiumPreview,
  ContentGateway,
  createContentGateway,
} from './content-gateway';
