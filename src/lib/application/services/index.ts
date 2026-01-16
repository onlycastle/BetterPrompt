/**
 * Application Services
 *
 * Business logic orchestration layer.
 *
 * @module application/services
 */

// Analysis
export {
  createAnalysisService,
  type AnalysisService,
  type AnalysisServiceDeps,
  type AnalysisOptions,
  type FullAnalysisResult,
} from './analysis-service';

// Knowledge
export {
  createKnowledgeService,
  type KnowledgeService,
  type KnowledgeServiceDeps,
  type ContentInput,
} from './knowledge-service';

// Recommendations
export {
  createRecommendationService,
  type RecommendationService,
  type RecommendationServiceDeps,
  type Recommendation,
} from './recommendation-service';

// Sharing
export {
  createSharingService,
  type SharingService,
  type SharingServiceDeps,
  type ShareLinkResult,
} from './sharing-service';

// Influencers
export {
  createInfluencerService,
  type InfluencerService,
  type InfluencerServiceDeps,
  type CreateInfluencerInput,
  type InfluencerStats,
} from './influencer-service';

// Jobs
export {
  createJobService,
  type JobService,
  type JobServiceDeps,
  type JobCreateOptions,
} from './job-service';
