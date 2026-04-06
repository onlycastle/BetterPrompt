/**
 * Enterprise Aggregation Utilities
 *
 * Pure functions that aggregate individual TeamMemberAnalysis data
 * into team-level and org-level views. Extracted from mock-data.ts
 * for use with real data.
 */

import type {
  TeamMemberAnalysis,
  TeamAnalytics,
  OrganizationAnalytics,
  DimensionScores,
  HistoryEntry,
  SkillGap,
  AntiPatternAggregate,
  EnhancedAntiPatternAggregate,
  TeamGrowthAreaAggregate,
  TeamGrowthAreaPEAAggregate,
  TeamKPTAggregate,
  TeamKPTItem,
  MemberGrowthArea,
  MemberGrowthAreaPEA,
  MemberEvidenceMoment,
  MemberKbTipAttachment,
  InefficiencyPattern,
  TeamActionItem,
} from '@/types/enterprise';
import { ANTI_PATTERN_LABELS } from '@/types/enterprise';
import type { CodingStyleType, AIControlLevel } from '@/lib/models/coding-style';
import {
  normalizeTag,
  computeNormalizedTagOverlap,
  clusterTags,
  deduplicateTagsBeforeClustering,
  buildTagClusterIndex,
} from '@/lib/enterprise/tag-similarity';

// ---------------------------------------------------------------------------
// Anti-pattern detail map
// ---------------------------------------------------------------------------

export const ANTI_PATTERN_DETAILS: Record<InefficiencyPattern, { description: string; actionableInsight: string }> = {
  late_compact: {
    description: 'Context compaction triggered too late in the session, causing degraded AI performance and increased token waste.',
    actionableInsight: 'Train the team to trigger compaction proactively at 60% context fill, not reactively at 90%+.',
  },
  context_bloat: {
    description: 'Sessions accumulate excessive context through large paste operations and unnecessary file inclusions.',
    actionableInsight: 'Establish a "minimal context" practice: include only files and snippets directly relevant to the current task.',
  },
  redundant_info: {
    description: 'Same information is re-provided multiple times within a session, wasting context window capacity.',
    actionableInsight: 'Encourage referencing prior messages instead of re-pasting. Use "as discussed above" patterns.',
  },
  prompt_length_inflation: {
    description: 'Prompts grow increasingly verbose without proportional improvement in output quality.',
    actionableInsight: 'Workshop concise prompting techniques. Aim for <200 words per prompt with structured formatting.',
  },
  no_session_separation: {
    description: 'Multiple unrelated tasks are handled in a single session, degrading context relevance.',
    actionableInsight: 'Establish a team norm: new task = new session. Keep sessions focused on one objective.',
  },
  verbose_error_pasting: {
    description: 'Full stack traces and error logs are pasted without summarization, consuming excessive context.',
    actionableInsight: 'Train developers to extract key error lines and provide summaries rather than raw pastes.',
  },
  no_knowledge_persistence: {
    description: 'Insights and decisions from sessions are not recorded, leading to repeated problem-solving.',
    actionableInsight: 'Implement session-end summaries stored in project docs for cross-session knowledge transfer.',
  },
};

// ---------------------------------------------------------------------------
// Domain configs (shared constant)
// ---------------------------------------------------------------------------

export const DOMAIN_CONFIGS = [
  // Legacy 6-domain framework — kept for backward compatibility with old runs
  { domain: 'thinkingQuality', label: 'Thinking Quality' },
  { domain: 'communicationPatterns', label: 'Communication' },
  { domain: 'learningBehavior', label: 'Learning Behavior' },
  { domain: 'contextEfficiency', label: 'Context Efficiency' },
  { domain: 'sessionOutcome', label: 'Session Outcome' },
  // 5-dimension framework (v2): merged domains + new sessionMastery
  { domain: 'aiPartnership', label: 'AI Partnership' },
  { domain: 'sessionCraft', label: 'Session Craft' },
  { domain: 'toolMastery', label: 'Tool Mastery' },
  { domain: 'skillResilience', label: 'Skill Resilience' },
  { domain: 'sessionMastery', label: 'Session Mastery' },
] as const;

// ---------------------------------------------------------------------------
// Growth area aggregation
// ---------------------------------------------------------------------------

export function aggregateGrowthAreas(members: TeamMemberAnalysis[]): TeamGrowthAreaAggregate[] {
  const map = new Map<string, {
    domain: string;
    domainLabel: string;
    members: string[];
    severities: MemberGrowthArea['severity'][];
    recommendation: string;
    /** Track representative evidence moments across members (up to 3) */
    representativeEvidence: Array<{ memberName: string; moment: MemberEvidenceMoment }>;
    /** Whether any contributing member flagged lowConfidence */
    hasLowConfidenceContributor: boolean;
  }>();

  const domainLabelMap: Record<string, string> = {};
  for (const { domain, label } of DOMAIN_CONFIGS) {
    domainLabelMap[domain] = label;
  }

  for (const m of members) {
    for (const ga of m.growthAreas) {
      const entry = map.get(ga.title) ?? {
        domain: ga.domain,
        domainLabel: domainLabelMap[ga.domain] ?? ga.domain,
        members: [],
        severities: [],
        recommendation: ga.recommendation,
        representativeEvidence: [],
        hasLowConfidenceContributor: false,
      };
      entry.members.push(m.name);
      entry.severities.push(ga.severity);

      // Track low-confidence contributors (AC 6)
      if (ga.lowConfidence) {
        entry.hasLowConfidenceContributor = true;
      }

      // Collect representative evidence moments (up to 3, one per member)
      if (ga.evidenceMoments && ga.evidenceMoments.length > 0 && entry.representativeEvidence.length < 3) {
        entry.representativeEvidence.push({
          memberName: m.name,
          moment: ga.evidenceMoments[0],
        });
      }

      map.set(ga.title, entry);
    }
  }

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 } as const;

  const totalDevs = members.length;

  return [...map.entries()]
    .filter(([, data]) => data.members.length >= 2)
    .map(([title, data]) => {
      const predominant = data.severities.reduce((best, s) =>
        severityRank[s] > severityRank[best] ? s : best, data.severities[0]);
      return {
        title,
        domain: data.domain,
        domainLabel: data.domainLabel,
        memberCount: data.members.length,
        totalDevs,
        affectedMembers: data.members,
        predominantSeverity: predominant,
        sampleRecommendation: data.recommendation,
        representativeEvidence: data.representativeEvidence.length > 0 ? data.representativeEvidence : undefined,
        hasLowConfidenceContributors: data.hasLowConfidenceContributor || undefined,
      };
    })
    .sort((a, b) => b.memberCount - a.memberCount || severityRank[b.predominantSeverity] - severityRank[a.predominantSeverity]);
}

