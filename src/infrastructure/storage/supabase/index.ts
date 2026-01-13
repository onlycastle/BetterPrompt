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
} from './client.js';

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
} from './helpers.js';

// Repositories
export { createSupabaseAnalysisRepository } from './analysis-repo.js';
export { createSupabaseKnowledgeRepository } from './knowledge-repo.js';
export { createSupabaseInfluencerRepository } from './influencer-repo.js';
export { createSupabaseUserRepository } from './user-repo.js';
export { createSupabaseSharingRepository } from './sharing-repo.js';
export { createSupabaseTeamRepository } from './team-repo.js';
export { createSupabaseTrackingRepository } from './tracking-repo.js';
