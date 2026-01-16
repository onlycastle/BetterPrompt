/**
 * React Query hooks for Knowledge API
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  listKnowledge,
  getKnowledge,
  deleteKnowledge,
  getKnowledgeStats,
  getQualityMetrics,
  type KnowledgeListParams,
} from '../api/client';

export const knowledgeKeys = {
  all: ['knowledge'] as const,
  lists: () => [...knowledgeKeys.all, 'list'] as const,
  list: (params: KnowledgeListParams) => [...knowledgeKeys.lists(), params] as const,
  details: () => [...knowledgeKeys.all, 'detail'] as const,
  detail: (id: string) => [...knowledgeKeys.details(), id] as const,
  stats: () => [...knowledgeKeys.all, 'stats'] as const,
  metrics: () => [...knowledgeKeys.all, 'metrics'] as const,
};

export function useKnowledgeList(params: KnowledgeListParams = {}) {
  return useQuery({
    queryKey: knowledgeKeys.list(params),
    queryFn: () => listKnowledge(params),
  });
}

export function useKnowledgeDetail(id: string) {
  return useQuery({
    queryKey: knowledgeKeys.detail(id),
    queryFn: () => getKnowledge(id),
    enabled: !!id,
  });
}

export function useKnowledgeStats() {
  return useQuery({
    queryKey: knowledgeKeys.stats(),
    queryFn: getKnowledgeStats,
  });
}

export function useQualityMetrics() {
  return useQuery({
    queryKey: knowledgeKeys.metrics(),
    queryFn: getQualityMetrics,
  });
}

export function useDeleteKnowledge() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteKnowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
  });
}