// ---------------------------------------------------------------------------
// Cross-developer pattern aggregation (PEA format)
// ---------------------------------------------------------------------------

/**
 * Minimum number of shared category tags required to cluster two growth areas
 * from different developers as the "same pattern" during tag-based matching.
 */
const TAG_OVERLAP_THRESHOLD = 2;

/**
 * Type guard: check if a MemberGrowthArea has PEA extension fields.
 * At runtime growthAreas may contain MemberGrowthAreaPEA instances
 * even though the array is typed as MemberGrowthArea[].
 */
function isPEAGrowthArea(ga: MemberGrowthArea): ga is MemberGrowthAreaPEA {
  return 'categoryTags' in ga && Array.isArray((ga as MemberGrowthAreaPEA).categoryTags);
}

/**
 * Extract category tags from a growth area, returning empty array for non-PEA areas.
 */
function getTagsFromGrowthArea(ga: MemberGrowthArea): string[] {
  return isPEAGrowthArea(ga) ? ga.categoryTags : [];
}

/**
 * Compute the number of shared tags between two sets.
 *
 * Uses semantic normalization (synonym mapping + stemming + filler removal)
 * so that freeform LLM-generated tags like "error-handling", "Error Handling",
 * and "exception handling patterns" cluster together.
 *
 * Each tag in tagsA can match at most one tag in tagsB (no double-counting).
 *
 * Falls back to similarity scoring (≥0.75 threshold) for partial matches
 * when exact normalized forms don't align.
 */
export function computeTagOverlapCount(tagsA: string[], tagsB: string[]): number {
  return computeNormalizedTagOverlap(tagsA, tagsB);
}

/** Internal bookkeeping for a pattern cluster during aggregation */
interface PatternCluster {
  /** Representative title (most frequent title in the cluster) */
  representativeTitle: string;
  domain: string;
  domainLabel: string;
  /** All distinct titles that mapped into this cluster */
  titles: string[];
  /** Normalized tag union for this cluster */
  tagUnion: Set<string>;
  /** Members contributing to this cluster (deduplicated by name) */
  memberContributions: Array<{
    memberName: string;
    severity: MemberGrowthArea['severity'];
    title: string;
    recommendation: string;
    evidenceMoments?: MemberEvidenceMoment[];
    lowConfidence?: boolean;
    goalRelevance?: string;
    categoryTags: string[];
    kbTipId?: string;
    kbTipTitle?: string;
    kbTipSourceAuthor?: string;
    kbTipRelevanceScore?: number;
    /** Full structured KB tip attachment — supersedes the individual fields above */
    knowledgeTip?: MemberKbTipAttachment;
  }>;
}

/**
 * Cross-developer pattern aggregation with PEA-format growth areas.
 *
 * Two-pass clustering algorithm:
 *
 * **Pass 1 — Exact title match** (fast, deterministic):
 * Growth areas with identical titles are grouped together regardless of tags.
 *
 * **Pass 2 — Category tag overlap** (fuzzy, for unmatched areas):
 * Remaining areas are clustered when they share ≥ TAG_OVERLAP_THRESHOLD tags
 * AND belong to the same domain. This catches patterns like "Late Error Handling"
 * and "Missing Error Boundaries" that share tags ["error-handling", "react"].
 *
 * Output includes:
 * - Frequency counts: `memberCount` of `totalMembers` developers share this pattern
 * - De-duplicated, frequency-ranked category tags
 * - Per-member severity breakdown
 * - Best-match KB tip (highest relevance score among members' tips)
 * - Actionable team-level recommendation
 *
 * @param members Team members with growth areas (may include PEA-extended data)
 * @returns Aggregated patterns sorted by member count then severity
 */
