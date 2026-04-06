/**
 * Growth Area Quality Validation Checker Tests
 *
 * Validates the automated quality-validation checker that scores each growth
 * area against the 4-criteria rubric and flags the four original problems:
 *   1. Generic areas     — dressed-up generic advice
 *   2. Isolated quotes   — single quote without pattern context
 *   3. Arbitrary scores  — severity not justified by evidence
 *   4. Missing patterns  — no behavioral pattern described
 *
 * Tests cover:
 *   - Individual criterion scoring functions (0-1 continuous scores)
 *   - Problem detection/flagging functions
 *   - Full validateGrowthAreaQuality() integration
 *   - Batch validation with summary statistics
 *   - Edge cases and boundary conditions
 *
 * @module tests/unit/plugin/growth-area-quality-checker
 */

import { describe, expect, it } from 'vitest';
import {
  validateGrowthAreaQuality,
  validateGrowthAreaBatch,
  scoreDistinctMoments,
  scoreVerifiableAction,
  scorePatternSpecificity,
  scoreToolFileNaming,
  flagGenericArea,
  flagIsolatedQuotes,
  flagArbitraryScores,
  flagMissingPatterns,
  detectGenericTitle,
  detectGenericDescription,
  detectBehavioralMarkers,
  analyzeEvidenceIsolation,
  validateSeverityJustification,
  hasSessionLogSpecificity,
} from '../../../packages/shared/src/validation/growth-area-quality-checker.js';
import type {
  GrowthAreaPEALLMOutput,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';

// ============================================================================
// Test Helpers
// ============================================================================

/**
 * Create a fully valid PEA LLM output that passes all criteria.
 * Override specific fields to test individual criteria failures.
 */
function makeValidPEA(overrides: Partial<GrowthAreaPEALLMOutput> = {}): GrowthAreaPEALLMOutput {
  return {
    pattern: {
      title: 'Untested Error Handling in Express Middleware Routes',
      description:
        'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware ' +
        'without creating corresponding test cases. The error paths in middleware/auth.ts and ' +
        'middleware/stripe.ts are never exercised by tests. This leaves undetected bugs in ' +
        'production error flows that could silently drop payment events.',
      severity: 'high',
      toolsFilesApis: ['Express.js', 'middleware/auth.ts', 'jest'],
      ...overrides.pattern,
    },
    evidence: overrides.evidence ?? [
      {
        utteranceId: 'sess_abc_5',
        sessionId: 'sess_abc',
        quote: 'Let me just add a try-catch here and move on to the next endpoint',
        context: 'Working on payment webhook handler in middleware/stripe.ts after 500 error',
        observation:
          'Added error handling without writing test for the error path — catch silently swallows validation error',
      },
      {
        utteranceId: 'sess_def_12',
        sessionId: 'sess_def',
        quote: 'The middleware is crashing but I am not sure which catch is wrong',
        context: 'Debugging auth middleware failure two days after initial implementation',
        observation:
          'Previous untested catch block masked the real error source — spent 20+ minutes debugging',
      },
      {
        utteranceId: 'sess_ghi_3',
        sessionId: 'sess_ghi',
        quote: 'I just need to wrap this in a try-catch and ship it before the deadline',
        context: 'Rushing to complete Stripe webhook integration before sprint demo',
        observation:
          'Third instance of adding catch blocks under time pressure without test coverage',
      },
    ],
    action: {
      instruction:
        'Before writing catch blocks in Express middleware, create a test file via Write for the error path using jest.spyOn on the failing service',
      verificationCheck:
        'Session log should show test file creation alongside error handling code with jest.spyOn patterns',
      goalRelevance:
        'Your Express API handles payment webhooks — untested error paths in middleware could silently drop Stripe events, causing revenue loss',
      ...overrides.action,
    },
    domain: overrides.domain ?? 'thinkingQuality',
    categoryTags: overrides.categoryTags ?? ['error-handling', 'test-coverage', 'express-middleware'],
    lowConfidence: overrides.lowConfidence,
  };
}

/**
 * Create a growth area that fails all criteria (worst case).
 */
function makeGenericPEA(): GrowthAreaPEALLMOutput {
  return {
    pattern: {
      title: 'Improve Error Handling Practices',
      description: 'This developer has poor error handling.',
      severity: 'critical',
      toolsFilesApis: ['the tool'],
    },
    evidence: [
      {
        utteranceId: 'sess_abc_5',
        sessionId: 'sess_abc',
        quote: 'Bad error handling',
        context: 'Working on backend',
        observation: 'Bad',
      },
      {
        utteranceId: 'sess_abc_5', // Same utteranceId!
        sessionId: 'sess_abc',
        quote: 'More bad handling',
        context: 'Still on backend',
        observation: 'Still bad',
      },
    ],
    action: {
      instruction: 'Be more careful with error handling',
      verificationCheck: 'Check logs',
      goalRelevance: 'This will help you write better code',
    },
    domain: 'thinkingQuality',
    categoryTags: ['error-handling'],
  };
}

// ============================================================================
// detectGenericTitle
// ============================================================================

describe('detectGenericTitle', () => {
  it('detects "Improve X practices" template', () => {
    const matches = detectGenericTitle('Improve Error Handling Practices');
    expect(matches.length).toBeGreaterThan(0);
    expect(matches[0]).toContain('generic template');
  });

  it('detects "Better X would" template', () => {
    const matches = detectGenericTitle('Better planning would improve velocity');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('detects "Consider using X more" template', () => {
    const matches = detectGenericTitle('Consider using tests more often');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('does not flag specific titles', () => {
    expect(detectGenericTitle('Untested Error Handling in Express Middleware Routes')).toHaveLength(0);
    expect(detectGenericTitle('Skipping vitest After Prisma Schema Changes')).toHaveLength(0);
    expect(detectGenericTitle('Context Window Exhaustion from Unbounded Grep')).toHaveLength(0);
  });
});

// ============================================================================
// detectGenericDescription
// ============================================================================

describe('detectGenericDescription', () => {
  it('detects "this will help you write better code"', () => {
    const matches = detectGenericDescription('This will help you write better code overall.');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('detects "testing is important for software quality"', () => {
    const matches = detectGenericDescription('Testing is important for software quality in any project.');
    expect(matches.length).toBeGreaterThan(0);
  });

  it('does not flag specific descriptions', () => {
    const specific = 'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware without creating test cases.';
    expect(detectGenericDescription(specific)).toHaveLength(0);
  });
});

// ============================================================================
// detectBehavioralMarkers
// ============================================================================

describe('detectBehavioralMarkers', () => {
  it('finds quantification markers', () => {
    const result = detectBehavioralMarkers('In 4 of 6 sessions, this pattern occurs frequently.');
    expect(result.markerCount).toBeGreaterThanOrEqual(2);
    expect(result.hasBehavioralPattern).toBe(true);
  });

  it('finds behavioral verbs', () => {
    const result = detectBehavioralMarkers(
      'You consistently skip running vitest after Prisma changes. This is observed in multiple sessions.',
    );
    expect(result.markers).toEqual(expect.arrayContaining([expect.stringMatching(/consistently/i)]));
    expect(result.hasBehavioralPattern).toBe(true);
  });

  it('reports no markers for vague descriptions', () => {
    const result = detectBehavioralMarkers('This developer has poor error handling.');
    expect(result.markerCount).toBe(0);
    expect(result.hasBehavioralPattern).toBe(false);
  });

  it('requires 2+ markers for hasBehavioralPattern', () => {
    const result = detectBehavioralMarkers('You consistently do something.');
    expect(result.markerCount).toBe(1);
    expect(result.hasBehavioralPattern).toBe(false);
  });
});

// ============================================================================
// analyzeEvidenceIsolation
// ============================================================================

describe('analyzeEvidenceIsolation', () => {
  it('detects duplicate utteranceIds', () => {
    const result = analyzeEvidenceIsolation([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'A long enough quote here', observation: 'Detailed observation of specific behavior', context: 'context' },
      { utteranceId: 'a_1', sessionId: 'b', quote: 'Another long enough quote', observation: 'Another detailed observation of behavior', context: 'context' },
    ]);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('duplicate')]));
  });

  it('detects single-session evidence', () => {
    const result = analyzeEvidenceIsolation([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'A long enough quote here for testing', observation: 'Detailed observation of specific behavior', context: 'context' },
      { utteranceId: 'a_2', sessionId: 'a', quote: 'Another long enough quote here', observation: 'Another detailed observation of behavior', context: 'context' },
    ]);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('single session')]));
  });

  it('detects short quotes', () => {
    const result = analyzeEvidenceIsolation([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'Short', observation: 'Detailed observation of specific behavior', context: 'context' },
      { utteranceId: 'b_1', sessionId: 'b', quote: 'Also short', observation: 'Another detailed observation of behavior', context: 'context' },
    ]);
    expect(result.reasons).toEqual(expect.arrayContaining([expect.stringContaining('under 20 chars')]));
  });

  it('reports not isolated for good cross-session evidence', () => {
    const result = analyzeEvidenceIsolation([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'Let me just add a try-catch here and move on', observation: 'Skipped test for error path in express middleware handler', context: 'Working on payment handler' },
      { utteranceId: 'b_2', sessionId: 'b', quote: 'The middleware crashes but I do not know which catch is wrong', observation: 'Previous untested catch block masked the real error source', context: 'Debugging auth failure' },
    ]);
    expect(result.isolated).toBe(false);
  });
});

