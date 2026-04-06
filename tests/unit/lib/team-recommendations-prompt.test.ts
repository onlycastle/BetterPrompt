/**
 * Tests for team-recommendations-prompt module
 *
 * Validates:
 * - buildTeamPatternAnalysisUserPrompt() — prompt serialization
 * - TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT — prompt quality assertions
 * - TEAM_PATTERN_ANALYSIS_TOOL — structured output schema shape
 * - generateLLMTeamPatternAnalysis() — combined freeform tag + recommendation generation
 *   (tested via mocking the Anthropic client)
 *
 * The legacy generateLLMTeamRecommendations() is not re-tested here —
 * it is covered by the route integration tests in team-analysis-route.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Anthropic SDK mock
//
// vi.hoisted() ensures the mockCreate reference is available inside vi.mock()
// even though vi.mock() calls are hoisted to the top of the file.
// ---------------------------------------------------------------------------

const mockCreate = vi.hoisted(() => vi.fn());

vi.mock('@anthropic-ai/sdk', () => {
  class MockAnthropic {
    messages = { create: mockCreate };
    constructor(_config: unknown) {}
  }
  return { default: MockAnthropic };
});

import {
  TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT,
  TEAM_PATTERN_ANALYSIS_TOOL,
  buildTeamPatternAnalysisUserPrompt,
  generateLLMTeamPatternAnalysis,
  type TeamPatternAnalysisResult,
} from '../../../src/lib/enterprise/team-recommendations-prompt';
import type { TeamGrowthAreaPEAAggregate } from '../../../src/types/enterprise';

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function makePattern(overrides: Partial<TeamGrowthAreaPEAAggregate> = {}): TeamGrowthAreaPEAAggregate {
  return {
    title: 'Late Error Handling',
    domain: 'thinkingQuality',
    domainLabel: 'Thinking Quality',
    memberCount: 3,
    totalDevs: 5,
    affectedMembers: ['alice', 'bob', 'carol'],
    predominantSeverity: 'high',
    sampleRecommendation: 'Add error handling earlier in middleware.',
    categoryTags: ['error-handling', 'typescript', 'express'],
    teamRecommendation: 'Schedule a workshop on error handling.',
    memberSeverities: [
      { memberName: 'alice', severity: 'high' },
      { memberName: 'bob', severity: 'high' },
      { memberName: 'carol', severity: 'medium' },
    ],
    representativeEvidence: undefined,
    hasLowConfidenceContributors: undefined,
    ...overrides,
  };
}

/** Build a minimal Anthropic tool_use response with the given pattern analyses */
function makeToolUseResponse(patternAnalyses: object[]) {
  return {
    content: [
      {
        type: 'tool_use',
        name: 'generate_team_pattern_analysis',
        input: { patternAnalyses },
      },
    ],
    stop_reason: 'tool_use',
  };
}

// ---------------------------------------------------------------------------
// buildTeamPatternAnalysisUserPrompt
// ---------------------------------------------------------------------------