export function aggregateGrowthAreasPEA(
  members: TeamMemberAnalysis[],
): TeamGrowthAreaPEAAggregate[] {
  const totalMembers = members.length;
  if (totalMembers === 0) return [];

  const domainLabelMap: Record<string, string> = {};
  for (const { domain, label } of DOMAIN_CONFIGS) {
    domainLabelMap[domain] = label;
  }

  // ---- Collect all member growth areas with their source member ----
  type TaggedGrowthEntry = {
    memberName: string;
    ga: MemberGrowthArea;
    tags: string[];
    clustered: boolean;
  };

  const entries: TaggedGrowthEntry[] = [];
  for (const m of members) {
    for (const ga of m.growthAreas) {
      entries.push({
        memberName: m.name,
        ga,
        tags: getTagsFromGrowthArea(ga),
        clustered: false,
      });
    }
  }

  const clusters: PatternCluster[] = [];

  // ---- Pass 1: Exact title match ----
  const titleGroups = new Map<string, TaggedGrowthEntry[]>();
  for (const entry of entries) {
    const key = entry.ga.title;
    const group = titleGroups.get(key) ?? [];
    group.push(entry);
    titleGroups.set(key, group);
  }

  for (const [title, group] of titleGroups) {
    // Only cluster if ≥2 distinct members share this exact title
    const distinctMembers = new Set(group.map(e => e.memberName));
    if (distinctMembers.size < 2) continue;

    // Mark entries as clustered
    for (const entry of group) {
      entry.clustered = true;
    }

    const tagUnion = new Set<string>();
    for (const entry of group) {
      for (const tag of entry.tags) tagUnion.add(normalizeTag(tag) || tag.toLowerCase());
    }

    const firstEntry = group[0];
    clusters.push({
      representativeTitle: title,
      domain: firstEntry.ga.domain,
      domainLabel: domainLabelMap[firstEntry.ga.domain] ?? firstEntry.ga.domain,
      titles: [title],
      tagUnion,
      memberContributions: group.map(e => buildContribution(e)),
    });
  }

  // ---- Pass 2: Tag-overlap clustering for unclustered entries ----
  const unclustered = entries.filter(e => !e.clustered && e.tags.length > 0);

  // Group unclustered entries by domain first (tag overlap only within same domain)
  const domainBuckets = new Map<string, TaggedGrowthEntry[]>();
  for (const entry of unclustered) {
    const bucket = domainBuckets.get(entry.ga.domain) ?? [];
    bucket.push(entry);
    domainBuckets.set(entry.ga.domain, bucket);
  }

  for (const [domain, bucket] of domainBuckets) {
    // Greedy merge: for each entry, try to merge into an existing tag cluster
    // Uses semantic tag normalization for fuzzy matching of freeform LLM tags
    const tagClusters: Array<{
      tagUnion: Set<string>;
      /** Raw tags preserved for display label selection */
      rawTags: string[];
      entries: TaggedGrowthEntry[];
    }> = [];

    for (const entry of bucket) {
      let merged = false;
      for (const tc of tagClusters) {
        const overlap = computeTagOverlapCount(
          entry.tags,
          [...tc.tagUnion],
        );
        if (overlap >= TAG_OVERLAP_THRESHOLD) {
          // Merge into this cluster
          tc.entries.push(entry);
          tc.rawTags.push(...entry.tags);
          for (const tag of entry.tags) tc.tagUnion.add(normalizeTag(tag) || tag.toLowerCase());
          merged = true;
          break;
        }
      }
      if (!merged) {
        tagClusters.push({
          tagUnion: new Set(entry.tags.map(t => normalizeTag(t) || t.toLowerCase())),
          rawTags: [...entry.tags],
          entries: [entry],
        });
      }
    }

    // Convert tag clusters with ≥2 distinct members into PatternClusters
    for (const tc of tagClusters) {
      const distinctMembers = new Set(tc.entries.map(e => e.memberName));
      if (distinctMembers.size < 2) continue;

      // Mark entries as clustered
      for (const entry of tc.entries) {
        entry.clustered = true;
      }

      // Pick most frequent title as representative
      const titleCounts = new Map<string, number>();
      for (const entry of tc.entries) {
        titleCounts.set(entry.ga.title, (titleCounts.get(entry.ga.title) ?? 0) + 1);
      }
      const representativeTitle = [...titleCounts.entries()]
        .sort((a, b) => b[1] - a[1])[0][0];

      const allTitles = [...new Set(tc.entries.map(e => e.ga.title))];

      clusters.push({
        representativeTitle,
        domain,
        domainLabel: domainLabelMap[domain] ?? domain,
        titles: allTitles,
        tagUnion: tc.tagUnion,
        memberContributions: tc.entries.map(e => buildContribution(e)),
      });
    }
  }

  // ---- Transform clusters into TeamGrowthAreaPEAAggregate ----
  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 } as const;

  return clusters
    .map(cluster => {
      // Deduplicate members (same member might contribute multiple growth areas to a cluster)
      const uniqueMembers = new Map<string, typeof cluster.memberContributions[0]>();
      for (const c of cluster.memberContributions) {
        // Keep the highest-severity entry per member
        const existing = uniqueMembers.get(c.memberName);
        if (!existing || severityRank[c.severity] > severityRank[existing.severity]) {
          uniqueMembers.set(c.memberName, c);
        }
      }
      const dedupedContributions = [...uniqueMembers.values()];

      // Frequency-ranked category tags with semantic clustering.
      // Step 1: pre-deduplicate exact/near-exact surface variants
      //   (e.g. "error-handling" / "Error Handling!" → "error handling")
      //   This collapses trivially-identical tags cheaply before the more
      //   expensive semantic clustering pass.
      // Step 2: semantic cluster by synonym / stemming / filler-removal overlap
      const allRawTags = dedupedContributions.flatMap(c => c.categoryTags);
      const preDeduped = deduplicateTagsBeforeClustering(allRawTags);
      const clusteredTags = clusterTags(preDeduped);
      const rankedTags = clusteredTags.map(ct => ct.displayLabel);

      // Predominant severity
      const predominant = dedupedContributions.reduce(
        (best, c) => severityRank[c.severity] > severityRank[best] ? c.severity : best,
        dedupedContributions[0].severity,
      );

      // Representative evidence (up to 3 from different members)
      const representativeEvidence: Array<{ memberName: string; moment: MemberEvidenceMoment }> = [];
      for (const c of dedupedContributions) {
        if (representativeEvidence.length >= 3) break;
        if (c.evidenceMoments && c.evidenceMoments.length > 0) {
          representativeEvidence.push({
            memberName: c.memberName,
            moment: c.evidenceMoments[0],
          });
        }
      }

      // Low confidence: if any contributor flagged lowConfidence
      const hasLowConfidence = dedupedContributions.some(c => c.lowConfidence);

      // Best KB tip: highest relevance score among members.
      // When scores are equal (or both absent), the first encountered tip wins.
      // Source credibility (credibilityTier) is preserved on the full knowledgeTip
      // attachment and surfaced to team-view consumers for transparency.
      let bestKbTip: {
        kbTipId?: string;
        kbTipTitle?: string;
        kbTipSourceAuthor?: string;
        kbTipRelevanceScore?: number;
        knowledgeTip?: MemberKbTipAttachment;
      } = {};
      for (const c of dedupedContributions) {
        // Check both full attachment and legacy ID fallback
        const tipScore = c.knowledgeTip?.relevanceScore ?? c.kbTipRelevanceScore ?? 0;
        const hasTip = Boolean(c.knowledgeTip ?? c.kbTipId);
        if (!hasTip) continue;
        // First tip found or higher relevance score beats current best
        const currentBestScore = bestKbTip.knowledgeTip?.relevanceScore
          ?? bestKbTip.kbTipRelevanceScore
          ?? 0;
        if (!bestKbTip.kbTipId || tipScore > currentBestScore) {
          bestKbTip = {
            kbTipId: c.kbTipId,
            kbTipTitle: c.kbTipTitle,
            kbTipSourceAuthor: c.kbTipSourceAuthor,
            kbTipRelevanceScore: c.kbTipRelevanceScore,
            knowledgeTip: c.knowledgeTip,
          };
        }
      }

      // Member severities breakdown
      const memberSeverities = dedupedContributions.map(c => ({
        memberName: c.memberName,
        severity: c.severity,
      }));

      // Team-level recommendation: use first available recommendation
      // (upstream LLM should generate team-specific ones; this is the fallback)
      const sampleRecommendation = dedupedContributions[0].recommendation;

      // Build team recommendation from the individual recommendations
      const teamRecommendation = buildTeamRecommendation(
        cluster.representativeTitle,
        dedupedContributions.length,
        totalMembers,
        predominant,
        sampleRecommendation,
        cluster.domain,
      );

      const { knowledgeTip: bestKnowledgeTip, ...bestKbTipLegacy } = bestKbTip;

      return {
        // Base TeamGrowthAreaAggregate fields
        title: cluster.representativeTitle,
        domain: cluster.domain,
        domainLabel: cluster.domainLabel,
        memberCount: dedupedContributions.length,
        totalDevs: totalMembers,
        affectedMembers: dedupedContributions.map(c => c.memberName),
        predominantSeverity: predominant,
        sampleRecommendation,
        representativeEvidence: representativeEvidence.length > 0 ? representativeEvidence : undefined,
        hasLowConfidenceContributors: hasLowConfidence || undefined,
        // PEA-specific fields
        categoryTags: rankedTags,
        teamRecommendation,
        memberSeverities,
        // Deprecated flat KB fields for backward compatibility
        ...bestKbTipLegacy,
        // Full structured knowledge tip — best-match from contributing members,
        // selected by highest relevanceScore. Carries source credibility signal.
        knowledgeTip: bestKnowledgeTip,
      } satisfies TeamGrowthAreaPEAAggregate;
    })
    .sort((a, b) =>
      b.memberCount - a.memberCount
      || severityRank[b.predominantSeverity] - severityRank[a.predominantSeverity],
    );
}

