/**
 * Supabase Storage Adapters
 *
 * Repository implementations using Supabase.
 *
 * @module infrastructure/storage/supabase
 */

// Client
export {
  getSupabaseClient,
  createAnonClient,
  createUserClient,
  isSupabaseConfigured,
  resetSupabaseClient,
  type SupabaseClient,
} from './client';

// Helpers
export {
  getErrorMessage,
  isNotFoundError,
  hasMoreResults,
  generateHexToken,
  generateShortId,
  generateAccessToken,
  getFirstOfMonth,
  getFirstOfNextMonth,
  getPaginationRange,
} from './helpers';

// Repositories
// Note: createSupabaseAnalysisRepository removed - analyses table dropped (unused, replaced by analysis_results)
export { createSupabaseKnowledgeRepository } from './knowledge-repo';
export { createSupabaseInfluencerRepository } from './influencer-repo';
export { createSupabaseUserRepository } from './user-repo';
export { createSupabaseSharingRepository } from './sharing-repo';
export { createSupabaseTeamRepository } from './team-repo';
export { createSupabaseTrackingRepository } from './tracking-repo';
