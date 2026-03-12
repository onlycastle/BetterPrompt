/**
 * Search Agent Models
 *
 * Re-exports all Zod schemas and types for the search-agent module.
 */

// Knowledge models
export {
  // Dimension Names (unified classification)
  DimensionNameSchema,
  TOPIC_TO_DIMENSION_MAP,
  type DimensionName,
  // Legacy classification
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
  // Professional Insights
  InsightCategorySchema,
  InsightSourceTypeSchema,
  ProfessionalInsightSchema,
  // Note: INITIAL_INSIGHTS removed - now managed by the local insight repository
  type TopicCategory,
  type ContentType,
  type SourcePlatform,
  type KnowledgeSource,
  type KnowledgeRelevance,
  type KnowledgeStatus,
  type KnowledgeItem,
  type KnowledgeCollection,
  type InsightCategory,
  type InsightSourceType,
  type ProfessionalInsight,
} from './knowledge';

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
} from './search';

// Relevance models
export {
  RelevanceDimensionSchema,
  RecommendationSchema,
  RelevanceAssessmentSchema,
  InfluencerMatchInfoSchema,
  JudgmentResultSchema,
  JudgmentStatsSchema,
  DEFAULT_DIMENSION_WEIGHTS,
  RELEVANCE_THRESHOLDS,
  type RelevanceDimension,
  type Recommendation,
  type RelevanceAssessment,
  type InfluencerMatchInfo,
  type JudgmentResult,
  type JudgmentStats,
} from './relevance';

// Influencer models
export {
  CredibilityTierSchema,
  InfluencerPlatformSchema,
  PlatformIdentifierSchema,
  InfluencerSchema,
  InfluencerRegistrySchema,
  InfluencerMatchSchema,
  DEFAULT_INFLUENCERS,
  normalizeHandle,
  extractHandleFromUrl,
  type CredibilityTier,
  type InfluencerPlatform,
  type PlatformIdentifier,
  type Influencer,
  type InfluencerRegistry,
  type InfluencerMatch,
} from './influencer';

// Discovery models
export {
  EngagementMetricsSchema,
  DiscoveredAuthorSchema,
  DiscoveredContentSchema,
  CandidateInfluencerSchema,
  DiscoverySessionSchema,
  DiscoveryResultSchema,
  ENGAGEMENT_THRESHOLDS,
  DISCOVERY_TOPICS,
  meetsEngagementThreshold,
  calculateEngagementScore,
  suggestCredibilityTier,
  type EngagementMetrics,
  type DiscoveredAuthor,
  type DiscoveredContent,
  type CandidateInfluencer,
  type DiscoverySession,
  type DiscoveryResult,
  type DiscoveryTopic,
} from './discovery';

// Platform utilities
export { detectPlatformFromUrl } from './platform-utils';