// ---------------------------------------------------------------------------
// Pattern frequency computation (lightweight projection)
// ---------------------------------------------------------------------------

/**
 * Lightweight per-pattern developer count record.
 *
 * Produced by computePatternFrequencies() for consumers that only need
 * the cross-developer frequency statistics without the full aggregate.
 *
 * Example: { pattern: 'over-explains context', devCount: 3, totalDevs: 5 }
 */
export interface PatternFrequencyResult {
  /** Representative pattern title (most common title in the semantic cluster) */
  pattern: string;
  /** Number of developers exhibiting this pattern */
  devCount: number;
  /** Total developers in the team — enables percentage computation */
  totalDevs: number;
  /** Analysis domain the pattern belongs to */
  domain: string;
  /** Dominant severity across contributing developers */
  predominantSeverity: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Compute per-pattern developer frequency counts across a team.
 *
 * Groups growth-area patterns using the same two-pass clustering algorithm as
 * aggregateGrowthAreasPEA() (exact title → semantic tag overlap), then projects
 * each cluster to the lightweight PatternFrequencyResult shape.
 *
 * Wires the existing aggregateGrowthAreasPEA() infrastructure — no duplicate
 * deduplication logic. All cross-developer pattern detection happens in the
 * existing function; this is a projection-only wrapper.
 *
 * @param members Team members with growth areas (may include PEA-extended data)
 * @returns Per-pattern frequency results sorted by devCount descending
 *
 * @example
 * const frequencies = computePatternFrequencies(teamMembers);
 * // [
 * //   { pattern: 'over-explains context', devCount: 3, totalDevs: 5, ... },
 * //   { pattern: 'skips error handling',  devCount: 2, totalDevs: 5, ... },
 * // ]
 */
export function computePatternFrequencies(
  members: TeamMemberAnalysis[],
): PatternFrequencyResult[] {
  const aggregated = aggregateGrowthAreasPEA(members);

  return aggregated.map(agg => ({
    pattern: agg.title,
    devCount: agg.memberCount,
    totalDevs: agg.totalDevs,
    domain: agg.domain,
    predominantSeverity: agg.predominantSeverity,
  }));
}

/** Build a contribution record from a tagged growth entry */
function buildContribution(entry: { memberName: string; ga: MemberGrowthArea }) {
  const pea = isPEAGrowthArea(entry.ga) ? entry.ga : undefined;

  // Resolve the best available knowledge tip attachment.
  // Priority: knowledgeTip (canonical) > kbTip (legacy alias) > pea deprecated fields.
  // Both knowledgeTip and kbTip are present on base MemberGrowthArea, so no PEA cast needed.
  const knowledgeTip: MemberKbTipAttachment | undefined =
    entry.ga.knowledgeTip ?? entry.ga.kbTip;

  return {
    memberName: entry.memberName,
    severity: entry.ga.severity,
    title: entry.ga.title,
    recommendation: entry.ga.recommendation,
    evidenceMoments: entry.ga.evidenceMoments,
    lowConfidence: entry.ga.lowConfidence,
    goalRelevance: entry.ga.goalRelevance,
    categoryTags: pea?.categoryTags ?? [],
    // Deprecated fields: populate from structured tip when available, else from PEA legacy fields.
    kbTipId: knowledgeTip?.tipId ?? pea?.kbTipId,
    kbTipTitle: knowledgeTip?.title ?? pea?.kbTipTitle,
    kbTipSourceAuthor: knowledgeTip?.sourceAuthor,
    kbTipRelevanceScore: knowledgeTip?.relevanceScore,
    // Full structured attachment — enables best-tip selection by relevanceScore
    // and source credibility, and is propagated to TeamGrowthAreaPEAAggregate.knowledgeTip.
    knowledgeTip,
  };
}

// ---------------------------------------------------------------------------
// Domain → specific intervention mapping
// ---------------------------------------------------------------------------

/** Concrete manager-actionable interventions keyed by analysis domain */
const DOMAIN_INTERVENTIONS: Record<string, {
  /** High/critical severity: urgent, structured intervention */
  urgent: string[];
  /** Medium/low severity: lightweight process improvement */
  light: string[];
}> = {
  thinkingQuality: {
    urgent: [
      'Schedule a weekly code review workshop where affected developers present their reasoning for architectural decisions before implementation',
      'Establish mandatory design-doc review gates before starting any task exceeding 2-hour estimate',
      'Create a "thinking checklist" template: problem statement → constraints → 3 alternatives → trade-off matrix → selected approach',
    ],
    light: [
      'Add a 5-minute "approach walkthrough" to standup where one developer explains their plan for the day\'s task',
      'Introduce async design-review threads in your team channel for non-blocking feedback on approach',
    ],
  },
  communicationPatterns: {
    urgent: [
      'Schedule a prompt-crafting workshop: review real session transcripts and practice rewriting vague prompts into structured requests',
      'Create team prompt templates for common task types (bug fix, feature implementation, refactoring) with required sections',
      'Assign prompt review buddies: pair each affected developer with a high-scorer for weekly 15-minute prompt review sessions',
    ],
    light: [
      'Add a pre-prompt checklist to your team wiki: specify goal, context, constraints, and expected output format',
      'Share a weekly "prompt of the week" in the team channel highlighting effective communication patterns',
    ],
  },
  learningBehavior: {
    urgent: [
      'Schedule bi-weekly knowledge-sharing sessions where developers demonstrate new techniques or tools learned during AI sessions',
      'Create a team learning journal: after each significant AI session, document one new technique and one mistake in a shared wiki',
      'Establish pair-programming rotations: pair affected developers with those who show strong learning patterns',
    ],
    light: [
      'Add a "lessons learned" section to sprint retrospectives covering AI collaboration insights',
      'Create a shared team bookmark list of effective patterns discovered during AI sessions',
    ],
  },
  contextEfficiency: {
    urgent: [
      'Schedule a context management workshop: demonstrate session scoping, context window monitoring, and proactive compaction techniques',
      'Add a pre-session checklist: define scope, prepare minimal file set, set a 60% context fill compaction trigger',
      'Create project-specific CLAUDE.md files with pre-loaded context to reduce per-session context setup overhead',
    ],
    light: [
      'Add a team norm: start each session with a clear scope statement and end with a session summary',
      'Share a context budget guideline: maximum 3 files per session, summarize errors before pasting',
    ],
  },
  sessionOutcome: {
    urgent: [
      'Schedule a session planning workshop: teach task decomposition, goal setting, and outcome verification techniques',
      'Add a pre-merge verification checklist: tests pass, types check, acceptance criteria met, session learnings documented',
      'Establish outcome review in sprint retros: compare session goals vs. actual outcomes for the past sprint',
    ],
    light: [
      'Add a session outcome log template: goal → approach → result → next steps, reviewed weekly by tech lead',
      'Create a "definition of done" checklist for AI-assisted tasks that includes verification steps',
    ],
  },
  // ---- 5-dimension framework (v2) domain-specific interventions ----
  aiPartnership: {
    urgent: [
      'Schedule a hands-on workshop reviewing AI collaboration session transcripts together, identifying moments where clearer direction reduced back-and-forth',
      'Establish an AI partnership check-in in weekly retros: share one AI collaboration win and one breakdown with concrete improvements',
      'Create a team "AI handoff protocol": explicit ownership signals (LGTM/REVISE) after each AI-generated code block to maintain developer control',
    ],
    light: [
      'Add a weekly 15-minute "AI collaboration share" where developers walk through one effective multi-turn AI exchange',
      'Create a team prompt library seeded with high-quality example exchanges from top performers',
    ],
  },
  sessionCraft: {
    urgent: [
      'Schedule a session design workshop: demonstrate session scoping, context window budgeting, and structured task decomposition using real transcripts',
      'Implement team session templates: define standard session structure (scope → plan → implement → verify) for the three most common task types',
      'Create project-specific CLAUDE.md files with pre-loaded context, constraints, and task checklists to reduce per-session setup overhead',
    ],
    light: [
      'Add a team norm: start every session with a one-sentence scope statement as the first message before any implementation',
      'Share a "session hygiene" checklist: one task per session, clear scope first, proactive compaction at 60% context fill',
    ],
  },
  toolMastery: {
    urgent: [
      'Schedule a tool discovery workshop: each developer demos their most productive Claude Code tool invocations from recent sessions',
      'Create a team tool inventory: document all Claude Code tools your team uses with real before/after examples of effective vs. ineffective invocations',
      'Assign tool mastery rotations: each sprint, one developer deep-dives a specific tool (Grep, Bash, Task) and presents findings at standup',
    ],
    light: [
      'Add a weekly "tool tip" to the team channel: one concrete example of a tool invocation that saved significant time this week',
      'Create a team wiki page with effective tool usage patterns discovered during AI sessions, updated incrementally each sprint',
    ],
  },
  skillResilience: {
    urgent: [
      'Schedule pair-programming sessions where AI assistance is intentionally limited to validate core skill retention for critical code paths',
      'Establish a "manual verification" practice: before accepting AI-generated code, the developer must explain the implementation approach out loud',
      'Create a skill-retention checklist for AI-assisted tasks: independently verify logic, edge cases, security implications, and performance impact',
    ],
    light: [
      'Add a periodic skill-check to sprints: one small task per developer done without AI assistance to validate retention of core competencies',
      'Share a "skill vs. tool" framework in the team wiki: guidance on when to rely on AI vs. when to deliberately build the skill independently',
    ],
  },
  sessionMastery: {
    urgent: [
      'Schedule a session anti-patterns workshop: review real session transcripts as a team, identify inefficiency patterns, and commit to three concrete session norms',
      'Create a "session quality gate" before ending sessions: verify task completion, context efficiency, and knowledge capture in a two-minute review',
      'Establish session quality metrics tracked in retros: context fill at compaction, task completion rate, and whether session learning was documented',
    ],
    light: [
      'Add a session-end ritual: a one-minute summary commit (what was done, what was learned) at the close of every significant AI session',
      'Share a "session mastery self-assessment" in the team wiki: a simple five-point checklist developers complete after complex AI sessions',
    ],
  },
};

/** Fallback interventions when domain is not recognized */
const DEFAULT_INTERVENTIONS = {
  urgent: [
    'Schedule a focused team workshop to address this pattern with hands-on exercises using real session data',
    'Assign accountability buddies: pair affected developers for weekly 15-minute improvement check-ins',
  ],
  light: [
    'Add a team checklist item addressing this pattern and review compliance in sprint retrospectives',
    'Share best-practice examples from high-performing team members in the team channel',
  ],
};

/**
 * Select a domain-specific intervention based on pattern characteristics.
 *
 * Selection strategy:
 * 1. Look up domain → intervention list (urgent vs. light based on severity)
 * 2. Use a deterministic hash of the title to pick a specific intervention
 *    (ensures consistency: same title always gets same recommendation)
 * 3. If domain is unknown, fall back to generic interventions
 */
function selectIntervention(
  domain: string,
  title: string,
  severity: 'critical' | 'high' | 'medium' | 'low',
): string {
  const domainInterventions = DOMAIN_INTERVENTIONS[domain] ?? DEFAULT_INTERVENTIONS;
  const isUrgent = severity === 'critical' || severity === 'high';
  const interventionList = isUrgent ? domainInterventions.urgent : domainInterventions.light;

  // Deterministic hash: sum of char codes mod list length
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = (hash + title.charCodeAt(i)) % 1000000;
  }
  const idx = hash % interventionList.length;
  return interventionList[idx];
}

