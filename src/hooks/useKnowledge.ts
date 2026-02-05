/**
 * React Query hooks for Knowledge API
 */

import { useQuery } from '@tanstack/react-query';
import {
  listKnowledge,
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

