/**
 * Evidence Distinctness Validation Tests
 *
 * Validates the minimum evidence threshold enforcement that ensures
 * growth areas contain at least 2 distinct evidence moments before
 * being accepted or stored.
 *
 * Tests cover:
 * 1. validateDistinctEvidence() — core validation helper
 * 2. evaluateQualityRubric() — distinctMoments criterion integration
 * 3. processLLMOutputToPEA() — end-to-end rejection of sparse evidence
 * 4. save-domain-results validateContentQuality() — storage-time gate
 *
 * @module tests/unit/plugin/evidence-distinctness-validation
 */

import { describe, expect, it } from 'vitest';
import {
  validateDistinctEvidence,
  evaluateQualityRubric,
  processLLMOutputToPEA,
  type GrowthAreaPEALLMOutput,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';

// ============================================================================
// Helpers
// ============================================================================

function makeValidPEAOutput(overrides: Partial<GrowthAreaPEALLMOutput> = {}): GrowthAreaPEALLMOutput {
  return {
    pattern: {
      title: 'Untested Error Handling in Express Middleware Routes',
      description: 'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware without creating corresponding test cases. The error paths in middleware/auth.ts and middleware/stripe.ts are never exercised by tests.',
      severity: 'high',
      toolsFilesApis: ['Express.js', 'middleware/auth.ts', 'jest'],
      ...overrides.pattern,
    },
    evidence: overrides.evidence ?? [
      {
        utteranceId: 'sess_abc_5',
        sessionId: 'sess_abc',
        quote: 'Let me just add a try-catch here and move on to the next endpoint',
        context: 'Working on payment webhook handler in middleware/stripe.ts',
        observation: 'Added error handling without writing test for the error path',
      },
      {
        utteranceId: 'sess_def_12',
        sessionId: 'sess_def',
        quote: 'The middleware is crashing but I am not sure which catch is wrong',
        context: 'Debugging auth middleware failure in production-like environment',
        observation: 'Previous untested catch block masked the real error source',
      },
    ],
    action: {
      instruction: 'Before writing catch blocks in Express middleware, create a test file via Write for the error path using jest.spyOn on the failing service',
      verificationCheck: 'Session log should show test file creation alongside error handling code with jest.spyOn patterns',
      goalRelevance: 'Your Express API handles payment webhooks and untested error paths could silently drop critical events',
      ...overrides.action,
    },
    domain: overrides.domain ?? 'thinkingQuality',
    categoryTags: overrides.categoryTags ?? ['error-handling', 'test-coverage', 'express-middleware'],
    lowConfidence: overrides.lowConfidence,
  };
}

// ============================================================================
// validateDistinctEvidence() — core validation helper
// ============================================================================

describe('validateDistinctEvidence', () => {
  describe('rejects insufficient evidence', () => {
    it('rejects empty evidence array', () => {
      const result = validateDistinctEvidence([]);
      expect(result.valid).toBe(false);
      expect(result.lowConfidence).toBe(true);
      expect(result.distinctUtteranceCount).toBe(0);
      expect(result.reason).toContain('at least 2');
    });

    it('rejects single evidence moment', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.lowConfidence).toBe(true);
      expect(result.distinctUtteranceCount).toBe(1);
      expect(result.reason).toContain('at least 2');
    });

    it('rejects duplicate utteranceIds (same moment cited twice)', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.lowConfidence).toBe(true);
      expect(result.distinctUtteranceCount).toBe(1);
      expect(result.reason).toContain('distinct utterance');
    });

    it('rejects 3 moments all with the same utteranceId', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_abc_5', sessionId: 'sess_def' },
        { utteranceId: 'sess_abc_5', sessionId: 'sess_ghi' },
      ]);
      expect(result.valid).toBe(false);
      expect(result.distinctUtteranceCount).toBe(1);
    });
  });

  describe('accepts valid evidence', () => {
    it('accepts 2 moments from different sessions', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_def_12', sessionId: 'sess_def' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.distinctUtteranceCount).toBe(2);
      expect(result.distinctSessionCount).toBe(2);
    });

    it('accepts 3+ moments from multiple sessions', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_def_12', sessionId: 'sess_def' },
        { utteranceId: 'sess_ghi_3', sessionId: 'sess_ghi' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.lowConfidence).toBe(false);
      expect(result.distinctSessionCount).toBe(3);
    });

    it('accepts 2 distinct moments from the same session (valid but lowConfidence)', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_abc_12', sessionId: 'sess_abc' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.lowConfidence).toBe(true);
      expect(result.distinctUtteranceCount).toBe(2);
      expect(result.distinctSessionCount).toBe(1);
      expect(result.reason).toContain('same session');
    });
  });

  describe('lowConfidence flag', () => {
    it('flags lowConfidence when exactly 2 moments (minimum threshold)', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_def_12', sessionId: 'sess_def' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.lowConfidence).toBe(true); // At minimum threshold
    });

    it('clears lowConfidence with 3+ moments from 2+ sessions', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_def_12', sessionId: 'sess_def' },
        { utteranceId: 'sess_ghi_3', sessionId: 'sess_ghi' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.lowConfidence).toBe(false);
    });

    it('flags lowConfidence for 3 moments all from same session', () => {
      const result = validateDistinctEvidence([
        { utteranceId: 'sess_abc_1', sessionId: 'sess_abc' },
        { utteranceId: 'sess_abc_5', sessionId: 'sess_abc' },
        { utteranceId: 'sess_abc_12', sessionId: 'sess_abc' },
      ]);
      expect(result.valid).toBe(true);
      expect(result.lowConfidence).toBe(true);
    });
  });
});