// ============================================================================
// validateSeverityJustification
// ============================================================================

describe('validateSeverityJustification', () => {
  it('rejects critical with only 2 moments', () => {
    const result = validateSeverityJustification('critical', 2, 2);
    expect(result.justified).toBe(false);
    expect(result.reason).toContain('3 evidence moments');
  });

  it('accepts critical with 3+ moments from 2+ sessions', () => {
    const result = validateSeverityJustification('critical', 3, 2);
    expect(result.justified).toBe(true);
  });

  it('rejects high with single session', () => {
    const result = validateSeverityJustification('high', 3, 1);
    expect(result.justified).toBe(false);
    expect(result.reason).toContain('2 sessions');
  });

  it('accepts high with 2+ moments from 2+ sessions', () => {
    const result = validateSeverityJustification('high', 2, 2);
    expect(result.justified).toBe(true);
  });

  it('accepts medium with 2 moments from 1 session', () => {
    const result = validateSeverityJustification('medium', 2, 1);
    expect(result.justified).toBe(true);
  });

  it('accepts low with minimal evidence', () => {
    const result = validateSeverityJustification('low', 2, 1);
    expect(result.justified).toBe(true);
  });

  it('rejects unknown severity levels', () => {
    const result = validateSeverityJustification('extreme', 10, 10);
    expect(result.justified).toBe(false);
    expect(result.reason).toContain('Unknown severity');
  });
});

