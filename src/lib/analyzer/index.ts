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
  type TopicCategory,
  type DimensionKeywordConfig,
  type DimensionMapping,
  DIMENSION_KEYWORDS,
  getKeywordConfig,
  getDimensionCategories,
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

// Re-export dimension quote extraction utilities
export {
  type ExtractedQuote,
  extractDimensionQuotes,
  extractAllDimensionQuotes,
  toConversationInsight,
  toEvidenceQuote,
} from './dimension-quote-extractor';

// Re-export insight generation utilities
export {
  generateAdvice,
  generateQuoteAdvice,
  formatProfessionalInsight,
  getDimensionDescription,
  generateInterpretation,
  buildInsightPrompt,
  INSIGHT_GENERATION_SYSTEM_PROMPT,
} from './insight-prompts';

// Re-export insight generator
export {
  type InsightGeneratorConfig,
  type GeneratedInsights,
  InsightGenerator,
  createInsightGenerator,
} from './insight-generator';

// Re-export unified analyzer (primary analyzer)
export {
  type UnifiedAnalyzerConfig,
  type AnalyzeOptions,
  type UnifiedAnalysisResult,
  UnifiedAnalyzer,
  createUnifiedAnalyzer,
  analyzeUnified,
  // KB integration factory
  createUnifiedAnalyzerWithKB,
} from './unified-analyzer';

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