// ============================================================================
// evaluateQualityRubric() — distinctMoments criterion
// ============================================================================

describe('evaluateQualityRubric — distinctMoments criterion', () => {
  it('passes distinctMoments with 2 moments from different sessions', () => {
    const pea = makeValidPEAOutput();
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.distinctMoments).toBe(true);
  });

  it('fails distinctMoments when evidence has duplicate utteranceIds', () => {
    const pea = makeValidPEAOutput({
      evidence: [
        {
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me just add a try-catch here and move on to the next endpoint',
          context: 'Working on payment webhook handler in middleware/stripe.ts',
          observation: 'Added error handling without writing test for the error path',
        },
        {
          utteranceId: 'sess_abc_5', // Same utteranceId = same moment!
          sessionId: 'sess_abc',
          quote: 'Let me just add a try-catch here and move on to the next endpoint',
          context: 'Working on payment webhook handler (duplicate reference)',
          observation: 'Same moment cited again — not a distinct observation',
        },
      ],
    });
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.distinctMoments).toBe(false);
  });

  it('passes distinctMoments with 2 moments from the same session but different utterances', () => {
    const pea = makeValidPEAOutput({
      evidence: [
        {
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me just add a try-catch here and move on',
          context: 'Working on payment webhook handler',
          observation: 'Added error handling without test',
        },
        {
          utteranceId: 'sess_abc_12',
          sessionId: 'sess_abc',
          quote: 'I think we can skip the test for now and fix it later',
          context: 'Later in the same session, skipping test again',
          observation: 'Repeated pattern of skipping tests within same session',
        },
      ],
    });
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.distinctMoments).toBe(true);
  });
});

// ============================================================================
// processLLMOutputToPEA() — end-to-end rejection & lowConfidence
// ============================================================================

