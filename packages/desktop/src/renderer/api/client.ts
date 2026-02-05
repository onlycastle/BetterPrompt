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
const API_BASE = import.meta.env.VITE_APP_URL || 'https://www.nomoreaislop.app';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  console.log('[API Client] Fetching:', url);

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    credentials: 'include',
  });

  const contentType = response.headers.get('content-type') || '';
  console.log('[API Client] Response:', {
    url,
    status: response.status,
    contentType,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => response.statusText);
    console.error('[API Client] Error response:', {
      url,
      status: response.status,
      body: errorText.slice(0, 300),
    });
    try {
      const error = JSON.parse(errorText);
      throw new Error(error.message || `HTTP ${response.status}`);
    } catch {
      throw new Error(`HTTP ${response.status}: ${errorText.slice(0, 100)}`);
    }
  }

  // Validate Content-Type before parsing JSON
  if (!contentType.includes('application/json')) {
    const rawText = await response.text();
    console.error('[API Client] Unexpected Content-Type:', {
      url,
      contentType,
      body: rawText.slice(0, 300),
    });
    throw new Error(
      `Unexpected response format from ${url}. Expected JSON, got ${contentType}. Body: ${rawText.slice(0, 100)}`
    );
  }

  const text = await response.text();
  console.log('[API Client] Response body preview:', text.slice(0, 200));

  try {
    return JSON.parse(text) as T;
  } catch (parseError) {
    console.error('[API Client] JSON parse error:', {
      url,
      error: parseError,
      body: text.slice(0, 500),
    });
    throw new Error(`JSON parse error from ${url}: ${text.slice(0, 100)}`);
  }
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

// Credits API
export interface CreditInfo {
  userId: string;
  credits: number;
  totalUsed: number;
  hasPaid: boolean;
  firstPaidAt: string | null;
}

export interface UseCreditResult {
  success: boolean;
  alreadyUnlocked?: boolean;
  reason?: 'insufficient_credits';
  creditsRemaining: number;
}

export async function getCredits(accessToken?: string): Promise<CreditInfo> {
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return fetchJson<CreditInfo>(`${API_BASE}/api/credits`, { headers });
}

export async function useCredit(resultId: string, accessToken?: string): Promise<UseCreditResult> {
  const headers: HeadersInit = {};
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }
  return fetchJson<UseCreditResult>(`${API_BASE}/api/credits/use`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ resultId }),
  });
}
