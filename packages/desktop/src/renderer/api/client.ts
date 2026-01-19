/**
 * API Client for Desktop App
 * Uses production API URL
 */

import type {
  KnowledgeListResponse,
  KnowledgeItem,
  KnowledgeStats,
  QualityMetrics,
  LearnYouTubeResponse,
  LearnUrlResponse,
  SourcePlatform,
  TopicCategory,
  KnowledgeStatus,
  ComparisonResult,
  FeatureComparisonResponse,
  PersonalAnalytics,
} from './types';

// Use environment variable or fallback to production URL
const API_BASE = import.meta.env.VITE_APP_URL || 'https://www.nomoreaislop.xyz';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: response.statusText }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// Knowledge API
export interface KnowledgeListParams {
  platform?: SourcePlatform;
  category?: TopicCategory;
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
      searchParams.set(key, String(value));
    }
  });

  const queryString = searchParams.toString();
  const url = `${API_BASE}/api/knowledge${queryString ? `?${queryString}` : ''}`;

  return fetchJson<KnowledgeListResponse>(url);
}

export async function getKnowledge(id: string): Promise<{ item: KnowledgeItem }> {
  return fetchJson<{ item: KnowledgeItem }>(`${API_BASE}/api/knowledge/${id}`);
}

export async function deleteKnowledge(id: string): Promise<{ success: boolean }> {
  return fetchJson<{ success: boolean }>(`${API_BASE}/api/knowledge/${id}`, {
    method: 'DELETE',
  });
}

export async function getKnowledgeStats(): Promise<KnowledgeStats> {
  return fetchJson<KnowledgeStats>(`${API_BASE}/api/knowledge/stats`);
}

export async function getQualityMetrics(): Promise<QualityMetrics> {
  return fetchJson<QualityMetrics>(`${API_BASE}/api/knowledge/metrics`);
}

// Learn API
export interface LearnYouTubeParams {
  url: string;
  processPlaylist?: boolean;
  maxVideos?: number;
}

export async function learnFromYouTube(params: LearnYouTubeParams): Promise<LearnYouTubeResponse> {
  return fetchJson<LearnYouTubeResponse>(`${API_BASE}/api/learn/youtube`, {
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
  return fetchJson<LearnUrlResponse>(`${API_BASE}/api/learn/url`, {
    method: 'POST',
    body: JSON.stringify(params),
  });
}

// Reports API
export async function getComparison(reportId: string): Promise<ComparisonResult> {
  return fetchJson<ComparisonResult>(`${API_BASE}/api/reports/comparison/${reportId}`);
}

export async function getFeatureComparison(): Promise<FeatureComparisonResponse> {
  return fetchJson<FeatureComparisonResponse>(`${API_BASE}/api/reports/comparison/features`);
}

// Personal Analytics API
export async function getPersonalAnalytics(userId: string): Promise<PersonalAnalytics> {
  return fetchJson<PersonalAnalytics>(`${API_BASE}/api/enterprise/personal/tracking?userId=${userId}`);
}
