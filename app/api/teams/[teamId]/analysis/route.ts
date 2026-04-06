/**
 * Team Analysis API
 *
 * GET /api/teams/[teamId]/analysis
 *
 * Runs the full team-level analysis pipeline server-side and returns a
 * TeamAnalysisOutput with cross-developer patterns and manager recommendations
 * co-located in a single response.
 *
 * Pipeline:
 *   1. Fetch team members from team-store
 *   2. For each member, fetch their analysis history and transform to
 *      TeamMemberAnalysis via mapUserToTeamMember()
 *   3. Run aggregateGrowthAreasPEA() to detect cross-developer patterns
 *   4. If ANTHROPIC_API_KEY is configured: generateLLMTeamPatternAnalysis()
 *      → Single LLM call producing BOTH:
 *        a) Freeform team-level category tags per pattern (cross-developer perspective)
 *        b) LLM-powered, pattern-specific manager recommendations
 *      Team-level tags replace the aggregated individual-developer tags on each pattern.
 *   5. Otherwise: generateTeamActionItems()
 *      → deterministic, domain-keyed template directives (no tag enrichment)
 *   6. Return TeamAnalysisOutput with patterns + recommendations + source label
 *
 * The "persisted alongside" design guarantee:
 *   patterns and recommendations are always returned together in the same
 *   atomic response. Callers never receive recommendations without the pattern
 *   data they were derived from, and never receive stale recommendations
 *   from a previous pattern set.
 *
 * Error handling: follows the "No Fallback Policy" — errors propagate to the
 * caller with a 500 response. No silent default data is returned.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromRequest, findUserById } from '@/lib/local/auth';
import {
  getTeam,
  getUserOrganization,
  listMembersForTeam,
} from '@/lib/local/team-store';
import { listAnalysesForUser } from '@/lib/local/analysis-store';
import { mapUserToTeamMember } from '@/lib/local/evaluation-to-team';
import {
  aggregateGrowthAreasPEA,
  generateTeamActionItems,
} from '@/lib/enterprise/aggregation';
import { generateLLMTeamPatternAnalysis } from '@/lib/enterprise/team-recommendations-prompt';
import type { TeamAnalysisOutput, TeamMemberAnalysis } from '@/types/enterprise';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ teamId: string }> },
) {
  const user = getCurrentUserFromRequest();
  const { teamId } = await params;

  // ---- Authorization: verify team belongs to user's organization ----
  const team = getTeam(teamId);
  if (!team) {
    return NextResponse.json(
      { error: 'not_found', message: 'Team not found' },
      { status: 404 },
    );
  }

  const org = getUserOrganization(user.id);
  if (!org) {
    return NextResponse.json(
      { error: 'not_found', message: 'User does not belong to an organization' },
      { status: 404 },
    );
  }

  if (team.organizationId !== org.id) {
    return NextResponse.json(
      { error: 'forbidden', message: 'Team does not belong to your organization' },
      { status: 403 },
    );
  }

  // ---- Build TeamMemberAnalysis[] for this team ----
  // listMembersForTeam() returns StoredTeamMember[] (membership records only).
  // We must transform each to TeamMemberAnalysis via mapUserToTeamMember()
  // so that aggregateGrowthAreasPEA() can access growthAreas, categoryTags,
  // kbTip attachments, and other analysis fields.
  const memberRecords = listMembersForTeam(teamId);
  const members: TeamMemberAnalysis[] = [];

  for (const record of memberRecords) {
    const memberUser = findUserById(record.userId);
    if (!memberUser) continue;

    const analyses = listAnalysesForUser(record.userId);
    const teamMember = mapUserToTeamMember(
      memberUser,
      analyses,
      record.teamId,
      record.role,
      team.name,
    );
    members.push(teamMember);
  }

  // ---- Cross-developer pattern detection ----
  // Two-pass clustering: exact title match → semantic tag overlap.
  // Members with no growthAreas contribute nothing to patterns (silent skip,
  // not an error — they simply have no data yet).
  let patterns = aggregateGrowthAreasPEA(members);
  const totalMembers = members.length;

  const hasApiKey = Boolean(process.env.ANTHROPIC_API_KEY);

  // ---- LLM combined analysis: freeform category tags + recommendations ----
  // When ANTHROPIC_API_KEY is configured, a single LLM call produces BOTH:
  //   a) Team-level freeform category tags per pattern — cross-developer
  //      behavioral descriptors from a manager perspective, distinct from
  //      the aggregated individual developer tags.
  //   b) Pattern-specific actionable manager recommendations.
  //
  // The team-level tags replace the aggregated individual-developer tags on
  // each pattern, giving the team view a manager-appropriate vocabulary.
  //
  // Follows No Fallback Policy: errors propagate — they are NOT silently caught.
  let recommendationSource: TeamAnalysisOutput['recommendationSource'];
  let recommendations: TeamAnalysisOutput['recommendations'];

  if (hasApiKey && patterns.length > 0) {
    // LLM path: single call for team-level tags + pattern-specific directives.
    // generateLLMTeamPatternAnalysis() throws on API errors — propagated below.
    const analysis = await generateLLMTeamPatternAnalysis(patterns, totalMembers);

    // Apply LLM-generated team-level category tags back to each pattern.
    // Fall back to the aggregated individual tags for patterns the LLM skipped.
    patterns = patterns.map(p => ({
      ...p,
      categoryTags: analysis.patternCategoryTags[p.title] ?? p.categoryTags,
    }));

    recommendations = analysis.recommendations;
    recommendationSource = 'llm';
  } else {
    // Deterministic path: domain-keyed template directives.
    // Used when ANTHROPIC_API_KEY is absent or there are no patterns to
    // recommend on. Category tags remain as aggregated from individual analyses.
    recommendations = generateTeamActionItems(patterns, totalMembers);
    recommendationSource = 'deterministic';
  }

  const output: TeamAnalysisOutput = {
    teamId,
    teamName: team.name,
    patterns,
    recommendations,
    recommendationSource,
    generatedAt: new Date().toISOString(),
    totalMembers,
  };

  return NextResponse.json(output);
}
