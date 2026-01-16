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
export { createSupabaseAnalysisRepository } from './analysis-repo';
export { createSupabaseKnowledgeRepository } from './knowledge-repo';
export { createSupabaseInfluencerRepository } from './influencer-repo';
export { createSupabaseUserRepository } from './user-repo';
export { createSupabaseSharingRepository } from './sharing-repo';
export { createSupabaseTeamRepository } from './team-repo';
export { createSupabaseTrackingRepository } from './tracking-repo';