// ============================================================================
// scoreDistinctMoments
// ============================================================================

describe('scoreDistinctMoments', () => {
  it('scores high for rich cross-session evidence', () => {
    const result = scoreDistinctMoments([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'Let me just add a try-catch here and move on to the next endpoint', observation: 'Added error handling without writing test for the error path', context: 'Working on payment webhook handler' },
      { utteranceId: 'b_2', sessionId: 'b', quote: 'The middleware is crashing but I am not sure which catch is wrong', observation: 'Previous untested catch block masked the real error source', context: 'Debugging auth failure' },
      { utteranceId: 'c_3', sessionId: 'c', quote: 'I just need to wrap this in a try-catch and ship it before the deadline', observation: 'Third instance of adding catch blocks under time pressure', context: 'Sprint demo preparation' },
      { utteranceId: 'd_4', sessionId: 'd', quote: 'Why is the webhook failing silently with no logs at all', observation: 'Silent failure caused by empty catch block from previous session', context: 'Production debugging session' },
    ]);
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
    expect(result.signals.length).toBeGreaterThan(0);
  });

  it('scores 0 for invalid evidence (less than 2 distinct)', () => {
    const result = scoreDistinctMoments([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'Just one quote here', observation: 'Single observation', context: 'Only context' },
    ]);
    expect(result.pass).toBe(false);
    expect(result.score).toBe(0);
  });

  it('scores lower for single-session evidence', () => {
    const singleSession = scoreDistinctMoments([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'First quote from session A that is long enough', observation: 'First observation that is detailed enough', context: 'Context for first moment' },
      { utteranceId: 'a_2', sessionId: 'a', quote: 'Second quote from session A that is long enough', observation: 'Second observation that is detailed enough', context: 'Context for second moment' },
    ]);
    const crossSession = scoreDistinctMoments([
      { utteranceId: 'a_1', sessionId: 'a', quote: 'First quote from session A that is long enough', observation: 'First observation that is detailed enough', context: 'Context for first moment' },
      { utteranceId: 'b_1', sessionId: 'b', quote: 'Quote from session B that is long enough too', observation: 'Different session observation that adds evidence', context: 'Context for cross-session moment' },
    ]);
    expect(crossSession.score).toBeGreaterThan(singleSession.score);
  });
});

// ============================================================================
// hasSessionLogSpecificity (AC 3 — checkable against future session logs)
// ============================================================================

