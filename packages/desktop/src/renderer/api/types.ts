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

/** 6 dimension scores (0-100) */
export interface DimensionScores {
  aiCollaboration: number;
  contextEngineering: number;
  burnoutRisk: number;
  toolMastery: number;
  aiControl: number;
  skillResilience: number;
}

/** Summary of a single analysis for comparison */
export interface AnalysisSummary {
  date: string;
  score: number;
  primaryType: string;
  dimensions?: DimensionScores;
}

/** History entry for trend chart */
export interface HistoryEntry {
  date: string;
  overallScore: number;
  dimensions?: DimensionScores;
}

/** Growth area from analysis */
export interface GrowthArea {
  title: string;
  description: string;
  recommendation?: string;
  evidence?: string[];
}

/** Legacy PersonalAnalytics (for backwards compatibility) */
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

/** Extended PersonalAnalytics with full journey data */
export interface PersonalAnalyticsExtended {
  // Journey header
  currentType: string;
  firstAnalysisDate: string;
  analysisCount: number;
  totalImprovement: number;

  // Dimension tracking
  currentDimensions?: DimensionScores;
  dimensionImprovements?: DimensionScores;

  // Comparison data
  firstAnalysis: AnalysisSummary;
  latestAnalysis: AnalysisSummary;

  // Trend data
  history: HistoryEntry[];

  // Growth areas from latest analysis
  growthAreas: GrowthArea[];

  // Legacy compatibility
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
