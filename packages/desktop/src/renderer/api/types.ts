/**
 * API Types for Desktop App
 * Shared with web app types
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

// Report types
export interface ComparisonResult {
  reportId: string;
  free: {
    primaryType: string;
    typeDistribution: Record<string, number>;
    summary: string;
  };
  premium: {
    strengths: Array<{
      title: string;
      description: string;
      evidence: string[];
    }>;
    growthAreas: Array<{
      title: string;
      description: string;
      recommendation: string;
    }>;
    promptPatterns: Array<{
      pattern: string;
      frequency: string;
      examples: string[];
    }>;
  };
  features: string[];
}

export interface FeatureComparisonResponse {
  categories: Array<{
    name: string;
    features: Array<{
      name: string;
      free: boolean | string;
      premium: boolean | string;
    }>;
  }>;
}

// Personal analytics types
export interface PersonalAnalytics {
  history: Array<{
    date: string;
    score: number;
    promptCount: number;
  }>;
  insights: Array<{
    type: 'strength' | 'growth' | 'trend';
    title: string;
    description: string;
  }>;
  goals: Array<{
    id: string;
    title: string;
    progress: number;
    target: number;
  }>;
}
