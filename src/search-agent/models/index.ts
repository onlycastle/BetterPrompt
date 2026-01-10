/**
 * Search Agent Models
 *
 * Re-exports all Zod schemas and types for the search-agent module.
 */

// Knowledge models
export {
  TopicCategorySchema,
  ContentTypeSchema,
  SourcePlatformSchema,
  KnowledgeSourceSchema,
  KnowledgeRelevanceSchema,
  KnowledgeStatusSchema,
  KnowledgeItemSchema,
  KnowledgeCollectionSchema,
  DEFAULT_SEARCH_TOPICS,
  TOPIC_DISPLAY_NAMES,
  type TopicCategory,
  type ContentType,
  type SourcePlatform,
  type KnowledgeSource,
  type KnowledgeRelevance,
  type KnowledgeStatus,
  type KnowledgeItem,
  type KnowledgeCollection,
} from './knowledge.js';

// Search models
export {
  SearchQuerySchema,
  EngagementSchema,
  RawSearchResultSchema,
  ExtractedMetadataSchema,
  EnhancedSearchResultSchema,
  PlatformBreakdownSchema,
  SearchExecutionSchema,
  DEFAULT_SEARCH_TERMS,
  type SearchQuery,
  type Engagement,
  type RawSearchResult,
  type ExtractedMetadata,
  type EnhancedSearchResult,
  type PlatformBreakdown,
  type SearchExecution,
} from './search.js';

// Relevance models
export {
  RelevanceDimensionSchema,
  RecommendationSchema,
  RelevanceAssessmentSchema,
  JudgmentResultSchema,
  JudgmentStatsSchema,
  DEFAULT_DIMENSION_WEIGHTS,
  RELEVANCE_THRESHOLDS,
  type RelevanceDimension,
  type Recommendation,
  type RelevanceAssessment,
  type JudgmentResult,
  type JudgmentStats,
} from './relevance.js';