describe('hasSessionLogSpecificity', () => {
  // AC 3: "checkable against future session logs" means verificationCheck
  // must describe how to find evidence in JSONL session log artifacts.

  it('detects "session log contains" phrasing', () => {
    expect(hasSessionLogSpecificity('Session log contains Glob tool_use blocks before Bash calls.')).toBe(true);
    expect(hasSessionLogSpecificity('Session log should show a /plan command in the first 3 messages.')).toBe(true);
  });

  it('detects "tool_use block" references', () => {
    expect(hasSessionLogSpecificity('A Grep tool_use block appears before any Bash tool_use block.')).toBe(true);
  });

  it('detects "in the session log" phrasing', () => {
    expect(hasSessionLogSpecificity('Look for a TodoWrite call in the session log before the first Edit.')).toBe(true);
  });

  it('detects "appears in the session" phrasing', () => {
    expect(hasSessionLogSpecificity('Zod schema definition appears in the same file as route handlers.')).toBe(false);
    expect(hasSessionLogSpecificity('/plan command appears within the first 3 messages of the session.')).toBe(true);
  });

  it('detects "first N messages" structural references', () => {
    expect(hasSessionLogSpecificity('First 3 messages contain /plan invocation or TodoWrite tool_use.')).toBe(true);
  });

  it('detects "early in the session" phrasing', () => {
    expect(hasSessionLogSpecificity('Grep or Glob tool_use blocks appear early in the session.')).toBe(true);
  });

  it('does NOT flag generic tool mentions that are not session-log-specific', () => {
    // "Glob is used" — mentions tool but no session log artifact reference
    expect(hasSessionLogSpecificity('The developer uses Glob instead of Bash grep.')).toBe(false);
    // Just mentioning a tool name is not session-log-specific
    expect(hasSessionLogSpecificity('Run vitest to validate changes.')).toBe(false);
  });

  it('detects "visible in session logs" phrasing', () => {
    expect(hasSessionLogSpecificity('The behavior should be visible in session logs as Bash tool_use invocations.')).toBe(true);
  });

  it('detects JSONL reference', () => {
    expect(hasSessionLogSpecificity('Check the JSONL session file for TodoWrite calls at session start.')).toBe(true);
  });
});

// ============================================================================
// scoreVerifiableAction
// ============================================================================