describe('buildTeamPatternAnalysisUserPrompt', () => {
  it('includes the pattern title in the user prompt', () => {
    const pattern = makePattern({ title: 'Missing Test Coverage' });
    const prompt = buildTeamPatternAnalysisUserPrompt([pattern], 5);
    expect(prompt).toContain('Missing Test Coverage');
  });

  it('includes domain and severity information', () => {
    const pattern = makePattern({ domain: 'toolMastery', domainLabel: 'Tool Mastery', predominantSeverity: 'critical' });
    const prompt = buildTeamPatternAnalysisUserPrompt([pattern], 5);
    expect(prompt).toContain('toolMastery');
    expect(prompt).toContain('Tool Mastery');
    expect(prompt).toContain('critical');
  });

  it('includes affected member count and percentage', () => {
    const pattern = makePattern({ memberCount: 3, totalDevs: 5, affectedMembers: ['alice', 'bob', 'carol'] });
    const prompt = buildTeamPatternAnalysisUserPrompt([pattern], 5);
    // 3/5 = 60%
    expect(prompt).toContain('3 of 5');
    expect(prompt).toContain('60%');
    expect(prompt).toContain('alice');
  });

  it('shows existing member-level tags as context', () => {
    const pattern = makePattern({ categoryTags: ['error-handling', 'express', 'middleware'] });
    const prompt = buildTeamPatternAnalysisUserPrompt([pattern], 5);
    // Should expose existing tags as "member-level context"
    expect(prompt).toContain('Member-level tags');
    expect(prompt).toContain('error-handling');
    expect(prompt).toContain('express');
  });

  it('instructs LLM to generate NEW team-level category tags', () => {
    const prompt = buildTeamPatternAnalysisUserPrompt([makePattern()], 5);
    expect(prompt).toContain('NEW team-level category tags');
  });

  it('includes sample individual recommendation as context', () => {
    const pattern = makePattern({ sampleRecommendation: 'Use try-catch in all async handlers.' });
    const prompt = buildTeamPatternAnalysisUserPrompt([pattern], 5);
    expect(prompt).toContain('Use try-catch in all async handlers.');
  });

  it('handles multiple patterns with sequential numbering', () => {
    const p1 = makePattern({ title: 'Pattern A' });
    const p2 = makePattern({ title: 'Pattern B' });
    const prompt = buildTeamPatternAnalysisUserPrompt([p1, p2], 4);
    expect(prompt).toContain('Pattern 1:');
    expect(prompt).toContain('Pattern 2:');
    expect(prompt).toContain('Pattern A');
    expect(prompt).toContain('Pattern B');
  });

  it('handles empty patterns array gracefully', () => {
    const prompt = buildTeamPatternAnalysisUserPrompt([], 5);
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(0);
  });

  it('shows (none) when pattern has no existing tags', () => {
    const pattern = makePattern({ categoryTags: [] });
    const prompt = buildTeamPatternAnalysisUserPrompt([pattern], 5);
    expect(prompt).toContain('(none)');
  });
});

// ---------------------------------------------------------------------------
// TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT quality assertions
// ---------------------------------------------------------------------------

describe('TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT', () => {
  it('instructs the LLM to generate team-level category tags', () => {
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('category tag');
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('team-level');
  });

  it('specifies that tags must be freeform (not constrained to taxonomy)', () => {
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toMatch(/freeform|not constrained/i);
  });

  it('specifies tag count range of 2-5', () => {
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('2-5');
  });

  it('specifies actionable recommendation requirements', () => {
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('actionable');
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('workshop');
  });

  it('specifies urgency assignment rules', () => {
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('immediate');
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('this-sprint');
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('next-sprint');
  });

  it('instructs the LLM to NOT copy individual developer tags', () => {
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toMatch(/NOT copy|not just.*individual|genuinely team/i);
  });

  it('references the generate_team_pattern_analysis tool by name', () => {
    expect(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT).toContain('generate_team_pattern_analysis');
  });
});

// ---------------------------------------------------------------------------
// TEAM_PATTERN_ANALYSIS_TOOL schema shape
// ---------------------------------------------------------------------------

