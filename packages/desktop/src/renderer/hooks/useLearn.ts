/**
 * React Query hooks for Learn API
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  learnFromYouTube,
  learnFromUrl,
  type LearnYouTubeParams,
  type LearnUrlParams,
} from '../api/client';
import { knowledgeKeys } from './useKnowledge';

export function useLearnFromYouTube() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: LearnYouTubeParams) => learnFromYouTube(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
  });
}

export function useLearnFromUrl() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (params: LearnUrlParams) => learnFromUrl(params),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: knowledgeKeys.all });
    },
  });
}