/**
 * Build an actionable team-level recommendation from pattern data.
 *
 * Output format:
 *   "[frequency context] [domain-specific actionable directive] [individual guidance]"
 *
 * The directive is a concrete, manager-implementable action (team_actionability criterion):
 *   - For critical/high severity: workshops, pair-programming, mandatory gates
 *   - For medium/low severity: checklists, norms, async reviews
 *
 * Selection is deterministic (same title → same intervention) and domain-aware.
 */
function buildTeamRecommendation(
  title: string,
  affectedCount: number,
  totalMembers: number,
  severity: 'critical' | 'high' | 'medium' | 'low',
  sampleRecommendation: string,
  domain?: string,
): string {
  const ratio = totalMembers > 0 ? affectedCount / totalMembers : 0;
  const percentText = `${Math.round(ratio * 100)}%`;

  // Frequency context — quantifies the scope for the manager
  const frequencyPrefix = ratio >= 0.6
    ? `${affectedCount} of ${totalMembers} developers (${percentText}) share this pattern.`
    : `${affectedCount} of ${totalMembers} developers exhibit this pattern.`;

  // Domain-specific, severity-appropriate intervention
  const intervention = selectIntervention(domain ?? '', title, severity);

  return `${frequencyPrefix} ${intervention} Individual guidance: ${sampleRecommendation}`;
}