describe('TEAM_PATTERN_ANALYSIS_TOOL', () => {
  it('has the correct tool name', () => {
    expect(TEAM_PATTERN_ANALYSIS_TOOL.name).toBe('generate_team_pattern_analysis');
  });

  it('requires patternAnalyses at root level', () => {
    const schema = TEAM_PATTERN_ANALYSIS_TOOL.input_schema as {
      properties: Record<string, unknown>;
      required: string[];
    };
    expect(schema.required).toContain('patternAnalyses');
    expect('patternAnalyses' in schema.properties).toBe(true);
  });

  it('includes teamCategoryTags in the item schema', () => {
    const schema = TEAM_PATTERN_ANALYSIS_TOOL.input_schema as {
      properties: {
        patternAnalyses: {
          items: {
            properties: Record<string, unknown>;
            required: string[];
          };
        };
      };
    };
    const itemProps = schema.properties.patternAnalyses.items.properties;
    expect('teamCategoryTags' in itemProps).toBe(true);
    expect('patternTitle' in itemProps).toBe(true);
    expect('urgency' in itemProps).toBe(true);
    expect('action' in itemProps).toBe(true);
    expect('rationale' in itemProps).toBe(true);
    expect('severity' in itemProps).toBe(true);
  });

  it('requires both patternTitle and teamCategoryTags in each item', () => {
    const schema = TEAM_PATTERN_ANALYSIS_TOOL.input_schema as {
      properties: {
        patternAnalyses: {
          items: {
            required: string[];
          };
        };
      };
    };
    const required = schema.properties.patternAnalyses.items.required;
    expect(required).toContain('patternTitle');
    expect(required).toContain('teamCategoryTags');
    expect(required).toContain('urgency');
    expect(required).toContain('action');
  });
});

// ---------------------------------------------------------------------------
// generateLLMTeamPatternAnalysis — API call + parsing
// ---------------------------------------------------------------------------

