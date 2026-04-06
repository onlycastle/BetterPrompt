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
  inferCredibilityTier,
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

// KB Growth Area Enricher — wires matcher into growth area output pipeline
export { enrichGrowthAreasWithKbTips } from './kb-growth-area-enricher.js';

// KB Loader — import directly from './kb-loader.js' in server-side code only.
// NOT re-exported here to avoid pulling node:fs into client bundles.
