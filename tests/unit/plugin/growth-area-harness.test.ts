/**
 * Growth Area Quality Harness
 *
 * Runs the full analysis pipeline on 7 diverse sample sessions and outputs
 * generated reports (growth areas JSON) for manual inspection against the
 * 4-criteria quality rubric:
 *   1. distinct_moments   — 2-3+ distinct specific moments
 *   2. verifiable_action  — Concrete enough to check in future logs
 *   3. pattern_specificity — Specific to this builder's behavior
 *   4. tool_file_naming   — Names specific tools/files/APIs
 *
 * Output: test-results/growth-area-harness-report.json
 *
 * Usage: npx vitest run tests/unit/plugin/growth-area-harness.test.ts
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  createAnalysisRun,
  saveDomainResult,
} from '../../../packages/plugin/lib/results-db.js';
import {
  pinCurrentRunId,
  resetResultsStorage,
  deterministicScores,
} from './plugin-analysis-fixtures.js';
import {
  passesQualityRubric,
  GrowthAreaPEASchema,
  peaToDomainGrowthArea,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';
import { enrichGrowthAreasWithKbTips } from '../../../packages/shared/src/matching/kb-growth-area-enricher.js';
import type {
  PortableKnowledgeItem,
  PortableProfessionalInsight,
} from '../../../packages/shared/src/matching/knowledge-resource-matcher.js';
import type {
  Phase1Output,
  DomainResult,
  DeterministicScores,
} from '../../../packages/plugin/lib/core/types.js';
import type {
  QualityRubric,
  GrowthAreaPEA,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';

// ============================================================================
// Output directory
// ============================================================================

const OUTPUT_DIR = join(process.cwd(), 'test-results');

// ============================================================================
// Synthetic KB Data for Enrichment Pipeline
// ============================================================================

/**
 * Synthetic knowledge items spanning multiple dimensions.
 * These exercise the deterministic KB matcher's dimension-overlap
 * and keyword-affinity scoring without requiring real ~/.betterprompt/knowledge/ files.
 */
const SYNTHETIC_KB_ITEMS: PortableKnowledgeItem[] = [
  {
    id: 'kb-express-error-testing',
    title: 'Test-Driven Error Handling in Express Middleware',
    summary: 'Write error path tests before implementing catch blocks in Express middleware to prevent silent failures. Use jest.spyOn to mock service calls and verify error propagation.',
    sourceUrl: 'https://kentcdodds.com/blog/common-mistakes-with-react-testing-library',
    sourceAuthor: 'Kent C. Dodds',
    contentType: 'article',
    tags: ['error-handling', 'express', 'testing', 'middleware', 'jest', 'tdd'],
    applicableDimensions: ['TrustVerification'],
    relevanceScore: 8,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-react-profiling-before-memo',
    title: 'Profile Before You Memo: React Performance Optimization',
    summary: 'Always use React DevTools Profiler to identify the actual render cascade before applying React.memo or useMemo. Premature memoization often masks the real issue.',
    sourceUrl: 'https://overreacted.io/before-you-memo/',
    sourceAuthor: 'Dan Abramov',
    contentType: 'article',
    tags: ['react', 'performance', 'profiling', 'memoization', 'devtools'],
    applicableDimensions: ['TrustVerification', 'WorkflowHabit'],
    relevanceScore: 9,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-explain-analyze-postgres',
    title: 'PostgreSQL Query Optimization with EXPLAIN ANALYZE',
    summary: 'Use EXPLAIN ANALYZE before every query optimization to identify sequential scans, missing indexes, and join inefficiencies. Avoid guessing at query performance.',
    sourceUrl: 'https://use-the-index-luke.com/sql/explain-plan',
    sourceAuthor: 'Markus Winand',
    contentType: 'article',
    tags: ['postgresql', 'query-performance', 'explain-analyze', 'indexing', 'database'],
    applicableDimensions: ['TrustVerification', 'KnowledgeGap'],
    relevanceScore: 8,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-k8s-memory-profiling',
    title: 'Debugging OOMKilled Pods: Memory Profiling Before Limit Bumps',
    summary: 'When pods are OOMKilled, profile memory usage with kubectl top and Node.js --inspect before increasing resource limits. Band-aid limit increases mask memory leaks.',
    sourceUrl: 'https://learnk8s.io/production-best-practices',
    sourceAuthor: 'Daniele Polencic',
    contentType: 'article',
    tags: ['kubernetes', 'memory', 'debugging', 'oomkilled', 'profiling', 'docker'],
    applicableDimensions: ['TrustVerification', 'WorkflowHabit'],
    relevanceScore: 7,
    sourcePlatform: 'web',
    credibilityTier: 'medium',
  },
  {
    id: 'kb-pytest-benchmark',
    title: 'Performance Regression Testing with pytest-benchmark',
    summary: 'Add benchmark tests alongside correctness tests to catch performance regressions. Use pytest-benchmark to set time thresholds for critical hot paths.',
    sourceUrl: 'https://pytest-benchmark.readthedocs.io/en/latest/',
    sourceAuthor: 'pytest-benchmark contributors',
    contentType: 'docs',
    tags: ['pytest', 'benchmark', 'performance', 'testing', 'python', 'regression'],
    applicableDimensions: ['KnowledgeGap', 'WorkflowHabit'],
    relevanceScore: 7,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-github-actions-dependencies',
    title: 'Modeling Job Dependencies in GitHub Actions Workflows',
    summary: 'Map the dependency graph between CI jobs before parallelizing. Use needs: and artifact sharing to prevent test failures from missing build outputs.',
    sourceUrl: 'https://docs.github.com/en/actions/using-workflows/workflow-syntax',
    sourceAuthor: 'GitHub Docs',
    contentType: 'docs',
    tags: ['github-actions', 'ci-cd', 'job-dependencies', 'artifacts', 'workflow'],
    applicableDimensions: ['WorkflowHabit', 'ContextEfficiency'],
    relevanceScore: 8,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-prisma-multi-tenant-checklist',
    title: 'Multi-Tenant Schema Validation for Prisma Migrations',
    summary: 'Before running prisma migrate dev for new tables, verify tenant_id foreign keys, composite indexes, and row-level security. Missing tenant isolation is a critical security vulnerability.',
    sourceUrl: 'https://www.prisma.io/docs/guides/other/multi-tenancy',
    sourceAuthor: 'Prisma Documentation',
    contentType: 'docs',
    tags: ['prisma', 'multi-tenant', 'security', 'migrations', 'postgresql', 'schema'],
    applicableDimensions: ['TrustVerification', 'KnowledgeGap'],
    relevanceScore: 9,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-context-restatement-pattern',
    title: 'Context Restatement for Multi-Session AI Debugging',
    summary: 'When continuing debugging across sessions, restate the current file state and error output rather than referencing changes by memory. Fresh context prevents AI from optimizing for stale assumptions.',
    sourceUrl: 'https://www.reddit.com/r/ClaudeAI/comments/abc123',
    sourceAuthor: 'u/devpractitioner',
    contentType: 'article',
    tags: ['context-management', 'debugging', 'ai-collaboration', 'session-management'],
    applicableDimensions: ['ContextEfficiency', 'CommunicationPatterns'],
    relevanceScore: 5,
    sourcePlatform: 'reddit',
    credibilityTier: 'standard',
  },
];

const SYNTHETIC_PROFESSIONAL_INSIGHTS: PortableProfessionalInsight[] = [
  {
    id: 'pi-verify-before-ship',
    title: 'Verification Before Shipping',
    keyTakeaway: 'Always verify changes with concrete evidence (test runs, profiler output, diff checks) before considering work complete.',
    actionableAdvice: [
      'Run tests after every code change, not just at session end',
      'Use profiler tools before declaring performance improvements',
      'Check migration diffs before applying to databases',
    ],
    sourceAuthor: 'BetterPrompt Expert Panel',
    sourceUrl: 'https://betterprompt.dev/insights/verification',
    category: 'diagnosis',
    priority: 9,
    applicableDimensions: ['TrustVerification', 'WorkflowHabit'],
  },
  {
    id: 'pi-profile-before-optimize',
    title: 'Profile Before You Optimize',
    keyTakeaway: 'Measure first, optimize second. Profiling reveals the actual bottleneck, which is often not where you expect.',
    actionableAdvice: [
      'Use EXPLAIN ANALYZE for database queries',
      'Use React DevTools Profiler for component performance',
      'Use cProfile or py-spy for Python hot paths',
    ],
    sourceAuthor: 'BetterPrompt Expert Panel',
    sourceUrl: 'https://betterprompt.dev/insights/profiling',
    category: 'diagnosis',
    priority: 8,
    applicableDimensions: ['TrustVerification', 'KnowledgeGap'],
  },
];

// ============================================================================
// 7 Diverse Sample Session Profiles
// ============================================================================

/**
 * Each profile represents a different developer archetype with
 * different project contexts, tools, and behavioral patterns.
 * Sessions span multiple distinct interactions to enable proper
 * evidence moment generation.
 */
interface SessionProfile {
  id: string;
  label: string;
  projectName: string;
  projectPath: string;
  sessionCount: number;
  sessions: Array<{
    sessionId: string;
    messages: Array<{
      uuid: string;
      role: 'user' | 'assistant';
      timestamp: string;
      content: string;
      toolCalls?: Array<{ id: string; name: string; input: object; result: string }>;
      tokenUsage?: { input: number; output: number };
    }>;
  }>;
  /** Pre-built growth areas in PEA-compatible DomainResult format */
  domainResults: DomainResult[];
  scores: DeterministicScores;
}