describe('scoreVerifiableAction', () => {
  it('scores high for concrete, tool-referencing actions', () => {
    const result = scoreVerifiableAction({
      instruction: 'Before writing catch blocks in Express middleware, create a test file via Write for the error path using jest.spyOn on the failing service',
      verificationCheck: 'Session log should show test file creation alongside error handling code with jest.spyOn patterns',
      goalRelevance: 'Your Express API handles payment webhooks — untested error paths in middleware could silently drop Stripe events',
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.8);
  });

  it('scores higher when verificationCheck explicitly references session log artifacts (AC 3 bonus)', () => {
    // With session-log-specific check
    const withSessionLogRef = scoreVerifiableAction({
      instruction: 'In your next session, use Glob for file discovery and Grep for content search instead of Bash grep.',
      verificationCheck: 'Session log contains Glob or Grep tool_use blocks before any Bash tool_use blocks that use find/grep.',
      goalRelevance: 'Your monorepo has 200+ TypeScript files — Bash grep takes 3-5 tool_use turns while Grep returns results in one.',
    });

    // Without session-log-specific check (just mentions tool)
    const withoutSessionLogRef = scoreVerifiableAction({
      instruction: 'In your next session, use Glob for file discovery and Grep for content search instead of Bash grep.',
      verificationCheck: 'Glob and Grep should be used more instead of Bash grep for file discovery.',
      goalRelevance: 'Your monorepo has 200+ TypeScript files — Bash grep takes 3-5 tool_use turns while Grep returns results in one.',
    });

    // Both should pass (both reference observable signals)
    expect(withSessionLogRef.pass).toBe(true);
    expect(withoutSessionLogRef.pass).toBe(true);

    // Session-log-specific check should score at least as high (AC 3 specificity bonus)
    // Both may hit the 1.0 ceiling when all other signals are strong
    expect(withSessionLogRef.score).toBeGreaterThanOrEqual(withoutSessionLogRef.score);
    expect(withSessionLogRef.signals).toEqual(expect.arrayContaining([
      expect.stringContaining('session-log artifacts'),
    ]));
  });

  it('scores 0 for vague non-verifiable actions', () => {
    const result = scoreVerifiableAction({
      instruction: 'Be more careful with error handling',
      verificationCheck: 'Check logs',
      goalRelevance: 'Better code',
    });
    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(0.4);
  });

  it('fails when no observable signals in action', () => {
    const result = scoreVerifiableAction({
      instruction: 'Think about your approach more carefully before starting any implementation work on the project',
      verificationCheck: 'The developer should take a more thoughtful approach to their work',
      goalRelevance: 'Planning ahead will help you write better code and avoid rework that slows down the project',
    });
    expect(result.pass).toBe(false);
    expect(result.deficiencies).toEqual(expect.arrayContaining([
      expect.stringContaining('No observable session-log signal'),
    ]));
  });

  it('adds deficiency hint when verificationCheck lacks session-log specificity', () => {
    // Passes the hard gate (mentions tool name) but lacks session-log-artifact reference
    const result = scoreVerifiableAction({
      instruction: 'Use /plan before starting any multi-file feature implementation task.',
      verificationCheck: 'The developer should use /plan more often.',
      goalRelevance: 'Your SaaS platform ships weekly — unplanned features miss edge cases causing trial conversion drops.',
    });
    // Passes because /plan is an observable slash command signal
    expect(result.pass).toBe(true);
    // But should flag that verificationCheck could be more specific about session logs
    const hasSessionLogHint = result.deficiencies.some(d => d.includes('session-log artifacts') || d.includes('JSONL'));
    expect(hasSessionLogHint).toBe(true);
  });
});

// ============================================================================
// scorePatternSpecificity
// ============================================================================

describe('scorePatternSpecificity', () => {
  it('scores high for specific behavioral patterns', () => {
    const result = scorePatternSpecificity({
      title: 'Untested Error Handling in Express Middleware Routes',
      description:
        'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware ' +
        'without creating corresponding test cases. The error paths in middleware/auth.ts and ' +
        'middleware/stripe.ts are never exercised by tests. This leaves undetected bugs in ' +
        'production error flows.',
      toolsFilesApis: ['Express.js', 'middleware/auth.ts', 'jest'],
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBeGreaterThanOrEqual(0.7);
  });

  it('scores low for generic advice patterns', () => {
    const result = scorePatternSpecificity({
      title: 'Improve Error Handling Practices',
      description: 'This developer has poor error handling across sessions.',
      toolsFilesApis: ['the tool'],
    });
    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(0.3);
  });

  it('detects generic title as deficiency', () => {
    const result = scorePatternSpecificity({
      title: 'Improve Testing Habits',
      description:
        'In 3 of 5 sessions, you skip running vitest after making changes to the Prisma schema. ' +
        'This pattern leaves schema drift undetected until deployment.',
      toolsFilesApis: ['vitest', 'Prisma'],
    });
    // Description is specific, but title is generic
    expect(result.deficiencies).toEqual(expect.arrayContaining([
      expect.stringContaining('generic template'),
    ]));
  });
});

// ============================================================================
// scoreToolFileNaming
// ============================================================================

describe('scoreToolFileNaming', () => {
  it('scores 1.0 for tools in title, description, and entries', () => {
    const result = scoreToolFileNaming({
      title: 'Skipping vitest After Prisma Schema Changes',
      description:
        'In 3 of 5 sessions, the developer runs Prisma migrate dev but skips running vitest afterward.',
      toolsFilesApis: ['vitest', 'Prisma'],
    });
    expect(result.pass).toBe(true);
    expect(result.score).toBeCloseTo(1.0, 5);
  });

  it('fails with only vague tool entries', () => {
    const result = scoreToolFileNaming({
      title: 'Error Handling Issues',
      description: 'The developer has poor error handling across sessions.',
      toolsFilesApis: ['the tool', 'some API'],
    });
    expect(result.pass).toBe(false);
    expect(result.score).toBeLessThan(0.3);
  });

  it('passes when title has tool reference even with minimal entries', () => {
    const result = scoreToolFileNaming({
      title: 'Context Exhaustion from Unbounded Grep',
      description:
        'The developer uses Grep searches that target the root directory instead of scoping to specific modules.',
      toolsFilesApis: ['Grep'],
    });
    expect(result.pass).toBe(true);
  });
});

// ============================================================================
// flagGenericArea
// ============================================================================

describe('flagGenericArea', () => {
  it('flags growth areas with generic title and no behavioral markers', () => {
    const dummyScore = { score: 0.2, pass: false, signals: [], deficiencies: [] };
    const result = flagGenericArea(
      {
        title: 'Improve Error Handling Practices',
        description: 'This developer has poor error handling.',
        toolsFilesApis: ['the tool'],
      },
      dummyScore,
    );
    expect(result.detected).toBe(true);
    expect(result.severity).toBe('critical');
    expect(result.suggestion).toContain('Replace generic title');
  });

  it('does not flag specific growth areas', () => {
    const goodScore = { score: 0.8, pass: true, signals: ['specific'], deficiencies: [] };
    const result = flagGenericArea(
      {
        title: 'Untested Error Handling in Express Middleware Routes',
        description:
          'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware without tests.',
        toolsFilesApis: ['Express.js', 'jest'],
      },
      goodScore,
    );
    expect(result.detected).toBe(false);
  });
});

// ============================================================================
// flagIsolatedQuotes
// ============================================================================

describe('flagIsolatedQuotes', () => {
  it('flags evidence with duplicate utteranceIds', () => {
    const dummyScore = { score: 0.3, pass: false, signals: [], deficiencies: [] };
    const result = flagIsolatedQuotes(
      [
        { utteranceId: 'a_1', sessionId: 'a', quote: 'Bad error handling code', observation: 'Bad', context: 'Backend' },
        { utteranceId: 'a_1', sessionId: 'a', quote: 'More bad handling again', observation: 'Still bad', context: 'Backend' },
      ],
      dummyScore,
    );
    expect(result.detected).toBe(true);
    expect(result.severity).toBe('critical');
  });

  it('does not flag well-formed cross-session evidence', () => {
    const goodScore = { score: 0.8, pass: true, signals: ['good'], deficiencies: [] };
    const result = flagIsolatedQuotes(
      [
        { utteranceId: 'a_1', sessionId: 'a', quote: 'Let me just add a try-catch here and move on to the next', observation: 'Added error handling without test for the error path', context: 'Working on payment handler' },
        { utteranceId: 'b_2', sessionId: 'b', quote: 'The middleware is crashing but I am not sure which catch', observation: 'Previous untested catch block masked the real error source', context: 'Debugging auth failure' },
      ],
      goodScore,
    );
    expect(result.detected).toBe(false);
  });
});

// ============================================================================
// flagArbitraryScores
// ============================================================================

describe('flagArbitraryScores', () => {
  it('flags critical severity with only 2 moments', () => {
    const result = flagArbitraryScores('critical', [
      { utteranceId: 'a_1', sessionId: 'a' },
      { utteranceId: 'b_1', sessionId: 'b' },
    ]);
    expect(result.detected).toBe(true);
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.stringContaining('Critical severity with minimal evidence'),
    ]));
  });

  it('flags high severity with single session', () => {
    const result = flagArbitraryScores('high', [
      { utteranceId: 'a_1', sessionId: 'a' },
      { utteranceId: 'a_2', sessionId: 'a' },
    ]);
    expect(result.detected).toBe(true);
    expect(result.evidence).toEqual(expect.arrayContaining([
      expect.stringContaining('high severity but evidence from only 1 session'),
    ]));
  });

  it('does not flag well-justified severity', () => {
    const result = flagArbitraryScores('high', [
      { utteranceId: 'a_1', sessionId: 'a' },
      { utteranceId: 'b_1', sessionId: 'b' },
      { utteranceId: 'c_1', sessionId: 'c' },
    ]);
    expect(result.detected).toBe(false);
  });

  it('does not flag low/medium severity with minimal evidence', () => {
    const result = flagArbitraryScores('medium', [
      { utteranceId: 'a_1', sessionId: 'a' },
      { utteranceId: 'a_2', sessionId: 'a' },
    ]);
    expect(result.detected).toBe(false);
  });
});

