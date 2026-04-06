import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resetConfig } from '../../../packages/plugin/lib/config.js';
import { closeResultsDb, createAnalysisRun, getDomainResult } from '../../../packages/plugin/lib/results-db.js';
import { execute } from '../../../packages/plugin/cli/commands/save-domain-results.js';

function makeLongText(label: string, minimumLength: number): string {
  return `${label} ${'x'.repeat(minimumLength)}`;
}

/**
 * Valid base fixtures reused across verifiable-action quality gate tests.
 *
 * These represent a completely valid communicationPatterns domain result
 * that passes all quality gates. Individual tests override just the
 * verifiableAction field to exercise specific failure modes.
 */
function makeValidStrengths() {
  return [
    {
      title: 'Explicit workflow composition with Bash',
      description: makeLongText(
        'The developer routinely uses Bash to compose discrete steps with npm and git commands, building a verifiable execution order before committing. This creates reproducible workflows that are easy to debug.',
        220,
      ),
      evidence: [
        {
          utteranceId: 'session-1_0',
          quote: 'Run npm test then git commit only if all tests pass.',
          context: 'verifiable workflow',
        },
        {
          utteranceId: 'session-1_1',
          quote: 'Use vitest --coverage before any PR to ensure branch coverage.',
          context: 'coverage enforcement',
        },
      ],
    },
  ];
}

function makeValidData() {
  return {
    _dimensionSource: 'toolMastery',
    communicationPatterns: [
      {
        patternName: 'Explicit Acceptance Criteria Definition',
        category: 'tool_usage',
        description: 'The developer encodes concrete completion markers before execution starts.',
        frequency: 'consistent',
        examples: ['When done, reply with exactly SEEDED.'],
      },
    ],
    signatureQuotes: [
      {
        utteranceId: 'session-1_0',
        text: 'Run npm test then git commit only if all tests pass.',
        behavioralMarker: 'workflow_composition',
        sessionId: 'session-1',
      },
    ],
  };
}

/**
 * Create a valid growth area with a customizable verifiableAction.
 * All other fields pass quality gates so tests can isolate action failures.
 */
function makeGrowthArea(verifiableActionOverride?: object | null) {
  const base = {
    title: 'Bash-Only File Search Instead of Glob/Grep Composition',
    description: makeLongText(
      'PATTERN: In 4 of 5 sessions, you consistently use Bash with find/grep instead of the Glob or Grep tools directly. You repeatedly run Bash commands like "find . -name *.ts" when Glob would return results with a single tool_use call. WHY IT MATTERS: This wastes context window and slows iteration since each Bash round-trip takes multiple turns. IMPACT: Switching to Glob and Grep composition would halve the number of tool_use blocks needed for file search, keeping sessions under context limits.',
      50,
    ),
    severity: 'medium',
    recommendation: makeLongText(
      'In your next session, replace all Bash find/grep combinations with Glob for file discovery and Grep for content search. These tools appear directly in session logs as tool_use blocks with pattern arguments, making adoption immediately verifiable.',
      80,
    ),
    evidence: [
      {
        utteranceId: 'session-2_3',
        quote: 'Let me just use bash to find all the TypeScript files in src/',
        context: 'file discovery via Bash instead of Glob',
        sessionId: 'session-2',
        behaviorDescription: 'Used Bash find instead of Glob tool_use',
      },
      {
        utteranceId: 'session-3_7',
        quote: 'grep -r "useState" src/ to find all React hooks usage',
        context: 'content search via Bash instead of Grep tool',
        sessionId: 'session-3',
        behaviorDescription: 'Used Bash grep instead of Grep tool_use',
      },
    ],
    goalRelevance: 'Your monorepo has 200+ TypeScript files — Bash grep searches take 3-5 tool_use turns while Grep returns results in one, directly reducing context exhaustion risk on complex refactoring sessions.',
  };

  if (verifiableActionOverride === null) {
    // Explicitly no verifiableAction (tests for missing gate)
    return base;
  }

  if (verifiableActionOverride !== undefined) {
    return { ...base, verifiableAction: verifiableActionOverride };
  }

  // Default: valid verifiableAction
  return {
    ...base,
    verifiableAction: {
      action: 'In your next session, replace any Bash find/grep commands with Glob tool for file discovery and Grep tool for content search — use them as first-choice tools before falling back to Bash.',
      checkDescription: 'Session log contains Glob or Grep tool_use blocks before or instead of Bash tool_use blocks with find/grep arguments.',
      toolOrPattern: 'Glob and Grep tools',
    },
  };
}

