/**
 * API Client for Knowledge Base
 */

import type {
  KnowledgeListResponse,
  KnowledgeItem,
  KnowledgeStats,
  QualityMetrics,
  LearnYouTubeResponse,
  LearnUrlResponse,
  InfluencerListResponse,
  Influencer,
  SourcePlatform,
  TopicCategory,
  KnowledgeStatus,
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Knowledge API

/**
 * Dimension names - aligned with analysis dimensions
 */
export type DimensionName =
  | 'aiCollaboration'
  | 'contextEngineering'
  | 'burnoutRisk'
  | 'aiControl'
  | 'skillResilience';

export interface KnowledgeListParams {
  platform?: SourcePlatform;
  /** @deprecated Use dimension instead */
  category?: TopicCategory;
  dimension?: DimensionName;
  dimensions?: DimensionName[];
  status?: KnowledgeStatus;
  author?: string;
  influencerId?: string;
  minScore?: number;
  query?: string;
  limit?: number;
  offset?: number;
  sortBy?: 'createdAt' | 'relevance';
  sortOrder?: 'asc' | 'desc';
}

export async function listKnowledge(params: KnowledgeListParams = {}): Promise<KnowledgeListResponse> {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) {
      // Handle dimensions array specially
      if (key === 'dimensions' && Array.isArray(value)) {
        searchParams.set(key, value.join(','));
      } else {
        searchParams.set(key, String(value));
      }
    }
  });

  const queryString = searchParams.toString();
  const url = `${API_BASE}/knowledge${queryString ? `?${queryString}` : ''}`;

  return fetchJson<KnowledgeListResponse>(url);
}

export async function getKnowledge(id: string): Promise<{ item: KnowledgeItem }> {
  return fetchJson<{ item: KnowledgeItem }>(`${API_BASE}/knowledge/${id}`);
}

export async function deleteKnowledge(id: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>(`${API_BASE}/knowledge/${id}`, {
    method: 'DELETE',
  });
}

export async function getKnowledgeStats(): Promise<KnowledgeStats> {
  return fetchJson<KnowledgeStats>(`${API_BASE}/knowledge/stats`);
}

export async function getQualityMetrics(): Promise<QualityMetrics> {
  return fetchJson<QualityMetrics>(`${API_BASE}/knowledge/metrics`);
}

// Learn API
export interface LearnYouTubeParams {
  url: string;
  processPlaylist?: boolean;
  maxVideos?: number;
}

export async function learnFromYouTube(params: LearnYouTubeParams): Promise<LearnYouTubeResponse> {
  return fetchJson<LearnYouTubeResponse>(`${API_BASE}/learn/youtube`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export interface LearnUrlParams {
  url: string;
  title?: string;
  summary?: string;
  topics?: string[];
}

export async function learnFromUrl(params: LearnUrlParams): Promise<LearnUrlResponse> {
  return fetchJson<LearnUrlResponse>(`${API_BASE}/learn/url`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Influencer API
export async function listInfluencers(): Promise<InfluencerListResponse> {
  return fetchJson<InfluencerListResponse>(`${API_BASE}/influencers`);
}

export async function getInfluencer(id: string): Promise<{ influencer: Influencer }> {
  return fetchJson<{ influencer: Influencer }>(`${API_BASE}/influencers/${id}`);
}

export interface CreateInfluencerParams {
  name: string;
  description?: string;
  credibilityTier?: 'high' | 'medium' | 'standard';
  identifiers: Array<{ platform: string; handle: string }>;
  expertiseTopics: string[];
  affiliation?: string;
}

export async function createInfluencer(params: CreateInfluencerParams): Promise<{ influencer: Influencer }> {
  return fetchJson<{ influencer: Influencer }>(`${API_BASE}/influencers`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

export async function deleteInfluencer(id: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>(`${API_BASE}/influencers/${id}`, {
    method: 'DELETE',
  });
}

