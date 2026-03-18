/**
 * Knowledge resource matching barrel export
 *
 * @module @betterprompt/shared/matching
 */

export {
  matchKnowledgeResources,
  extractMatchingContextFromDomainResults,
  computeTagOverlap,
  computeSubCategoryOverlap,
} from './knowledge-resource-matcher.js';

export type {
  GrowthAreaInsight,
  PortableKnowledgeItem,
  PortableProfessionalInsight,
  MatchedKnowledgeItem,
  MatchedProfessionalInsight,
  DimensionResourceMatch,
  MatchingContext,
} from './knowledge-resource-matcher.js';
