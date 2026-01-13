/**
 * Skills Module
 *
 * Re-exports all skills for the search-agent.
 */

// Base skill
export {
  BaseSkill,
  SkillError,
  type SkillResult,
  type SkillConfig,
} from './base-skill.js';

// Gatherer skill
export {
  GathererSkill,
  createGatherer,
  createSearchQuery,
  type GathererInput,
  type GathererOutput,
  type WebSearchItem,
} from './gatherer/index.js';

// Judge skill
export {
  JudgeSkill,
  createJudge,
  type JudgeInput,
  type JudgeOutput,
} from './judge/index.js';

// Organizer skill
export {
  OrganizerSkill,
  createOrganizer,
  type OrganizerInput,
  type OrganizerOutput,
  type RawContent,
} from './organizer/index.js';

// Criteria and taxonomy
export { RELEVANCE_CRITERIA, type RelevanceCriterion } from './judge/criteria.js';
export { KNOWLEDGE_TAXONOMY, getTaxonomyNode, type TaxonomyNode } from './organizer/taxonomy.js';

// Transcript skill
export {
  TranscriptSkill,
  createTranscriptSkill,
  type TranscriptInput,
  type TranscriptOutput,
  type VideoAnalysisResult,
} from './transcript/index.js';

// Re-export transcript types
export type { YouTubeTranscript, AnalyzedTranscript } from './transcript/index.js';
export {
  parseYouTubeVideoId,
  parseYouTubePlaylistId,
  isYouTubeUrl,
  TranscriptError,
} from './transcript/index.js';

// Discovery skill
export {
  DiscoverySkill,
  createDiscoverySkill,
  aggregateInfluencers,
  generateSearchQueries,
  getTopicQueries,
  estimateQueryCount,
  type DiscoveryInput,
  type DiscoveryOutput,
  type WebSearchResult,
  type SearchQueryDef,
} from './discovery/index.js';