describe('generateLLMTeamPatternAnalysis', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('throws when ANTHROPIC_API_KEY is missing', async () => {
    const patterns = [makePattern()];
    await expect(
      generateLLMTeamPatternAnalysis(patterns, 5, { apiKey: '' }),
    ).rejects.toThrow('ANTHROPIC_API_KEY is required');
  });

  it('returns empty result for empty patterns array', async () => {
    const result = await generateLLMTeamPatternAnalysis([], 5, { apiKey: 'test-key' });
    expect(result.patternCategoryTags).toEqual({});
    expect(result.recommendations).toEqual([]);
  });

  it('returns empty result when totalMembers is 0', async () => {
    const result = await generateLLMTeamPatternAnalysis([makePattern()], 0, { apiKey: 'test-key' });
    expect(result.patternCategoryTags).toEqual({});
    expect(result.recommendations).toEqual([]);
  });

  it('calls Anthropic with the generate_team_pattern_analysis tool', async () => {
    const pattern = makePattern();
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: pattern.title,
        teamCategoryTags: ['backend-error-resilience', 'api-validation-gap'],
        urgency: 'this-sprint',
        action: 'Schedule TypeScript error handling workshop.',
        rationale: '3 of 5 developers (60%) exhibit "Late Error Handling" — high severity in thinkingQuality.',
        domain: 'thinkingQuality',
        domainLabel: 'Thinking Quality',
        affectedMembers: ['alice', 'bob', 'carol'],
        severity: 'high',
      }]),
    );

    await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });

    expect(mockCreate).toHaveBeenCalledOnce();
    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.tool_choice).toEqual({ type: 'tool', name: 'generate_team_pattern_analysis' });
    expect(callArgs.tools[0].name).toBe('generate_team_pattern_analysis');
  });

  it('uses the TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT', async () => {
    const pattern = makePattern();
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: pattern.title,
        teamCategoryTags: ['backend-error-resilience'],
        urgency: 'this-sprint',
        action: 'Run workshop.',
        rationale: 'Rationale.',
        domain: 'thinkingQuality',
        domainLabel: 'Thinking Quality',
        affectedMembers: ['alice'],
        severity: 'high',
      }]),
    );

    await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.system).toBe(TEAM_PATTERN_ANALYSIS_SYSTEM_PROMPT);
  });

  it('extracts patternCategoryTags keyed by pattern title', async () => {
    const pattern = makePattern({ title: 'Late Error Handling' });
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: 'Late Error Handling',
        teamCategoryTags: ['backend-error-resilience', 'api-validation-gap', 'production-risk'],
        urgency: 'this-sprint',
        action: 'Schedule workshop.',
        rationale: 'Rationale.',
        domain: 'thinkingQuality',
        domainLabel: 'Thinking Quality',
        affectedMembers: ['alice', 'bob'],
        severity: 'high',
      }]),
    );

    const result = await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });

    expect(result.patternCategoryTags['Late Error Handling']).toEqual([
      'backend-error-resilience',
      'api-validation-gap',
      'production-risk',
    ]);
  });

  it('lowercases and trims tag strings', async () => {
    const pattern = makePattern();
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: pattern.title,
        teamCategoryTags: ['Backend-Error-Resilience', '  API VALIDATION  ', 'production-risk'],
        urgency: 'this-sprint',
        action: 'Schedule workshop.',
        rationale: 'Rationale.',
        domain: 'thinkingQuality',
        domainLabel: 'Thinking Quality',
        affectedMembers: ['alice'],
        severity: 'high',
      }]),
    );

    const result = await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });

    const tags = result.patternCategoryTags[pattern.title];
    expect(tags).toBeDefined();
    // All tags should be lowercased
    for (const tag of tags) {
      expect(tag).toBe(tag.toLowerCase());
    }
  });

  it('enforces max 5 tags per pattern', async () => {
    const pattern = makePattern();
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: pattern.title,
        teamCategoryTags: ['tag1', 'tag2', 'tag3', 'tag4', 'tag5', 'tag6', 'tag7'],
        urgency: 'this-sprint',
        action: 'Schedule workshop.',
        rationale: 'Rationale.',
        domain: 'thinkingQuality',
        domainLabel: 'Thinking Quality',
        affectedMembers: ['alice'],
        severity: 'high',
      }]),
    );

    const result = await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });

    const tags = result.patternCategoryTags[pattern.title];
    expect(tags.length).toBeLessThanOrEqual(5);
  });

  it('produces recommendations with correct TeamActionItem shape', async () => {
    const pattern = makePattern({ title: 'Late Error Handling' });
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: 'Late Error Handling',
        teamCategoryTags: ['backend-error-resilience'],
        urgency: 'this-sprint',
        action: 'Schedule TypeScript error boundary workshop.',
        rationale: '3 of 5 developers (60%) exhibit "Late Error Handling" — high severity in thinkingQuality.',
        domain: 'thinkingQuality',
        domainLabel: 'Thinking Quality',
        affectedMembers: ['alice', 'bob', 'carol'],
        severity: 'high',
      }]),
    );

    const result = await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });

    expect(result.recommendations).toHaveLength(1);
    const rec = result.recommendations[0];
    expect(rec.priority).toBe(1);
    expect(rec.urgency).toBe('this-sprint');
    expect(rec.action).toBe('Schedule TypeScript error boundary workshop.');
    expect(rec.pattern).toBe('Late Error Handling');
    expect(rec.domain).toBe('thinkingQuality');
    expect(rec.domainLabel).toBe('Thinking Quality');
    expect(rec.affectedMembers).toEqual(['alice', 'bob', 'carol']);
    expect(rec.severity).toBe('high');
  });

  it('assigns sequential priority numbers starting from 1', async () => {
    const p1 = makePattern({ title: 'Pattern A' });
    const p2 = makePattern({ title: 'Pattern B' });
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        {
          patternTitle: 'Pattern A',
          teamCategoryTags: ['tag-a'],
          urgency: 'immediate',
          action: 'Action A.',
          rationale: 'Rationale A.',
          domain: 'toolMastery',
          domainLabel: 'Tool Mastery',
          affectedMembers: ['alice', 'bob', 'carol'],
          severity: 'critical',
        },
        {
          patternTitle: 'Pattern B',
          teamCategoryTags: ['tag-b'],
          urgency: 'next-sprint',
          action: 'Action B.',
          rationale: 'Rationale B.',
          domain: 'sessionCraft',
          domainLabel: 'Session Craft',
          affectedMembers: ['alice'],
          severity: 'low',
        },
      ]),
    );

    const result = await generateLLMTeamPatternAnalysis([p1, p2], 5, { apiKey: 'test-key' });

    const priorities = result.recommendations.map(r => r.priority);
    expect(priorities[0]).toBe(1);
    expect(priorities[1]).toBe(2);
  });

  it('sorts recommendations by urgency rank (immediate > this-sprint > next-sprint)', async () => {
    const p1 = makePattern({ title: 'Pattern A' });
    const p2 = makePattern({ title: 'Pattern B' });
    // LLM returns next-sprint first, then immediate — should be re-sorted
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        {
          patternTitle: 'Pattern A',
          teamCategoryTags: ['tag-a'],
          urgency: 'next-sprint',
          action: 'Action A.',
          rationale: 'Rationale A.',
          domain: 'toolMastery',
          domainLabel: 'Tool Mastery',
          affectedMembers: ['alice'],
          severity: 'low',
        },
        {
          patternTitle: 'Pattern B',
          teamCategoryTags: ['tag-b'],
          urgency: 'immediate',
          action: 'Action B.',
          rationale: 'Rationale B.',
          domain: 'sessionCraft',
          domainLabel: 'Session Craft',
          affectedMembers: ['alice', 'bob', 'carol'],
          severity: 'critical',
        },
      ]),
    );

    const result = await generateLLMTeamPatternAnalysis([p1, p2], 5, { apiKey: 'test-key' });

    // immediate should be priority 1
    expect(result.recommendations[0].urgency).toBe('immediate');
    expect(result.recommendations[0].pattern).toBe('Pattern B');
    expect(result.recommendations[1].urgency).toBe('next-sprint');
    expect(result.recommendations[1].pattern).toBe('Pattern A');
  });

  it('caps recommendations at 7 items', async () => {
    const patterns = Array.from({ length: 10 }, (_, i) => makePattern({ title: `Pattern ${i}` }));
    const analyses = patterns.map((p, i) => ({
      patternTitle: p.title,
      teamCategoryTags: ['tag'],
      urgency: 'next-sprint' as const,
      action: `Action ${i}.`,
      rationale: `Rationale ${i}.`,
      domain: 'toolMastery',
      domainLabel: 'Tool Mastery',
      affectedMembers: ['alice'],
      severity: 'low' as const,
    }));
    mockCreate.mockResolvedValueOnce(makeToolUseResponse(analyses));

    const result = await generateLLMTeamPatternAnalysis(patterns, 10, { apiKey: 'test-key' });

    expect(result.recommendations.length).toBeLessThanOrEqual(7);
  });

  it('handles multiple patterns and returns tags for each', async () => {
    const p1 = makePattern({ title: 'Error Handling Gap' });
    const p2 = makePattern({ title: 'Missing Test Coverage', domain: 'toolMastery', domainLabel: 'Tool Mastery' });
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        {
          patternTitle: 'Error Handling Gap',
          teamCategoryTags: ['backend-resilience', 'api-error-patterns'],
          urgency: 'this-sprint',
          action: 'Workshop on error handling.',
          rationale: 'Rationale.',
          domain: 'thinkingQuality',
          domainLabel: 'Thinking Quality',
          affectedMembers: ['alice', 'bob', 'carol'],
          severity: 'high',
        },
        {
          patternTitle: 'Missing Test Coverage',
          teamCategoryTags: ['test-coverage-deficit', 'ci-risk'],
          urgency: 'next-sprint',
          action: 'Add coverage gates.',
          rationale: 'Rationale.',
          domain: 'toolMastery',
          domainLabel: 'Tool Mastery',
          affectedMembers: ['alice', 'carol'],
          severity: 'medium',
        },
      ]),
    );

    const result = await generateLLMTeamPatternAnalysis([p1, p2], 5, { apiKey: 'test-key' });

    expect(result.patternCategoryTags['Error Handling Gap']).toEqual(['backend-resilience', 'api-error-patterns']);
    expect(result.patternCategoryTags['Missing Test Coverage']).toEqual(['test-coverage-deficit', 'ci-risk']);
    expect(result.recommendations).toHaveLength(2);
  });

  it('throws when LLM response does not contain a tool_use block', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: 'text', text: 'Here are my recommendations...' }],
      stop_reason: 'end_turn',
    });

    const pattern = makePattern();
    await expect(
      generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' }),
    ).rejects.toThrow('LLM response did not contain a tool_use block');
  });

  it('throws when tool output is missing the patternAnalyses array', async () => {
    mockCreate.mockResolvedValueOnce({
      content: [
        {
          type: 'tool_use',
          name: 'generate_team_pattern_analysis',
          input: { wrongField: [] },
        },
      ],
      stop_reason: 'tool_use',
    });

    const pattern = makePattern();
    await expect(
      generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' }),
    ).rejects.toThrow('tool output missing "patternAnalyses" array');
  });

  it('silently skips malformed analysis entries missing required fields', async () => {
    const pattern = makePattern({ title: 'Good Pattern' });
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([
        // Malformed — missing required fields
        { patternTitle: 'Good Pattern' /* missing teamCategoryTags, urgency, etc. */ },
        // Valid entry
        {
          patternTitle: 'Good Pattern',
          teamCategoryTags: ['valid-tag'],
          urgency: 'next-sprint',
          action: 'Valid action.',
          rationale: 'Valid rationale.',
          domain: 'toolMastery',
          domainLabel: 'Tool Mastery',
          affectedMembers: ['alice'],
          severity: 'low',
        },
      ]),
    );

    // Should not throw — malformed entry is filtered out
    const result = await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });
    expect(result.recommendations).toHaveLength(1);
    expect(result.recommendations[0].pattern).toBe('Good Pattern');
  });

  it('uses the configured model from config', async () => {
    const pattern = makePattern();
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: pattern.title,
        teamCategoryTags: ['tag'],
        urgency: 'next-sprint',
        action: 'Action.',
        rationale: 'Rationale.',
        domain: 'toolMastery',
        domainLabel: 'Tool Mastery',
        affectedMembers: ['alice'],
        severity: 'low',
      }]),
    );

    await generateLLMTeamPatternAnalysis([pattern], 5, {
      apiKey: 'test-key',
      model: 'claude-opus-4-5',
    });

    const callArgs = mockCreate.mock.calls[0][0];
    expect(callArgs.model).toBe('claude-opus-4-5');
  });

  it('omits pattern from patternCategoryTags if LLM returns empty tags array', async () => {
    const pattern = makePattern({ title: 'Pattern A' });
    mockCreate.mockResolvedValueOnce(
      makeToolUseResponse([{
        patternTitle: 'Pattern A',
        teamCategoryTags: [], // empty — should not be stored
        urgency: 'next-sprint',
        action: 'Action.',
        rationale: 'Rationale.',
        domain: 'toolMastery',
        domainLabel: 'Tool Mastery',
        affectedMembers: ['alice'],
        severity: 'low',
      }]),
    );

    const result = await generateLLMTeamPatternAnalysis([pattern], 5, { apiKey: 'test-key' });

    // Empty tags → pattern not added to the map
    expect('Pattern A' in result.patternCategoryTags).toBe(false);
    // Recommendation still included
    expect(result.recommendations).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// TeamPatternAnalysisResult type shape (compile-time contract)
// ---------------------------------------------------------------------------

describe('TeamPatternAnalysisResult interface contract', () => {
  it('result from empty patterns has correct shape', async () => {
    const result: TeamPatternAnalysisResult = await generateLLMTeamPatternAnalysis([], 0, { apiKey: 'test-key' });
    expect(typeof result.patternCategoryTags).toBe('object');
    expect(Array.isArray(result.recommendations)).toBe(true);
  });
});