describe('processLLMOutputToPEA — evidence validation integration', () => {
  it('accepts growth areas with 2+ distinct evidence moments', () => {
    const pea = makeValidPEAOutput();
    const result = processLLMOutputToPEA(pea);
    expect(result).not.toBeNull();
  });

  it('rejects growth areas where evidence has duplicate utteranceIds', () => {
    const pea = makeValidPEAOutput({
      evidence: [
        {
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me just add a try-catch here and move on to the next endpoint',
          context: 'Working on payment webhook handler in middleware/stripe.ts',
          observation: 'Added error handling without writing test for the error path',
        },
        {
          utteranceId: 'sess_abc_5', // Duplicate!
          sessionId: 'sess_def',
          quote: 'Again skipping the test for the error handling code in the middleware',
          context: 'Different session but same utteranceId cited',
          observation: 'Duplicate utteranceId — not genuinely distinct evidence',
        },
      ],
    });
    const result = processLLMOutputToPEA(pea);
    expect(result).toBeNull(); // Rejected by distinct_moments rubric
  });

  it('sets lowConfidence when evidence is at minimum threshold (exactly 2)', () => {
    const pea = makeValidPEAOutput(); // Has exactly 2 evidence moments
    const result = processLLMOutputToPEA(pea);
    expect(result).not.toBeNull();
    expect(result!.lowConfidence).toBe(true); // At minimum = lowConfidence
  });

  it('clears lowConfidence with 3+ moments from different sessions', () => {
    const pea = makeValidPEAOutput({
      evidence: [
        {
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me just add a try-catch here and move on to the next endpoint',
          context: 'Working on payment webhook handler in middleware/stripe.ts',
          observation: 'Added error handling without writing test for the error path',
        },
        {
          utteranceId: 'sess_def_12',
          sessionId: 'sess_def',
          quote: 'The middleware is crashing but I am not sure which catch is wrong',
          context: 'Debugging auth middleware failure in production-like environment',
          observation: 'Previous untested catch block masked the real error source',
        },
        {
          utteranceId: 'sess_ghi_7',
          sessionId: 'sess_ghi',
          quote: 'Let me wrap this in try catch and move to the API integration',
          context: 'Setting up new API route without error path tests',
          observation: 'Third session showing same untested error handling pattern',
        },
      ],
    });
    const result = processLLMOutputToPEA(pea);
    expect(result).not.toBeNull();
    expect(result!.lowConfidence).toBeUndefined(); // 3 sessions = confident
  });

  it('sets lowConfidence when all moments are from the same session', () => {
    const pea = makeValidPEAOutput({
      evidence: [
        {
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me just add a try-catch here and move on to the next endpoint',
          context: 'Working on payment webhook handler in middleware/stripe.ts',
          observation: 'Added error handling without writing test',
        },
        {
          utteranceId: 'sess_abc_12',
          sessionId: 'sess_abc',
          quote: 'I think we can skip the test for now and fix it later',
          context: 'Later in same session, still skipping test for error path',
          observation: 'Pattern repeated in same session — single-session evidence',
        },
        {
          utteranceId: 'sess_abc_18',
          sessionId: 'sess_abc',
          quote: 'No time for tests, lets just deploy this error handler as is',
          context: 'End of session, skipping tests for third time',
          observation: 'Consistent avoidance of error path testing',
        },
      ],
    });
    const result = processLLMOutputToPEA(pea);
    expect(result).not.toBeNull();
    expect(result!.lowConfidence).toBe(true); // Same session = lowConfidence
  });
});

// ============================================================================
// validateEvidenceContentDistinctness() — Sub-AC 2c post-generation gate
// ============================================================================

