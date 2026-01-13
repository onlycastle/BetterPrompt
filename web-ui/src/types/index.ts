/**
 * Shared types for the Knowledge Base Web UI
 */

export type SourcePlatform = 'youtube' | 'twitter' | 'reddit' | 'linkedin' | 'threads' | 'web' | 'manual';

export type TopicCategory =
  | 'context-engineering'
  | 'claude-code-skills'
  | 'subagents'
  | 'memory-management'
  | 'prompt-engineering'
  | 'tool-use'
  | 'workflow-automation'
  | 'best-practices'
  | 'other';

export type KnowledgeStatus = 'draft' | 'reviewed' | 'approved' | 'archived';

export type CredibilityTier = 'high' | 'medium' | 'standard';

export interface KnowledgeSource {
  platform: SourcePlatform;
  url: string;
  author?: string;
  authorHandle?: string;
  publishedAt?: string;
  fetchedAt: string;
  influencerId?: string;
  credibilityTier?: CredibilityTier;
}

export interface KnowledgeRelevance {
  score: number;
  confidence: number;
  reasoning: string;
}

export interface KnowledgeItem {
  id: string;
  version: '1.0.0';
  title: string;
  summary: string;
  content: string;
  category: TopicCategory;
  contentType: string;
  tags: string[];
  source: KnowledgeSource;
  relevance: KnowledgeRelevance;
  createdAt: string;
  updatedAt: string;
  status: KnowledgeStatus;
  relatedItems?: string[];
}

export interface KnowledgeStats {
  totalItems: number;
  byCategory: Partial<Record<TopicCategory, number>>;
  byStatus: Record<string, number>;
  byPlatform: Partial<Record<SourcePlatform, number>>;
}

export interface QualityMetrics {
  totalItems: number;
  averageRelevanceScore: number;
  highQualityCount: number;
  influencerContentCount: number;
  platformDistribution: Partial<Record<SourcePlatform, number>>;
  categoryDistribution: Partial<Record<TopicCategory, number>>;
  recentItemsCount: number;
}

export interface PlatformIdentifier {
  platform: 'twitter' | 'youtube' | 'linkedin' | 'github' | 'reddit' | 'web';
  handle: string;
  profileUrl?: string;
}

export interface Influencer {
  id: string;
  name: string;
  description: string;
  credibilityTier: CredibilityTier;
  identifiers: PlatformIdentifier[];
  expertiseTopics: string[];
  affiliation?: string;
  addedAt: string;
  updatedAt?: string;
  isActive: boolean;
  contentCount: number;
  lastContentAt?: string;
}

export interface InfluencerStats {
  total: number;
  active: number;
  byTier: Record<CredibilityTier, number>;
  totalContent: number;
}

// API Response types
export interface KnowledgeListResponse {
  items: KnowledgeItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface LearnYouTubeResponse {
  success: boolean;
  results?: KnowledgeItem[];
  savedCount?: number;
  errors?: Array<{ url: string; error: string }>;
  error?: string;
}

export interface LearnUrlResponse {
  success: boolean;
  item?: KnowledgeItem;
  error?: string;
}

export interface InfluencerListResponse {
  influencers: Influencer[];
  stats: InfluencerStats;
}

// Re-export enterprise and personal types (base types)
export * from './enterprise.js';
export * from './personal.js';

// Re-export report types (avoid conflicts by only exporting specific types)
export type {
  TypeDistribution,
  TypeMetrics,
  ConversationEvidence,
  TypeResult,
  TypeMetadata,
  DimensionLevel,
  DimensionEvidence,
  AICollaborationResult,
  ContextEngineeringResult,
  BurnoutRiskResult,
  ToolMasteryResult,
  MasteryLevel,
  AIControlResult,
  SkillResilienceResult,
  SkillResilienceLevel,
  FullAnalysisResult,
  ReportDimensionMetadata,
  SessionMetadata,
  ReportStats,
  ReportData,
  ShareReportRequest,
  ShareReportResponse,
  DeleteReportRequest,
} from './report.js';

// Export report metadata constants with distinct names
export { REPORT_TYPE_METADATA, REPORT_DIMENSION_METADATA } from './report.js';