describe('save_domain_results tool', () => {
  const originalHome = process.env.HOME;
  let homeDir = '';

  beforeEach(() => {
    homeDir = mkdtempSync(join(tmpdir(), 'betterprompt-save-domain-results-'));
    process.env.HOME = homeDir;
    resetConfig();
  });

  afterEach(() => {
    closeResultsDb();
    if (originalHome === undefined) delete process.env.HOME;
    else process.env.HOME = originalHome;
    resetConfig();
    if (homeDir) {
      rmSync(homeDir, { recursive: true, force: true });
    }
  });

  it('accepts stringified retry payloads from writer skills and persists the parsed result', async () => {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 1,
        totalMessages: 2,
        totalDeveloperUtterances: 1,
        totalAIResponses: 1,
        avgMessagesPerSession: 2,
        avgDeveloperMessageLength: 180,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: {
          earliest: '2026-03-25T01:48:51.124Z',
          latest: '2026-03-25T01:50:37.984Z',
        },
      },
      scores: {
        thinkingQuality: 80,
        communicationPatterns: 82,
        learningBehavior: 70,
        contextEfficiency: 76,
        sessionOutcome: 75,
        controlScore: 74,
      },
    });

    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    const strengths = [
      {
        title: 'Explicit workflow composition',
        description: makeLongText('The developer routinely composes discrete steps, acceptance checks, and scope boundaries into a single workflow request so the assistant can move with low ambiguity and a stable execution order.', 220),
        evidence: [
          {
            utteranceId: 'session-1_0',
            quote: 'Run bp analyze. Use the BetterPrompt analysis flow end to end.',
            context: 'analysis orchestration',
          },
          {
            utteranceId: 'session-1_1',
            quote: 'Analyze only the projects currently selected in BetterPrompt prefs.',
            context: 'project scoping',
          },
        ],
      },
    ];

    const growthAreas = [
      {
        title: 'Broaden tool repertoire',
        description: makeLongText('The current sessions show disciplined tool usage, but they cluster tightly around a small set of reads and MCP calls. That keeps execution clean, yet it leaves some leverage unused when the task could benefit from richer exploration, cross-checking, or automation depth before committing to a conclusion.', 180),
        severity: 'medium',
        recommendation: makeLongText('Add one explicit discovery pass before locking the implementation route, then choose the narrowest follow-up tool that resolves the remaining uncertainty. This preserves the current low-noise style while widening the evidence base behind later decisions and reducing the chance that an early assumption silently shapes the whole run.', 80),
        evidence: [
          {
            utteranceId: 'session-1_2',
            quote: 'Read README.md and give a short checklist for improving scripting consistency in this project.',
            context: 'single-tool read pattern',
          },
          {
            utteranceId: 'session-1_3',
            quote: 'Read README.md and propose three workflow improvements for a YouTube creator planning system.',
            context: 'single-tool read pattern',
          },
        ],
        verifiableAction: {
          action: 'In your next session, use Grep or Glob to search for existing patterns before opening any file with Read, building a cross-reference base before committing to a single approach.',
          checkDescription: 'Session log contains at least one Grep or Glob tool_use before the first Read tool_use in the session.',
          toolOrPattern: 'Grep, Glob tools',
        },
        goalRelevance: 'Your YouTube creator planning system has multiple script templates and workflow configs — relying only on Read misses cross-file patterns that Grep would catch, risking duplicate logic across your planning modules.',
      },
    ];

    const data = {
      _dimensionSource: 'toolMastery',
      communicationPatterns: [
        {
          patternName: 'Explicit Acceptance Criteria Definition',
          category: 'tool_usage',
          description: 'The developer encodes concrete completion markers before execution starts.',
          frequency: 'consistent',
          examples: ['When done, reply with exactly SEEDED.'],
        },
      ],
      signatureQuotes: [
        {
          utteranceId: 'session-1_0',
          text: 'Run bp analyze. Use the BetterPrompt analysis flow end to end.',
          behavioralMarker: 'workflow_composition',
          sessionId: 'session-1',
        },
      ],
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '82',
      confidenceScore: '0.78',
      strengths: JSON.stringify(strengths),
      growthAreas: JSON.stringify(growthAreas),
      data: JSON.stringify(data),
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.domain).toBe('communicationPatterns');
    expect(parsed.score).toBe(82);

    const saved = getDomainResult(runId, 'communicationPatterns');
    expect(saved?.overallScore).toBe(82);
    expect(saved?.confidenceScore).toBe(0.78);
    expect(saved?.strengths[0]?.title).toBe('Explicit workflow composition');
    expect(saved?.growthAreas[0]?.severity).toBe('medium');
    expect(saved?.data).toMatchObject({
      _dimensionSource: 'toolMastery',
      communicationPatterns: [
        {
          patternName: 'Explicit Acceptance Criteria Definition',
        },
      ],
    });
  });

  // ====================================================================
  // AC 3: Verifiable Next-Session Action Quality Gate
  //
  // Every growth area must include a verifiable next-session action that
  // is specific enough to check against future session logs (CRITICAL).
  //
  // The gate enforces:
  //   1. verifiableAction field is present (not undefined)
  //   2. action text is >= 50 chars (specific, not a vague one-liner)
  //   3. checkDescription is >= 30 chars (describes observable signal)
  //   4. Combined text references at least one observable session-log
  //      signal — tool names, CLI commands, file refs, slash commands, etc.
  //
  // Failures return quality_error so the LLM can fix and retry.
  // ====================================================================

  it('rejects growth area missing verifiableAction entirely', async () => {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2,
        totalMessages: 10,
        totalDeveloperUtterances: 5,
        totalAIResponses: 5,
        avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    // Growth area deliberately missing verifiableAction
    const growthAreaWithoutAction = makeGrowthArea(null);

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithoutAction]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    expect(parsed.issues).toBeDefined();
    const issue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('verifiableAction') && !i.field.includes('.action') && !i.field.includes('.checkDescription'),
    );
    expect(issue).toBeDefined();
    expect(issue.message).toContain('missing a verifiable next-session action');
  });

  it('rejects growth area with verifiableAction.action under 50 chars (Zod schema enforcement)', async () => {
    // NOTE: The VerifiableActionSchema has `action: z.string().min(50)` which Zod enforces
    // at step 1 (schema validation), before the quality gate runs at step 3.
    // Short actions are therefore caught with `validation_error`, not `quality_error`.
    // This test documents the two-layer defense: Zod catches structural violations first,
    // quality gate catches semantic violations (like missing observable signals).
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2,
        totalMessages: 10,
        totalDeveloperUtterances: 5,
        totalAIResponses: 5,
        avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    const growthAreaShortAction = makeGrowthArea({
      // action is only 30 chars — under the 50-char minimum enforced by VerifiableActionSchema
      action: 'Use Grep instead of Bash find.',
      checkDescription: 'Session log shows Grep tool_use blocks instead of Bash find commands.',
      toolOrPattern: 'Grep tool',
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaShortAction]),
      data: JSON.stringify(makeValidData()),
    }));

    // Zod schema validation catches short action before the quality gate
    expect(['validation_error', 'quality_error']).toContain(parsed.status);
    // Either Zod errors or quality issues must report a problem
    expect(parsed.errors ?? parsed.issues).toBeDefined();
  });

  it('rejects growth area with verifiableAction.checkDescription under 30 chars (Zod schema enforcement)', async () => {
    // NOTE: VerifiableActionSchema has `checkDescription: z.string().min(30)` — Zod enforces
    // this at step 1 before the quality gate. Short checkDescriptions → `validation_error`.
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2,
        totalMessages: 10,
        totalDeveloperUtterances: 5,
        totalAIResponses: 5,
        avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    const growthAreaShortCheck = makeGrowthArea({
      action: 'In your next session, use Glob tool for file discovery and Grep tool for content search before falling back to Bash.',
      // checkDescription is only 15 chars — under the 30-char minimum in VerifiableActionSchema
      checkDescription: 'Glob tool used.',
      toolOrPattern: 'Glob tool',
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaShortCheck]),
      data: JSON.stringify(makeValidData()),
    }));

    // Zod schema validation catches short checkDescription before the quality gate
    expect(['validation_error', 'quality_error']).toContain(parsed.status);
    expect(parsed.errors ?? parsed.issues).toBeDefined();
  });

  it('rejects growth area with no observable session-log signal in verifiableAction', async () => {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2,
        totalMessages: 10,
        totalDeveloperUtterances: 5,
        totalAIResponses: 5,
        avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    // Both action and checkDescription are long enough but contain NO observable signal
    // — no tool names, no commands, no file patterns, no slash commands
    const growthAreaVagueAction = makeGrowthArea({
      action: 'Think more carefully about your approach to file searching before starting any discovery work in your project codebase.',
      checkDescription: 'The developer should take a more thoughtful approach to searching and discovery tasks in their workflow.',
      toolOrPattern: undefined,
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaVagueAction]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const issue = parsed.issues.find((i: { field: string }) =>
      i.field === 'growthAreas[0].verifiableAction',
    );
    expect(issue).toBeDefined();
    expect(issue.message).toContain('observable session-log signal');
  });

  it('accepts growth area with concrete verifiable action referencing session-log signals', async () => {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2,
        totalMessages: 10,
        totalDeveloperUtterances: 5,
        totalAIResponses: 5,
        avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    // Default valid verifiableAction references Glob and Grep (tool names = observable signals)
    const validGrowthArea = makeGrowthArea();

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([validGrowthArea]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.growthAreaCount).toBe(1);
  });

  it('accepts verifiable action using slash commands as observable signals', async () => {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2,
        totalMessages: 10,
        totalDeveloperUtterances: 5,
        totalAIResponses: 5,
        avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    const growthAreaWithSlashCommand = makeGrowthArea({
      action: 'In your next session, use /plan in the first 3 messages to break down the task structure before writing any implementation code or file edits.',
      checkDescription: 'Session log contains /plan invocation or TodoWrite tool_use in the opening messages before any Edit or Bash tool calls.',
      toolOrPattern: '/plan command',
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithSlashCommand]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  it('accepts verifiable action using CLI commands (vitest, npm) as observable signals', async () => {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2,
        totalMessages: 10,
        totalDeveloperUtterances: 5,
        totalAIResponses: 5,
        avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120,
        questionRatio: 0,
        codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));

    const growthAreaWithCli = makeGrowthArea({
      action: 'After every Prisma schema migration in your next session, run vitest via Bash before committing with git to catch schema incompatibilities before they reach staging.',
      checkDescription: 'Session log shows Bash tool_use executing vitest after each Edit to a .prisma file, with npm or git commit following the test run.',
      toolOrPattern: 'vitest, git commit sequence',
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithCli]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  // ====================================================================
  // Sub-AC 2: PEA Quality Rubric Gate
  //
  // When a growth area includes the structured `pea` sub-object with
  // distinct Pattern, Evidence, and Action fields, the 4-criteria quality
  // rubric is enforced via evaluateQualityRubric().
  //
  // Tests cover:
  //   - Valid pea passes (status ok)
  //   - pea.evidence failing distinct_moments (duplicate utteranceIds)
  //   - pea.action failing verifiable_action (no observable signal)
  //   - pea.pattern failing tool_file_naming (vague toolsFilesApis)
  // ====================================================================

  function makeRunAndSetup(homeDir: string) {
    const runId = createAnalysisRun({
      metrics: {
        totalSessions: 2, totalMessages: 10, totalDeveloperUtterances: 5,
        totalAIResponses: 5, avgMessagesPerSession: 5,
        avgDeveloperMessageLength: 120, questionRatio: 0, codeBlockRatio: 0,
        dateRange: { earliest: '2026-03-25T00:00:00.000Z', latest: '2026-03-26T00:00:00.000Z' },
      },
      scores: { thinkingQuality: 70, communicationPatterns: 70, learningBehavior: 70, contextEfficiency: 70, sessionOutcome: 70, controlScore: 70 },
    });
    const dataDir = join(homeDir, '.betterprompt');
    mkdirSync(dataDir, { recursive: true });
    writeFileSync(join(dataDir, 'current-run-id.txt'), String(runId));
    return runId;
  }

  /** A fully valid PEA sub-object that passes all 4 rubric criteria */
  function makeValidPea() {
    return {
      pattern: {
        title: 'Bash-Only File Search Instead of Glob/Grep Composition',
        description: 'In 4 of 5 sessions, the developer invokes Bash with find/grep for file discovery instead of using the Glob tool directly. Each Bash find call requires multiple refinement turns vs. a single Glob tool_use. This pattern wastes context window and slows iteration cycles. WHY IT MATTERS: The monorepo has 200+ TypeScript files — Bash searches take 3+ tool turns while Glob returns results instantly.',
        severity: 'medium' as const,
        toolsFilesApis: ['Bash', 'Glob', 'Grep'],
      },
      evidence: [
        {
          utteranceId: 'session-2_3',
          sessionId: 'session-2',
          quote: 'Let me just use bash to find all the TypeScript files in src/',
          context: 'In the monorepo project, after a Bash call for npm install — searching for TypeScript files instead of using Glob',
          observation: 'Used Bash find instead of Glob tool_use, requiring multiple follow-up calls to refine the pattern',
        },
        {
          utteranceId: 'session-3_7',
          sessionId: 'session-3',
          quote: 'grep -r "useState" src/ to find all React hooks usage',
          context: 'In the react-dashboard project, after Edit tool calls on component files — content search via Bash instead of Grep',
          observation: 'Used Bash grep instead of Grep tool_use, spent 3 extra turns narrowing the search pattern',
        },
      ],
      action: {
        instruction: 'In your next session, use Glob tool for file discovery ("**/*.ts", "src/**/*.tsx") and Grep tool for content search before falling back to Bash. These tools appear directly as tool_use blocks in session logs.',
        verificationCheck: 'Session log contains Glob or Grep tool_use blocks before or instead of Bash tool_use blocks with find/grep arguments.',
        goalRelevance: 'Your monorepo has 200+ TypeScript files — Bash grep searches take 3-5 tool_use turns while Grep returns results in one, directly reducing context exhaustion risk on complex refactoring sessions.',
      },
    };
  }

  it('accepts growth area with valid pea sub-object — all 4 rubric criteria pass', async () => {
    makeRunAndSetup(homeDir);

    const growthArea = {
      ...makeGrowthArea(),
      categoryTags: ['tool-composition', 'bash-overuse', 'file-discovery'],
      pea: makeValidPea(),
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthArea]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.growthAreaCount).toBe(1);
  });

  it('rejects pea sub-object where evidence has duplicate utteranceIds (fails distinct_moments)', async () => {
    makeRunAndSetup(homeDir);

    const peaWithDuplicateEvidence = {
      ...makeValidPea(),
      evidence: [
        {
          utteranceId: 'session-2_3', // DUPLICATE — same utteranceId
          sessionId: 'session-2',
          quote: 'Let me just use bash to find all the TypeScript files in src/',
          context: 'In the monorepo project, after a Bash call for npm install',
          observation: 'Used Bash find instead of Glob tool_use',
        },
        {
          utteranceId: 'session-2_3', // DUPLICATE — same utteranceId
          sessionId: 'session-3',
          quote: 'grep -r "useState" src/ to find all React hooks usage',
          context: 'In the react-dashboard project, after Edit tool calls',
          observation: 'Used Bash grep instead of Grep tool_use',
        },
      ],
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([{ ...makeGrowthArea(), pea: peaWithDuplicateEvidence }]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const peaIssue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('pea.evidence'),
    );
    expect(peaIssue).toBeDefined();
    expect(peaIssue.message).toContain('distinct_moments');
  });

  it('rejects pea sub-object where action has no observable session-log signal (fails verifiable_action)', async () => {
    makeRunAndSetup(homeDir);

    const peaWithVagueAction = {
      ...makeValidPea(),
      action: {
        instruction: 'Be more thoughtful about how you search for files and consider using different approaches when looking for code patterns across your project codebase.',
        verificationCheck: 'The developer should demonstrate improved search behavior in future sessions by thinking more carefully before searching.',
        goalRelevance: 'Better search practices will improve your overall efficiency and reduce the time spent on file discovery tasks in your projects.',
      },
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([{ ...makeGrowthArea(), pea: peaWithVagueAction }]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const peaIssue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('pea.action'),
    );
    expect(peaIssue).toBeDefined();
    expect(peaIssue.message).toContain('verifiable_action');
  });

  it('rejects pea sub-object with generic toolsFilesApis entries (fails tool_file_naming)', async () => {
    makeRunAndSetup(homeDir);

    const peaWithGenericTools = {
      ...makeValidPea(),
      pattern: {
        ...makeValidPea().pattern,
        title: 'Generic Pattern Without Specific Tool Names',
        description: 'The developer uses a tool for file operations instead of using a more appropriate tool for the same purpose. This pattern occurs across multiple sessions and creates extra work. It shows a gap in tool knowledge that could be improved with practice.',
        toolsFilesApis: ['tool', 'api'], // GENERIC — should fail tool_file_naming
      },
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([{ ...makeGrowthArea(), pea: peaWithGenericTools }]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const peaIssue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('pea.pattern'),
    );
    expect(peaIssue).toBeDefined();
    expect(peaIssue.message).toContain('tool_file_naming');
  });

  // ====================================================================
  // AC 13: Category Tags Gate
  //
  // Every PEA growth area MUST carry at least 1 freeform LLM-generated
  // behavioral category tag for cross-developer clustering in team views.
  //
  // Tests cover:
  //   - Missing categoryTags on a PEA growth area → quality_error
  //   - All-generic categoryTags (e.g. ["general"]) → quality_error
  //   - Mixed tags (1 specific + 1 generic) → accepted (gate only fails on ALL-generic)
  //   - Pre-PEA growth area without pea sub-object → not affected (backward compat)
  // ====================================================================

  it('rejects pea growth area with missing categoryTags (AC 13 — behavioral category tags required)', async () => {
    makeRunAndSetup(homeDir);

    // Growth area has a valid pea sub-object but no categoryTags at all
    const growthAreaWithoutTags = {
      ...makeGrowthArea(),
      // categoryTags intentionally omitted
      pea: makeValidPea(),
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithoutTags]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const tagIssue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('categoryTags'),
    );
    expect(tagIssue).toBeDefined();
    expect(tagIssue.message).toContain('categoryTags');
    expect(tagIssue.message).toContain('PEA growth area');
  });

  it('rejects pea growth area where all categoryTags are generic placeholders (AC 13)', async () => {
    makeRunAndSetup(homeDir);

    // All tags are from GENERIC_CATEGORY_TAG_PLACEHOLDERS
    const growthAreaWithGenericTags = {
      ...makeGrowthArea(),
      categoryTags: ['general', 'tag-1', 'tag-2'],
      pea: makeValidPea(),
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithGenericTags]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const tagIssue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('categoryTags'),
    );
    expect(tagIssue).toBeDefined();
    expect(tagIssue.message).toContain('generic placeholders');
    expect(tagIssue.message).toContain('"general"');
  });

  it('accepts pea growth area with mixed tags (one specific + one generic passes AC 13 gate)', async () => {
    makeRunAndSetup(homeDir);

    // One specific tag + one generic tag — gate only fails on ALL-generic
    const growthAreaWithMixedTags = {
      ...makeGrowthArea(),
      categoryTags: ['bash-overuse', 'general'],
      pea: makeValidPea(),
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithMixedTags]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  it('does not require categoryTags on pre-PEA growth area (backward compatibility)', async () => {
    makeRunAndSetup(homeDir);

    // Growth area has no pea sub-object — AC 13 gate must not apply
    const prePeaGrowthArea = makeGrowthArea();
    // No categoryTags, no pea sub-object
    expect(prePeaGrowthArea.categoryTags).toBeUndefined();
    expect((prePeaGrowthArea as Record<string, unknown>).pea).toBeUndefined();

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([prePeaGrowthArea]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  // ====================================================================
  // AC 3: Verifiable Action — Session-Log-Checkable Requirements
  //
  // Additional tests specifically for the "checkable against future session
  // logs" aspect of AC 3. These tests verify that the verifiable action gate
  // enforces actions that produce observable artifacts in JSONL session logs.
  //
  // Session log observable artifacts:
  //   - tool_use blocks (tool names like Read, Edit, Grep, Glob, Bash, Write,
  //     MultiEdit, NotebookEdit, TodoWrite, WebSearch, WebFetch)
  //   - User message content (slash commands like /plan, /compact)
  //   - Bash tool_use content (CLI commands like npm, git, vitest, ruff, mypy)
  //   - Tool arguments (file names, patterns)
  // ====================================================================

  it('AC3: accepts verifiable action referencing MultiEdit tool (session-log observable)', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaWithMultiEdit = makeGrowthArea({
      action: 'In your next session, use MultiEdit to make all related changes atomically across files instead of sequential Edit calls — prevents partial-state commits that break the build.',
      checkDescription: 'Session log contains MultiEdit tool_use blocks instead of sequential Edit calls when modifying multiple related files simultaneously.',
      toolOrPattern: 'MultiEdit tool',
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithMultiEdit]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  it('AC3: accepts verifiable action referencing Python quality tools (ruff, mypy) as session-log signals', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaWithPythonTools = makeGrowthArea({
      action: 'After every change to src/models/ in your next session, run ruff and mypy via Bash before committing to catch type errors and style issues before they accumulate across the codebase.',
      checkDescription: 'Session log shows Bash tool_use executing ruff and mypy after each Edit to .py files in src/models/, with outputs reviewed before the next code change.',
      toolOrPattern: 'ruff, mypy',
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithPythonTools]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  it('AC3: accepts verifiable action referencing tool_use artifact explicitly', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaWithToolUseRef = makeGrowthArea({
      action: 'In your next session, before writing any implementation, add a TodoWrite tool_use call with the full task decomposition so the scope is explicit before any Edit or Bash calls begin.',
      checkDescription: 'Session log contains a TodoWrite tool_use block in the first 3 messages before any Edit or Bash tool_use appears — verifying the planning-first pattern was followed.',
      toolOrPattern: 'TodoWrite tool',
    });

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaWithToolUseRef]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  it('AC3: pea.action verificationCheck references session log — passes verifiable_action rubric', async () => {
    makeRunAndSetup(homeDir);

    // PEA growth area where action.verificationCheck explicitly describes
    // what to look for in future session JSONL logs
    const peaWithSessionLogCheck = {
      ...makeValidPea(),
      action: {
        instruction: 'Before adding any catch block in Express middleware, first use Write to create a test file with a test case for the error path using jest.spyOn on the failing service — this makes error paths verifiable before the handler ships.',
        verificationCheck: 'Future session logs should show Write tool_use creating a .test.ts file before or alongside the Edit adding the catch block, with jest.spyOn or mock patterns visible in the file content.',
        goalRelevance: 'Your payment API handles Stripe webhook events — untested catch blocks in middleware silently swallow validation errors, causing revenue loss when webhook signatures fail in production.',
      },
    };

    const growthArea = {
      ...makeGrowthArea(),
      categoryTags: ['error-handling', 'test-coverage', 'express-middleware'],
      pea: peaWithSessionLogCheck,
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthArea]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.growthAreaCount).toBe(1);
  });

  // ====================================================================
  // AC 5: Goal Relevance Quality Gate
  //
  // Every growth area must explain WHY the observed pattern matters for
  // what the builder is specifically trying to achieve. This connects the
  // growth area to the builder's actual goals, not abstract best practices.
  //
  // Evaluation criterion: goal_relevance
  // Tests cover:
  //   - Missing goalRelevance (no field, no WHY IT MATTERS in description) → quality_error
  //   - Too-short goalRelevance (< 50 chars) → quality_error
  //   - Generic platitude goalRelevance → quality_error
  //   - Builder-specific goalRelevance → accepted (status ok)
  //   - goalRelevance sourced from pea.action.goalRelevance (fallback) → accepted
  //   - goalRelevance in description "WHY IT MATTERS" section (legacy) → accepted
  // ====================================================================

  it('AC5: rejects growth area with missing goalRelevance and no WHY IT MATTERS section', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaNoGoal = {
      title: 'Bash-Only File Search Instead of Glob/Grep Composition',
      description: makeLongText(
        'PATTERN: In 4 of 5 sessions, you use Bash with find/grep instead of Glob or Grep tools. IMPACT: Context window waste accumulates across sessions.',
        200,
      ),
      severity: 'medium',
      recommendation: makeLongText(
        'Use Glob tool for file discovery and Grep tool for content search in your next session.',
        80,
      ),
      evidence: [
        {
          utteranceId: 'session-2_3',
          quote: 'Let me just use bash to find all the TypeScript files in src/',
          context: 'file discovery via Bash',
          sessionId: 'session-2',
          behaviorDescription: 'Used Bash find instead of Glob tool_use',
        },
        {
          utteranceId: 'session-3_7',
          quote: 'grep -r "useState" src/ to find all React hooks usage',
          context: 'content search via Bash',
          sessionId: 'session-3',
          behaviorDescription: 'Used Bash grep instead of Grep tool_use',
        },
      ],
      verifiableAction: {
        action: 'Use Glob and Grep tools for file discovery and content search in the next session.',
        checkDescription: 'Session log contains Glob or Grep tool_use blocks.',
        toolOrPattern: 'Glob, Grep tools',
      },
      // goalRelevance intentionally omitted AND description has no "WHY IT MATTERS" section
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaNoGoal]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const issue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('goalRelevance'),
    );
    expect(issue).toBeDefined();
    expect(issue.message).toContain('missing goal relevance');
  });

  it('AC5: rejects growth area with too-short goalRelevance (under 50 chars, passes Zod min-30 but fails quality gate)', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaShortGoal = {
      ...makeGrowthArea(),
      goalRelevance: 'Saves time and improves overall code quality.', // 45 chars — passes Zod min(30) but fails quality gate min(50)
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaShortGoal]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const issue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('goalRelevance'),
    );
    expect(issue).toBeDefined();
    expect(issue.message).toContain('too short');
  });

  it('AC5: rejects growth area with generic platitude goalRelevance (testing is important for software quality)', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaGenericGoal = {
      ...makeGrowthArea(),
      goalRelevance: 'Testing is important for software quality and helps prevent regressions across the codebase.',
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaGenericGoal]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const issue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('goalRelevance'),
    );
    expect(issue).toBeDefined();
    expect(issue.message).toContain('generic platitude');
  });

  it('AC5: rejects growth area with generic platitude goalRelevance (will help you write better code)', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaGenericGoal2 = {
      ...makeGrowthArea(),
      goalRelevance: 'This will help you write better code and reduce the number of bugs you introduce in your projects.',
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaGenericGoal2]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const issue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('goalRelevance'),
    );
    expect(issue).toBeDefined();
    expect(issue.message).toContain('generic platitude');
  });

  it('AC5: rejects growth area with generic platitude goalRelevance (better practices will improve your overall efficiency)', async () => {
    makeRunAndSetup(homeDir);

    const growthAreaGenericGoal3 = {
      ...makeGrowthArea(),
      goalRelevance: 'Better search practices will improve your overall efficiency and reduce the time spent on file discovery tasks in your projects.',
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaGenericGoal3]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    const issue = parsed.issues.find((i: { field: string }) =>
      i.field.includes('goalRelevance'),
    );
    expect(issue).toBeDefined();
    expect(issue.message).toContain('generic platitude');
  });

  it('AC5: accepts growth area with builder-specific goalRelevance referencing project and technology', async () => {
    makeRunAndSetup(homeDir);

    // The default makeGrowthArea() has a properly specific goalRelevance already:
    // "Your monorepo has 200+ TypeScript files — Bash grep searches take 3-5 tool_use turns
    //  while Grep returns results in one, directly reducing context exhaustion risk on
    //  complex refactoring sessions."
    const validGrowthArea = makeGrowthArea();

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([validGrowthArea]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.growthAreaCount).toBe(1);
  });

  it('AC5: accepts goalRelevance sourced from pea.action.goalRelevance (PEA pipeline fallback path)', async () => {
    makeRunAndSetup(homeDir);

    // Growth area omits top-level goalRelevance but provides it in pea.action
    // The gate should pick it up from pea.action.goalRelevance as the fallback.
    const growthAreaPeaGoal = {
      ...makeGrowthArea(),
      goalRelevance: undefined, // omit top-level
      categoryTags: ['tool-composition', 'bash-overuse', 'file-discovery'],
      pea: {
        ...makeValidPea(),
        action: {
          instruction: 'In your next session, use Glob tool for file discovery and Grep tool for content search before falling back to Bash. These tools appear directly as tool_use blocks in session logs.',
          verificationCheck: 'Session log contains Glob or Grep tool_use blocks before or instead of Bash tool_use blocks with find/grep arguments.',
          // Specific goalRelevance in pea.action — references project + technology + consequence
          goalRelevance: 'Your monorepo has 200+ TypeScript files — Bash grep searches take 3-5 tool_use turns while Glob or Grep returns results in one, directly reducing context exhaustion risk on complex multi-file refactoring sessions.',
        },
      },
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaPeaGoal]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
    expect(parsed.growthAreaCount).toBe(1);
  });

  it('AC5: accepts goalRelevance embedded in description WHY IT MATTERS section (legacy path)', async () => {
    makeRunAndSetup(homeDir);

    // Legacy format: goalRelevance embedded in description, no goalRelevance field
    const growthAreaLegacyGoal = {
      title: 'Bash-Only File Search Instead of Glob/Grep Composition',
      description: makeLongText(
        'PATTERN: In 4 of 5 sessions, you use Bash with find/grep instead of Glob or Grep tools. WHY IT MATTERS: Your monorepo has 200+ TypeScript files — each Bash search takes 3-5 turns while Glob returns in one. IMPACT: Context exhaustion accumulates.',
        100,
      ),
      severity: 'medium',
      recommendation: makeLongText(
        'Use Glob tool for file discovery and Grep tool for content search in your next session.',
        80,
      ),
      evidence: [
        {
          utteranceId: 'session-2_3',
          quote: 'Let me just use bash to find all the TypeScript files in src/',
          context: 'file discovery via Bash instead of Glob',
          sessionId: 'session-2',
          behaviorDescription: 'Used Bash find instead of Glob tool_use',
        },
        {
          utteranceId: 'session-3_7',
          quote: 'grep -r "useState" src/ to find all React hooks usage',
          context: 'content search via Bash instead of Grep tool',
          sessionId: 'session-3',
          behaviorDescription: 'Used Bash grep instead of Grep tool_use',
        },
      ],
      verifiableAction: {
        action: 'Use Glob and Grep tools for file discovery and content search in the next session instead of Bash.',
        checkDescription: 'Session log contains Glob or Grep tool_use blocks before any Bash find/grep calls.',
        toolOrPattern: 'Glob, Grep tools',
      },
      // No top-level goalRelevance field — relies on WHY IT MATTERS in description
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthAreaLegacyGoal]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('ok');
  });

  // ====================================================================
  // Sub-AC 3: Rich Quality Diagnostics in quality_error Response
  //
  // When a PEA growth area fails the 4-criteria quality rubric, the
  // quality_error response MUST include both:
  //   1. `issues`: flat quality gate failures with targeted fix messages
  //   2. `qualityDiagnostics`: rich per-criterion scores (0-1) and
  //      problem type detection for more efficient retry guidance
  //
  // The rich diagnostics come from validateGrowthAreaQuality() (the full
  // quality checker with continuous scores and problem flags), wired into
  // the save-domain-results quality gate for Sub-AC 3.
  //
  // Tests cover:
  //   - Failing PEA growth area → qualityDiagnostics present in response
  //   - qualityDiagnostics includes growthAreaTitle, summary, criteriaScores
  //   - criteriaScores has 0-1 values for each of the 4 rubric criteria
  //   - Passing PEA growth area → qualityDiagnostics NOT included (not needed)
  //   - Non-PEA growth area failing → qualityDiagnostics NOT included
  // ====================================================================

  it('Sub-AC3: quality_error response includes qualityDiagnostics for failing PEA growth areas', async () => {
    makeRunAndSetup(homeDir);

    // PEA growth area that fails the rubric: duplicate utteranceIds (fails distinct_moments)
    // and no observable session-log signal in action (fails verifiable_action)
    const failingPea = {
      ...makeValidPea(),
      evidence: [
        {
          utteranceId: 'session-2_3', // DUPLICATE — same utteranceId
          sessionId: 'session-2',
          quote: 'Let me just use bash to find all the TypeScript files in src/',
          context: 'In the monorepo project, after Bash calls — file search via Bash',
          observation: 'Used Bash find instead of Glob tool_use for file discovery',
        },
        {
          utteranceId: 'session-2_3', // DUPLICATE — same utteranceId → fails distinct_moments
          sessionId: 'session-3',
          quote: 'grep -r "useState" src/ to find all React hooks usage',
          context: 'In the react-dashboard project, after Edit calls — content search via Bash',
          observation: 'Used Bash grep instead of Grep tool_use',
        },
      ],
    };

    const growthArea = {
      ...makeGrowthArea(),
      categoryTags: ['bash-overuse', 'file-discovery'],
      pea: failingPea,
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([growthArea]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');

    // The response must include qualityDiagnostics for the failing PEA area
    expect(parsed.qualityDiagnostics).toBeDefined();
    expect(Array.isArray(parsed.qualityDiagnostics)).toBe(true);
    expect(parsed.qualityDiagnostics.length).toBeGreaterThan(0);

    const diagnostic = parsed.qualityDiagnostics[0];

    // Must identify the growth area by title
    expect(typeof diagnostic.growthAreaTitle).toBe('string');
    expect(diagnostic.growthAreaTitle).toContain('Bash');

    // Must include human-readable summary
    expect(typeof diagnostic.summary).toBe('string');
    expect(diagnostic.summary.length).toBeGreaterThan(50);
    expect(diagnostic.summary).toMatch(/FAIL|PASS|distinct_moments|verifiable_action|pattern_specificity|tool_file_naming/i);

    // Must include continuous criterion scores (0-1) for all 4 criteria
    expect(diagnostic.criteriaScores).toBeDefined();
    expect(typeof diagnostic.criteriaScores.distinctMoments).toBe('number');
    expect(typeof diagnostic.criteriaScores.verifiableAction).toBe('number');
    expect(typeof diagnostic.criteriaScores.patternSpecificity).toBe('number');
    expect(typeof diagnostic.criteriaScores.toolFileNaming).toBe('number');

    // Scores must be in [0, 1] range
    expect(diagnostic.criteriaScores.distinctMoments).toBeGreaterThanOrEqual(0);
    expect(diagnostic.criteriaScores.distinctMoments).toBeLessThanOrEqual(1);
    expect(diagnostic.criteriaScores.verifiableAction).toBeGreaterThanOrEqual(0);
    expect(diagnostic.criteriaScores.verifiableAction).toBeLessThanOrEqual(1);

    // The failing criterion (distinct_moments) must have a low score
    expect(diagnostic.criteriaScores.distinctMoments).toBeLessThan(0.5);

    // Must include detected problems array
    expect(Array.isArray(diagnostic.detectedProblems)).toBe(true);
  });

  it('Sub-AC3: quality_error response does NOT include qualityDiagnostics when non-PEA growth area fails', async () => {
    makeRunAndSetup(homeDir);

    // A non-PEA growth area that fails quality gates (description < 300 chars but > 100 chars,
    // so it passes Zod schema validation but fails the quality gate threshold)
    const shortDescArea = {
      title: 'Bash-Only File Search',
      description: 'The developer consistently uses Bash with find/grep commands instead of the dedicated Glob and Grep tools, adding extra tool turns per discovery operation.', // 160 chars — passes Zod min(100) but fails quality gate min(300)
      severity: 'medium',
      recommendation: 'Use Glob and Grep tools for discovery instead of Bash.',
      evidence: [
        {
          utteranceId: 'session-2_3',
          quote: 'Let me just use bash to find TypeScript files',
          context: 'file discovery via Bash',
          sessionId: 'session-2',
          behaviorDescription: 'Used Bash find instead of Glob tool_use',
        },
        {
          utteranceId: 'session-3_7',
          quote: 'grep -r "useState" src/ to find all React hooks',
          context: 'content search via Bash',
          sessionId: 'session-3',
          behaviorDescription: 'Used Bash grep instead of Grep tool_use',
        },
      ],
      verifiableAction: {
        action: 'Use Glob tool for file discovery and Grep for content search in your next session.',
        checkDescription: 'Session log contains Glob or Grep tool_use blocks before any Bash find/grep.',
        toolOrPattern: 'Glob, Grep tools',
      },
      goalRelevance: 'Your monorepo has 200+ files — Bash searches waste 3-5 turns vs. Glob in one.',
      // No pea sub-object — this is a pre-PEA growth area
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '65',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([shortDescArea]),
      data: JSON.stringify(makeValidData()),
    }));

    expect(parsed.status).toBe('quality_error');
    expect(parsed.issues).toBeDefined();

    // No PEA sub-object → no qualityDiagnostics should be present
    expect(parsed.qualityDiagnostics).toBeUndefined();
  });

  it('Sub-AC3: passing PEA growth area does NOT trigger qualityDiagnostics in response', async () => {
    makeRunAndSetup(homeDir);

    const validGrowthArea = {
      ...makeGrowthArea(),
      categoryTags: ['tool-composition', 'bash-overuse', 'file-discovery'],
      pea: makeValidPea(),
    };

    const parsed = JSON.parse(await execute({
      domain: 'communicationPatterns',
      overallScore: '72',
      strengths: JSON.stringify(makeValidStrengths()),
      growthAreas: JSON.stringify([validGrowthArea]),
      data: JSON.stringify(makeValidData()),
    }));

    // Passing growth areas → status ok, no qualityDiagnostics
    expect(parsed.status).toBe('ok');
    expect(parsed.qualityDiagnostics).toBeUndefined();
  });
});