import {
  validateEvidenceContentDistinctness,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';

/**
 * Minimum valid evidence moment (passes all three content checks).
 *
 * Default quotes are keyed by session prefix so that makeValidMoment() calls
 * from different sessions get distinct quotes. This prevents cross-session
 * repeated-content detection from firing when a test only overrides context
 * or observation (not quote) and uses multiple sessions.
 */
const SESSION_DEFAULT_QUOTES: Record<string, string> = {
  'sess_abc': 'Let me just add a try-catch here and move on to the next endpoint',
  'sess_def': 'The authentication flow requires reviewing the JWT token signature before proceeding',
  'sess_ghi': 'Need to update the Prisma migration script to add the new tenant_id foreign key',
  'sess_xyz': 'Debugging the Stripe webhook integration after the payment handler returned 500',
};

function makeValidMoment(overrides: Partial<{
  utteranceId: string;
  sessionId: string;
  quote: string;
  context: string;
  observation: string;
}> = {}) {
  const uid = overrides.utteranceId ?? 'sess_abc_5';
  // Derive session prefix (e.g. 'sess_abc' from 'sess_abc_5') for quote lookup
  const sessionPrefix = uid.replace(/_\d+$/, '');
  const defaultQuote = SESSION_DEFAULT_QUOTES[sessionPrefix]
    ?? `Resolved issue in session context for ${uid}`;

  return {
    utteranceId: uid,
    sessionId: overrides.sessionId ?? sessionPrefix,
    quote: overrides.quote ?? defaultQuote,
    context: overrides.context ?? 'In the payment-api project, after Read then Bash calls on middleware/stripe.ts',
    observation: overrides.observation ?? 'Wrapped failing Stripe handler in generic catch block without writing a jest test for the error path first',
  };
}

describe('validateEvidenceContentDistinctness', () => {

  // ── Valid evidence ──────────────────────────────────────────────────────────

  describe('accepts valid evidence', () => {
    it('accepts two distinct moments with concrete context and specific observations', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me just add a try-catch here and move on to the next endpoint',
          context: 'In the payment-api project, after Read then Bash calls on middleware/stripe.ts',
          observation: 'Wrapped failing Stripe handler in generic catch block without writing jest test for the error path',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_12',
          sessionId: 'sess_def',
          quote: 'The middleware is crashing but I am not sure which catch is wrong',
          context: 'Debugging auth middleware failure in Express app two sessions later',
          observation: 'Previous untested catch block in middleware/auth.ts masked the real error — developer lost 20 minutes tracing wrong catch',
        }),
      ]);
      expect(result.valid).toBe(true);
      expect(result.issues).toHaveLength(0);
      expect(result.repeatedContentCount).toBe(0);
      expect(result.genericContextCount).toBe(0);
      expect(result.weakObservationCount).toBe(0);
    });

    it('accepts evidence with project-name-like identifiers as context anchors', () => {
      // Context with hyphenated project name (not matched by tool patterns but valid anchor)
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          context: 'In the user-auth project while implementing the login flow',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          quote: 'I will skip tests for the session handler and come back later',
          context: 'Working on the session-manager module during the API integration sprint',
          observation: 'Skipped writing vitest cases for the session invalidation handler despite it being a critical auth path',
        }),
      ]);
      expect(result.valid).toBe(true);
      expect(result.genericContextCount).toBe(0);
    });

    it('accepts evidence with exactly similar quotes at just below the threshold', () => {
      // Cross-session threshold is 80% — these share ~50% overlap (several unrelated words)
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me add a try-catch here to handle the database error',
          context: 'In the payment-api project, editing src/db/connection.ts',
          observation: 'Added catch block around Prisma query without any error path test coverage',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          quote: 'I am going to skip the unit tests for the route handler since we are in a hurry',
          context: 'In the user-dashboard project, after Edit to src/routes/user.ts via npm run dev',
          observation: 'Explicitly skipped test writing to meet deadline — pattern of deferring test coverage under time pressure',
        }),
      ]);
      expect(result.valid).toBe(true);
      expect(result.repeatedContentCount).toBe(0);
    });

    it('accepts single-moment evidence array (below min for comparison — no repeated check)', () => {
      // With only 1 moment there is nothing to compare against, so no repeated-content issue
      const result = validateEvidenceContentDistinctness([
        makeValidMoment(),
      ]);
      // valid = false because majority check: 0 < ceil(1/2)=1... wait, all 3 counts are 0
      // so repeatedContentCount=0 (hard block = false), genericContextCount=0, weakObsCount=0
      // majority = ceil(1/2) = 1; genericContextCount(0) < 1 AND weakObsCount(0) < 1
      // valid = true
      expect(result.valid).toBe(true);
      expect(result.repeatedContentCount).toBe(0);
    });
  });

  // ── Repeated content detection ─────────────────────────────────────────────

  describe('rejects repeated content', () => {
    it('rejects near-identical quotes in the same session (>= 65% similarity)', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'let me just add a try catch here and move on to the endpoint',
          context: 'In the payment-api project, editing middleware/stripe.ts after Bash calls',
          observation: 'Added error handling catch block without writing a test for the error path first',
        }),
        makeValidMoment({
          utteranceId: 'sess_abc_8',
          sessionId: 'sess_abc',
          // Near-identical: only "just" removed, endpoint→handler, ~85% overlap
          quote: 'let me add a try catch here and move on to the handler',
          context: 'In the payment-api project, editing middleware/auth.ts after Read calls',
          observation: 'Repeated the same pattern of skipping error path tests while adding another catch block',
        }),
      ]);
      expect(result.valid).toBe(false);
      expect(result.repeatedContentCount).toBe(1);
      expect(result.issues.some(i => i.issueType === 'repeated_content')).toBe(true);
    });

    it('rejects near-identical quotes across sessions (>= 80% similarity)', () => {
      // Same quote text with only minor punctuation differences — different sessions
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'the middleware keeps crashing but i am not sure which catch block is wrong here',
          context: 'In the payment-api project, debugging Express middleware via npm test',
          observation: 'Lost 20+ minutes tracing wrong catch block because previous error handling was never tested',
        }),
        makeValidMoment({
          utteranceId: 'sess_xyz_3',
          sessionId: 'sess_xyz',
          // Cross-session, nearly identical quote — LLM re-used the same moment
          quote: 'the middleware keeps crashing but i am not sure which catch block is wrong',
          context: 'In the auth-service project, debugging Express middleware via Bash',
          observation: 'Same debugging pattern as before — untested catch block masking real error',
        }),
      ]);
      expect(result.valid).toBe(false);
      expect(result.repeatedContentCount).toBe(1);
      const repeatIssue = result.issues.find(i => i.issueType === 'repeated_content')!;
      expect(repeatIssue.similarToIndex).toBe(0);
      expect(repeatIssue.similarity).toBeGreaterThanOrEqual(0.8);
    });

    it('includes specific retry guidance in repeated-content error message', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          // Two very similar quotes in the same session (>= 65% similarity)
          quote: 'just add try catch here to handle the payment errors and move on',
        }),
        makeValidMoment({
          utteranceId: 'sess_abc_9',
          sessionId: 'sess_abc',
          quote: 'just add try catch here to handle the payment errors and continue',
        }),
      ]);
      const issue = result.issues.find(i => i.issueType === 'repeated_content');
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('word similarity');
      expect(issue!.message).toContain('utteranceId');
      expect(issue!.message).toContain('Fix');
    });

    it('reports correct momentIndex in repeated-content issue', () => {
      const result = validateEvidenceContentDistinctness([
        // Moments 0 and 1 are very similar same-session quotes (>= 65% similarity)
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'add try catch here to handle the authentication errors and move on quickly',
        }),
        makeValidMoment({
          utteranceId: 'sess_abc_8',
          sessionId: 'sess_abc',
          quote: 'add try catch here to handle the authentication errors and keep going quickly',
        }),
        // Moment 2 is genuinely distinct
        makeValidMoment({
          utteranceId: 'sess_def_3',
          sessionId: 'sess_def',
          quote: 'I skipped all tests because we were in a hurry during the deployment sprint',
        }),
      ]);
      const repeatIssue = result.issues.find(i => i.issueType === 'repeated_content');
      expect(repeatIssue).toBeDefined();
      expect(repeatIssue!.momentIndex).toBe(1);
      expect(repeatIssue!.similarToIndex).toBe(0);
    });
  });

  // ── Generic context detection ──────────────────────────────────────────────

  describe('flags generic context', () => {
    it('flags context with no concrete anchor (purely generic description)', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          context: 'working on a backend task',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          context: 'debugging an issue in the codebase',
        }),
      ]);
      expect(result.genericContextCount).toBe(2);
      expect(result.valid).toBe(false); // majority (2/2) have generic context
    });

    it('flags majority-generic context but allows a minority of weak contexts', () => {
      // 1 of 3 has a generic context — should not block (below majority threshold)
      // All quotes are deliberately unique to avoid false repeated-content triggers.
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          sessionId: 'sess_abc',
          quote: 'Let me add a try-catch around the Stripe webhook handler and move on',
          context: 'In the payment-api project, editing middleware/stripe.ts after Bash',
          observation: 'Added catch block around Stripe handler without writing a jest test for the error path',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          quote: 'I will skip tests for this route and come back to add them later today',
          context: 'working on some backend code', // generic context
          observation: 'Skipped writing test coverage for the route handler despite it handling critical payments',
        }),
        makeValidMoment({
          utteranceId: 'sess_ghi_3',
          sessionId: 'sess_ghi',
          quote: 'Wrap this database call in a quick error handler and keep moving forward',
          context: 'In the api-gateway project, after npm test failures on the route handler',
          observation: 'Added error handling around Prisma query without verifying the error path coverage in vitest',
        }),
      ]);
      expect(result.genericContextCount).toBe(1);
      expect(result.valid).toBe(true); // 1 of 3 = minority → not blocked
    });

    it('accepts context with tool name from toolCallsBefore', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          context: 'after Read then Edit calls, developer immediately added catch block',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          context: 'after running Bash for npm test, found failing test and skipped it',
        }),
      ]);
      expect(result.genericContextCount).toBe(0);
    });

    it('includes actionable fix guidance in generic-context error message', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          context: 'implementing a new feature',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          context: 'fixing a bug in the system',
        }),
      ]);
      const issue = result.issues.find(i => i.issueType === 'generic_context');
      expect(issue).toBeDefined();
      expect(issue!.message).toContain('projectName');
      expect(issue!.message).toContain('toolCallsBefore');
      expect(issue!.message).toContain('Fix');
    });
  });

  // ── Weak observation detection ─────────────────────────────────────────────

  describe('flags weak observations', () => {
    it('flags very short observations (< 25 chars)', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({ utteranceId: 'sess_abc_5', observation: 'bad error handling' }),
        makeValidMoment({ utteranceId: 'sess_def_8', sessionId: 'sess_def', observation: 'not testing' }),
      ]);
      expect(result.weakObservationCount).toBe(2);
      expect(result.valid).toBe(false);
    });

    it('flags generic label-type observations matching BANNED patterns', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({ utteranceId: 'sess_abc_5', observation: 'shows bad error handling.' }),
        makeValidMoment({ utteranceId: 'sess_def_8', sessionId: 'sess_def', observation: 'Needs improvement' }),
      ]);
      expect(result.weakObservationCount).toBe(2);
    });

    it('accepts specific observations naming tool and behavior', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          observation: 'Wrapped failing Stripe webhook handler in a generic catch block without creating a jest.spyOn test for the error path — catch silently swallows the validation error',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          observation: 'Called npm test twice on the same failing test without reading the error output between runs — retry without diagnosis pattern',
        }),
      ]);
      expect(result.weakObservationCount).toBe(0);
    });

    it('allows minority of weak observations (1 of 3 moments)', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          quote: 'Let me add a try-catch around the Stripe webhook handler and move on',
          observation: 'Wrapped Stripe webhook handler in catch block without writing a vitest test for the error path first',
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          quote: 'I will skip tests for this route handler and add them later today',
          observation: 'needs testing', // weak
        }),
        makeValidMoment({
          utteranceId: 'sess_ghi_3',
          sessionId: 'sess_ghi',
          quote: 'Wrap this database query in error handling and continue to the next endpoint',
          observation: 'Third session shows the same untested error handling in the Express middleware route handler — pattern is consistent across 3 sessions',
        }),
      ]);
      expect(result.weakObservationCount).toBe(1);
      expect(result.valid).toBe(true); // 1 of 3 = minority → not blocked
    });
  });

  // ── Combined issues ────────────────────────────────────────────────────────

  describe('combined issue detection', () => {
    it('reports multiple issue types on the same evidence array', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          context: 'working on something', // generic
          observation: 'bad code', // weak
        }),
        makeValidMoment({
          utteranceId: 'sess_def_8',
          sessionId: 'sess_def',
          context: 'in the payment-api project, editing middleware/stripe.ts',
          observation: 'Wrapped Stripe webhook in catch block without writing jest error-path test',
        }),
      ]);
      // moment 0 has both generic_context and weak_observation
      // moment 1 is clean
      expect(result.issues.length).toBeGreaterThan(0);
      const issuetypes = result.issues.map(i => i.issueType);
      expect(issuetypes).toContain('generic_context');
      expect(issuetypes).toContain('weak_observation');
    });

    it('hard-blocks on any repeated content regardless of other issue counts', () => {
      // Only 1 of 2 moments has repeated content, but that 1 is enough to block
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({
          utteranceId: 'sess_abc_5',
          quote: 'add try catch to handle the database errors here quickly',
          context: 'In the payment-api project, editing src/db/prisma.ts via Bash',
          observation: 'Added catch block around Prisma query without any test coverage for error paths',
        }),
        makeValidMoment({
          utteranceId: 'sess_abc_9',
          sessionId: 'sess_abc',
          // Near-identical to first quote (~85% overlap)
          quote: 'add a try catch to handle database errors here quickly',
          context: 'In the payment-api project, editing src/db/connection.ts after Read',
          observation: 'Repeated the same pattern of adding untested catch blocks around Prisma queries',
        }),
      ]);
      expect(result.repeatedContentCount).toBe(1);
      expect(result.valid).toBe(false); // Hard block on any repeated content
    });

    it('returns structured per-moment diagnostics for retry guidance', () => {
      const result = validateEvidenceContentDistinctness([
        makeValidMoment({ utteranceId: 'sess_abc_5', context: 'working on backend' }),
        makeValidMoment({ utteranceId: 'sess_def_8', sessionId: 'sess_def', context: 'debugging an issue' }),
      ]);
      for (const issue of result.issues) {
        expect(issue.momentIndex).toBeGreaterThanOrEqual(0);
        expect(issue.utteranceId).toBeTruthy();
        expect(issue.issueType).toMatch(/^(repeated_content|generic_context|weak_observation)$/);
        expect(issue.message).toBeTruthy();
        expect(issue.message.length).toBeGreaterThan(50);
      }
    });
  });
});
