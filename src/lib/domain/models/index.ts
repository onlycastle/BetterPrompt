/**
 * Domain Models - Central Export
 *
 * This is the SINGLE SOURCE OF TRUTH for all data models in the application.
 * All Zod schemas and TypeScript types should be imported from here.
 *
 * @module domain/models
 */

// ============================================================================
// Analysis Models (Session, Evaluation, Coding Style)
// ============================================================================

export {
  // JSONL Input Types
  TextBlockSchema,
  ToolUseBlockSchema,
  ToolResultBlockSchema,
  ContentBlockSchema,
  TokenUsageSchema,
  UserMessageSchema,
  AssistantMessageSchema,
  QueueOperationSchema,
  FileHistorySnapshotSchema,
  JSONLLineSchema,
  type TextBlock,
  type ToolUseBlock,
  type ToolResultBlock,
  type ContentBlock,
  type TokenUsage,
  type UserMessage,
  type AssistantMessage,
  type QueueOperation,
  type FileHistorySnapshot,
  type JSONLLine,
  // Parsed types
  type ToolCall,
  type ParsedMessage,
  type SessionStats,
  type ParsedSession,
  type SessionMetadata,
  // Type guards
  isConversationMessage,
  isTextBlock,
  isToolUseBlock,
  isToolResultBlock,
  // Evaluation
  RatingSchema,
  ClueSchema,
  CategoryEvaluationSchema,
  EvaluationSchema,
  LLMResponseSchema,
  type Rating,
  type Clue,
  type CategoryEvaluation,
  type Evaluation,
  type LLMResponse,
  // Coding Style
  CodingStyleTypeSchema,
  AIControlLevelSchema,
  TypeResultSchema,
  DimensionLevelSchema,
  DimensionResultSchema,
  DimensionsSchema,
  StoredAnalysisSchema,
  type CodingStyleType,
  type AIControlLevel,
  type SessionMetrics,
  type TypeScores,
  type TypeDistribution,
  type ConversationEvidence,
  type TypeResult,
  type CodingStyleMatrix,
  type DimensionLevel,
  type DimensionResult,
  type Dimensions,
  type StoredAnalysis,
  type AnalysisSummary,
  // Constants
  PATTERN_KEYWORDS,
  TYPE_METADATA,
  MATRIX_NAMES,
  MATRIX_METADATA,
  CONTROL_LEVEL_METADATA,
  getMatrixResult,
} from './analysis';

// ============================================================================
// Knowledge Models
// ============================================================================

export {
  // Dimension Names (unified classification system)
  DimensionNameSchema as KnowledgeDimensionNameSchema,
  type DimensionName as KnowledgeDimensionName,
  // Classification (legacy - kept for migration)
  TopicCategorySchema,
  ContentTypeSchema,
  SourcePlatformSchema,
  KnowledgeStatusSchema,
  CredibilityTierSchema,
  type TopicCategory,
  type ContentType,
  type SourcePlatform,
  type KnowledgeStatus,
  type CredibilityTier,
  // Knowledge Item
  KnowledgeSourceSchema,
  KnowledgeRelevanceSchema,
  KnowledgeItemSchema,
  KnowledgeCollectionSchema,
  type KnowledgeSource,
  type KnowledgeRelevance,
  type KnowledgeItem,
  type KnowledgeCollection,
  type KnowledgeStats,
  type KnowledgeFilters,
  // Professional Insights
  InsightCategorySchema,
  InsightSourceTypeSchema,
  ProfessionalInsightSchema,
  type InsightCategory,
  type InsightSourceType,
  type ProfessionalInsight,
  // Constants
  DIMENSION_DISPLAY_NAMES as KNOWLEDGE_DIMENSION_DISPLAY_NAMES,
  ALL_DIMENSIONS,
  TOPIC_TO_DIMENSION_MAP,
  DEFAULT_SEARCH_TOPICS,
  TOPIC_DISPLAY_NAMES,
  RELEVANCE_THRESHOLDS,
  INITIAL_INSIGHTS,
} from './knowledge';

// ============================================================================
// Influencer Models
// ============================================================================

export {
  // Platform types
  InfluencerPlatformSchema,
  PlatformIdentifierSchema,
  type InfluencerPlatform,
  type PlatformIdentifier,
  // Influencer schemas
  InfluencerSchema,
  InfluencerRegistrySchema,
  InfluencerMatchSchema,
  CandidateInfluencerSchema,
  type Influencer,
  type InfluencerRegistry,
  type InfluencerMatch,
  type CandidateInfluencer,
  // Helpers
  normalizeHandle,
  extractHandleFromUrl,
  detectPlatformFromUrl,
  // Constants
  DEFAULT_INFLUENCERS,
} from './influencer';

