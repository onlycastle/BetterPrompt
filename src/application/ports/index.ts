/**
 * Application Ports - Central Export
 *
 * Port interfaces define contracts between the application layer
 * and infrastructure. Implementations (adapters) are in infrastructure/.
 *
 * @module application/ports
 */

// ============================================================================
// Storage Ports
// ============================================================================

export type {
  // Common types
  PaginationOptions,
  SortOptions,
  PaginatedResult,
  QueryOptions,
  // Repository interfaces
  IAnalysisRepository,
  IKnowledgeRepository,
  IInfluencerRepository,
  IUserRepository,
  ITeamRepository,
  ITrackingRepository,
  ISharingRepository,
  // Sync manager
  ISyncManager,
} from './storage.js';

// ============================================================================
// LLM Ports
// ============================================================================

export type {
  // Configuration
  LLMConfig,
  TokenUsage,
  LLMMetadata,
  // Structured output
  ToolDefinition,
  StructuredResponse,
  // Main interface
  ILLMPort,
  // Cache
  CacheKeyGenerator,
  CacheOptions,
  ILLMCachePort,
  CachedLLMConfig,
  // Factory
  LLMPortFactory,
  // Mock (for testing)
  MockLLMResponse,
  MockLLMConfig,
} from './llm.js';

// ============================================================================
// Job Queue Ports
// ============================================================================

export type {
  // Handler types
  JobContext,
  JobHandler,
  JobHandlerRegistry,
  // Configuration
  QueueConfig,
  QueueStats,
  // Main interface
  IJobQueuePort,
  // Events
  JobQueueEvent,
  JobEventPayload,
  JobEventHandler,
  // Worker
  WorkerConfig,
  IJobWorker,
  // Factory
  JobQueueFactory,
  WorkerFactory,
} from './job-queue.js';