/**
 * Generate prioritized team action items from PEA aggregates.
 *
 * Business rules:
 * - Critical + >50% affected → "immediate"
 * - High severity OR >40% affected → "this-sprint"
 * - Everything else → "next-sprint"
 * - Max 7 items returned (manager attention budget)
 * - Items with the same urgency are sub-sorted by affected count
 */
export function generateTeamActionItems(
  patterns: TeamGrowthAreaPEAAggregate[],
  totalMembers: number,
): TeamActionItem[] {
  if (patterns.length === 0 || totalMembers === 0) return [];

  const severityRank = { critical: 4, high: 3, medium: 2, low: 1 } as const;

  const items: TeamActionItem[] = patterns.map((pattern, _idx) => {
    const ratio = pattern.memberCount / totalMembers;
    const isHighFrequency = ratio > 0.5;
    const isCritical = pattern.predominantSeverity === 'critical';
    const isHigh = pattern.predominantSeverity === 'high';

    let urgency: TeamActionItem['urgency'];
    if (isCritical && isHighFrequency) {
      urgency = 'immediate';
    } else if (isHigh || ratio > 0.4) {
      urgency = 'this-sprint';
    } else {
      urgency = 'next-sprint';
    }

    // Build the action — use the domain-specific intervention
    const action = selectIntervention(
      pattern.domain,
      pattern.title,
      pattern.predominantSeverity,
    );

    // Build rationale with concrete numbers
    const pctText = `${Math.round(ratio * 100)}%`;
    const rationale = `${pattern.memberCount} of ${totalMembers} developers (${pctText}) exhibit "${pattern.title}" — ${pattern.predominantSeverity} severity.`;

    return {
      priority: 0, // will be set after sorting
      urgency,
      action,
      rationale,
      pattern: pattern.title,
      domain: pattern.domain,
      domainLabel: pattern.domainLabel,
      affectedMembers: pattern.affectedMembers,
      severity: pattern.predominantSeverity,
    };
  });

  // Sort: urgency rank → severity → member count
  const urgencyRank = { immediate: 3, 'this-sprint': 2, 'next-sprint': 1 } as const;
  items.sort((a, b) =>
    urgencyRank[b.urgency] - urgencyRank[a.urgency]
    || severityRank[b.severity] - severityRank[a.severity]
    || b.affectedMembers.length - a.affectedMembers.length
  );

  // Assign priority numbers and cap at 7
  return items.slice(0, 7).map((item, idx) => ({
    ...item,
    priority: idx + 1,
  }));
}

// ---------------------------------------------------------------------------
// KPT aggregation
// ---------------------------------------------------------------------------

export function aggregateKPT(members: TeamMemberAnalysis[]): TeamKPTAggregate {
  function aggregateCategory(items: { text: string; memberName: string }[]): TeamKPTItem[] {
    const map = new Map<string, string[]>();
    for (const { text, memberName } of items) {
      const arr = map.get(text) ?? [];
      arr.push(memberName);
      map.set(text, arr);
    }
    return [...map.entries()]
      .filter(([, members]) => members.length >= 2)
      .map(([text, members]) => ({ text, memberCount: members.length, affectedMembers: members }))
      .sort((a, b) => b.memberCount - a.memberCount);
  }

  const keepItems = members.flatMap(m => m.kpt.keep.map(text => ({ text, memberName: m.name })));
  const problemItems = members.flatMap(m => m.kpt.problem.map(text => ({ text, memberName: m.name })));
  const tryItems = members.flatMap(m => m.kpt.tryNext.map(text => ({ text, memberName: m.name })));

  return {
    keep: aggregateCategory(keepItems),
    problem: aggregateCategory(problemItems),
    tryNext: aggregateCategory(tryItems),
  };
}

// ---------------------------------------------------------------------------
// Anti-pattern aggregation
// ---------------------------------------------------------------------------

export function aggregateEnhancedAntiPatterns(members: TeamMemberAnalysis[]): EnhancedAntiPatternAggregate[] {
  const map = new Map<InefficiencyPattern, {
    memberNames: string[];
    memberIds: Set<string>;
    total: number;
    impacts: ('high' | 'medium' | 'low')[];
  }>();

  for (const m of members) {
    for (const ap of m.antiPatterns) {
      const entry = map.get(ap.pattern) ?? { memberNames: [], memberIds: new Set(), total: 0, impacts: [] };
      if (!entry.memberIds.has(m.id)) {
        entry.memberNames.push(m.name);
        entry.memberIds.add(m.id);
      }
      entry.total += ap.frequency;
      entry.impacts.push(ap.impact);
      map.set(ap.pattern, entry);
    }
  }

  return [...map.entries()]
    .map(([pattern, data]) => {
      const details = ANTI_PATTERN_DETAILS[pattern];
      return {
        pattern,
        label: ANTI_PATTERN_LABELS[pattern],
        memberCount: data.memberIds.size,
        totalOccurrences: data.total,
        predominantImpact: data.impacts.includes('high') ? 'high' as const
          : data.impacts.includes('medium') ? 'medium' as const
          : 'low' as const,
        description: details.description,
        affectedMembers: data.memberNames,
        actionableInsight: details.actionableInsight,
      };
    })
    .sort((a, b) => b.totalOccurrences - a.totalOccurrences);
}

// ---------------------------------------------------------------------------
// Team analytics builder
// ---------------------------------------------------------------------------