// ============================================================================
// User Models
// ============================================================================

export {
  // Tiers
  UserTierSchema,
  type UserTier,
  TIER_LIMITS,
  // User
  UserSchema,
  CreateUserInputSchema,
  type User,
  type CreateUserInput,
  // Teams & Organizations
  TeamRoleSchema,
  TeamSchema,
  TeamMemberSchema,
  OrganizationSchema,
  type TeamRole,
  type Team,
  type TeamMember,
  type Organization,
  // Licenses
  LicenseTypeSchema,
  LicenseSchema,
  LicenseActivationSchema,
  type LicenseType,
  type License,
  type LicenseActivation,
  // Usage tracking
  UsageRecordSchema,
  TrackingMetricsSchema,
  type UsageRecord,
  type TrackingMetrics,
  // Helpers
  canUserPerformAction,
  getRemainingAnalyses,
  getEffectiveTier,
  getEffectiveTierLimits,
} from './user';

// ============================================================================
// Job Models
// ============================================================================

export {
  // Types & Status
  JobTypeSchema,
  JobStatusSchema,
  JobPrioritySchema,
  type JobType,
  type JobStatus,
  type JobPriority,
  // Payloads
  YouTubeTranscriptPayloadSchema,
  KnowledgeLearnPayloadSchema,
  BulkAnalysisPayloadSchema,
  InfluencerDiscoverPayloadSchema,
  KnowledgeSyncPayloadSchema,
  ReportGeneratePayloadSchema,
  JobPayloadSchema,
  type YouTubeTranscriptPayload,
  type KnowledgeLearnPayload,
  type BulkAnalysisPayload,
  type InfluencerDiscoverPayload,
  type KnowledgeSyncPayload,
  type ReportGeneratePayload,
  type JobPayload,
  // Job
  JobResultSchema,
  JobSchema,
  CreateJobInputSchema,
  JobStatusResponseSchema,
  type JobResult,
  type Job,
  type CreateJobInput,
  type JobStatusResponse,
  // Helpers
  isJobTerminal,
  canRetryJob,
  getJobProgressPercentage,
  getEstimatedTimeRemaining,
} from './job';

// ============================================================================
// Sharing Models
// ============================================================================

export {
  // Access
  ShareAccessLevelSchema,
  ShareTokenSchema,
  type ShareAccessLevel,
  type ShareToken,
  // Shared Report
  SharedReportSchema,
  CreateSharedReportInputSchema,
  PublicReportViewSchema,
  type SharedReport,
  type CreateSharedReportInput,
  type PublicReportView,
  // Social
  SocialPlatformSchema,
  ShareLinkSchema,
  ShareEventSchema,
  type SocialPlatform,
  type ShareLink,
  type ShareEvent,
  // Aggregate Stats
  AggregateStatsSchema,
  type AggregateStats,
  // OG & Embed
  OGMetadataSchema,
  EmbedCodeSchema,
  type OGMetadata,
  type EmbedCode,
  // Helpers
  generateReportId,
  buildShareUrl,
  generateTwitterShareLink,
  generateLinkedInShareLink,
  generateOGMetadata,
  generateEmbedCode,
} from './sharing';

// ============================================================================
// Config Models
// ============================================================================

export {
  // Core config
  ConfigSchema,
  DEFAULT_CONFIG,
  ENV_MAPPINGS,
  RuntimeEnvironmentSchema,
  type Config,
  type RuntimeEnvironment,
  // Telemetry
  TelemetryEventTypeSchema,
  TelemetryEventSchema,
  type TelemetryEventType,
  type TelemetryEvent,
  type AnalysisCompletedProperties,
  type AnalysisFailedProperties,
  // Feature flags
  FeatureFlagsSchema,
  DEFAULT_FEATURE_FLAGS,
  type FeatureFlags,
  // Helpers
  resolveConfig,
  getEnvValue,
  parseEnvBoolean,
} from './config';

// ============================================================================
// Agent Configuration
// ============================================================================

export {
  AgentTierSchema,
  AgentIdSchema,
  type AgentTier,
  type AgentId,
  type AgentConfig,
  AGENT_CONFIGS,
  FREE_AGENT_IDS,
  PREMIUM_AGENT_IDS,
  isAgentFree,
  getAgentConfig,
  getAgentsByTier,
} from './agent-config';