// ============================================================================
// flagMissingPatterns
// ============================================================================

describe('flagMissingPatterns', () => {
  it('flags descriptions with no behavioral markers and short observations', () => {
    const result = flagMissingPatterns(
      {
        title: 'Error Issues',
        description: 'This developer has poor error handling.',
      },
      [
        { observation: 'Bad' },
        { observation: 'Still bad' },
      ],
    );
    expect(result.detected).toBe(true);
    expect(result.evidence.length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag well-formed behavioral patterns', () => {
    const result = flagMissingPatterns(
      {
        title: 'Untested Error Handling in Express Middleware',
        description:
          'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware without tests. ' +
          'The error paths in middleware/auth.ts are never exercised by tests.',
      },
      [
        { observation: 'Added error handling without writing test for the error path in Express middleware' },
        { observation: 'Previous untested catch block masked the real error source during debugging' },
      ],
    );
    expect(result.detected).toBe(false);
  });
});

// ============================================================================
// validateGrowthAreaQuality — Full Integration
// ============================================================================

describe('validateGrowthAreaQuality', () => {
  describe('passing growth areas', () => {
    it('passes a well-formed PEA growth area', () => {
      const pea = makeValidPEA();
      const result = validateGrowthAreaQuality(pea);
      expect(result.passes).toBe(true);
      expect(result.overallScore).toBeGreaterThanOrEqual(0.7);
      expect(result.rubric.distinctMoments).toBe(true);
      expect(result.rubric.verifiableAction).toBe(true);
      expect(result.rubric.patternSpecificity).toBe(true);
      expect(result.rubric.toolFileNaming).toBe(true);
    });

    it('provides positive signals for passing criteria', () => {
      const pea = makeValidPEA();
      const result = validateGrowthAreaQuality(pea);
      expect(result.criteria.distinctMoments.signals.length).toBeGreaterThan(0);
      expect(result.criteria.verifiableAction.signals.length).toBeGreaterThan(0);
      expect(result.criteria.patternSpecificity.signals.length).toBeGreaterThan(0);
      expect(result.criteria.toolFileNaming.signals.length).toBeGreaterThan(0);
    });

    it('generates a diagnostic summary', () => {
      const pea = makeValidPEA();
      const result = validateGrowthAreaQuality(pea);
      expect(result.summary).toContain('PASS');
      expect(result.summary).toContain('Untested Error Handling');
    });
  });

  describe('failing growth areas', () => {
    it('fails a fully generic growth area on all criteria', () => {
      const pea = makeGenericPEA();
      const result = validateGrowthAreaQuality(pea);
      expect(result.passes).toBe(false);
      expect(result.overallScore).toBeLessThan(0.3);
    });

    it('detects all four problems in a poorly-formed growth area', () => {
      const pea = makeGenericPEA();
      const result = validateGrowthAreaQuality(pea);
      expect(result.problems.genericArea.detected).toBe(true);
      expect(result.problems.isolatedQuotes.detected).toBe(true);
      expect(result.problems.arbitraryScores.detected).toBe(true);
      expect(result.problems.missingPatterns.detected).toBe(true);
    });

    it('includes diagnostic summary with FAIL', () => {
      const pea = makeGenericPEA();
      const result = validateGrowthAreaQuality(pea);
      expect(result.summary).toContain('FAIL');
    });
  });

  describe('partial failures', () => {
    it('fails when only distinct_moments criterion fails', () => {
      const pea = makeValidPEA({
        evidence: [
          {
            utteranceId: 'a_1',
            sessionId: 'a',
            quote: 'Only one evidence moment which is not enough for a pattern',
            context: 'Working on the project in a single session',
            observation: 'Single observation is not sufficient to establish a recurring pattern',
          },
        ],
      });
      const result = validateGrowthAreaQuality(pea);
      expect(result.passes).toBe(false);
      expect(result.criteria.distinctMoments.pass).toBe(false);
      // Other criteria should still pass
      expect(result.criteria.toolFileNaming.pass).toBe(true);
    });

    it('fails when only verifiable_action criterion fails', () => {
      const pea = makeValidPEA({
        action: {
          instruction: 'Think more carefully about your approach to error handling in your projects',
          verificationCheck: 'Developer thinks more carefully about their approach to errors and handling',
          goalRelevance: 'Better error handling reduces bugs and improves code quality for the long term',
        },
      });
      const result = validateGrowthAreaQuality(pea);
      expect(result.passes).toBe(false);
      expect(result.criteria.verifiableAction.pass).toBe(false);
      expect(result.criteria.distinctMoments.pass).toBe(true);
    });

    it('fails when critical problem detected even if all criteria pass', () => {
      // Critical severity with only 2 moments but from 2 sessions
      const pea = makeValidPEA({
        pattern: {
          title: 'Untested Error Handling in Express Middleware Routes',
          description:
            'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware ' +
            'without creating corresponding test cases. The error paths in middleware/auth.ts and ' +
            'middleware/stripe.ts are never exercised by tests.',
          severity: 'critical',
          toolsFilesApis: ['Express.js', 'jest'],
        },
        evidence: [
          {
            utteranceId: 'a_1',
            sessionId: 'a',
            quote: 'Let me just add a try-catch here and move on to the next endpoint',
            context: 'Working on payment webhook handler in middleware/stripe.ts',
            observation: 'Added error handling without writing test for the error path',
          },
          {
            utteranceId: 'b_1',
            sessionId: 'b',
            quote: 'The middleware is crashing but I am not sure which catch is wrong',
            context: 'Debugging auth middleware failure two days later',
            observation: 'Previous untested catch block masked the real error source',
          },
        ],
      });
      const result = validateGrowthAreaQuality(pea);
      // Critical severity with only 2 moments should flag arbitrary_scores as critical
      expect(result.problems.arbitraryScores.detected).toBe(true);
      expect(result.passes).toBe(false);
    });
  });

  describe('backward compatibility', () => {
    it('rubric field matches existing QualityRubric format', () => {
      const pea = makeValidPEA();
      const result = validateGrowthAreaQuality(pea);
      expect(result.rubric).toEqual({
        distinctMoments: expect.any(Boolean),
        verifiableAction: expect.any(Boolean),
        patternSpecificity: expect.any(Boolean),
        toolFileNaming: expect.any(Boolean),
      });
    });
  });
});

// ============================================================================
// validateGrowthAreaBatch
// ============================================================================

describe('validateGrowthAreaBatch', () => {
  it('validates a batch of growth areas', () => {
    const batch = [makeValidPEA(), makeGenericPEA()];
    const result = validateGrowthAreaBatch(batch);
    expect(result.results).toHaveLength(2);
    expect(result.passing).toHaveLength(1);
    expect(result.failing).toHaveLength(1);
    expect(result.summary.total).toBe(2);
    expect(result.summary.passRate).toBe(0.5);
  });

  it('reports problem frequency across the batch', () => {
    const batch = [makeGenericPEA(), makeGenericPEA()];
    const result = validateGrowthAreaBatch(batch);
    expect(result.summary.problemFrequency.genericArea).toBe(2);
    expect(result.summary.problemFrequency.isolatedQuotes).toBe(2);
    expect(result.summary.problemFrequency.arbitraryScores).toBe(2);
  });

  it('handles empty batch', () => {
    const result = validateGrowthAreaBatch([]);
    expect(result.results).toHaveLength(0);
    expect(result.summary.total).toBe(0);
    expect(result.summary.passRate).toBe(0);
    expect(result.summary.averageScore).toBe(0);
  });

  it('all-passing batch has 100% pass rate', () => {
    const batch = [makeValidPEA(), makeValidPEA(), makeValidPEA()];
    const result = validateGrowthAreaBatch(batch);
    expect(result.summary.passRate).toBe(1);
    expect(result.summary.failing).toBe(0);
  });

  it('computes meaningful average score', () => {
    const batch = [makeValidPEA(), makeGenericPEA()];
    const result = validateGrowthAreaBatch(batch);
    expect(result.summary.averageScore).toBeGreaterThan(0.2);
    expect(result.summary.averageScore).toBeLessThan(0.8);
  });
});

// ============================================================================
// Edge Cases
// ============================================================================

describe('edge cases', () => {
  it('handles minimum-passing evidence (exactly 2 moments from 2 sessions)', () => {
    const pea = makeValidPEA({
      evidence: [
        {
          utteranceId: 'a_1',
          sessionId: 'a',
          quote: 'Let me just add a try-catch here and move on to the next endpoint',
          context: 'Working on payment webhook handler in middleware/stripe.ts',
          observation: 'Added error handling without writing test for the error path',
        },
        {
          utteranceId: 'b_1',
          sessionId: 'b',
          quote: 'The middleware is crashing but I am not sure which catch is wrong',
          context: 'Debugging auth middleware failure two days later in production',
          observation: 'Previous untested catch block masked the real error source',
        },
      ],
      pattern: {
        title: 'Untested Error Handling in Express Middleware Routes',
        description:
          'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware ' +
          'without creating corresponding test cases. The error paths in middleware/auth.ts and ' +
          'middleware/stripe.ts are never exercised by tests.',
        severity: 'medium', // Downgraded from high — matches evidence weight
        toolsFilesApis: ['Express.js', 'middleware/auth.ts', 'jest'],
      },
    });
    const result = validateGrowthAreaQuality(pea);
    expect(result.criteria.distinctMoments.pass).toBe(true);
  });

  it('handles very long descriptions', () => {
    const longDescription = 'In 5 of 7 sessions, you consistently use Grep without path constraints. '.repeat(10);
    const pea = makeValidPEA({
      pattern: {
        title: 'Context Exhaustion from Unbounded Grep Searches',
        description: longDescription,
        severity: 'high',
        toolsFilesApis: ['Grep', 'src/lib/'],
      },
    });
    const result = validateGrowthAreaQuality(pea);
    expect(result.criteria.patternSpecificity.pass).toBe(true);
  });

  it('handles growth area with many category tags', () => {
    const pea = makeValidPEA({
      categoryTags: ['error-handling', 'test-coverage', 'express', 'middleware', 'jest'],
    });
    const result = validateGrowthAreaQuality(pea);
    expect(result.passes).toBe(true);
  });
});