export function buildTeamAnalytics(
  teamId: string,
  teamName: string,
  members: TeamMemberAnalysis[],
): TeamAnalytics {
  const count = members.length;
  if (count === 0) {
    return {
      teamId,
      teamName,
      memberCount: 0,
      averageOverallScore: 0,
      averageDimensions: { aiCollaboration: 0, contextEngineering: 0, burnoutRisk: 0, aiControl: 0, skillResilience: 0 },
      typeDistribution: { architect: 0, analyst: 0, conductor: 0, speedrunner: 0, trendsetter: 0 },
      controlLevelDistribution: { explorer: 0, navigator: 0, cartographer: 0 },
      skillGaps: [],
      weeklyTrend: [],
      weekOverWeekChange: 0,
      monthOverMonthChange: 0,
      totalTokensThisWeek: 0,
      antiPatternAggregates: [],
      activeProjects: [],
      growthDistribution: { improving: 0, stable: 0, declining: 0 },
    };
  }

  // Average dimensions
  const avgDim: DimensionScores = {
    aiCollaboration: 0, contextEngineering: 0, burnoutRisk: 0,
    aiControl: 0, skillResilience: 0,
  };
  for (const m of members) {
    for (const key of Object.keys(avgDim) as (keyof DimensionScores)[]) {
      avgDim[key] += m.dimensions[key];
    }
  }
  for (const key of Object.keys(avgDim) as (keyof DimensionScores)[]) {
    avgDim[key] = Math.round(avgDim[key] / count);
  }

  // Type distribution
  const typeDist = { architect: 0, analyst: 0, conductor: 0, speedrunner: 0, trendsetter: 0 } as Record<CodingStyleType, number>;
  for (const m of members) {
    typeDist[m.primaryType]++;
  }

  // Control level distribution
  const controlDist = { explorer: 0, navigator: 0, cartographer: 0 } as Record<AIControlLevel, number>;
  for (const m of members) {
    controlDist[m.controlLevel]++;
  }

  // Skill gaps (dimensions below 65 avg)
  const threshold = 65;
  const gaps: SkillGap[] = [];
  const dimLabels: Record<keyof DimensionScores, string> = {
    aiCollaboration: 'AI Collaboration',
    contextEngineering: 'Context Engineering',
    burnoutRisk: 'Burnout Risk',
    aiControl: 'AI Control',
    skillResilience: 'Skill Resilience',
  };
  for (const key of Object.keys(avgDim) as (keyof DimensionScores)[]) {
    if (key === 'burnoutRisk') continue; // Inverted metric
    if (avgDim[key] < threshold) {
      gaps.push({
        dimension: key,
        label: dimLabels[key],
        avgScore: avgDim[key],
        membersBelowThreshold: members.filter(m => m.dimensions[key] < threshold).length,
        threshold,
      });
    }
  }

  // Average overall score
  const avgScore = Math.round(members.reduce((s, m) => s + m.overallScore, 0) / count * 10) / 10;

  // Weekly trend (aggregate from members' histories)
  const weeklyTrend: HistoryEntry[] = [];
  if (members.length > 0 && members[0].history.length > 0) {
    for (let w = 0; w < members[0].history.length; w++) {
      const avg = Math.round(members.reduce((s, m) => s + (m.history[w]?.overallScore ?? 0), 0) / count);
      weeklyTrend.push({ date: members[0].history[w].date, overallScore: avg });
    }
  }

  const wowChange = weeklyTrend.length >= 2
    ? Math.round((weeklyTrend[weeklyTrend.length - 1].overallScore - weeklyTrend[weeklyTrend.length - 2].overallScore) * 10) / 10
    : 0;

  const momChange = weeklyTrend.length >= 5
    ? Math.round((weeklyTrend[weeklyTrend.length - 1].overallScore - weeklyTrend[weeklyTrend.length - 5].overallScore) * 10) / 10
    : 0;

  // Token usage
  const lastWeekTrend = members.flatMap(m => {
    const last = m.tokenUsage.weeklyTokenTrend[m.tokenUsage.weeklyTokenTrend.length - 1];
    return last ? [last.totalTokens] : [];
  });
  const totalTokensThisWeek = lastWeekTrend.reduce((s, t) => s + t, 0);

  const allProjects = new Set(members.flatMap(m => m.projects.map(p => p.projectName)));

  const growthDist = { improving: 0, stable: 0, declining: 0 };
  for (const m of members) {
    growthDist[m.growth.trend]++;
  }

  // Simple anti-pattern aggregates (without enhanced details)
  const simpleAntiPatterns: AntiPatternAggregate[] = aggregateEnhancedAntiPatterns(members)
    .map(({ pattern, label, memberCount, totalOccurrences, predominantImpact }) => ({
      pattern, label, memberCount, totalOccurrences, predominantImpact,
    }));

  return {
    teamId,
    teamName,
    memberCount: count,
    averageOverallScore: avgScore,
    averageDimensions: avgDim,
    typeDistribution: typeDist,
    controlLevelDistribution: controlDist,
    skillGaps: gaps,
    weeklyTrend,
    weekOverWeekChange: wowChange,
    monthOverMonthChange: momChange,
    totalTokensThisWeek,
    antiPatternAggregates: simpleAntiPatterns,
    activeProjects: [...allProjects],
    growthDistribution: growthDist,
  };
}

// ---------------------------------------------------------------------------
// Tag-grouped pattern view (inverted index: tag → patterns)
// ---------------------------------------------------------------------------

/**
 * A group of cross-developer patterns sharing a common category tag.
 *
 * Produced by groupPatternsByTag() to power the "patterns by category" view
 * in enterprise dashboards. Each entry represents one behavioral tag
 * (e.g. "error-handling", "testing") with all cross-developer patterns
 * that carry that tag, plus aggregated developer frequency statistics.
 *
 * Example:
 *   {
 *     canonicalTag: "error handl",
 *     displayTag: "error-handling",
 *     patternCount: 2,
 *     totalDevOccurrences: 5,
 *     patterns: [
 *       { pattern: "Late Error Handling", devCount: 3, ... },
 *       { pattern: "Missing Error Boundaries", devCount: 2, ... },
 *     ]
 *   }
 */
export interface TagPatternGroup {
  /**
   * Canonical cluster key used for grouping — the representative normalized
   * form (output of normalizeTag) for the cluster that this tag belongs to.
   *
   * Tags that are semantically equivalent across different patterns (e.g.
   * "error handling" and "exception handling") are merged into a single cluster
   * and share the same canonicalTag.  Consumers can use this for stable identity
   * checks across renders (e.g. `group.canonicalTag.includes('error')`).
   */
  canonicalTag: string;
  /**
   * Best display label for this tag cluster — the most frequent raw form
   * across ALL patterns contributing to this group (global frequency, not
   * local to a single pattern).
   * This is what UIs should render (e.g. "error-handling" not "error handl").
   */
  displayTag: string;
  /** Number of distinct cross-developer patterns in this group */
  patternCount: number;
  /**
   * Total developer occurrences summed across all patterns in this group.
   *
   * Note: the same developer can contribute to multiple patterns in one tag group
   * (e.g. both "Late Error Handling" and "Missing Error Boundaries"), so
   * totalDevOccurrences can exceed the number of unique developers.
   * Use this for sorting priority, not for unique-developer counts.
   */
  totalDevOccurrences: number;
  /** Patterns in this group, sorted by devCount descending */
  patterns: PatternFrequencyResult[];
}