function createProfile1_AuthRefactoring(): SessionProfile {
  return {
    id: 'profile-auth-refactor',
    label: 'Auth Module Refactoring — Express/Prisma Developer',
    projectName: 'saas-dashboard',
    projectPath: '/home/dev/saas-dashboard',
    sessionCount: 3,
    sessions: [
      {
        sessionId: 'auth-sess-1',
        messages: [
          { uuid: 'u1', role: 'user', timestamp: '2026-03-10T09:00:00Z', content: 'Refactor the authentication module in src/auth/middleware.ts to support JWT refresh tokens. Read the current implementation first.' },
          { uuid: 'a1', role: 'assistant', timestamp: '2026-03-10T09:01:00Z', content: 'Reading the auth middleware...', toolCalls: [{ id: 't1', name: 'Read', input: { path: 'src/auth/middleware.ts' }, result: 'ok' }], tokenUsage: { input: 400, output: 300 } },
          { uuid: 'u2', role: 'user', timestamp: '2026-03-10T09:05:00Z', content: 'The token validation is failing silently. Just add a try-catch and move on.' },
          { uuid: 'a2', role: 'assistant', timestamp: '2026-03-10T09:06:00Z', content: 'Added try-catch around JWT verification.', toolCalls: [{ id: 't2', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 350, output: 250 } },
        ],
      },
      {
        sessionId: 'auth-sess-2',
        messages: [
          { uuid: 'u3', role: 'user', timestamp: '2026-03-11T10:00:00Z', content: 'The middleware is crashing in staging. Can you look at the error logs and fix it? I think it is the auth module again.' },
          { uuid: 'a3', role: 'assistant', timestamp: '2026-03-11T10:01:00Z', content: 'Let me read the error logs and the middleware file.', toolCalls: [{ id: 't3', name: 'Read', input: { path: 'logs/staging-error.log' }, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u4', role: 'user', timestamp: '2026-03-11T10:10:00Z', content: 'It is the catch block we added yesterday — it swallows the error. Just log it and re-throw.' },
          { uuid: 'a4', role: 'assistant', timestamp: '2026-03-11T10:11:00Z', content: 'Fixed. Added console.error and re-throw in catch block.', toolCalls: [{ id: 't4', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 300, output: 200 } },
        ],
      },
      {
        sessionId: 'auth-sess-3',
        messages: [
          { uuid: 'u5', role: 'user', timestamp: '2026-03-12T14:00:00Z', content: 'Now we need to add test coverage for the refresh token flow. Create tests in src/auth/__tests__/refresh.test.ts' },
          { uuid: 'a5', role: 'assistant', timestamp: '2026-03-12T14:01:00Z', content: 'Writing test file for refresh token flow.', toolCalls: [{ id: 't5', name: 'Write', input: {}, result: 'ok' }], tokenUsage: { input: 450, output: 350 } },
        ],
      },
    ],
    scores: { ...deterministicScores, aiPartnership: 72, sessionCraft: 68 },
    domainResults: [
      {
        domain: 'aiPartnership',
        overallScore: 72,
        confidenceScore: 0.82,
        strengths: [{
          title: 'Proactive bug localization',
          description: 'The developer actively identifies the root cause of issues and pinpoints the specific code location before asking for changes. This pattern shows strong debugging intuition and effective collaboration with AI tools by narrowing the search space upfront, reducing wasted iterations and keeping the AI focused on the actual problem rather than exploring blindly.',
          evidence: [{ utteranceId: 'auth-sess-2_0', quote: 'The middleware is crashing in staging. Can you look at the error logs and fix it? I think it is the auth module again.' }],
        }],
        growthAreas: [{
          title: 'Untested Error Handling in Express JWT Middleware',
          description: 'Across three sessions working on the saas-dashboard authentication system, you consistently added try-catch blocks to Express middleware without writing corresponding test cases for the error paths. In auth-sess-1, you asked to "just add a try-catch and move on" for JWT validation failures. By auth-sess-2, this pattern caused a staging crash because the catch block silently swallowed errors. This pattern matters because your SaaS dashboard handles user authentication — silent error swallowing in JWT middleware can lead to users being locked out or security tokens being accepted without proper validation.',
          severity: 'high',
          recommendation: 'Before writing any catch block in Express middleware, first create a test file (e.g., src/auth/__tests__/middleware-errors.test.ts) that covers the error path using jest.spyOn to mock the failing JWT verification call. Run the test to confirm it fails, then add the catch block implementation and verify the test passes.',
          evidence: [
            { utteranceId: 'auth-sess-1_1', quote: 'The token validation is failing silently. Just add a try-catch and move on.', sessionId: 'auth-sess-1', behaviorDescription: 'Added error handling without writing any test for the error path' },
            { utteranceId: 'auth-sess-2_1', quote: 'It is the catch block we added yesterday — it swallows the error. Just log it and re-throw.', sessionId: 'auth-sess-2', behaviorDescription: 'Previous untested catch block caused a staging crash, demonstrating the consequence of skipping error path tests' },
          ],
          evidenceMoments: [
            { utteranceId: 'auth-sess-1_1', sessionId: 'auth-sess-1', quote: 'The token validation is failing silently. Just add a try-catch and move on.', behaviorDescription: 'Added error handling without writing any test for the error path' },
            { utteranceId: 'auth-sess-2_1', sessionId: 'auth-sess-2', quote: 'It is the catch block we added yesterday — it swallows the error. Just log it and re-throw.', behaviorDescription: 'Previous untested catch block caused a staging crash' },
            { utteranceId: 'auth-sess-3_0', sessionId: 'auth-sess-3', quote: 'Now we need to add test coverage for the refresh token flow. Create tests in src/auth/__tests__/refresh.test.ts', behaviorDescription: 'Retroactively adding tests after bugs surfaced rather than test-first workflow' },
          ],
          lowConfidence: false,
          verifiableAction: {
            action: 'In your next session involving error handling in Express middleware, create a test file with jest.spyOn mocking the failing service call BEFORE writing the catch block implementation.',
            checkDescription: 'Session log shows a Write tool call creating a .test.ts file with jest.spyOn before or alongside an Edit tool call adding a try-catch block.',
            toolOrPattern: 'jest.spyOn in test files',
          },
          goalRelevance: 'Your SaaS dashboard Express API handles JWT authentication for paying customers — untested error paths in auth middleware can silently break login flows, lock users out, or worse, accept invalid tokens without proper validation.',
          categoryTags: ['error-handling', 'test-coverage', 'express-middleware', 'jwt-auth'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'sessionCraft',
        overallScore: 68,
        confidenceScore: 0.78,
        strengths: [{
          title: 'Clear context setting at session start',
          description: 'The developer begins sessions by providing specific file paths and project context, which helps the AI understand the codebase structure immediately. This reduces the number of exploratory reads needed and keeps the session focused on the actual task rather than wasting tokens on context gathering, leading to more efficient use of the context window.',
          evidence: [{ utteranceId: 'auth-sess-1_0', quote: 'Refactor the authentication module in src/auth/middleware.ts to support JWT refresh tokens. Read the current implementation first.' }],
        }],
        growthAreas: [{
          title: 'Stale Context Retention Between Retry Attempts in Prisma Migration Sessions',
          description: 'When debugging the authentication middleware across multiple sessions, you carried over stale assumptions from previous failed attempts without restating the current state. In auth-sess-2, you referenced "the catch block we added yesterday" without providing the current file state, forcing the AI to re-read the file to understand what changed. This is particularly problematic in sessions involving Prisma schema migrations where stale migration state can lead to data integrity issues in your multi-tenant SaaS dashboard.',
          severity: 'medium',
          recommendation: 'At the start of each debugging session that continues previous work, paste the current error output and explicitly state what has changed since the last session. Use a format like "Since yesterday: [changes]. Current error: [paste]. Expected behavior: [description]" to give the AI fresh context.',
          evidence: [
            { utteranceId: 'auth-sess-1_1', quote: 'The token validation is failing silently. Just add a try-catch and move on.', sessionId: 'auth-sess-1', behaviorDescription: 'Ended session without providing current state summary for future continuation' },
            { utteranceId: 'auth-sess-2_0', quote: 'The middleware is crashing in staging. Can you look at the error logs and fix it? I think it is the auth module again.', sessionId: 'auth-sess-2', behaviorDescription: 'Continued debugging from previous session without restating what changed or current file state' },
          ],
          evidenceMoments: [
            { utteranceId: 'auth-sess-1_1', sessionId: 'auth-sess-1', quote: 'The token validation is failing silently. Just add a try-catch and move on.', behaviorDescription: 'Ended session without providing current state summary for future continuation' },
            { utteranceId: 'auth-sess-2_0', sessionId: 'auth-sess-2', quote: 'The middleware is crashing in staging. Can you look at the error logs and fix it? I think it is the auth module again.', behaviorDescription: 'Continued debugging from previous session without restating what changed or current file state' },
          ],
          lowConfidence: true, // Evidence from 2 sessions but pattern is mild
          verifiableAction: {
            action: 'When starting a debugging session that continues prior work, include the current file diff or error output in your first message rather than referencing changes by memory alone.',
            checkDescription: 'First user message in continuation sessions contains pasted error output, file content, or explicit "since last session" summary with concrete details.',
            toolOrPattern: 'Context restatement pattern',
          },
          goalRelevance: 'Your SaaS dashboard involves multi-session debugging across auth and Prisma layers — carrying stale context causes the AI to optimize for outdated assumptions, wasting context window and potentially introducing regressions.',
          categoryTags: ['context-management', 'debugging-workflow', 'session-continuity'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'toolMastery',
        overallScore: 80,
        confidenceScore: 0.85,
        strengths: [{
          title: 'Targeted file reads before edits',
          description: 'The developer consistently reads specific files before requesting edits, providing the AI with accurate context for the changes needed. This pattern reduces the likelihood of incorrect edits and demonstrates strong understanding of the read-then-edit workflow that maximizes AI code generation accuracy and minimizes token waste from incorrect attempts.',
          evidence: [{ utteranceId: 'auth-sess-1_0', quote: 'Refactor the authentication module in src/auth/middleware.ts to support JWT refresh tokens. Read the current implementation first.' }],
        }],
        growthAreas: [],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'skillResilience',
        overallScore: 74,
        confidenceScore: 0.79,
        strengths: [{
          title: 'Recovery from failed approaches',
          description: 'When initial approaches fail (silent error swallowing in catch blocks), the developer pivots effectively to a better solution rather than doubling down on the failing approach. This resilience pattern shows the developer can recognize when a quick fix creates technical debt and course-correct, which is essential for maintaining code quality in production authentication systems.',
          evidence: [{ utteranceId: 'auth-sess-2_1', quote: 'It is the catch block we added yesterday — it swallows the error. Just log it and re-throw.' }],
        }],
        growthAreas: [],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'sessionMastery',
        overallScore: 76,
        confidenceScore: 0.80,
        strengths: [{
          title: 'Reasonable session boundaries',
          description: 'The developer separates authentication refactoring, debugging, and testing into distinct sessions, keeping each session focused on a single concern. This prevents context pollution and ensures the AI can dedicate its full context window to the immediate task, improving output quality across the multi-session development workflow.',
          evidence: [{ utteranceId: 'auth-sess-3_0', quote: 'Now we need to add test coverage for the refresh token flow. Create tests in src/auth/__tests__/refresh.test.ts' }],
        }],
        growthAreas: [],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
    ],
  };
}

function createProfile2_ReactFrontend(): SessionProfile {
  return {
    id: 'profile-react-frontend',
    label: 'React Component Refactoring — Next.js Developer',
    projectName: 'admin-portal',
    projectPath: '/home/dev/admin-portal',
    sessionCount: 2,
    sessions: [
      {
        sessionId: 'react-sess-1',
        messages: [
          { uuid: 'u1', role: 'user', timestamp: '2026-03-10T11:00:00Z', content: 'The DataTable component in src/components/DataTable.tsx is re-rendering on every keystroke in the search input. Can you profile it and fix the performance issue?' },
          { uuid: 'a1', role: 'assistant', timestamp: '2026-03-10T11:01:00Z', content: 'Reading the component to understand the render cycle...', toolCalls: [{ id: 't1', name: 'Read', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u2', role: 'user', timestamp: '2026-03-10T11:05:00Z', content: 'Just wrap it in React.memo and add useMemo for the filtered data. That should fix it.' },
          { uuid: 'a2', role: 'assistant', timestamp: '2026-03-10T11:06:00Z', content: 'Applied React.memo and useMemo.', toolCalls: [{ id: 't2', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 400, output: 300 } },
        ],
      },
      {
        sessionId: 'react-sess-2',
        messages: [
          { uuid: 'u3', role: 'user', timestamp: '2026-03-11T09:00:00Z', content: 'The DataTable is still slow. The React.memo did not help because the parent is passing a new object reference every render. We need to fix the parent component too.' },
          { uuid: 'a3', role: 'assistant', timestamp: '2026-03-11T09:01:00Z', content: 'Let me read the parent component...', toolCalls: [{ id: 't3', name: 'Read', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u4', role: 'user', timestamp: '2026-03-11T09:10:00Z', content: 'Use useCallback for the onFilter handler in the parent and move the data transform into a useMemo. Also add React DevTools profiler check before we commit.' },
          { uuid: 'a4', role: 'assistant', timestamp: '2026-03-11T09:12:00Z', content: 'Applied useCallback and useMemo in parent component.', toolCalls: [{ id: 't4', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 450, output: 350 } },
        ],
      },
    ],
    scores: { ...deterministicScores, aiPartnership: 70, toolMastery: 66 },
    domainResults: [
      {
        domain: 'aiPartnership',
        overallScore: 70,
        confidenceScore: 0.80,
        strengths: [{
          title: 'Performance-aware debugging approach',
          description: 'The developer demonstrates awareness of React rendering performance issues and proactively investigates the root cause using component profiling mental models. This systematic approach to performance debugging shows strong engineering instincts that help the AI tool provide targeted optimizations rather than generic advice, leading to faster resolution of rendering bottlenecks.',
          evidence: [{ utteranceId: 'react-sess-1_0', quote: 'The DataTable component in src/components/DataTable.tsx is re-rendering on every keystroke in the search input. Can you profile it and fix the performance issue?' }],
        }],
        growthAreas: [{
          title: 'Premature Memoization Without Root Cause Analysis in React DataTable',
          description: 'In two consecutive sessions optimizing the DataTable component, you jumped to memoization (React.memo, useMemo) without first profiling to understand the actual render cascade. In react-sess-1, you prescribed "Just wrap it in React.memo" before understanding why re-renders were happening. By react-sess-2, you discovered the real issue was the parent passing new object references, invalidating React.memo entirely. This premature optimization pattern wastes development time because the initial fix created false confidence that the performance issue was resolved. In a Next.js admin portal where DataTable renders hundreds of rows, unnecessary re-renders directly impact user experience.',
          severity: 'high',
          recommendation: 'Before applying React.memo or useMemo to any component, first use React DevTools Profiler (or console.log in the render function) to identify which prop changes trigger re-renders. Run `npx why-did-you-render` or add a useEffect with dependency logging to trace the exact prop causing re-renders before applying memoization.',
          evidence: [
            { utteranceId: 'react-sess-1_1', quote: 'Just wrap it in React.memo and add useMemo for the filtered data. That should fix it.', sessionId: 'react-sess-1', behaviorDescription: 'Prescribed memoization fix without profiling the actual render cascade first' },
            { utteranceId: 'react-sess-2_0', quote: 'The DataTable is still slow. The React.memo did not help because the parent is passing a new object reference every render.', sessionId: 'react-sess-2', behaviorDescription: 'Discovered that premature memoization failed because the root cause was in the parent component' },
          ],
          evidenceMoments: [
            { utteranceId: 'react-sess-1_1', sessionId: 'react-sess-1', quote: 'Just wrap it in React.memo and add useMemo for the filtered data. That should fix it.', behaviorDescription: 'Prescribed memoization fix without profiling the actual render cascade first' },
            { utteranceId: 'react-sess-2_0', sessionId: 'react-sess-2', quote: 'The DataTable is still slow. The React.memo did not help because the parent is passing a new object reference every render.', behaviorDescription: 'Discovered premature memoization failed — root cause was parent component prop references' },
          ],
          lowConfidence: false,
          verifiableAction: {
            action: 'Before applying React.memo or useMemo in any component optimization session, first ask the AI to add a useEffect logging dependency array changes, or use React DevTools Profiler to identify the specific prop change causing re-renders.',
            checkDescription: 'Session log shows a Read or Bash tool call involving React DevTools profiler, why-did-you-render, or useEffect dependency logging BEFORE any Edit adding React.memo/useMemo.',
            toolOrPattern: 'React DevTools Profiler or useEffect dependency logging',
          },
          goalRelevance: 'Your admin-portal DataTable renders hundreds of rows for enterprise users — premature memoization wastes development cycles on solutions that do not address the actual render cascade, leaving performance issues unresolved and degrading user experience.',
          categoryTags: ['react-performance', 'premature-optimization', 'component-profiling', 'next-js'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'sessionCraft',
        overallScore: 74,
        confidenceScore: 0.77,
        strengths: [{
          title: 'Iterative refinement across sessions',
          description: 'The developer uses separate sessions for initial attempt and follow-up corrections, demonstrating effective session boundary management. When the first optimization attempt failed, the developer started a fresh session with updated context rather than continuing to debug in the same polluted context window, improving the quality of AI assistance.',
          evidence: [{ utteranceId: 'react-sess-2_0', quote: 'The DataTable is still slow. The React.memo did not help because the parent is passing a new object reference every render.' }],
        }],
        growthAreas: [],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'toolMastery',
        overallScore: 66,
        confidenceScore: 0.75,
        strengths: [{
          title: 'Specific component path references',
          description: 'The developer consistently references exact file paths (src/components/DataTable.tsx) when describing issues, enabling the AI to immediately locate and read the relevant code without ambiguity. This precision eliminates unnecessary search operations and keeps tool usage efficient across the development workflow.',
          evidence: [{ utteranceId: 'react-sess-1_0', quote: 'The DataTable component in src/components/DataTable.tsx is re-rendering on every keystroke in the search input.' }],
        }],
        growthAreas: [{
          title: 'Missing Verification Step After React Performance Optimizations',
          description: 'After applying React.memo and useMemo optimizations, you did not verify the performance improvement before ending the session. In react-sess-1, you accepted "Applied React.memo and useMemo" as success without running a profiler or benchmark to confirm the re-render count decreased. Only in the next session did you discover the optimization had no effect. In react-sess-2, you mentioned using React DevTools but did not explicitly run it before committing. For a Next.js admin portal with enterprise data tables, unverified performance changes risk deploying code that appears optimized but performs identically or worse.',
          severity: 'medium',
          recommendation: 'After applying any React performance optimization, immediately ask the AI to run a verification step: either a React DevTools profiler session via `npx react-devtools` or a console.count/console.time benchmark in the component to measure before/after render counts.',
          evidence: [
            { utteranceId: 'react-sess-1_1', quote: 'Just wrap it in React.memo and add useMemo for the filtered data. That should fix it.', sessionId: 'react-sess-1', behaviorDescription: 'Applied optimization and assumed it worked without measuring the actual performance impact' },
            { utteranceId: 'react-sess-2_1', quote: 'Use useCallback for the onFilter handler in the parent and move the data transform into a useMemo. Also add React DevTools profiler check before we commit.', sessionId: 'react-sess-2', behaviorDescription: 'Mentioned verification step but framed it as an afterthought rather than a prerequisite' },
          ],
          evidenceMoments: [
            { utteranceId: 'react-sess-1_1', sessionId: 'react-sess-1', quote: 'Just wrap it in React.memo and add useMemo for the filtered data. That should fix it.', behaviorDescription: 'Applied optimization without measuring actual performance impact' },
            { utteranceId: 'react-sess-2_1', sessionId: 'react-sess-2', quote: 'Use useCallback for the onFilter handler in the parent and move the data transform into a useMemo. Also add React DevTools profiler check before we commit.', behaviorDescription: 'Mentioned verification as afterthought rather than prerequisite' },
          ],
          lowConfidence: false,
          verifiableAction: {
            action: 'After applying any React performance optimization (React.memo, useMemo, useCallback), immediately use Bash to run a performance measurement before considering the task complete — either React DevTools profiler or console.time/console.count benchmarks.',
            checkDescription: 'Session log contains a Bash tool call running profiler/benchmark or a Read call checking profiler output after Edit calls that add memoization hooks.',
            toolOrPattern: 'React DevTools Profiler or console.time benchmarks',
          },
          goalRelevance: 'Your admin-portal serves enterprise customers who expect responsive data tables — deploying unverified optimizations risks silent performance regressions that erode trust.',
          categoryTags: ['react-performance', 'verification-workflow', 'profiling-tools'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'skillResilience',
        overallScore: 76,
        confidenceScore: 0.78,
        strengths: [{
          title: 'Cross-session learning from failures',
          description: 'When the React.memo optimization failed to resolve the performance issue, the developer returned in a new session with a deeper understanding of the problem (parent component prop references) rather than retrying the same approach. This demonstrates effective learning from failed attempts and the ability to level up debugging skills across sessions.',
          evidence: [{ utteranceId: 'react-sess-2_0', quote: 'The DataTable is still slow. The React.memo did not help because the parent is passing a new object reference every render.' }],
        }],
        growthAreas: [],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      {
        domain: 'sessionMastery',
        overallScore: 75,
        confidenceScore: 0.80,
        strengths: [{
          title: 'Clean performance debugging sessions',
          description: 'Sessions are focused on a single performance issue (DataTable re-rendering) without mixing in unrelated features or tasks, maintaining clean context throughout the debugging workflow. This focused approach ensures the AI can dedicate its full attention to understanding the render cascade without context pollution from unrelated code changes.',
          evidence: [{ utteranceId: 'react-sess-1_0', quote: 'The DataTable component in src/components/DataTable.tsx is re-rendering on every keystroke in the search input.' }],
        }],
        growthAreas: [],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
    ],
  };
}

function createProfile3_APIDebugging(): SessionProfile {
  return {
    id: 'profile-api-debugging',
    label: 'REST API Debugging — Node.js/PostgreSQL Developer',
    projectName: 'order-service',
    projectPath: '/home/dev/order-service',
    sessionCount: 2,
    sessions: [
      {
        sessionId: 'api-sess-1',
        messages: [
          { uuid: 'u1', role: 'user', timestamp: '2026-03-10T14:00:00Z', content: 'The GET /api/orders endpoint returns 500 when there are more than 100 orders. Check the query in src/routes/orders.ts and the Knex migration in migrations/20240101_orders.ts' },
          { uuid: 'a1', role: 'assistant', timestamp: '2026-03-10T14:01:00Z', content: 'Reading both files...', toolCalls: [{ id: 't1', name: 'Read', input: {}, result: 'ok' }], tokenUsage: { input: 600, output: 500 } },
          { uuid: 'u2', role: 'user', timestamp: '2026-03-10T14:10:00Z', content: 'I think the problem is the missing pagination. Just add LIMIT 50 OFFSET to the query.' },
          { uuid: 'a2', role: 'assistant', timestamp: '2026-03-10T14:11:00Z', content: 'Added pagination parameters.', toolCalls: [{ id: 't2', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 400, output: 300 } },
        ],
      },
      {
        sessionId: 'api-sess-2',
        messages: [
          { uuid: 'u3', role: 'user', timestamp: '2026-03-11T09:00:00Z', content: 'The pagination is working but now the total count query is slow on large datasets. It is doing a full table scan. Can you add an index and optimize the count query?' },
          { uuid: 'a3', role: 'assistant', timestamp: '2026-03-11T09:02:00Z', content: 'I will create a new migration to add the index and optimize the count query.', toolCalls: [{ id: 't3', name: 'Write', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u4', role: 'user', timestamp: '2026-03-11T09:15:00Z', content: 'Run the migration and test the endpoint with 10000 records to make sure it is fast now.' },
          { uuid: 'a4', role: 'assistant', timestamp: '2026-03-11T09:18:00Z', content: 'Migration applied, running load test...', toolCalls: [{ id: 't4', name: 'Bash', input: { command: 'npx knex migrate:latest && curl /api/orders?page=1' }, result: 'ok' }], tokenUsage: { input: 450, output: 350 } },
        ],
      },
    ],
    scores: { ...deterministicScores, sessionCraft: 70, toolMastery: 78 },
    domainResults: [
      {
        domain: 'aiPartnership',
        overallScore: 75,
        confidenceScore: 0.82,
        strengths: [{
          title: 'Provides specific file paths and endpoint details',
          description: 'The developer consistently provides exact file paths, endpoint names, and migration file references when describing issues, enabling the AI to immediately locate the relevant code. This precision eliminates ambiguity and reduces the number of exploratory tool calls needed, resulting in faster problem resolution and more efficient use of the AI collaboration context window.',
          evidence: [{ utteranceId: 'api-sess-1_0', quote: 'The GET /api/orders endpoint returns 500 when there are more than 100 orders. Check the query in src/routes/orders.ts and the Knex migration in migrations/20240101_orders.ts' }],
        }],
        growthAreas: [{
          title: 'Symptom-Level Fixes Without Query Performance Profiling in Knex Endpoints',
          description: 'Across two sessions debugging the order-service API, you addressed symptoms (500 errors, slow counts) without profiling the underlying query performance first. In api-sess-1, you prescribed adding LIMIT/OFFSET pagination without running EXPLAIN ANALYZE to understand why the query failed at 100+ records. In api-sess-2, you then discovered a full table scan on the count query — a problem that EXPLAIN ANALYZE would have revealed alongside the original pagination issue. For a production order service handling thousands of records, undiagnosed query performance issues can cascade into timeout failures and database connection pool exhaustion.',
          severity: 'high',
          recommendation: 'Before fixing any database query performance issue in Knex routes, first ask the AI to run EXPLAIN ANALYZE on the current query via Bash (e.g., `npx knex raw "EXPLAIN ANALYZE SELECT..."`) to identify the actual bottleneck — missing indexes, sequential scans, or join inefficiencies — before prescribing a fix.',
          evidence: [
            { utteranceId: 'api-sess-1_1', quote: 'I think the problem is the missing pagination. Just add LIMIT 50 OFFSET to the query.', sessionId: 'api-sess-1', behaviorDescription: 'Prescribed pagination fix without profiling the query to understand the actual failure mode' },
            { utteranceId: 'api-sess-2_0', quote: 'The pagination is working but now the total count query is slow on large datasets. It is doing a full table scan.', sessionId: 'api-sess-2', behaviorDescription: 'Discovered a second performance issue that would have been visible if EXPLAIN ANALYZE had been run initially' },
          ],
          evidenceMoments: [
            { utteranceId: 'api-sess-1_1', sessionId: 'api-sess-1', quote: 'I think the problem is the missing pagination. Just add LIMIT 50 OFFSET to the query.', behaviorDescription: 'Prescribed pagination fix without profiling the query' },
            { utteranceId: 'api-sess-2_0', sessionId: 'api-sess-2', quote: 'The pagination is working but now the total count query is slow on large datasets. It is doing a full table scan.', behaviorDescription: 'Discovered hidden query performance issue that profiling would have caught earlier' },
          ],
          lowConfidence: false,
          verifiableAction: {
            action: 'Before modifying any database query in Knex routes for performance reasons, first run EXPLAIN ANALYZE on the current query using Bash tool (e.g., npx knex raw "EXPLAIN ANALYZE ...") to identify the actual bottleneck before prescribing a fix.',
            checkDescription: 'Session log shows a Bash tool call containing EXPLAIN ANALYZE or knex raw with query analysis before any Edit calls modifying the query.',
            toolOrPattern: 'EXPLAIN ANALYZE via Knex raw query',
          },
          goalRelevance: 'Your order-service API serves a production e-commerce system — undiagnosed query bottlenecks can cascade into timeout failures and database connection pool exhaustion under peak load.',
          categoryTags: ['query-performance', 'database-profiling', 'knex-migrations', 'postgresql'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      ...createMinimalDomainResults(['sessionCraft', 'toolMastery', 'skillResilience', 'sessionMastery'], {
        sessionCraft: 70, toolMastery: 78, skillResilience: 76, sessionMastery: 77,
      }),
    ],
  };
}

function createProfile4_InfraDeployment(): SessionProfile {
  return {
    id: 'profile-infra-deployment',
    label: 'Docker/Kubernetes Deployment — DevOps Engineer',
    projectName: 'platform-infra',
    projectPath: '/home/dev/platform-infra',
    sessionCount: 3,
    sessions: [
      {
        sessionId: 'infra-sess-1',
        messages: [
          { uuid: 'u1', role: 'user', timestamp: '2026-03-10T08:00:00Z', content: 'The staging deployment failed. Check the Dockerfile at infra/Dockerfile.staging and the k8s manifest at k8s/staging/deployment.yaml.' },
          { uuid: 'a1', role: 'assistant', timestamp: '2026-03-10T08:01:00Z', content: 'Reading both files...', toolCalls: [{ id: 't1', name: 'Read', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u2', role: 'user', timestamp: '2026-03-10T08:10:00Z', content: 'The container is OOMKilled. Just bump the memory limit to 512Mi in the deployment manifest.' },
          { uuid: 'a2', role: 'assistant', timestamp: '2026-03-10T08:11:00Z', content: 'Updated memory limit.', toolCalls: [{ id: 't2', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 300, output: 200 } },
        ],
      },
      {
        sessionId: 'infra-sess-2',
        messages: [
          { uuid: 'u3', role: 'user', timestamp: '2026-03-11T10:00:00Z', content: 'Staging is OOMKilled again even with 512Mi. I think the Node.js process has a memory leak in the connection pooling. Can you check the health endpoint and add memory profiling?' },
          { uuid: 'a3', role: 'assistant', timestamp: '2026-03-11T10:02:00Z', content: 'Reading the health endpoint...', toolCalls: [{ id: 't3', name: 'Read', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
        ],
      },
      {
        sessionId: 'infra-sess-3',
        messages: [
          { uuid: 'u5', role: 'user', timestamp: '2026-03-12T09:00:00Z', content: 'Found the leak — the pg connection pool was not being cleaned up. Fix the pool.end() call in src/db/connection.ts and update the Dockerfile to set NODE_OPTIONS=--max-old-space-size=384.' },
          { uuid: 'a5', role: 'assistant', timestamp: '2026-03-12T09:02:00Z', content: 'Applied both fixes.', toolCalls: [{ id: 't5', name: 'Edit', input: {}, result: 'ok' }, { id: 't6', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 400, output: 300 } },
        ],
      },
    ],
    scores: { ...deterministicScores, aiPartnership: 68, sessionCraft: 72 },
    domainResults: [
      {
        domain: 'aiPartnership',
        overallScore: 68,
        confidenceScore: 0.80,
        strengths: [{
          title: 'Provides infrastructure context with file paths',
          description: 'The developer includes specific Dockerfile and Kubernetes manifest paths when describing deployment issues, giving the AI precise context to diagnose infrastructure problems. This habit of providing multi-file context (both Dockerfile and k8s manifests together) accelerates root cause analysis in DevOps workflows where problems often span multiple configuration layers.',
          evidence: [{ utteranceId: 'infra-sess-1_0', quote: 'The staging deployment failed. Check the Dockerfile at infra/Dockerfile.staging and the k8s manifest at k8s/staging/deployment.yaml.' }],
        }],
        growthAreas: [{
          title: 'Resource Limit Band-Aid Without Memory Profiling in Kubernetes Deployments',
          description: 'Across three sessions debugging OOMKilled containers in the platform-infra project, you repeatedly increased memory limits as the first response instead of profiling the application memory usage. In infra-sess-1, you bumped the limit to 512Mi without investigating why the container was consuming so much memory. By infra-sess-2, the same OOMKilled error recurred because the root cause was a pg connection pool memory leak in the Node.js application. This band-aid approach delays root cause identification and can mask memory leaks that eventually overwhelm even generous resource limits in production Kubernetes clusters.',
          severity: 'critical',
          recommendation: 'When a Kubernetes pod is OOMKilled, before increasing memory limits, first run a memory profiling step: add --inspect flag to NODE_OPTIONS in the Dockerfile, or use `kubectl top pods` and `kubectl exec` to check actual memory usage versus the limit. Only increase limits after confirming the application is not leaking memory.',
          evidence: [
            { utteranceId: 'infra-sess-1_1', quote: 'The container is OOMKilled. Just bump the memory limit to 512Mi in the deployment manifest.', sessionId: 'infra-sess-1', behaviorDescription: 'Increased memory limit as immediate fix without investigating the cause of high memory consumption' },
            { utteranceId: 'infra-sess-2_0', quote: 'Staging is OOMKilled again even with 512Mi. I think the Node.js process has a memory leak in the connection pooling.', sessionId: 'infra-sess-2', behaviorDescription: 'Discovered memory leak after band-aid failed — profiling upfront would have caught this immediately' },
            { utteranceId: 'infra-sess-3_0', quote: 'Found the leak — the pg connection pool was not being cleaned up. Fix the pool.end() call in src/db/connection.ts and update the Dockerfile to set NODE_OPTIONS=--max-old-space-size=384.', sessionId: 'infra-sess-3', behaviorDescription: 'Root cause found only after third session — connection pool leak was the real issue all along' },
          ],
          evidenceMoments: [
            { utteranceId: 'infra-sess-1_1', sessionId: 'infra-sess-1', quote: 'The container is OOMKilled. Just bump the memory limit to 512Mi in the deployment manifest.', behaviorDescription: 'Increased memory limit without investigating root cause' },
            { utteranceId: 'infra-sess-2_0', sessionId: 'infra-sess-2', quote: 'Staging is OOMKilled again even with 512Mi. I think the Node.js process has a memory leak in the connection pooling.', behaviorDescription: 'Discovered band-aid failed — memory leak was the real cause' },
            { utteranceId: 'infra-sess-3_0', sessionId: 'infra-sess-3', quote: 'Found the leak — the pg connection pool was not being cleaned up. Fix the pool.end() call in src/db/connection.ts and update the Dockerfile to set NODE_OPTIONS=--max-old-space-size=384.', behaviorDescription: 'Root cause identified in third session — three sessions spent on what profiling would have caught in one' },
          ],
          lowConfidence: false,
          verifiableAction: {
            action: 'When a Kubernetes pod is OOMKilled, before modifying memory limits in the deployment manifest, first use Bash to run kubectl top pods and kubectl exec to check actual memory usage, then profile the application with NODE_OPTIONS=--inspect to identify the memory consumer.',
            checkDescription: 'Session log shows a Bash tool call with kubectl top pods or kubectl exec with memory diagnostics BEFORE any Edit call modifying the deployment manifest memory limits.',
            toolOrPattern: 'kubectl top pods and Node.js --inspect memory profiling',
          },
          goalRelevance: 'Your platform-infra serves production workloads — repeatedly bumping memory limits without identifying leaks wastes cluster resources and creates ticking time bombs that crash under sustained load.',
          categoryTags: ['kubernetes-debugging', 'memory-profiling', 'dockerfile-optimization', 'connection-pooling'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      ...createMinimalDomainResults(['sessionCraft', 'toolMastery', 'skillResilience', 'sessionMastery'], {
        sessionCraft: 72, toolMastery: 75, skillResilience: 70, sessionMastery: 74,
      }),
    ],
  };
}

function createProfile5_TestDriven(): SessionProfile {
  return {
    id: 'profile-test-driven',
    label: 'TDD Practitioner — Python/pytest Developer',
    projectName: 'ml-pipeline',
    projectPath: '/home/dev/ml-pipeline',
    sessionCount: 2,
    sessions: [
      {
        sessionId: 'tdd-sess-1',
        messages: [
          { uuid: 'u1', role: 'user', timestamp: '2026-03-10T10:00:00Z', content: 'I need to add a data validation step in the ML pipeline. First, write the test in tests/test_validation.py that checks for null values, type mismatches, and out-of-range features. Then implement the validator.' },
          { uuid: 'a1', role: 'assistant', timestamp: '2026-03-10T10:02:00Z', content: 'Writing the test first...', toolCalls: [{ id: 't1', name: 'Write', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u2', role: 'user', timestamp: '2026-03-10T10:15:00Z', content: 'Good. Now implement src/pipeline/validator.py to make all tests pass. Make sure it handles pandas DataFrames and numpy arrays.' },
          { uuid: 'a2', role: 'assistant', timestamp: '2026-03-10T10:17:00Z', content: 'Implementing the validator...', toolCalls: [{ id: 't2', name: 'Write', input: {}, result: 'ok' }], tokenUsage: { input: 600, output: 500 } },
        ],
      },
      {
        sessionId: 'tdd-sess-2',
        messages: [
          { uuid: 'u3', role: 'user', timestamp: '2026-03-11T14:00:00Z', content: 'The validator is too slow on large datasets (10M+ rows). Profile it with cProfile and optimize the null check to use vectorized numpy operations instead of iterating rows.' },
          { uuid: 'a3', role: 'assistant', timestamp: '2026-03-11T14:02:00Z', content: 'Profiling with cProfile...', toolCalls: [{ id: 't3', name: 'Bash', input: { command: 'python -m cProfile -o profile.out src/pipeline/validator.py' }, result: 'ok' }], tokenUsage: { input: 450, output: 350 } },
          { uuid: 'u4', role: 'user', timestamp: '2026-03-11T14:20:00Z', content: 'The profile shows the null check is 80% of execution time. Replace the loop with np.isnan() vectorized check. Make sure the existing tests still pass.' },
          { uuid: 'a4', role: 'assistant', timestamp: '2026-03-11T14:22:00Z', content: 'Optimized with vectorized numpy operations. Running tests...', toolCalls: [{ id: 't4', name: 'Edit', input: {}, result: 'ok' }, { id: 't5', name: 'Bash', input: { command: 'pytest tests/test_validation.py -v' }, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
        ],
      },
    ],
    scores: { ...deterministicScores, aiPartnership: 88, toolMastery: 85, sessionCraft: 82 },
    domainResults: [
      {
        domain: 'aiPartnership',
        overallScore: 88,
        confidenceScore: 0.90,
        strengths: [{
          title: 'Test-first workflow with explicit verification gates',
          description: 'The developer consistently writes tests before implementation and uses test execution as a verification gate before moving forward. This disciplined TDD approach ensures the AI generates code that meets specific acceptance criteria, reducing iteration cycles and producing more reliable implementations. The explicit "make all tests pass" instruction keeps the AI focused on correctness rather than feature completeness.',
          evidence: [
            { utteranceId: 'tdd-sess-1_0', quote: 'First, write the test in tests/test_validation.py that checks for null values, type mismatches, and out-of-range features. Then implement the validator.' },
          ],
        }],
        growthAreas: [{
          title: 'Missing Performance Regression Tests for Optimized numpy Validators',
          description: 'While your TDD workflow is strong for correctness, you optimized the data validator for performance (vectorized numpy operations) without adding a performance regression test. In tdd-sess-2, you profiled with cProfile and optimized the null check, then verified existing tests pass — but added no benchmark test to detect if future changes regress the vectorized performance. For an ML pipeline processing 10M+ rows, a regression from vectorized to iterative operations could make the pipeline unrunnable in production batch processing windows.',
          severity: 'medium',
          recommendation: 'After optimizing any hot path in the ML pipeline, add a pytest-benchmark test (e.g., tests/test_validation_perf.py) that asserts the operation completes within a time threshold for a standard dataset size. This catches performance regressions the same way your existing tests catch correctness regressions.',
          evidence: [
            { utteranceId: 'tdd-sess-1_1', quote: 'Good. Now implement src/pipeline/validator.py to make all tests pass. Make sure it handles pandas DataFrames and numpy arrays.', sessionId: 'tdd-sess-1', behaviorDescription: 'Wrote correctness tests but no performance baseline test before implementing the hot path' },
            { utteranceId: 'tdd-sess-2_1', quote: 'The profile shows the null check is 80% of execution time. Replace the loop with np.isnan() vectorized check. Make sure the existing tests still pass.', sessionId: 'tdd-sess-2', behaviorDescription: 'Verified correctness tests pass but did not add a performance benchmark test to prevent regressions' },
          ],
          evidenceMoments: [
            { utteranceId: 'tdd-sess-1_1', sessionId: 'tdd-sess-1', quote: 'Good. Now implement src/pipeline/validator.py to make all tests pass. Make sure it handles pandas DataFrames and numpy arrays.', behaviorDescription: 'Wrote correctness tests but no performance baseline test before implementing the hot path' },
            { utteranceId: 'tdd-sess-2_1', sessionId: 'tdd-sess-2', quote: 'The profile shows the null check is 80% of execution time. Replace the loop with np.isnan() vectorized check. Make sure the existing tests still pass.', behaviorDescription: 'Verified correctness but not performance — no benchmark test added after optimization' },
          ],
          lowConfidence: true, // Pattern emerging across sessions but still early
          verifiableAction: {
            action: 'After optimizing any performance-critical function in the ML pipeline, add a pytest-benchmark test file that asserts the optimized function completes within a time threshold for a representative dataset size (e.g., 1M rows in under 2 seconds).',
            checkDescription: 'Session log shows a Write tool call creating a test file with pytest-benchmark or time-based assertions after an Edit call that optimizes a hot path.',
            toolOrPattern: 'pytest-benchmark or time-assertion test files',
          },
          goalRelevance: 'Your ML pipeline processes 10M+ row datasets in batch — a regression from vectorized numpy to row iteration could make the pipeline miss production processing windows, blocking model training and retraining schedules.',
          categoryTags: ['performance-testing', 'tdd-workflow', 'numpy-optimization', 'ml-pipeline'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      ...createMinimalDomainResults(['sessionCraft', 'toolMastery', 'skillResilience', 'sessionMastery'], {
        sessionCraft: 82, toolMastery: 85, skillResilience: 80, sessionMastery: 83,
      }),
    ],
  };
}

function createProfile6_CICDPipeline(): SessionProfile {
  return {
    id: 'profile-cicd-pipeline',
    label: 'CI/CD Pipeline Optimization — GitHub Actions Developer',
    projectName: 'monorepo-ci',
    projectPath: '/home/dev/monorepo-ci',
    sessionCount: 2,
    sessions: [
      {
        sessionId: 'cicd-sess-1',
        messages: [
          { uuid: 'u1', role: 'user', timestamp: '2026-03-10T13:00:00Z', content: 'The CI pipeline in .github/workflows/ci.yml takes 25 minutes. The main bottleneck is the npm install step. Can you add caching and parallel jobs?' },
          { uuid: 'a1', role: 'assistant', timestamp: '2026-03-10T13:02:00Z', content: 'Reading the workflow file...', toolCalls: [{ id: 't1', name: 'Read', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u2', role: 'user', timestamp: '2026-03-10T13:10:00Z', content: 'Add actions/cache for node_modules and split lint, test, and build into parallel jobs. Also add the turbo cache for the monorepo.' },
          { uuid: 'a2', role: 'assistant', timestamp: '2026-03-10T13:12:00Z', content: 'Updated workflow with caching and parallel jobs.', toolCalls: [{ id: 't2', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 600, output: 500 } },
        ],
      },
      {
        sessionId: 'cicd-sess-2',
        messages: [
          { uuid: 'u3', role: 'user', timestamp: '2026-03-11T15:00:00Z', content: 'The parallel jobs are running but the test job is failing because it depends on the build output. We need to add a dependency between jobs and share artifacts.' },
          { uuid: 'a3', role: 'assistant', timestamp: '2026-03-11T15:02:00Z', content: 'Adding job dependencies and artifact sharing...', toolCalls: [{ id: 't3', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u4', role: 'user', timestamp: '2026-03-11T15:15:00Z', content: 'Good. Now add a workflow_dispatch trigger so we can manually run it for testing. Also verify the cache key includes the lockfile hash.' },
          { uuid: 'a4', role: 'assistant', timestamp: '2026-03-11T15:17:00Z', content: 'Added workflow_dispatch and verified cache key.', toolCalls: [{ id: 't4', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 400, output: 300 } },
        ],
      },
    ],
    scores: { ...deterministicScores, aiPartnership: 74, sessionCraft: 70 },
    domainResults: [
      {
        domain: 'aiPartnership',
        overallScore: 74,
        confidenceScore: 0.81,
        strengths: [{
          title: 'Specific CI optimization instructions',
          description: 'The developer provides precise optimization targets (npm install step, 25-minute total time, specific cache actions and turbo support) rather than vague "make it faster" requests. This specificity helps the AI focus on the right optimization levers and produce immediately applicable workflow changes rather than generic CI advice.',
          evidence: [{ utteranceId: 'cicd-sess-1_0', quote: 'The CI pipeline in .github/workflows/ci.yml takes 25 minutes. The main bottleneck is the npm install step. Can you add caching and parallel jobs?' }],
        }],
        growthAreas: [{
          title: 'Job Dependency Planning Missing Before Parallelizing GitHub Actions Workflows',
          description: 'When optimizing the CI pipeline, you split jobs into parallel without first mapping the dependency graph between lint, test, and build steps. In cicd-sess-1, you requested parallel jobs without specifying which jobs depend on build artifacts. By cicd-sess-2, the test job failed because it needed build output that was not yet shared as an artifact. This oversight cost an extra session to fix and would cause CI failures on every PR until the dependency was added. In a monorepo CI context, incorrect job dependencies can block the entire team.',
          severity: 'medium',
          recommendation: 'Before splitting a CI workflow into parallel jobs, first ask the AI to map the dependency graph: list which jobs produce artifacts and which jobs consume them. Use a simple text format like "build → [test, deploy], lint → [] (independent)" to validate the dependency structure before modifying the workflow YAML.',
          evidence: [
            { utteranceId: 'cicd-sess-1_1', quote: 'Add actions/cache for node_modules and split lint, test, and build into parallel jobs. Also add the turbo cache for the monorepo.', sessionId: 'cicd-sess-1', behaviorDescription: 'Requested parallel jobs without specifying the dependency graph between steps' },
            { utteranceId: 'cicd-sess-2_0', quote: 'The parallel jobs are running but the test job is failing because it depends on the build output. We need to add a dependency between jobs and share artifacts.', sessionId: 'cicd-sess-2', behaviorDescription: 'Discovered missing job dependency that caused test failures — dependency mapping upfront would have prevented this' },
          ],
          evidenceMoments: [
            { utteranceId: 'cicd-sess-1_1', sessionId: 'cicd-sess-1', quote: 'Add actions/cache for node_modules and split lint, test, and build into parallel jobs. Also add the turbo cache for the monorepo.', behaviorDescription: 'Parallelized jobs without mapping dependency graph' },
            { utteranceId: 'cicd-sess-2_0', sessionId: 'cicd-sess-2', quote: 'The parallel jobs are running but the test job is failing because it depends on the build output. We need to add a dependency between jobs and share artifacts.', behaviorDescription: 'Missing dependency caused test failures in CI' },
          ],
          lowConfidence: false,
          verifiableAction: {
            action: 'Before splitting any CI workflow into parallel jobs, first ask the AI to output a text-based dependency graph (e.g., "build → test, lint → independent") by reading the current workflow steps and identifying which steps produce artifacts consumed by others.',
            checkDescription: 'Session log shows an assistant message containing a dependency graph or "needs:" analysis of the CI workflow BEFORE Edit calls that add parallel jobs.',
            toolOrPattern: 'GitHub Actions needs: dependency mapping',
          },
          goalRelevance: 'Your monorepo CI serves the entire development team — broken job dependencies block every PR in the pipeline and waste developer time waiting for failed CI runs to complete before the root cause is identified.',
          categoryTags: ['ci-cd-optimization', 'github-actions', 'job-dependencies', 'monorepo'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      ...createMinimalDomainResults(['sessionCraft', 'toolMastery', 'skillResilience', 'sessionMastery'], {
        sessionCraft: 70, toolMastery: 76, skillResilience: 73, sessionMastery: 75,
      }),
    ],
  };
}

function createProfile7_DatabaseMigration(): SessionProfile {
  return {
    id: 'profile-db-migration',
    label: 'Schema Migration — Prisma/PostgreSQL Developer',
    projectName: 'multi-tenant-app',
    projectPath: '/home/dev/multi-tenant-app',
    sessionCount: 2,
    sessions: [
      {
        sessionId: 'db-sess-1',
        messages: [
          { uuid: 'u1', role: 'user', timestamp: '2026-03-10T16:00:00Z', content: 'I need to add a new "teams" table to the Prisma schema with a many-to-many relation to users. Update prisma/schema.prisma and create the migration.' },
          { uuid: 'a1', role: 'assistant', timestamp: '2026-03-10T16:02:00Z', content: 'Reading schema and updating...', toolCalls: [{ id: 't1', name: 'Read', input: {}, result: 'ok' }, { id: 't2', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u2', role: 'user', timestamp: '2026-03-10T16:10:00Z', content: 'Run npx prisma migrate dev and check if the migration SQL looks correct.' },
          { uuid: 'a2', role: 'assistant', timestamp: '2026-03-10T16:12:00Z', content: 'Migration created and applied.', toolCalls: [{ id: 't3', name: 'Bash', input: { command: 'npx prisma migrate dev --name add-teams' }, result: 'ok' }], tokenUsage: { input: 400, output: 300 } },
        ],
      },
      {
        sessionId: 'db-sess-2',
        messages: [
          { uuid: 'u3', role: 'user', timestamp: '2026-03-11T11:00:00Z', content: 'The migration broke existing user queries because the join table needs a composite index. Also, the tenant_id foreign key is missing on the teams table — this is a multi-tenant app so every table needs tenant_id.' },
          { uuid: 'a3', role: 'assistant', timestamp: '2026-03-11T11:02:00Z', content: 'Adding composite index and tenant_id...', toolCalls: [{ id: 't4', name: 'Edit', input: {}, result: 'ok' }], tokenUsage: { input: 500, output: 400 } },
          { uuid: 'u4', role: 'user', timestamp: '2026-03-11T11:15:00Z', content: 'Check the migration diff with npx prisma migrate diff to make sure only the expected changes are included before applying.' },
          { uuid: 'a4', role: 'assistant', timestamp: '2026-03-11T11:17:00Z', content: 'Migration diff looks correct. Applying...', toolCalls: [{ id: 't5', name: 'Bash', input: { command: 'npx prisma migrate dev --name fix-teams-index' }, result: 'ok' }], tokenUsage: { input: 400, output: 300 } },
        ],
      },
    ],
    scores: { ...deterministicScores, aiPartnership: 71, sessionCraft: 73 },
    domainResults: [
      {
        domain: 'aiPartnership',
        overallScore: 71,
        confidenceScore: 0.79,
        strengths: [{
          title: 'Migration diff verification before applying',
          description: 'The developer learned to verify migration diffs before applying changes, showing an improving verification workflow. By the second session, the developer requested an explicit diff check with prisma migrate diff, demonstrating awareness that database migrations need extra caution. This verification habit is particularly valuable in multi-tenant applications where schema changes affect all tenants simultaneously.',
          evidence: [{ utteranceId: 'db-sess-2_1', quote: 'Check the migration diff with npx prisma migrate diff to make sure only the expected changes are included before applying.' }],
        }],
        growthAreas: [{
          title: 'Missing Multi-Tenant Schema Checklist Before Prisma Migrations',
          description: 'When adding the teams table to your multi-tenant application schema, you omitted the tenant_id foreign key — a critical constraint that must exist on every table in your multi-tenant architecture. In db-sess-1, you created the migration without verifying it against your multi-tenant requirements (tenant_id on all tables, composite indexes including tenant_id). By db-sess-2, you discovered the omission had broken existing queries. This pattern is dangerous in multi-tenant apps because a missing tenant_id constraint can expose data across tenants.',
          severity: 'critical',
          recommendation: 'Before running any prisma migrate dev for new tables, first ask the AI to verify the schema against your multi-tenant checklist: (1) Does the new table have a tenant_id column with foreign key? (2) Are all indexes composite with tenant_id? (3) Does the migration SQL include row-level security policies? Review this checklist output before running the migration.',
          evidence: [
            { utteranceId: 'db-sess-1_0', quote: 'I need to add a new "teams" table to the Prisma schema with a many-to-many relation to users. Update prisma/schema.prisma and create the migration.', sessionId: 'db-sess-1', behaviorDescription: 'Created new table migration without specifying multi-tenant constraints like tenant_id' },
            { utteranceId: 'db-sess-2_0', quote: 'The migration broke existing user queries because the join table needs a composite index. Also, the tenant_id foreign key is missing on the teams table — this is a multi-tenant app so every table needs tenant_id.', sessionId: 'db-sess-2', behaviorDescription: 'Discovered missing tenant_id and indexes after the migration was already applied to the database' },
          ],
          evidenceMoments: [
            { utteranceId: 'db-sess-1_0', sessionId: 'db-sess-1', quote: 'I need to add a new "teams" table to the Prisma schema with a many-to-many relation to users. Update prisma/schema.prisma and create the migration.', behaviorDescription: 'Created table without specifying multi-tenant constraints' },
            { utteranceId: 'db-sess-2_0', sessionId: 'db-sess-2', quote: 'The migration broke existing user queries because the join table needs a composite index. Also, the tenant_id foreign key is missing on the teams table — this is a multi-tenant app so every table needs tenant_id.', behaviorDescription: 'Discovered missing tenant_id after migration was already applied' },
          ],
          lowConfidence: false,
          verifiableAction: {
            action: 'Before running prisma migrate dev for any new table, ask the AI to output a multi-tenant schema compliance check: verify tenant_id foreign key exists, composite indexes include tenant_id, and row-level security constraints are present in the generated migration SQL.',
            checkDescription: 'Session log shows an assistant message containing "tenant_id" verification or schema compliance check BEFORE any Bash call running prisma migrate dev.',
            toolOrPattern: 'Prisma schema validation and prisma migrate diff',
          },
          goalRelevance: 'Your multi-tenant-app stores data for multiple customers in the same database — a missing tenant_id constraint can expose one tenant\'s data to another, creating a critical security vulnerability and potential compliance violation.',
          categoryTags: ['prisma-migrations', 'multi-tenant-security', 'schema-validation', 'postgresql'],
        }],
        data: {},
        analyzedAt: '2026-03-12T15:00:00Z',
      },
      ...createMinimalDomainResults(['sessionCraft', 'toolMastery', 'skillResilience', 'sessionMastery'], {
        sessionCraft: 73, toolMastery: 77, skillResilience: 72, sessionMastery: 74,
      }),
    ],
  };
}

// ============================================================================
// Helper: create minimal domain results for domains without growth areas
// ============================================================================

function createMinimalDomainResults(
  domains: string[],
  scores: Record<string, number>,
): DomainResult[] {
  return domains.map(domain => ({
    domain: domain as DomainResult['domain'],
    overallScore: scores[domain] ?? 75,
    confidenceScore: 0.80,
    strengths: [{
      title: `Competent ${domain} practices`,
      description: `The developer demonstrates adequate competency in ${domain} with consistent patterns across analyzed sessions. While no standout strengths were identified, the developer maintains a baseline of professional behavior that supports effective AI collaboration and session management across the development workflow.`,
      evidence: [{ utteranceId: 'placeholder_0', quote: 'Consistent baseline behavior observed across analyzed sessions.' }],
    }],
    growthAreas: [],
    data: {},
    analyzedAt: '2026-03-12T15:00:00Z',
  }));
}

// ============================================================================
// Quality Rubric Validator
// ============================================================================

interface RubricResult {
  profileId: string;
  profileLabel: string;
  domain: string;
  growthAreaTitle: string;
  rubric: QualityRubric;
  passes: boolean;
  details: {
    distinctMomentCount: number;
    distinctSessionCount: number;
    hasVerifiableAction: boolean;
    hasSpecificToolNames: boolean;
    descriptionLength: number;
    hasGoalRelevance: boolean;
    hasEvidenceMoments: boolean;
    lowConfidence: boolean;
    categoryTagCount: number;
  };
}

function evaluateGrowthAreaRubric(
  profileId: string,
  profileLabel: string,
  domainResult: DomainResult,
): RubricResult[] {
  return domainResult.growthAreas.map(ga => {
    const evidenceMoments = ga.evidenceMoments ?? [];
    const distinctSessions = new Set(evidenceMoments.map(m => m.sessionId));

    // Criterion 1: distinct_moments — 2+ distinct moments from different sessions
    const distinctMoments = evidenceMoments.length >= 2 && distinctSessions.size >= 2;

    // Criterion 2: verifiable_action — concrete enough to check in logs
    const verifiableAction = !!(
      ga.verifiableAction?.action &&
      ga.verifiableAction.action.length >= 50 &&
      ga.verifiableAction.checkDescription &&
      ga.verifiableAction.checkDescription.length >= 30
    );

    // Criterion 3: pattern_specificity — not generic advice
    const patternSpecificity = !!(
      ga.description.length >= 100 &&
      ga.goalRelevance &&
      ga.goalRelevance.length >= 30
    );

    // Criterion 4: tool_file_naming — names specific tools/files/APIs
    // Check if evidence mentions specific tools, files, or APIs in the title or description
    const toolPatterns = /\b(src\/|\.ts|\.js|\.py|\.tsx|\.yml|Express|React|Prisma|jest|npm|npx|kubectl|Docker|Knex|GitHub Actions|pytest|numpy|pandas|cProfile)\b/i;
    const toolFileNaming = toolPatterns.test(ga.title) || toolPatterns.test(ga.description);

    const rubric: QualityRubric = {
      distinctMoments,
      verifiableAction,
      patternSpecificity,
      toolFileNaming,
    };

    return {
      profileId,
      profileLabel,
      domain: domainResult.domain,
      growthAreaTitle: ga.title,
      rubric,
      passes: passesQualityRubric(rubric),
      details: {
        distinctMomentCount: evidenceMoments.length,
        distinctSessionCount: distinctSessions.size,
        hasVerifiableAction: verifiableAction,
        hasSpecificToolNames: toolFileNaming,
        descriptionLength: ga.description.length,
        hasGoalRelevance: !!(ga.goalRelevance && ga.goalRelevance.length >= 30),
        hasEvidenceMoments: evidenceMoments.length >= 2,
        lowConfidence: ga.lowConfidence ?? false,
        categoryTagCount: ga.categoryTags?.length ?? 0,
      },
    };
  });
}

// ============================================================================
// Pipeline Runner: create run → save domains → assemble → extract growth areas
// ============================================================================

interface PipelineResult {
  profileId: string;
  profileLabel: string;
  runId: number;
  domainResults: DomainResult[];
  growthAreaSummary: Array<{
    domain: string;
    title: string;
    severity: string;
    evidenceMomentCount: number;
    hasKbTip: boolean;
    kbTipTitle: string | null;
    kbTipRelevance: number | null;
    kbTipCredibility: string | null;
    lowConfidence: boolean;
    categoryTags: string[];
  }>;
  rubricResults: RubricResult[];
  peaValidationErrors: string[];
  allPass: boolean;
}

function runPipeline(profile: SessionProfile): PipelineResult {
  // Build Phase1Output from profile sessions
  const phase1Output = buildPhase1Output(profile);

  // Create analysis run
  const runId = createAnalysisRun({
    metrics: phase1Output.sessionMetrics,
    scores: profile.scores,
    phase1Output,
    activitySessions: phase1Output.activitySessions,
  });
  pinCurrentRunId(runId);

  // Save domain results
  for (const dr of profile.domainResults) {
    saveDomainResult(runId, dr);
  }

  // ── KB Enrichment Pipeline ────────────────────────────────────────────
  // Wire the deterministic KB matcher to attach one best-match knowledge
  // tip per growth area. Uses synthetic KB data for test isolation.
  const enrichedDomainResults = enrichGrowthAreasWithKbTips(
    profile.domainResults,
    SYNTHETIC_KB_ITEMS,
    SYNTHETIC_PROFESSIONAL_INSIGHTS,
  );

  // ── PEA Schema Validation ────────────────────────────────────────────
  // Validate that every growth area with full PEA data parses correctly
  const peaValidationErrors: string[] = [];
  for (const dr of enrichedDomainResults) {
    for (const ga of dr.growthAreas) {
      if (ga.evidenceMoments && ga.evidenceMoments.length >= 2 && ga.categoryTags) {
        // Reconstruct PEA shape for schema validation
        const peaCandidate = {
          pattern: {
            title: ga.title,
            description: ga.description,
            severity: ga.severity,
            toolsFilesApis: extractToolNames(ga.title + ' ' + ga.description),
          },
          evidence: ga.evidenceMoments.map(m => ({
            utteranceId: m.utteranceId,
            sessionId: m.sessionId,
            quote: m.quote,
            context: m.behaviorDescription || 'Context from session analysis',
            observation: m.behaviorDescription || 'Behavioral observation from session',
          })),
          action: {
            instruction: ga.recommendation,
            verificationCheck: ga.verifiableAction?.checkDescription ?? 'Check session logs for behavioral change',
            goalRelevance: ga.goalRelevance ?? 'Improves development workflow efficiency',
          },
          qualityRubric: {
            distinctMoments: true,
            verifiableAction: true,
            patternSpecificity: true,
            toolFileNaming: true,
          },
          domain: dr.domain,
          categoryTags: ga.categoryTags,
          lowConfidence: ga.lowConfidence,
        };
        const parseResult = GrowthAreaPEASchema.safeParse(peaCandidate);
        if (!parseResult.success) {
          peaValidationErrors.push(
            `${dr.domain}/${ga.title}: ${parseResult.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`,
          );
        }
      }
    }
  }

  // Collect rubric results against enriched data
  const rubricResults: RubricResult[] = [];
  for (const dr of enrichedDomainResults) {
    rubricResults.push(...evaluateGrowthAreaRubric(profile.id, profile.label, dr));
  }

  // Build summary from enriched results (shows KB tip attachment)
  const growthAreaSummary = enrichedDomainResults.flatMap(dr =>
    dr.growthAreas.map(ga => ({
      domain: dr.domain,
      title: ga.title,
      severity: ga.severity,
      evidenceMomentCount: ga.evidenceMoments?.length ?? 0,
      hasKbTip: !!ga.kbTip,
      kbTipTitle: ga.kbTip?.title ?? null,
      kbTipRelevance: ga.kbTip?.relevanceScore ?? null,
      kbTipCredibility: ga.kbTip?.credibilityTier ?? null,
      lowConfidence: ga.lowConfidence ?? false,
      categoryTags: ga.categoryTags ?? [],
    })),
  );

  return {
    profileId: profile.id,
    profileLabel: profile.label,
    runId,
    domainResults: enrichedDomainResults,
    growthAreaSummary,
    rubricResults,
    peaValidationErrors,
    allPass: rubricResults.every(r => r.passes),
  };
}

/** Extract tool/file/API names from text for PEA schema validation */
function extractToolNames(text: string): string[] {
  const patterns = [
    /\b(Express(?:\.js)?|React|Prisma|jest|npm|npx|kubectl|Docker(?:file)?|Knex|GitHub Actions|pytest|numpy|pandas|cProfile)\b/gi,
    /\b(src\/[\w/.]+)\b/g,
    /\b([\w-]+\.(?:ts|js|py|tsx|yml|yaml))\b/g,
  ];
  const found = new Set<string>();
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      found.add(match[1]);
    }
  }
  return found.size > 0 ? [...found] : ['general-tool'];
}

function buildPhase1Output(profile: SessionProfile): Phase1Output {
  const allMessages = profile.sessions.flatMap(s => s.messages);
  const userMessages = allMessages.filter(m => m.role === 'user');

  return {
    developerUtterances: userMessages.map((m, i) => {
      const session = profile.sessions.find(s =>
        s.messages.some(msg => msg.uuid === m.uuid),
      )!;
      return {
        id: `${session.sessionId}_${i}`,
        text: m.content,
        displayText: m.content,
        timestamp: m.timestamp,
        sessionId: session.sessionId,
        turnIndex: i,
        characterCount: m.content.length,
        wordCount: m.content.split(/\s+/).length,
        hasCodeBlock: false,
        hasQuestion: m.content.includes('?'),
        isSessionStart: i === 0,
        precedingAIToolCalls: [],
      };
    }),
    sessionMetrics: {
      totalSessions: profile.sessionCount,
      totalMessages: allMessages.length,
      totalDeveloperUtterances: userMessages.length,
      totalAIResponses: allMessages.filter(m => m.role === 'assistant').length,
      avgMessagesPerSession: allMessages.length / profile.sessionCount,
      avgDeveloperMessageLength: Math.round(
        userMessages.reduce((sum, m) => sum + m.content.length, 0) / userMessages.length,
      ),
      questionRatio: userMessages.filter(m => m.content.includes('?')).length / userMessages.length,
      codeBlockRatio: 0,
      avgContextFillPercent: 45,
      maxContextFillPercent: 68,
      dateRange: {
        earliest: allMessages[0]?.timestamp ?? '2026-03-10T00:00:00Z',
        latest: allMessages[allMessages.length - 1]?.timestamp ?? '2026-03-12T00:00:00Z',
      },
    },
    aiInsightBlocks: [],
    activitySessions: profile.sessions.map(s => ({
      sessionId: s.sessionId,
      projectName: profile.projectName,
      projectPath: profile.projectPath,
      startTime: s.messages[0]?.timestamp ?? '',
      durationSeconds: 720,
      messageCount: s.messages.length,
      userMessageCount: s.messages.filter(m => m.role === 'user').length,
      assistantMessageCount: s.messages.filter(m => m.role === 'assistant').length,
      totalInputTokens: s.messages.reduce((sum, m) => sum + (m.tokenUsage?.input ?? 0), 0),
      totalOutputTokens: s.messages.reduce((sum, m) => sum + (m.tokenUsage?.output ?? 0), 0),
      firstUserMessage: s.messages.find(m => m.role === 'user')?.content ?? '',
    })),
    sessions: profile.sessions.map(s => ({
      sessionId: s.sessionId,
      projectPath: profile.projectPath,
      projectName: profile.projectName,
      startTime: s.messages[0]?.timestamp ?? '',
      endTime: s.messages[s.messages.length - 1]?.timestamp ?? '',
      durationSeconds: 720,
      claudeCodeVersion: '1.0.0',
      messages: s.messages.map(m => ({
        uuid: m.uuid,
        role: m.role,
        timestamp: m.timestamp,
        content: m.content,
        toolCalls: m.toolCalls,
        tokenUsage: m.tokenUsage,
      })),
      stats: {
        userMessageCount: s.messages.filter(m => m.role === 'user').length,
        assistantMessageCount: s.messages.filter(m => m.role === 'assistant').length,
        toolCallCount: s.messages.reduce((sum, m) => sum + (m.toolCalls?.length ?? 0), 0),
        uniqueToolsUsed: [...new Set(s.messages.flatMap(m => m.toolCalls?.map(t => t.name) ?? []))],
        totalInputTokens: s.messages.reduce((sum, m) => sum + (m.tokenUsage?.input ?? 0), 0),
        totalOutputTokens: s.messages.reduce((sum, m) => sum + (m.tokenUsage?.output ?? 0), 0),
      },
      source: 'claude-code' as const,
    })),
  };
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Growth Area Quality Harness', () => {
  afterEach(() => {
    resetResultsStorage();
  });

  const profiles = [
    createProfile1_AuthRefactoring,
    createProfile2_ReactFrontend,
    createProfile3_APIDebugging,
    createProfile4_InfraDeployment,
    createProfile5_TestDriven,
    createProfile6_CICDPipeline,
    createProfile7_DatabaseMigration,
  ];

  // Individual profile tests
  for (const createProfile of profiles) {
    const profile = createProfile();

    it(`runs pipeline and validates rubric for: ${profile.label}`, () => {
      const result = runPipeline(profile);

      // Every growth area must have evidence moments
      for (const summary of result.growthAreaSummary) {
        expect(summary.evidenceMomentCount).toBeGreaterThanOrEqual(2);
      }

      // Every rubric criterion must pass
      for (const rubric of result.rubricResults) {
        expect(rubric.rubric.distinctMoments).toBe(true);
        expect(rubric.rubric.verifiableAction).toBe(true);
        expect(rubric.rubric.patternSpecificity).toBe(true);
        expect(rubric.rubric.toolFileNaming).toBe(true);
        expect(rubric.passes).toBe(true);
      }
    });
  }

  it('generates comprehensive inspection report with all 7 profiles', () => {
    const allResults: PipelineResult[] = [];

    for (const createProfile of profiles) {
      const profile = createProfile();
      const result = runPipeline(profile);
      allResults.push(result);

      // Reset storage between runs to avoid ID conflicts
      resetResultsStorage();
    }

    // ── Aggregate Statistics ──────────────────────────────────────────
    const totalGrowthAreas = allResults.reduce(
      (sum, r) => sum + r.growthAreaSummary.length, 0,
    );
    const totalPassing = allResults.reduce(
      (sum, r) => sum + r.rubricResults.filter(rr => rr.passes).length, 0,
    );
    const totalFailing = allResults.reduce(
      (sum, r) => sum + r.rubricResults.filter(rr => !rr.passes).length, 0,
    );
    const lowConfidenceCount = allResults.reduce(
      (sum, r) => sum + r.growthAreaSummary.filter(s => s.lowConfidence).length, 0,
    );

    // ── KB Enrichment Statistics ─────────────────────────────────────
    const totalWithKbTip = allResults.reduce(
      (sum, r) => sum + r.growthAreaSummary.filter(s => s.hasKbTip).length, 0,
    );
    const kbTipDetails = allResults.flatMap(r =>
      r.growthAreaSummary
        .filter(s => s.hasKbTip)
        .map(s => ({
          growthArea: s.title,
          tipTitle: s.kbTipTitle,
          relevance: s.kbTipRelevance,
          credibility: s.kbTipCredibility,
        })),
    );

    // ── PEA Schema Validation Stats ──────────────────────────────────
    const allPeaErrors = allResults.flatMap(r => r.peaValidationErrors);

    // ── Category Tag Distribution ────────────────────────────────────
    const allCategoryTags = allResults.flatMap(r =>
      r.growthAreaSummary.flatMap(s => s.categoryTags),
    );
    const tagFrequency = new Map<string, number>();
    for (const tag of allCategoryTags) {
      tagFrequency.set(tag, (tagFrequency.get(tag) ?? 0) + 1);
    }

    // ── Build the Full Inspection Report ─────────────────────────────
    const inspectionReport = {
      generatedAt: new Date().toISOString(),
      harness: 'growth-area-pipeline-harness v2 — with KB enrichment + PEA validation',
      summary: {
        profileCount: allResults.length,
        totalGrowthAreas,
        totalPassing,
        totalFailing,
        passRate: `${Math.round((totalPassing / (totalPassing + totalFailing)) * 100)}%`,
        lowConfidenceCount,
        allProfilesPass: allResults.every(r => r.allPass),
      },
      kbEnrichment: {
        syntheticKbItemCount: SYNTHETIC_KB_ITEMS.length,
        syntheticInsightCount: SYNTHETIC_PROFESSIONAL_INSIGHTS.length,
        growthAreasWithKbTip: totalWithKbTip,
        growthAreasWithoutKbTip: totalGrowthAreas - totalWithKbTip,
        kbTipAttachmentRate: `${Math.round((totalWithKbTip / totalGrowthAreas) * 100)}%`,
        attachedTips: kbTipDetails,
      },
      peaValidation: {
        totalValidated: allResults.reduce((sum, r) =>
          sum + r.domainResults.flatMap(dr => dr.growthAreas).filter(ga =>
            ga.evidenceMoments && ga.evidenceMoments.length >= 2 && ga.categoryTags,
          ).length, 0,
        ),
        errors: allPeaErrors,
        allValid: allPeaErrors.length === 0,
      },
      rubricCriteria: {
        distinctMoments: 'References 2-3+ distinct specific moments from actual sessions',
        verifiableAction: 'Action concrete enough to verify in future session logs',
        patternSpecificity: 'Specific to this builder — not generic advice',
        toolFileNaming: 'Names specific tools, files, APIs, or technologies',
      },
      categoryTagDistribution: Object.fromEntries(
        [...tagFrequency.entries()].sort((a, b) => b[1] - a[1]),
      ),
      profiles: allResults.map(r => ({
        id: r.profileId,
        label: r.profileLabel,
        growthAreaCount: r.growthAreaSummary.length,
        allPass: r.allPass,
        peaValidationErrors: r.peaValidationErrors,
        growthAreas: r.growthAreaSummary,
        rubricResults: r.rubricResults.map(rr => ({
          domain: rr.domain,
          title: rr.growthAreaTitle,
          passes: rr.passes,
          criteria: rr.rubric,
          details: rr.details,
        })),
        // Include full domain results for detailed inspection
        domainResults: r.domainResults.filter(dr => dr.growthAreas.length > 0),
      })),
    };

    // Write to test-results directory
    mkdirSync(OUTPUT_DIR, { recursive: true });
    writeFileSync(
      join(OUTPUT_DIR, 'growth-area-harness-report.json'),
      JSON.stringify(inspectionReport, null, 2),
    );

    // ── Assertions ───────────────────────────────────────────────────
    // Core: 7 profiles, all pass rubric
    expect(inspectionReport.summary.profileCount).toBe(7);
    expect(inspectionReport.summary.totalGrowthAreas).toBeGreaterThanOrEqual(7);
    expect(inspectionReport.summary.allProfilesPass).toBe(true);
    expect(inspectionReport.summary.totalFailing).toBe(0);

    // PEA validation: no schema errors
    expect(inspectionReport.peaValidation.allValid).toBe(true);

    // KB enrichment: at least some tips attached (synthetic KB data matches)
    expect(totalWithKbTip).toBeGreaterThanOrEqual(1);

    // Category tag diversity: at least 5 unique tags across all profiles
    expect(tagFrequency.size).toBeGreaterThanOrEqual(5);

    // Low-confidence flagging works (profiles 5 and 1 have low-confidence areas)
    expect(lowConfidenceCount).toBeGreaterThanOrEqual(1);
  });
});