/**
 * Group cross-developer growth area patterns by their category tags.
 *
 * This is the inverted index of aggregateGrowthAreasPEA(): instead of
 * "pattern → tags", it returns "tag → patterns with occurrence counts".
 *
 * Algorithm:
 * 1. Run aggregateGrowthAreasPEA() to get clustered, deduplicated patterns
 *    (reuses the two-pass title + tag-overlap clustering, no duplication)
 * 2. Collect ALL category tags from ALL patterns into a flat pool
 * 3. Run buildTagClusterIndex() on the full pool so that semantically similar
 *    tags from *different* patterns (e.g. "error handling" from pattern A and
 *    "exception handling" from pattern B) are merged under the same canonical
 *    cluster label *before* frequency counting (Sub-AC 14b)
 * 4. Build the inverted index using cluster canonical keys: each pattern's tags
 *    are resolved to their cluster canonical before bucketing
 * 5. Sort groups by totalDevOccurrences descending, then alphabetical displayTag
 *
 * Only patterns that survived the aggregation (≥2 distinct developers) are
 * included. Patterns with no categoryTags are omitted from the tag index
 * but still appear in the direct aggregateGrowthAreasPEA() output.
 *
 * @param members Team members with PEA growth areas
 * @returns Tag groups sorted by totalDevOccurrences descending
 *
 * @example
 * const tagGroups = groupPatternsByTag(teamMembers);
 * // [
 * //   {
 * //     canonicalTag: "error handl",
 * //     displayTag: "error-handling",
 * //     patternCount: 2,
 * //     totalDevOccurrences: 5,
 * //     patterns: [
 * //       { pattern: "Late Error Handling", devCount: 3, totalDevs: 5, ... },
 * //       { pattern: "Missing Error Boundaries", devCount: 2, totalDevs: 5, ... },
 * //     ]
 * //   },
 * //   { canonicalTag: "test", displayTag: "testing", patternCount: 1, ... },
 * // ]
 */
export function groupPatternsByTag(
  members: TeamMemberAnalysis[],
): TagPatternGroup[] {
  const aggregated = aggregateGrowthAreasPEA(members);

  if (aggregated.length === 0) return [];

  // Step 1: Build a global cluster index from ALL tags across ALL aggregated patterns.
  //
  // By running buildTagClusterIndex() over the complete flat tag pool *before*
  // building the inverted index, we ensure that semantically similar tags from
  // *different* patterns collapse to the same canonical cluster key — so that
  // "exception handling" from pattern B merges with the "error handling" bucket
  // from pattern A (because both normalize to "error handl" via the synonym map).
  // Without this pre-pass, each pattern's tags would only be normalized
  // individually (no cross-pattern merging).
  const allRawTagsFlat = aggregated.flatMap(agg => agg.categoryTags);
  const clusterIndex = buildTagClusterIndex(allRawTagsFlat);

  // Step 2: Build the inverted index using cluster-canonical keys.
  // Each bucket is keyed by the canonical cluster representative, not the raw tag.
  const tagIndex = new Map<string, {
    /** Canonical cluster key (from buildTagClusterIndex) */
    canonical: string;
    /** Best display label for this cluster (most frequent raw form globally) */
    displayLabel: string;
    /** Patterns in this group (deduped by pattern title) */
    patternSet: Map<string, PatternFrequencyResult>;
  }>();

  for (const agg of aggregated) {
    if (agg.categoryTags.length === 0) continue;

    const patternEntry: PatternFrequencyResult = {
      pattern: agg.title,
      devCount: agg.memberCount,
      totalDevs: agg.totalDevs,
      domain: agg.domain,
      predominantSeverity: agg.predominantSeverity,
    };

    for (const rawTag of agg.categoryTags) {
      const norm = normalizeTag(rawTag);
      if (norm.length === 0) continue;

      // Resolve the cluster canonical + display label for this tag.
      // Tags from different patterns that share a cluster (e.g. synonym-equivalent
      // tags) will resolve to the same canonical key and be merged into one bucket.
      const clusterInfo = clusterIndex.get(norm);
      const canonicalKey = clusterInfo?.canonical ?? norm;
      const displayLabel = clusterInfo?.displayLabel ?? rawTag.toLowerCase().trim();

      // Get or initialize the bucket for this cluster
      let bucket = tagIndex.get(canonicalKey);
      if (!bucket) {
        bucket = {
          canonical: canonicalKey,
          displayLabel,
          patternSet: new Map(),
        };
        tagIndex.set(canonicalKey, bucket);
      }

      // Add pattern to the bucket (keyed by title — each cross-developer pattern appears once)
      if (!bucket.patternSet.has(agg.title)) {
        bucket.patternSet.set(agg.title, patternEntry);
      }
    }
  }

  if (tagIndex.size === 0) return [];

  // Step 3: Transform the index into TagPatternGroup[]
  const groups: TagPatternGroup[] = [];

  for (const [canonicalTag, bucket] of tagIndex) {
    // Sort patterns within this group by devCount descending
    const patterns = [...bucket.patternSet.values()]
      .sort((a, b) => b.devCount - a.devCount || a.pattern.localeCompare(b.pattern));

    // totalDevOccurrences: sum of devCounts across all patterns in this group
    // (note: same dev may appear in multiple patterns — this is intentional)
    const totalDevOccurrences = patterns.reduce((sum, p) => sum + p.devCount, 0);

    groups.push({
      canonicalTag,
      displayTag: bucket.displayLabel,
      patternCount: patterns.length,
      totalDevOccurrences,
      patterns,
    });
  }

  // Sort groups: highest totalDevOccurrences first, then alphabetical displayTag
  return groups.sort(
    (a, b) =>
      b.totalDevOccurrences - a.totalDevOccurrences
      || a.displayTag.localeCompare(b.displayTag),
  );
}

// ---------------------------------------------------------------------------
// Organization analytics builder
// ---------------------------------------------------------------------------

export function buildOrganizationAnalytics(
  orgId: string,
  orgName: string,
  teams: TeamAnalytics[],
  allMembers: TeamMemberAnalysis[],
): OrganizationAnalytics {
  const totalMembers = allMembers.length;
  const overallAverageScore = totalMembers > 0
    ? Math.round(allMembers.reduce((s, m) => s + m.overallScore, 0) / totalMembers * 10) / 10
    : 0;

  return {
    organizationId: orgId,
    organizationName: orgName,
    teams,
    totalMembers,
    overallAverageScore,
  };
}
