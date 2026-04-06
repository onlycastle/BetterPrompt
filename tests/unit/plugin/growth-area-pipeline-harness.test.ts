/**
 * Growth Area Pipeline Test Harness
 *
 * Exercises the full growth-area quality pipeline end-to-end:
 *   1. Creates 7 diverse developer personas with multi-session Phase1Output data
 *   2. Defines 3-5 PEA growth areas per persona across all 5 domains
 *   3. Validates every growth area against the 4-criteria quality rubric (hard gate)
 *   4. Enriches growth areas with KB tips via deterministic matcher
 *   5. Aggregates into team view with freeform category tag clustering
 *   6. Outputs all JSON to test-results/ for manual inspection
 *
 * This is NOT an LLM-dependent test — all growth areas are synthetic but realistic,
 * representing what a properly-tuned LLM pipeline should produce. The harness verifies
 * the post-generation validation + enrichment + aggregation layers.
 *
 * Run: npx vitest run tests/unit/plugin/growth-area-pipeline-harness.test.ts
 */

import { describe, it, expect, afterEach, afterAll } from 'vitest';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  passesQualityRubric,
  peaToDomainGrowthArea,
  peaToMemberGrowthArea,
  GrowthAreaPEASchema,
  KB_TIP_RELEVANCE_THRESHOLD,
  hasObservableSignal,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';
import type { GrowthAreaPEA, QualityRubric } from '../../../packages/shared/src/schemas/growth-area-pea.js';
import { enrichGrowthAreasWithKbTips } from '../../../packages/shared/src/matching/kb-growth-area-enricher.js';
import {
  validateGrowthAreaQuality,
  validateGrowthAreaBatch,
} from '../../../packages/shared/src/validation/growth-area-quality-checker.js';
import type { QualityValidationResult } from '../../../packages/shared/src/validation/growth-area-quality-checker.js';
import type { DomainResult } from '../../../packages/shared/src/schemas/domain-result.js';
import type {
  PortableKnowledgeItem,
  PortableProfessionalInsight,
} from '../../../packages/shared/src/matching/knowledge-resource-matcher.js';

// ============================================================================
// Output Directory
// ============================================================================

const OUTPUT_DIR = resolve(__dirname, '../../../test-results/growth-area-harness');

function writeOutput(filename: string, data: unknown): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(join(OUTPUT_DIR, filename), JSON.stringify(data, null, 2));
}

// ============================================================================
// 4-Criteria Quality Rubric Validator
// ============================================================================

/**
 * Evaluate a PEA growth area against the 4-criteria quality rubric.
 *
 * This is the deterministic validation that would run post-LLM-generation.
 * Returns the rubric result and passes/fails the hard gate.
 *
 * AC 3 — verifiable_action: The action must propose a concrete next-session
 * behavior that is checkable against future session logs. Three conditions:
 *   a) instruction >= 50 chars (not a vague one-liner)
 *   b) verificationCheck >= 30 chars (describes what to look for in logs)
 *   c) hasObservableSignal — combined text references a tool name, CLI command,
 *      slash command, file pattern, or structural prompt pattern that would
 *      appear as an observable artifact in JSONL session logs.
 *
 * This mirrors the production evaluateQualityRubric() in growth-area-pea.ts
 * so the harness faithfully represents the hard gate that LLM-generated
 * growth areas must pass before storage.
 */
function evaluateQualityRubric(pea: GrowthAreaPEA): {
  rubric: QualityRubric;
  passes: boolean;
  failures: string[];
} {
  const distinctSessionIds = new Set(pea.evidence.map(e => e.sessionId));

  // AC 3 — verifiable_action: three-part check matching production gate
  const actionInstruction = pea.action.instruction;
  const actionCheck = pea.action.verificationCheck;
  const verifiableAction =
    actionInstruction.length >= 50 &&
    actionCheck.length >= 30 &&
    hasObservableSignal(actionInstruction, actionCheck);

  const rubric: QualityRubric = {
    // 2+ distinct moments from different sessions
    distinctMoments: pea.evidence.length >= 2 && distinctSessionIds.size >= 2,
    // Action is concrete enough to verify by checking future session logs (AC 3)
    verifiableAction,
    // Pattern is specific to this builder (has description > 100 chars and uses specific language)
    patternSpecificity: pea.pattern.description.length >= 100,
    // Names specific tools, files, APIs, or technologies
    toolFileNaming: pea.pattern.toolsFilesApis.length >= 1,
  };

  const failures: string[] = [];
  if (!rubric.distinctMoments) failures.push('distinct_moments: Need 2+ moments from distinct sessions');
  if (!rubric.verifiableAction) {
    const reasons: string[] = [];
    if (actionInstruction.length < 50) reasons.push(`instruction too short (${actionInstruction.length} chars, need 50+)`);
    if (actionCheck.length < 30) reasons.push(`verificationCheck too short (${actionCheck.length} chars, need 30+)`);
    if (!hasObservableSignal(actionInstruction, actionCheck)) {
      reasons.push('no observable session-log signal (tool name, CLI command, slash command, or file reference required)');
    }
    failures.push(`verifiable_action: ${reasons.join('; ')}`);
  }
  if (!rubric.patternSpecificity) failures.push('pattern_specificity: Description too short/generic');
  if (!rubric.toolFileNaming) failures.push('tool_file_naming: No tools/files/APIs named');

  return { rubric, passes: passesQualityRubric(rubric), failures };
}

// ============================================================================
// Synthetic Knowledge Base Items
// ============================================================================

const SYNTHETIC_KB_ITEMS: PortableKnowledgeItem[] = [
  {
    id: 'kb-express-error-handling',
    title: 'Defensive Error Handling in Express Middleware',
    summary: 'Wrap each middleware in a try-catch and pass errors to next() so the centralized error handler can log and respond consistently.',
    sourceUrl: 'https://expressjs.com/en/guide/error-handling.html',
    sourceAuthor: 'Express.js Official Docs',
    contentType: 'documentation',
    tags: ['express', 'error-handling', 'middleware', 'node.js'],
    applicableDimensions: ['TrustVerification', 'WorkflowHabit'],
    relevanceScore: 8,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-react-accessibility',
    title: 'Building Accessible React Components',
    summary: 'Use semantic HTML, ARIA attributes, keyboard navigation, and screen reader testing to ensure React components are accessible to all users.',
    sourceUrl: 'https://react.dev/learn/accessibility',
    sourceAuthor: 'React Official Docs',
    contentType: 'documentation',
    tags: ['react', 'accessibility', 'a11y', 'aria', 'components'],
    applicableDimensions: ['CommunicationPatterns', 'KnowledgeGap'],
    relevanceScore: 7,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-prisma-migrations',
    title: 'Safe Schema Migrations with Prisma',
    summary: 'Always run prisma migrate diff before deploying to preview breaking changes. Use shadow databases for CI and protect production data.',
    sourceUrl: 'https://www.prisma.io/docs/concepts/components/prisma-migrate',
    sourceAuthor: 'Prisma Official Docs',
    contentType: 'documentation',
    tags: ['prisma', 'migrations', 'database', 'schema', 'orm'],
    applicableDimensions: ['KnowledgeGap', 'TrustVerification'],
    relevanceScore: 8,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-docker-layer-caching',
    title: 'Docker Build Optimization with Layer Caching',
    summary: 'Order Dockerfile instructions from least to most frequently changing. Copy package.json before source code to maximize layer cache hits.',
    sourceUrl: 'https://docs.docker.com/build/cache/',
    sourceAuthor: 'Docker Official Docs',
    contentType: 'documentation',
    tags: ['docker', 'caching', 'ci', 'build', 'optimization'],
    applicableDimensions: ['ContextEfficiency', 'WorkflowHabit'],
    relevanceScore: 7,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-testing-error-paths',
    title: 'Test-Driven Error Path Coverage',
    summary: 'Write error path tests before implementing catch blocks. Use jest.spyOn to simulate failures and verify error handling behavior.',
    sourceUrl: 'https://kentcdodds.com/blog/common-mistakes-with-react-testing-library',
    sourceAuthor: 'Kent C. Dodds',
    contentType: 'article',
    tags: ['testing', 'jest', 'error-handling', 'tdd', 'coverage'],
    applicableDimensions: ['TrustVerification', 'KnowledgeGap'],
    relevanceScore: 9,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-context-window-management',
    title: 'Effective Context Window Management for AI Coding',
    summary: 'Keep sessions focused on one task. Use /compact proactively at 60% fill. Reference prior context instead of re-pasting.',
    sourceUrl: 'https://www.reddit.com/r/ClaudeAI/comments/tips_for_context',
    sourceAuthor: 'CommunityPractitioner',
    contentType: 'discussion',
    tags: ['context-window', 'ai-coding', 'session-management', 'prompting'],
    applicableDimensions: ['ContextEfficiency'],
    relevanceScore: 6,
    sourcePlatform: 'reddit',
    credibilityTier: 'standard',
  },
  {
    id: 'kb-plan-command-usage',
    title: 'Structured Task Planning with /plan Command',
    summary: 'Start complex tasks with /plan to decompose into smaller steps. This creates a structured todo that the AI tracks across the session.',
    sourceUrl: 'https://docs.anthropic.com/claude-code/plan-command',
    sourceAuthor: 'Anthropic Docs',
    contentType: 'documentation',
    tags: ['planning', 'task-decomposition', 'claude-code', 'plan-command'],
    applicableDimensions: ['TrustVerification', 'WorkflowHabit'],
    relevanceScore: 8,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
  {
    id: 'kb-nextjs-api-routes',
    title: 'Next.js API Route Best Practices',
    summary: 'Validate request bodies with Zod, return typed responses, handle errors with proper HTTP status codes, and add rate limiting for production.',
    sourceUrl: 'https://nextjs.org/docs/app/building-your-application/routing/route-handlers',
    sourceAuthor: 'Next.js Official Docs',
    contentType: 'documentation',
    tags: ['nextjs', 'api-routes', 'validation', 'zod', 'typescript'],
    applicableDimensions: ['KnowledgeGap', 'TrustVerification'],
    relevanceScore: 7,
    sourcePlatform: 'web',
    credibilityTier: 'high',
  },
];

const SYNTHETIC_PROFESSIONAL_INSIGHTS: PortableProfessionalInsight[] = [
  {
    id: 'pi-verification-habit',
    title: 'The Verification-Before-Commit Habit',
    keyTakeaway: 'Expert developers verify AI-generated code before committing by running tests, reviewing diffs, and checking edge cases.',
    actionableAdvice: [
      'Run the test suite after every AI-generated code change',
      'Review git diff before committing to catch AI hallucinations',
      'Check edge cases the AI might have missed',
    ],
    sourceAuthor: 'BetterPrompt Research',
    sourceUrl: 'https://betterprompt.dev/insights/verification',
    category: 'diagnosis',
    priority: 9,
    applicableDimensions: ['TrustVerification'],
  },
  {
    id: 'pi-session-separation',
    title: 'One Task Per Session Principle',
    keyTakeaway: 'Mixing multiple tasks in one session degrades AI context quality. Start a new session for each distinct task.',
    actionableAdvice: [
      'End the current session before switching to an unrelated task',
      'Use session boundaries to keep context focused',
    ],
    sourceAuthor: 'BetterPrompt Research',
    sourceUrl: 'https://betterprompt.dev/insights/session-separation',
    category: 'trend',
    priority: 7,
    applicableDimensions: ['ContextEfficiency', 'WorkflowHabit'],
  },
];

// ============================================================================
// 7 Diverse Developer Personas with PEA Growth Areas
// ============================================================================

/**
 * Each persona represents a realistic developer profile with:
 * - A project context (what they're building)
 * - Multiple sessions (with session IDs for evidence linking)
 * - 3-5 PEA growth areas across different domains
 *
 * Growth areas are crafted to pass the 4-criteria quality rubric:
 * 1. distinct_moments: 2-3+ moments from different sessions
 * 2. verifiable_action: Concrete enough to check in future logs
 * 3. pattern_specificity: Specific to this builder's actual behavior
 * 4. tool_file_naming: Names specific tools, files, APIs
 */

interface PersonaDefinition {
  name: string;
  project: string;
  sessionIds: string[];
  growthAreas: GrowthAreaPEA[];
}

function createPersonas(): PersonaDefinition[] {
  return [
    // ── Persona 1: Alice — Express API Developer ─────────────────────────
    {
      name: 'Alice Chen',
      project: 'payment-gateway-api',
      sessionIds: ['alice-sess-1', 'alice-sess-2', 'alice-sess-3'],
      growthAreas: [
        {
          pattern: {
            title: 'Untested Error Paths in Express Middleware Chain',
            description:
              'Across multiple sessions working on the payment gateway API, Alice consistently adds try-catch blocks to Express middleware without writing corresponding test cases for the error paths. This creates a false sense of safety — the catch blocks exist but their behavior under real failure conditions is unverified. In session alice-sess-1, she added error handling to the Stripe webhook handler without testing what happens when signature verification fails. In session alice-sess-3, the same pattern repeated with the rate limiter middleware.',
            severity: 'high',
            toolsFilesApis: ['Express.js', 'middleware/stripe-webhook.ts', 'jest', 'supertest'],
          },
          evidence: [
            {
              utteranceId: 'alice-sess-1_5',
              sessionId: 'alice-sess-1',
              quote: 'Add a try-catch around the webhook signature verification and return 400 on failure',
              context: 'Working on Stripe webhook handler in middleware/stripe-webhook.ts',
              observation: 'Added error handling without creating a test for the 400 response path',
            },
            {
              utteranceId: 'alice-sess-2_8',
              sessionId: 'alice-sess-2',
              quote: 'The middleware is crashing in staging but the error message is unhelpful — can you check what the catch block returns?',
              context: 'Debugging production-like failure in auth middleware after deploying untested error path',
              observation: 'Previous untested catch block masked the real error, leading to a debugging session',
            },
            {
              utteranceId: 'alice-sess-3_3',
              sessionId: 'alice-sess-3',
              quote: 'Wrap the rate limiter in try-catch too, same pattern as the webhook handler',
              context: 'Adding rate limiting middleware to API routes, copying untested error pattern',
              observation: 'Repeated the same untested-catch pattern from session 1 without learning from session 2 debugging',
            },
          ],
          action: {
            instruction:
              'Before writing any catch block in Express middleware, first create a test file (e.g., __tests__/middleware-name.test.ts) with a test case that simulates the error condition using jest.spyOn or supertest, then implement the catch block to pass that test.',
            verificationCheck:
              'Session log should show test file creation (Write tool to __tests__/*.test.ts) before or alongside Edit operations on middleware catch blocks.',
            goalRelevance:
              'Your payment gateway API handles real Stripe webhook events — untested error paths in middleware could silently drop payment confirmations, causing transaction discrepancies and revenue loss for merchants.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'aiPartnership',
          categoryTags: ['error-handling', 'test-coverage', 'express-middleware'],
        },
        {
          pattern: {
            title: 'Stale Retry Context in Multi-Attempt Debugging Sessions',
            description:
              'When debugging fails on the first attempt, Alice continues in the same session without restating the current state, causing the AI to optimize for the stale context from the previous failed attempt rather than the current reality. This pattern appeared in both webhook debugging and database connection troubleshooting sessions, resulting in wasted iterations where the AI suggested fixes for already-resolved sub-problems.',
            severity: 'medium',
            toolsFilesApis: ['Express.js', 'Prisma ORM', 'pg (node-postgres)'],
          },
          evidence: [
            {
              utteranceId: 'alice-sess-2_12',
              sessionId: 'alice-sess-2',
              quote: 'That fix did not work either. Try something else.',
              context: 'Third debugging attempt on webhook signature failure without restating what changed',
              observation: 'Vague retry instruction without clearing stale context from previous attempts',
            },
            {
              utteranceId: 'alice-sess-3_9',
              sessionId: 'alice-sess-3',
              quote: 'Still failing. The database connection pool is timing out.',
              context: 'Debugging Prisma connection pool issues after two failed attempts with different configs',
              observation: 'Failed to restate which configs were already tried, causing AI to re-suggest them',
            },
          ],
          action: {
            instruction:
              'After each failed debugging attempt, write a brief status update message that states: (1) what was tried, (2) what the current error is now, and (3) what has been ruled out. Format it as a numbered list before asking for the next suggestion.',
            verificationCheck:
              'Session log should contain numbered status messages (with "tried:", "current error:", "ruled out:" keywords) between consecutive debugging attempts.',
            goalRelevance:
              'Your payment gateway debugging sessions averaged 3.5 retry loops — restating context between retries could cut debugging time by 40%, directly reducing time-to-fix for production payment issues.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'sessionCraft',
          categoryTags: ['debugging-workflow', 'context-management', 'retry-efficiency'],
        },
        {
          pattern: {
            title: 'Missing Prisma Migration Diff Checks Before Schema Deployment',
            description:
              'Alice applies Prisma schema changes and runs prisma migrate dev without first checking the migration diff. This is risky because the generated migration SQL may include destructive operations (DROP COLUMN, ALTER TYPE) that are not obvious from the schema file changes alone. In two sessions, she modified the payments table schema without reviewing what SQL Prisma would generate, trusting the ORM blindly.',
            severity: 'high',
            toolsFilesApis: ['Prisma ORM', 'prisma/schema.prisma', 'prisma migrate dev', 'prisma migrate diff'],
          },
          evidence: [
            {
              utteranceId: 'alice-sess-1_14',
              sessionId: 'alice-sess-1',
              quote: 'Update the Payment model to add a currency field and run the migration',
              context: 'Adding currency support to payments table without reviewing migration SQL',
              observation: 'Instructed AI to run migration without reviewing the generated SQL diff',
            },
            {
              utteranceId: 'alice-sess-3_15',
              sessionId: 'alice-sess-3',
              quote: 'Change the amount field from Int to Decimal and migrate',
              context: 'Changing column type in payments table — potentially destructive migration',
              observation: 'Column type change generates ALTER TYPE SQL which could fail on existing data, but no diff review requested',
            },
          ],
          action: {
            instruction:
              'Before running prisma migrate dev, always run prisma migrate diff --from-schema-datamodel prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma.bak first, then review the SQL output for destructive operations (DROP, ALTER TYPE, DELETE) before proceeding.',
            verificationCheck:
              'Session log should show Bash tool call with "prisma migrate diff" command appearing before any "prisma migrate dev" command in the same session.',
            goalRelevance:
              'Your payment gateway stores financial transaction records — an unreviewed destructive migration could corrupt payment history data or cause downtime during the migration, directly impacting merchant reconciliation.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'toolMastery',
          categoryTags: ['database-migrations', 'prisma', 'safety-checks'],
        },
      ],
    },

    // ── Persona 2: Bob — React Frontend Developer ────────────────────────
    {
      name: 'Bob Martinez',
      project: 'customer-dashboard',
      sessionIds: ['bob-sess-1', 'bob-sess-2', 'bob-sess-3', 'bob-sess-4'],
      growthAreas: [
        {
          pattern: {
            title: 'Missing Keyboard Navigation in Custom React Components',
            description:
              'Bob builds custom interactive components (dropdowns, modals, tabs) without implementing keyboard navigation handlers. Every custom component in the dashboard uses onClick handlers but lacks onKeyDown, onKeyUp, or proper tabIndex attributes. This makes the customer dashboard inaccessible to keyboard-only users and screen reader users, which is a compliance risk for enterprise customers.',
            severity: 'high',
            toolsFilesApis: ['React', 'src/components/Dashboard/FilterDropdown.tsx', 'onKeyDown', 'tabIndex', 'ARIA'],
          },
          evidence: [
            {
              utteranceId: 'bob-sess-1_7',
              sessionId: 'bob-sess-1',
              quote: 'Create a custom dropdown component for the filter bar with onClick to toggle the dropdown open and closed',
              context: 'Building FilterDropdown component with mouse-only interaction model',
              observation: 'Specified click handler but did not mention keyboard interaction or accessibility',
            },
            {
              utteranceId: 'bob-sess-2_4',
              sessionId: 'bob-sess-2',
              quote: 'Add a modal overlay for the export dialog — clicking outside should close it',
              context: 'Building ExportModal component with click-outside-to-close pattern',
              observation: 'No mention of Escape key handler, focus trapping, or aria-modal attribute',
            },
            {
              utteranceId: 'bob-sess-4_2',
              sessionId: 'bob-sess-4',
              quote: 'Build a tab component for switching between chart views in the analytics section',
              context: 'Creating TabSwitcher component for analytics dashboard',
              observation: 'Tab component built with div + onClick — no arrow key navigation or role="tablist"',
            },
          ],
          action: {
            instruction:
              'For every interactive React component, add a brief accessibility spec as a code comment before implementing: list the required ARIA role, keyboard shortcuts (Tab, Enter, Escape, Arrow keys), and focus management behavior. Then implement the onKeyDown handler alongside the onClick handler.',
            verificationCheck:
              'Session log should show a comment block with "ARIA role:", "keyboard:", and "focus:" labels appearing in Write/Edit tool calls before the onClick handler implementation.',
            goalRelevance:
              'Your customer dashboard is used by enterprise clients who require WCAG 2.1 AA compliance — inaccessible components block sales to government and healthcare customers, which are your highest-value segments.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'skillResilience',
          categoryTags: ['accessibility', 'react-components', 'keyboard-navigation', 'wcag'],
        },
        {
          pattern: {
            title: 'Uncontrolled Re-renders in Dashboard Chart Components',
            description:
              'Bob passes inline object literals and arrow functions as props to chart components, causing unnecessary re-renders on every parent state change. The dashboard analytics page re-renders all chart components when any filter changes because the charting library (Recharts) receives new object references on every render cycle. This pattern was observed in both the revenue chart and user activity chart implementations.',
            severity: 'medium',
            toolsFilesApis: ['React', 'Recharts', 'useMemo', 'useCallback', 'React.memo', 'src/components/Analytics/'],
          },
          evidence: [
            {
              utteranceId: 'bob-sess-2_11',
              sessionId: 'bob-sess-2',
              quote: 'Pass the chart data as {{ labels: months, datasets: revenue }} directly to the RevenueChart component',
              context: 'Wiring analytics data into Recharts component with inline object',
              observation: 'Inline object literal creates new reference every render, causing chart re-render',
            },
            {
              utteranceId: 'bob-sess-3_6',
              sessionId: 'bob-sess-3',
              quote: 'The dashboard feels sluggish when switching between date filters — the charts are flickering',
              context: 'Experiencing performance issue caused by unnecessary chart re-renders',
              observation: 'Reporting symptoms of the re-render problem without recognizing the root cause in prop passing',
            },
          ],
          action: {
            instruction:
              'Wrap all chart data objects with useMemo and event handlers with useCallback in the parent component. When passing config objects to Recharts components, memoize them with a dependency array that only includes the actual data source, not the parent state.',
            verificationCheck:
              'Session log should show useMemo or useCallback imports and usage in Edit operations on components that render Recharts or chart library components.',
            goalRelevance:
              'Your customer dashboard loads 6 charts simultaneously — eliminating unnecessary re-renders will reduce the perceived load time from 2.3s to under 1s, which directly impacts user engagement metrics your PM is tracking.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'sessionCraft',
          categoryTags: ['react-performance', 'memoization', 'recharts', 'rendering'],
        },
        {
          pattern: {
            title: 'No Error Boundary Around Third-Party Chart Components',
            description:
              'Bob integrates Recharts components without wrapping them in React Error Boundaries. When chart data is malformed or a Recharts internal error occurs, the entire dashboard page crashes with an unhandled exception rather than showing a graceful fallback. This was observed when null values in the revenue data caused an uncaught TypeError that brought down the whole analytics page.',
            severity: 'medium',
            toolsFilesApis: ['React', 'Recharts', 'ErrorBoundary', 'src/components/Analytics/RevenueChart.tsx'],
          },
          evidence: [
            {
              utteranceId: 'bob-sess-3_12',
              sessionId: 'bob-sess-3',
              quote: 'The whole analytics page crashed when I filtered to a date range with no data — can you fix the null check?',
              context: 'Dashboard crash due to null revenue data passed to Recharts without error boundary',
              observation: 'Treating the symptom (null check) rather than adding structural error isolation',
            },
            {
              utteranceId: 'bob-sess-4_8',
              sessionId: 'bob-sess-4',
              quote: 'Add the new retention chart component next to the revenue chart on the analytics page',
              context: 'Adding another chart without error boundary after experiencing a crash from the same pattern',
              observation: 'Did not add error boundary despite having experienced a chart crash in a previous session',
            },
          ],
          action: {
            instruction:
              'Create a reusable ChartErrorBoundary component in src/components/common/ChartErrorBoundary.tsx that catches errors and renders a "Chart unavailable" fallback. Wrap every Recharts component with it before adding new chart features.',
            verificationCheck:
              'Session log should show a Write or Edit operation creating or importing ChartErrorBoundary, and JSX wrapping chart components with it.',
            goalRelevance:
              'Your enterprise customers view the analytics dashboard daily — a full-page crash from one bad data point destroys trust in the product reliability, which is your primary differentiation against competitors.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'aiPartnership',
          categoryTags: ['error-handling', 'react-components', 'error-boundaries', 'test-coverage'],
        },
      ],
    },

    // ── Persona 3: Carol — Full-Stack Next.js Developer ──────────────────
    {
      name: 'Carol Park',
      project: 'saas-onboarding-platform',
      sessionIds: ['carol-sess-1', 'carol-sess-2', 'carol-sess-3', 'carol-sess-4', 'carol-sess-5'],
      growthAreas: [
        {
          pattern: {
            title: 'No Task Decomposition Before Complex Multi-File Changes',
            description:
              'Carol jumps directly into implementing complex features that span multiple files without first using /plan or TodoWrite to decompose the work. In the onboarding platform project, she attempted to implement the entire invite-flow feature (API route + database migration + email template + UI component) in a single unstructured session, leading to incomplete implementations and forgotten edge cases.',
            severity: 'high',
            toolsFilesApis: ['/plan command', 'TodoWrite', 'Next.js App Router', 'app/api/invites/route.ts'],
          },
          evidence: [
            {
              utteranceId: 'carol-sess-1_1',
              sessionId: 'carol-sess-1',
              quote: 'Build the invite flow — I need an API endpoint, email sending, and a page where invited users can accept',
              context: 'Starting a multi-component feature without any decomposition or planning',
              observation: 'Described a 4-component feature in one sentence without using /plan for task breakdown',
            },
            {
              utteranceId: 'carol-sess-2_1',
              sessionId: 'carol-sess-2',
              quote: 'Actually we forgot to handle the case where the invite link expires — add that to the invite flow',
              context: 'Discovering a missed requirement from the unplanned session 1 implementation',
              observation: 'Edge case discovered after implementation because no upfront planning captured requirements',
            },
            {
              utteranceId: 'carol-sess-4_2',
              sessionId: 'carol-sess-4',
              quote: 'Implement the team settings page — it needs role management, member list, billing info, and audit log',
              context: 'Another multi-component feature started without decomposition',
              observation: 'Repeated the same no-planning pattern despite having experienced missed requirements in session 2',
            },
          ],
          action: {
            instruction:
              'For any feature that touches 3+ files, start the session by typing "/plan" followed by a brief feature description. Review the generated task list and confirm it before writing any code. Keep the plan visible by not dismissing it.',
            verificationCheck:
              'Session log should show a /plan command or TodoWrite tool_use block appearing in the first 3 messages of sessions that involve multi-file changes.',
            goalRelevance:
              'Your SaaS onboarding platform ships weekly to enterprise trial users — unplanned features ship with missing edge cases that cause trial-to-paid conversion drops when users hit broken invite flows.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'aiPartnership',
          categoryTags: ['planning', 'task-decomposition', 'multi-file-changes'],
        },
        {
          pattern: {
            title: 'Unvalidated API Request Bodies in Next.js Route Handlers',
            description:
              'Carol creates Next.js API route handlers that destructure request bodies directly without Zod validation. The invite API, team settings API, and billing webhook all parse JSON bodies with bare await request.json() calls, trusting client input without schema validation. This creates both runtime errors from malformed input and potential security issues from unvalidated data reaching the database layer.',
            severity: 'high',
            toolsFilesApis: ['Next.js', 'Zod', 'app/api/invites/route.ts', 'app/api/teams/route.ts'],
          },
          evidence: [
            {
              utteranceId: 'carol-sess-1_8',
              sessionId: 'carol-sess-1',
              quote: 'Parse the request body and create the invite record — destructure email and role from the JSON',
              context: 'Creating invite API endpoint with unvalidated body parsing',
              observation: 'Direct destructuring of request.json() without Zod schema validation',
            },
            {
              utteranceId: 'carol-sess-3_5',
              sessionId: 'carol-sess-3',
              quote: 'The invite API is crashing when the email field is missing — add a check for that',
              context: 'Runtime error from unvalidated input that would have been caught by schema validation',
              observation: 'Band-aid null check instead of implementing proper schema validation',
            },
            {
              utteranceId: 'carol-sess-4_7',
              sessionId: 'carol-sess-4',
              quote: 'Create the POST handler for team settings — accept teamName, description, and visibility as JSON fields',
              context: 'Another API route created without input validation, repeating the pattern',
              observation: 'Created another unvalidated endpoint despite experiencing the crash in session 3',
            },
          ],
          action: {
            instruction:
              'Create a shared validation helper at lib/api/validate.ts that wraps Zod schema.parse(await request.json()) with proper error response (400 + validation message). Import and use this helper in every new route handler before accessing body fields.',
            verificationCheck:
              'Session log should show Zod schema definition (z.object) appearing in the same file or imported module before any request.json() destructuring in route handler files.',
            goalRelevance:
              'Your SaaS platform accepts invite data from external email links — unvalidated inputs are a direct vector for injection attacks that could compromise tenant isolation in your multi-tenant architecture.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'toolMastery',
          categoryTags: ['input-validation', 'zod', 'nextjs-api', 'security'],
        },
        {
          pattern: {
            title: 'Mixing Unrelated Tasks in Single AI Sessions',
            description:
              'Carol frequently switches between unrelated features within a single AI session without starting a new one. In session carol-sess-5, she worked on email templates, then switched to billing webhook handling, then to CSS fixes — all in one session. This pollutes the AI context with irrelevant information from previous tasks, reducing response quality for each subsequent topic.',
            severity: 'medium',
            toolsFilesApis: ['Claude Code', '/clear command', 'session management'],
          },
          evidence: [
            {
              utteranceId: 'carol-sess-3_1',
              sessionId: 'carol-sess-3',
              quote: 'While we are fixing the invite validation, also update the email template spacing — it looks off on mobile',
              context: 'Mixing unrelated UI fix into an API validation session',
              observation: 'Injected unrelated CSS task into an API-focused session, splitting context between two systems',
            },
            {
              utteranceId: 'carol-sess-5_1',
              sessionId: 'carol-sess-5',
              quote: 'First fix the email template spacing issue, then after that help me set up the Stripe billing webhook',
              context: 'Announcing two unrelated tasks to be done in one session',
              observation: 'Explicitly planning to mix CSS/email work with payment webhook setup in one session',
            },
            {
              utteranceId: 'carol-sess-5_15',
              sessionId: 'carol-sess-5',
              quote: 'Actually now the billing webhook response includes CSS class names from earlier — is the context confused?',
              context: 'Experiencing context pollution from mixing email template CSS with billing logic',
              observation: 'Context pollution from mixed tasks causing AI to blend unrelated code patterns',
            },
          ],
          action: {
            instruction:
              'When switching to an unrelated task, end the current session and start a new one. If you notice yourself about to say "now switch to..." or "after that, help me with...", that is the signal to start a fresh session instead.',
            verificationCheck:
              'Session logs should show each session focuses on a single project area (e.g., all billing or all email), with no sessions containing both unrelated Bash/Edit operations on different subsystems.',
            goalRelevance:
              'Your onboarding platform has tight weekly sprint deadlines — context-polluted sessions waste 20-30 minutes per occurrence on AI confusion, adding up to hours of lost productivity each sprint.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'sessionCraft',
          categoryTags: ['session-management', 'context-pollution', 'focus'],
        },
      ],
    },

    // ── Persona 4: Dave — Backend API Developer ──────────────────────────
    {
      name: 'Dave Okonkwo',
      project: 'inventory-management-api',
      sessionIds: ['dave-sess-1', 'dave-sess-2', 'dave-sess-3'],
      growthAreas: [
        {
          pattern: {
            title: 'Blind Trust in AI-Generated SQL Queries Without EXPLAIN Analysis',
            description:
              'Dave accepts AI-generated SQL queries and Prisma query chains without analyzing their execution plans. In the inventory management API, he asked for complex join queries across products, warehouses, and stock_movements tables and directly deployed the generated queries without running EXPLAIN ANALYZE. Two of these queries caused full table scans on tables with 500K+ rows, degrading API response times.',
            severity: 'high',
            toolsFilesApis: ['Prisma ORM', 'PostgreSQL', 'EXPLAIN ANALYZE', 'src/services/inventory.ts'],
          },
          evidence: [
            {
              utteranceId: 'dave-sess-1_6',
              sessionId: 'dave-sess-1',
              quote: 'Write a query that joins products with stock_movements and calculates current stock levels per warehouse',
              context: 'Requesting complex aggregation query without mentioning performance considerations',
              observation: 'Accepted the generated query without requesting EXPLAIN output or discussing indexing',
            },
            {
              utteranceId: 'dave-sess-2_3',
              sessionId: 'dave-sess-2',
              quote: 'The stock level API endpoint is taking 8 seconds in staging — something is wrong with the database',
              context: 'Discovering performance issue from unanalyzed query deployed to staging',
              observation: 'Blamed the database rather than recognizing the missing EXPLAIN step from session 1',
            },
            {
              utteranceId: 'dave-sess-3_9',
              sessionId: 'dave-sess-3',
              quote: 'Generate the report query that aggregates monthly sales with product categories and supplier info',
              context: 'Another complex multi-join query request without performance analysis',
              observation: 'Repeated the pattern of requesting complex queries without EXPLAIN despite the session 2 incident',
            },
          ],
          action: {
            instruction:
              'After the AI generates any Prisma query involving joins or aggregations, immediately ask "Run EXPLAIN ANALYZE on this query against the staging database and show me the execution plan" before deploying. Check for Seq Scan on large tables and request index additions if found.',
            verificationCheck:
              'Session log should show a Bash tool call containing "EXPLAIN" or "EXPLAIN ANALYZE" after complex query generation and before any deployment-related commands (prisma migrate, git push).',
            goalRelevance:
              'Your inventory API serves real-time stock levels to the warehouse mobile app — 8-second query times cause warehouse workers to rescan barcodes and lose trust in the system, leading to manual tracking workarounds.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'aiPartnership',
          categoryTags: ['query-performance', 'database', 'prisma', 'verification'],
        },
        {
          pattern: {
            title: 'No Integration Tests for Multi-Service API Endpoints',
            description:
              'Dave writes unit tests for individual service functions but skips integration tests that exercise the full API endpoint flow (request → middleware → service → database → response). The inventory API has 15 unit tests but zero integration tests, meaning middleware authentication, request validation, and database transaction rollback behavior are all untested.',
            severity: 'medium',
            toolsFilesApis: ['supertest', 'jest', 'Prisma', 'src/routes/inventory.ts', '__tests__/'],
          },
          evidence: [
            {
              utteranceId: 'dave-sess-1_12',
              sessionId: 'dave-sess-1',
              quote: 'Write unit tests for the calculateStockLevel function in the inventory service',
              context: 'Creating unit tests for the service layer only, skipping route-level tests',
              observation: 'Only tested the service function, not the route handler that calls it with middleware',
            },
            {
              utteranceId: 'dave-sess-3_14',
              sessionId: 'dave-sess-3',
              quote: 'Add tests for the new report generation service — mock the database calls',
              context: 'Another round of service-level-only tests with mocked dependencies',
              observation: 'Pattern of testing services in isolation without exercising the full request flow',
            },
          ],
          action: {
            instruction:
              'For each new API endpoint, create an integration test file using supertest that makes actual HTTP requests to the route, including authentication headers, and verifies the full response shape. Use a test database with seeded data instead of mocking Prisma.',
            verificationCheck:
              'Session log should show supertest import and app.listen() or createServer() patterns in test files alongside route creation, with actual HTTP assertions (expect(res.status).toBe(200)).',
            goalRelevance:
              'Your inventory API is consumed by 3 client apps (mobile, web dashboard, and ERP integration) — integration test gaps mean authentication changes or middleware updates can silently break API contracts across all clients.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'skillResilience',
          categoryTags: ['integration-testing', 'supertest', 'api-testing', 'test-coverage'],
        },
        {
          pattern: {
            title: 'Verbose Full-Stack-Trace Pasting Instead of Error Summarization',
            description:
              'When encountering errors, Dave pastes the entire stack trace (50-100 lines) into the AI prompt instead of extracting the key error message and relevant lines. This wastes context window space and dilutes the AI focus. In two sessions, he pasted full Prisma error outputs including internal ORM stack frames that are irrelevant to the actual database issue.',
            severity: 'low',
            toolsFilesApis: ['Prisma ORM', 'PostgreSQL', 'Claude Code context window'],
          },
          evidence: [
            {
              utteranceId: 'dave-sess-2_5',
              sessionId: 'dave-sess-2',
              quote: 'Here is the full error output from the API... [pasted 87 lines of Prisma error including engine internals]',
              context: 'Pasting complete Prisma error output instead of extracting the PrismaClientKnownRequestError message',
              observation: 'Pasted 87 lines when the relevant error was a 3-line PrismaClientKnownRequestError',
            },
            {
              utteranceId: 'dave-sess-3_4',
              sessionId: 'dave-sess-3',
              quote: 'Getting this error when running the migration... [pasted full prisma migrate output with 45 lines]',
              context: 'Another full error paste for a migration failure that could be summarized in 5 lines',
              observation: 'Pasted 45 lines of migration output when only the last 5 lines contained the actual error',
            },
          ],
          action: {
            instruction:
              'When encountering an error, extract only: (1) the error type/name, (2) the error message, and (3) the first 3 relevant stack frames. Paste this 5-10 line summary instead of the full output. Say "Full trace available if needed" at the end.',
            verificationCheck:
              'Session log should show error-related user messages under 15 lines in length, with structured format (error name, message, first frames) rather than raw paste blocks.',
            goalRelevance:
              'Your inventory API debugging sessions use 35% of context on error paste — reducing this frees context for the AI to reason about your specific Prisma schema and business logic instead of parsing engine internals.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'sessionCraft',
          categoryTags: ['context-efficiency', 'error-handling', 'error-reporting', 'verbose-pasting'],
        },
      ],
    },

    // ── Persona 5: Eve — DevOps / Infrastructure Engineer ────────────────
    {
      name: 'Eve Tanaka',
      project: 'ci-cd-pipeline-modernization',
      sessionIds: ['eve-sess-1', 'eve-sess-2', 'eve-sess-3'],
      growthAreas: [
        {
          pattern: {
            title: 'No Dry-Run Validation Before Docker Build Config Changes',
            description:
              'Eve modifies Dockerfiles and docker-compose.yml configurations without running a dry-run build to validate syntax and layer ordering before committing. In the CI/CD modernization project, she made Dockerfile changes that broke layer caching and only discovered the issue when the CI pipeline took 25 minutes instead of the expected 5 minutes.',
            severity: 'high',
            toolsFilesApis: ['Docker', 'Dockerfile', 'docker-compose.yml', 'docker build --check', 'GitHub Actions'],
          },
          evidence: [
            {
              utteranceId: 'eve-sess-1_4',
              sessionId: 'eve-sess-1',
              quote: 'Reorder the Dockerfile to install system dependencies first, then copy package.json and install node modules',
              context: 'Restructuring Dockerfile layer order for the Node.js API service',
              observation: 'Modified layer order without running a test build to verify caching behavior',
            },
            {
              utteranceId: 'eve-sess-2_7',
              sessionId: 'eve-sess-2',
              quote: 'The CI build went from 5 minutes to 25 minutes after yesterdays Dockerfile change — the cache is not being used',
              context: 'Discovering that the Dockerfile reorder broke layer caching in CI',
              observation: 'CI build regression caused by untested Dockerfile change from session 1',
            },
          ],
          action: {
            instruction:
              'After every Dockerfile or docker-compose.yml modification, run "docker build --no-cache -t test-build ." locally and compare the layer timing output against the previous build. Check that CACHED layers appear for dependency installation steps before committing.',
            verificationCheck:
              'Session log should show a Bash tool call with "docker build" appearing after Edit operations on Dockerfile or docker-compose.yml files, before any git commit commands.',
            goalRelevance:
              'Your CI/CD modernization project targets 5-minute build times for the monorepo — a broken cache multiplies build time 5x, blocking the entire team from merging PRs during the 25-minute queue.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'toolMastery',
          categoryTags: ['docker', 'ci-cd', 'build-optimization', 'layer-caching'],
        },
        {
          pattern: {
            title: 'GitHub Actions Workflow Changes Without act Local Testing',
            description:
              'Eve pushes GitHub Actions workflow changes directly to the repository and relies on CI feedback loops to debug YAML syntax errors and step ordering issues. She made 4 push-and-check cycles in one session to fix a single workflow file because she was not using act for local testing. Each push-check cycle wastes 3-5 minutes of CI runner time.',
            severity: 'medium',
            toolsFilesApis: ['GitHub Actions', '.github/workflows/', 'act CLI', 'nektos/act'],
          },
          evidence: [
            {
              utteranceId: 'eve-sess-1_11',
              sessionId: 'eve-sess-1',
              quote: 'Push this workflow change and let me check if CI passes',
              context: 'Pushing untested GitHub Actions YAML to remote for CI validation',
              observation: 'Using CI as the test environment instead of local validation with act',
            },
            {
              utteranceId: 'eve-sess-3_6',
              sessionId: 'eve-sess-3',
              quote: 'The workflow failed again — I think the step ordering is wrong. Fix the depends-on and push again.',
              context: 'Third attempt at fixing workflow YAML via push-and-check cycle',
              observation: 'Multiple push-debug cycles that could have been caught with one local act run',
            },
          ],
          action: {
            instruction:
              'Install act CLI (brew install act or npm install @nektos/act) and run "act -j <job-name> --dryrun" locally after every .github/workflows/*.yml change. Only push to remote after the local dry run passes without errors.',
            verificationCheck:
              'Session log should show Bash tool call with "act" command (containing "act -j" or "act push") after Edit operations on .github/workflows/ files, before any "git push" commands.',
            goalRelevance:
              'Your CI/CD modernization project manages 12 workflow files — each push-and-check debug cycle consumes shared runner minutes and blocks other teams merges, directly impacting developer velocity across the org.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'sessionMastery',
          categoryTags: ['github-actions', 'ci-cd', 'local-testing', 'workflow-yaml'],
        },
        {
          pattern: {
            title: 'Infrastructure-as-Code Changes Without Terraform Plan Review',
            description:
              'Eve applies Terraform changes with terraform apply without first reviewing the terraform plan output for unexpected resource destruction or modification. In the CI/CD modernization project, she accidentally triggered a database instance recreation because a name change generated a destroy-and-recreate plan that she did not review.',
            severity: 'critical',
            toolsFilesApis: ['Terraform', 'terraform plan', 'terraform apply', 'AWS RDS', 'main.tf'],
          },
          evidence: [
            {
              utteranceId: 'eve-sess-2_14',
              sessionId: 'eve-sess-2',
              quote: 'Apply the Terraform changes for the new staging environment setup',
              context: 'Running terraform apply without reviewing the plan output first',
              observation: 'Skipped terraform plan review before applying infrastructure changes',
            },
            {
              utteranceId: 'eve-sess-3_11',
              sessionId: 'eve-sess-3',
              quote: 'The staging database was recreated — all the test data is gone. What happened with the Terraform apply?',
              context: 'Discovering that terraform apply destroyed and recreated the RDS instance',
              observation: 'Terraform apply without plan review caused data loss in staging environment',
            },
            {
              utteranceId: 'eve-sess-1_8',
              sessionId: 'eve-sess-1',
              quote: 'Run terraform apply to provision the new VPC and security groups for the staging cluster',
              context: 'First infrastructure provisioning session with terraform apply on networking resources',
              observation: 'Applied infrastructure changes without running terraform plan first — same pattern that later caused the RDS recreation incident',
            },
          ],
          action: {
            instruction:
              'Always run "terraform plan -out=tfplan" first, review the output for any lines containing "destroy" or "replace", and only proceed with "terraform apply tfplan" after confirming no destructive changes. Save the plan file for audit trail.',
            verificationCheck:
              'Session log should show "terraform plan" Bash call appearing before "terraform apply" in every session, with a user message acknowledging the plan output between them.',
            goalRelevance:
              'Your CI/CD modernization involves managing production infrastructure for the staging and production environments — an unreviewed terraform apply could destroy production databases, causing a P0 incident and data loss.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'aiPartnership',
          categoryTags: ['terraform', 'infrastructure', 'safety-checks', 'plan-review'],
        },
      ],
    },

    // ── Persona 6: Frank — Python Data Engineer ──────────────────────────
    {
      name: 'Frank Rivera',
      project: 'data-pipeline-etl',
      sessionIds: ['frank-sess-1', 'frank-sess-2', 'frank-sess-3'],
      growthAreas: [
        {
          pattern: {
            title: 'Hardcoded File Paths in Python ETL Scripts Instead of Config',
            description:
              'Frank embeds absolute file paths directly in Python ETL scripts rather than using environment variables, config files, or pathlib for portable path construction. The data pipeline breaks when deployed to different environments (local dev vs CI vs production) because paths like /home/frank/data/raw/ do not exist outside his machine. This pattern appeared in both the CSV ingestion script and the Parquet export module.',
            severity: 'medium',
            toolsFilesApis: ['Python', 'pathlib', 'python-dotenv', 'scripts/ingest_csv.py', 'scripts/export_parquet.py'],
          },
          evidence: [
            {
              utteranceId: 'frank-sess-1_4',
              sessionId: 'frank-sess-1',
              quote: 'Read the CSV files from /home/frank/data/raw/ and process them into the staging table',
              context: 'Setting up CSV ingestion with hardcoded absolute path to local data directory',
              observation: 'Used personal home directory path instead of configurable data source path',
            },
            {
              utteranceId: 'frank-sess-2_8',
              sessionId: 'frank-sess-2',
              quote: 'The pipeline failed in CI — FileNotFoundError on /home/frank/data/raw/. How do I make this work in the container?',
              context: 'CI failure caused by hardcoded path that does not exist in Docker container',
              observation: 'Discovered the hardcoded path issue when deploying to a different environment',
            },
            {
              utteranceId: 'frank-sess-3_3',
              sessionId: 'frank-sess-3',
              quote: 'Export the processed data to /home/frank/data/output/report.parquet',
              context: 'Writing another script with hardcoded output path despite the session 2 failure',
              observation: 'Repeated the hardcoded path pattern despite experiencing the CI failure in session 2',
            },
          ],
          action: {
            instruction:
              'Create a config.py module that reads DATA_INPUT_DIR and DATA_OUTPUT_DIR from environment variables (with local defaults via python-dotenv). Import these in every ETL script instead of hardcoding paths. Use pathlib.Path for all path construction.',
            verificationCheck:
              'Session log should show os.environ or dotenv usage in config modules, and pathlib.Path imports in ETL scripts, with no hardcoded absolute paths (starting with /) in Write/Edit operations on .py files.',
            goalRelevance:
              'Your data pipeline runs nightly in a Docker container on AWS — hardcoded paths cause silent failures that skip data processing, leaving downstream analytics dashboards stale without any alert.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'toolMastery',
          categoryTags: ['python', 'configuration', 'path-management', 'portability'],
        },
        {
          pattern: {
            title: 'No Data Validation Between ETL Pipeline Stages',
            description:
              'Frank builds ETL pipeline stages that pass data from extraction to transformation to loading without any intermediate validation checks. There are no row count assertions, schema checks, or null percentage guards between stages. When the raw CSV data had unexpected null values in the product_id column, the transformation stage silently produced incorrect aggregations that propagated to the final report.',
            severity: 'high',
            toolsFilesApis: ['Python', 'pandas', 'Great Expectations', 'scripts/transform.py', 'pytest'],
          },
          evidence: [
            {
              utteranceId: 'frank-sess-1_9',
              sessionId: 'frank-sess-1',
              quote: 'Read the raw data and pass it directly to the transformation function — aggregate sales by product_id',
              context: 'Piping raw CSV data directly to aggregation without validating product_id presence',
              observation: 'No validation step between extraction and transformation stages',
            },
            {
              utteranceId: 'frank-sess-3_10',
              sessionId: 'frank-sess-3',
              quote: 'The monthly report numbers look wrong — the total is lower than expected. Can you check the transform output?',
              context: 'Discovering data quality issue caused by null product_ids being silently dropped in aggregation',
              observation: 'Data quality issue propagated through pipeline due to missing inter-stage validation',
            },
          ],
          action: {
            instruction:
              'Add a validate_stage_output() function that checks row count (±10% of expected), null percentage per column (< 5% threshold), and schema match after each ETL stage. Log warnings for soft violations and raise exceptions for hard violations.',
            verificationCheck:
              'Session log should show assertion/validation function definitions (assert, validate, check) appearing in ETL scripts between data reading (pd.read) and data processing (groupby, merge) operations.',
            goalRelevance:
              'Your data pipeline feeds the executive analytics dashboard — silent data quality issues in the ETL cause incorrect revenue and inventory metrics that erode leadership trust in data-driven decisions.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'skillResilience',
          categoryTags: ['data-validation', 'etl-pipeline', 'data-quality', 'python'],
        },
      ],
    },

    // ── Persona 7: Grace — Mobile/React Native Developer ─────────────────
    {
      name: 'Grace Kim',
      project: 'field-service-mobile-app',
      sessionIds: ['grace-sess-1', 'grace-sess-2', 'grace-sess-3', 'grace-sess-4'],
      growthAreas: [
        {
          pattern: {
            title: 'No Offline-First Error Handling in React Native Network Calls',
            description:
              'Grace builds network request handlers in the field service mobile app that assume network availability, without implementing offline detection, retry logic, or local queue fallbacks. Field service technicians frequently work in areas with spotty connectivity, and the app shows unhelpful "Network Error" messages instead of queuing work orders for later sync.',
            severity: 'high',
            toolsFilesApis: ['React Native', '@react-native-community/netinfo', 'AsyncStorage', 'src/api/workOrders.ts'],
          },
          evidence: [
            {
              utteranceId: 'grace-sess-1_5',
              sessionId: 'grace-sess-1',
              quote: 'Create the work order submission API call — POST to /api/work-orders with the form data',
              context: 'Building work order submission without offline handling for field use case',
              observation: 'Created network call without any offline detection or retry/queue mechanism',
            },
            {
              utteranceId: 'grace-sess-2_3',
              sessionId: 'grace-sess-2',
              quote: 'Users are complaining that the app crashes when they try to submit work orders in the field without signal',
              context: 'Field technicians experiencing crashes from unhandled network errors',
              observation: 'Network errors from offline usage causing crashes — no offline-first design',
            },
            {
              utteranceId: 'grace-sess-4_6',
              sessionId: 'grace-sess-4',
              quote: 'Add the photo upload feature for work order attachments — send the image to the upload endpoint',
              context: 'Adding photo upload without offline handling despite knowing about connectivity issues',
              observation: 'Another network-dependent feature added without offline-first design after known issues',
            },
          ],
          action: {
            instruction:
              'Before implementing any network call, first check NetInfo.fetch() for connectivity. If offline, store the request payload in AsyncStorage with a queue key and timestamp. Implement a sync manager that processes the queue when connectivity returns.',
            verificationCheck:
              'Session log should show NetInfo import and useNetInfo hook usage, plus AsyncStorage read/write operations, appearing in the same file as fetch/axios calls in React Native API modules.',
            goalRelevance:
              'Your field service app is used by technicians at remote job sites — 40% of submissions happen in low-connectivity areas, so offline-first is not a nice-to-have but a core product requirement that determines field adoption.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'skillResilience',
          categoryTags: ['offline-first', 'react-native', 'network-handling', 'mobile'],
        },
        {
          pattern: {
            title: 'Unoptimized FlatList Rendering Without Key Extractor and Memoization',
            description:
              'Grace renders long lists of work orders using FlatList without proper keyExtractor, getItemLayout, or React.memo on list item components. The work order list screen with 200+ items scrolls poorly on older Android devices because every scroll event re-renders all visible items. This was observed in both the main work order list and the technician schedule view.',
            severity: 'medium',
            toolsFilesApis: ['React Native', 'FlatList', 'React.memo', 'keyExtractor', 'getItemLayout'],
          },
          evidence: [
            {
              utteranceId: 'grace-sess-1_11',
              sessionId: 'grace-sess-1',
              quote: 'Render the work orders in a FlatList — each item shows the order number, status badge, and customer name',
              context: 'Creating work order list without performance optimization props',
              observation: 'FlatList created without keyExtractor or getItemLayout, using inline renderItem arrow function',
            },
            {
              utteranceId: 'grace-sess-3_8',
              sessionId: 'grace-sess-3',
              quote: 'The list is really laggy on the Samsung Galaxy A series phones our technicians use — scrolling stutters visibly',
              context: 'Performance complaint on budget Android devices used by field technicians',
              observation: 'Scroll jank from unoptimized FlatList rendering on lower-end hardware',
            },
          ],
          action: {
            instruction:
              'For every FlatList component: (1) add keyExtractor using the unique ID field, (2) define getItemLayout if items have fixed height, (3) wrap the list item component with React.memo, and (4) extract the renderItem function outside the parent component or wrap with useCallback.',
            verificationCheck:
              'Session log should show keyExtractor, getItemLayout, and React.memo appearing in FlatList-related code, with renderItem defined outside the component body or wrapped in useCallback.',
            goalRelevance:
              'Your field technicians use budget Android phones (Samsung Galaxy A series) — scroll jank on the 200+ work order list directly impacts their ability to find and update assignments quickly in the field, reducing job completion rate.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'sessionCraft',
          categoryTags: ['react-native', 'list-performance', 'flatlist', 'mobile-optimization'],
        },
        {
          pattern: {
            title: 'Missing TypeScript Types for API Response Shapes in React Native',
            description:
              'Grace fetches API responses and uses them throughout the app without defining TypeScript interfaces for the response shapes. The work order data is typed as "any" in the API layer and flows through components, hooks, and state management without type safety. This leads to runtime errors from accessing properties that do not exist or have been renamed on the backend.',
            severity: 'medium',
            toolsFilesApis: ['TypeScript', 'React Native', 'src/api/types.ts', 'Zod', 'src/api/workOrders.ts'],
          },
          evidence: [
            {
              utteranceId: 'grace-sess-1_8',
              sessionId: 'grace-sess-1',
              quote: 'Parse the work order response and store it in state — the response has id, status, customerName, and assignedTo fields',
              context: 'Using API response without defining a TypeScript type for the shape',
              observation: 'Described response fields verbally instead of defining a TypeScript interface',
            },
            {
              utteranceId: 'grace-sess-4_10',
              sessionId: 'grace-sess-4',
              quote: 'The app crashes when accessing workOrder.assignee — I thought the field was called assignedTo',
              context: 'Runtime error from accessing a renamed field that TypeScript would have caught',
              observation: 'Property name mismatch between frontend and backend that type-checking would have prevented',
            },
          ],
          action: {
            instruction:
              'Create a src/api/types.ts file with Zod schemas for all API response shapes. Use z.infer<typeof Schema> to derive TypeScript types. Validate responses at the API boundary with schema.parse() before passing to components.',
            verificationCheck:
              'Session log should show z.object() schema definitions in api/types.ts and z.infer type usage in components that consume API data, with no "any" type annotations in API-related files.',
            goalRelevance:
              'Your React Native app is deployed to 500+ technician devices — runtime crashes from type mismatches require emergency app updates that take 48 hours to propagate through app store review, leaving technicians on broken versions.',
          },
          qualityRubric: { distinctMoments: true, verifiableAction: true, patternSpecificity: true, toolFileNaming: true },
          domain: 'toolMastery',
          categoryTags: ['typescript', 'type-safety', 'api-contracts', 'react-native'],
        },
      ],
    },
  ];
}

// ============================================================================
// Helper: Convert PEA growth areas → DomainResult[]
// ============================================================================

function peaGrowthAreasToDomainResults(
  growthAreas: GrowthAreaPEA[],
  scores: Record<string, number>,
): DomainResult[] {
  const domainMap = new Map<string, GrowthAreaPEA[]>();
  for (const ga of growthAreas) {
    const list = domainMap.get(ga.domain) ?? [];
    list.push(ga);
    domainMap.set(ga.domain, list);
  }

  const results: DomainResult[] = [];
  for (const [domain, areas] of domainMap) {
    results.push({
      domain: domain as DomainResult['domain'],
      overallScore: scores[domain] ?? 70,
      confidenceScore: 0.82,
      strengths: [
        {
          title: `Strength in ${domain}`,
          description: 'This is a placeholder strength for the test harness. It represents a genuine capability identified across multiple sessions of the developer working with AI collaboration tools effectively in this domain area.',
          evidence: [{ utteranceId: `${areas[0].evidence[0].sessionId}_0`, quote: 'Placeholder strength evidence' }],
        },
      ],
      growthAreas: areas.map(pea => peaToDomainGrowthArea(pea)),
      analyzedAt: new Date().toISOString(),
    });
  }

  return results;
}

// ============================================================================
// Test Suite
// ============================================================================

describe('Growth Area Pipeline Test Harness', () => {
  const personas = createPersonas();

  // ── Section 1: PEA Schema Validation ─────────────────────────────────
  describe('PEA Schema Validation', () => {
    for (const persona of personas) {
      describe(`${persona.name} (${persona.project})`, () => {
        for (const ga of persona.growthAreas) {
          it(`validates "${ga.pattern.title}" against PEA schema`, () => {
            const result = GrowthAreaPEASchema.safeParse(ga);
            if (!result.success) {
              console.error(`Schema validation failed for "${ga.pattern.title}":`, result.error.format());
            }
            expect(result.success).toBe(true);
          });
        }
      });
    }
  });

  // ── Section 2: 4-Criteria Quality Rubric (Hard Gate) ─────────────────
  describe('Quality Rubric — All 4 Criteria Must Pass', () => {
    const allResults: Array<{
      persona: string;
      title: string;
      rubric: QualityRubric;
      passes: boolean;
      failures: string[];
    }> = [];

    for (const persona of personas) {
      describe(`${persona.name}`, () => {
        for (const ga of persona.growthAreas) {
          it(`passes rubric: "${ga.pattern.title}"`, () => {
            const result = evaluateQualityRubric(ga);
            allResults.push({
              persona: persona.name,
              title: ga.pattern.title,
              ...result,
            });
            if (!result.passes) {
              console.error(`RUBRIC FAIL: "${ga.pattern.title}" — ${result.failures.join(', ')}`);
            }
            expect(result.passes).toBe(true);
          });
        }
      });
    }

    // Write rubric results after all tests run
    afterAll(() => {
      writeOutput('rubric-results.json', {
        totalGrowthAreas: allResults.length,
        passing: allResults.filter(r => r.passes).length,
        failing: allResults.filter(r => !r.passes).length,
        results: allResults,
      });
    });
  });

  // ── Section 2b: Deep Quality Validation (4 Problems + Continuous Scores) ──
  //
  // Goes beyond the basic rubric (count/length) to run the full quality checker
  // that detects the 4 original problems:
  //   1. Generic areas     — dressed-up generic advice
  //   2. Isolated quotes   — single quote without pattern context
  //   3. Arbitrary scores  — severity not justified by evidence weight
  //   4. Missing patterns  — no behavioral pattern described
  //
  // This is the hard gate: ALL growth areas must pass with zero flagged problems.
  describe('Deep Quality Validation — Zero Flagged Problems', () => {
    const allValidations: Array<{
      persona: string;
      title: string;
      validation: QualityValidationResult;
    }> = [];

    for (const persona of personas) {
      describe(`${persona.name}`, () => {
        for (const ga of persona.growthAreas) {
          it(`passes deep validation: "${ga.pattern.title}"`, () => {
            const validation = validateGrowthAreaQuality(ga);
            allValidations.push({
              persona: persona.name,
              title: ga.pattern.title,
              validation,
            });

            // Log detailed diagnostics for any failure
            if (!validation.passes) {
              console.error(`\n✗ DEEP VALIDATION FAIL: "${ga.pattern.title}" (${persona.name})`);
              console.error(`  Overall score: ${validation.overallScore.toFixed(2)}`);

              // Criterion failures
              const criteria = validation.criteria;
              if (!criteria.distinctMoments.pass) {
                console.error(`  ✗ distinct_moments: ${criteria.distinctMoments.deficiencies.join('; ')}`);
              }
              if (!criteria.verifiableAction.pass) {
                console.error(`  ✗ verifiable_action: ${criteria.verifiableAction.deficiencies.join('; ')}`);
              }
              if (!criteria.patternSpecificity.pass) {
                console.error(`  ✗ pattern_specificity: ${criteria.patternSpecificity.deficiencies.join('; ')}`);
              }
              if (!criteria.toolFileNaming.pass) {
                console.error(`  ✗ tool_file_naming: ${criteria.toolFileNaming.deficiencies.join('; ')}`);
              }

              // Problem flags
              const problems = validation.problems;
              if (problems.genericArea.detected) {
                console.error(`  ⚑ GENERIC AREA (${problems.genericArea.severity}): ${problems.genericArea.evidence.join('; ')}`);
              }
              if (problems.isolatedQuotes.detected) {
                console.error(`  ⚑ ISOLATED QUOTES (${problems.isolatedQuotes.severity}): ${problems.isolatedQuotes.evidence.join('; ')}`);
              }
              if (problems.arbitraryScores.detected) {
                console.error(`  ⚑ ARBITRARY SCORES (${problems.arbitraryScores.severity}): ${problems.arbitraryScores.evidence.join('; ')}`);
              }
              if (problems.missingPatterns.detected) {
                console.error(`  ⚑ MISSING PATTERNS (${problems.missingPatterns.severity}): ${problems.missingPatterns.evidence.join('; ')}`);
              }
            }

            expect(validation.passes).toBe(true);
          });
        }
      });
    }

    // Batch validation summary
    it('batch validation: 100% pass rate with zero problems', () => {
      const allGrowthAreas = personas.flatMap(p => p.growthAreas);
      const batch = validateGrowthAreaBatch(allGrowthAreas);

      writeOutput('deep-validation-results.json', {
        summary: batch.summary,
        results: batch.results.map(r => ({
          title: r.growthArea.pattern.title,
          passes: r.validation.passes,
          overallScore: r.validation.overallScore,
          criteria: {
            distinctMoments: { score: r.validation.criteria.distinctMoments.score, pass: r.validation.criteria.distinctMoments.pass },
            verifiableAction: { score: r.validation.criteria.verifiableAction.score, pass: r.validation.criteria.verifiableAction.pass },
            patternSpecificity: { score: r.validation.criteria.patternSpecificity.score, pass: r.validation.criteria.patternSpecificity.pass },
            toolFileNaming: { score: r.validation.criteria.toolFileNaming.score, pass: r.validation.criteria.toolFileNaming.pass },
          },
          problems: {
            genericArea: r.validation.problems.genericArea.detected,
            isolatedQuotes: r.validation.problems.isolatedQuotes.detected,
            arbitraryScores: r.validation.problems.arbitraryScores.detected,
            missingPatterns: r.validation.problems.missingPatterns.detected,
          },
        })),
      });

      // Hard gates
      expect(batch.summary.passRate).toBe(1.0);
      expect(batch.summary.failing).toBe(0);
      expect(batch.summary.problemFrequency.genericArea).toBe(0);
      expect(batch.summary.problemFrequency.isolatedQuotes).toBe(0);
      expect(batch.summary.problemFrequency.arbitraryScores).toBe(0);
      expect(batch.summary.problemFrequency.missingPatterns).toBe(0);
    });

    afterAll(() => {
      const passing = allValidations.filter(v => v.validation.passes);
      const failing = allValidations.filter(v => !v.validation.passes);

      writeOutput('deep-validation-summary.json', {
        totalValidated: allValidations.length,
        passing: passing.length,
        failing: failing.length,
        passRate: allValidations.length > 0 ? passing.length / allValidations.length : 0,
        averageScore: allValidations.length > 0
          ? allValidations.reduce((sum, v) => sum + v.validation.overallScore, 0) / allValidations.length
          : 0,
        failureDetails: failing.map(f => ({
          persona: f.persona,
          title: f.title,
          score: f.validation.overallScore,
          failedCriteria: Object.entries(f.validation.criteria)
            .filter(([, v]) => !v.pass)
            .map(([k]) => k),
          detectedProblems: Object.entries(f.validation.problems)
            .filter(([, v]) => v.detected)
            .map(([k, v]) => ({ problem: k, severity: v.severity, evidence: v.evidence })),
        })),
      });
    });
  });

  // ── Section 3: KB Enrichment Pipeline ────────────────────────────────
  describe('KB Enrichment Pipeline', () => {
    const enrichmentResults: Array<{
      persona: string;
      enrichedGrowthAreas: Array<{
        title: string;
        domain: string;
        kbTipAttached: boolean;
        kbTipTitle?: string;
        kbTipRelevanceScore?: number;
        kbTipCredibilityTier?: string;
        kbTipSourceAuthor?: string;
      }>;
    }> = [];

    for (const persona of personas) {
      it(`enriches growth areas for ${persona.name}`, () => {
        const domainResults = peaGrowthAreasToDomainResults(persona.growthAreas, {
          aiPartnership: 72,
          sessionCraft: 68,
          toolMastery: 75,
          skillResilience: 70,
          sessionMastery: 78,
        });

        const enriched = enrichGrowthAreasWithKbTips(
          domainResults,
          SYNTHETIC_KB_ITEMS,
          SYNTHETIC_PROFESSIONAL_INSIGHTS,
        );

        const gaResults = enriched.flatMap(dr =>
          dr.growthAreas.map(ga => ({
            title: ga.title,
            domain: dr.domain,
            kbTipAttached: !!ga.kbTip,
            kbTipTitle: ga.kbTip?.title,
            kbTipRelevanceScore: ga.kbTip?.relevanceScore,
            kbTipCredibilityTier: ga.kbTip?.credibilityTier,
            kbTipSourceAuthor: ga.kbTip?.sourceAuthor,
          })),
        );

        enrichmentResults.push({ persona: persona.name, enrichedGrowthAreas: gaResults });

        // At minimum, verify enrichment does not crash and returns same structure
        expect(enriched.length).toBe(domainResults.length);
        for (const dr of enriched) {
          expect(dr.growthAreas.length).toBeGreaterThan(0);
          // Sub-AC 7b: knowledgeTip must mirror kbTip on every growth area that receives a tip.
          // Both fields are set by the enricher simultaneously (dual-write for backward compat).
          for (const ga of dr.growthAreas) {
            if (ga.kbTip) {
              expect(ga.knowledgeTip).toBeDefined();
              expect(ga.knowledgeTip).toEqual(ga.kbTip);
            } else {
              expect(ga.knowledgeTip).toBeUndefined();
            }
          }
        }
      });
    }

    afterAll(() => {
      writeOutput('kb-enrichment-results.json', {
        totalPersonas: enrichmentResults.length,
        kbTipThreshold: KB_TIP_RELEVANCE_THRESHOLD,
        results: enrichmentResults,
      });
    });
  });

  // ── Section 4: Full Pipeline Report Output ───────────────────────────
  describe('Full Report Output for Manual Inspection', () => {
    it('generates complete growth area reports for all 7 personas', () => {
      const fullReports: Array<{
        persona: string;
        project: string;
        sessionCount: number;
        domainResults: Array<{
          domain: string;
          overallScore: number;
          growthAreaCount: number;
          growthAreas: Array<{
            title: string;
            severity: string;
            description: string;
            recommendation: string;
            evidenceMomentCount: number;
            evidenceMoments: Array<{
              sessionId: string;
              quote: string;
              behaviorDescription: string;
            }>;
            verifiableAction: {
              action: string;
              checkDescription: string;
            } | null;
            goalRelevance: string | null;
            categoryTags: string[] | undefined;
            lowConfidence: boolean | undefined;
            kbTip: {
              title: string;
              sourceAuthor: string;
              relevanceScore: number;
              credibilityTier: string | undefined;
            } | null;
          }>;
        }>;
        qualityRubricResults: Array<{
          title: string;
          rubric: QualityRubric;
          passes: boolean;
        }>;
      }> = [];

      for (const persona of personas) {
        const domainResults = peaGrowthAreasToDomainResults(persona.growthAreas, {
          aiPartnership: 72,
          sessionCraft: 68,
          toolMastery: 75,
          skillResilience: 70,
          sessionMastery: 78,
        });

        const enriched = enrichGrowthAreasWithKbTips(
          domainResults,
          SYNTHETIC_KB_ITEMS,
          SYNTHETIC_PROFESSIONAL_INSIGHTS,
        );

        const report = {
          persona: persona.name,
          project: persona.project,
          sessionCount: persona.sessionIds.length,
          domainResults: enriched.map(dr => ({
            domain: dr.domain,
            overallScore: dr.overallScore,
            growthAreaCount: dr.growthAreas.length,
            growthAreas: dr.growthAreas.map(ga => ({
              title: ga.title,
              severity: ga.severity,
              description: ga.description,
              recommendation: ga.recommendation,
              evidenceMomentCount: ga.evidenceMoments?.length ?? 0,
              evidenceMoments: (ga.evidenceMoments ?? []).map(m => ({
                sessionId: m.sessionId,
                quote: m.quote,
                behaviorDescription: m.behaviorDescription,
              })),
              verifiableAction: ga.verifiableAction
                ? { action: ga.verifiableAction.action, checkDescription: ga.verifiableAction.checkDescription }
                : null,
              goalRelevance: ga.goalRelevance ?? null,
              categoryTags: ga.categoryTags,
              lowConfidence: ga.lowConfidence,
              kbTip: ga.kbTip
                ? {
                    title: ga.kbTip.title,
                    sourceAuthor: ga.kbTip.sourceAuthor,
                    relevanceScore: ga.kbTip.relevanceScore,
                    credibilityTier: ga.kbTip.credibilityTier,
                  }
                : null,
            })),
          })),
          qualityRubricResults: persona.growthAreas.map(ga => {
            const result = evaluateQualityRubric(ga);
            return { title: ga.pattern.title, rubric: result.rubric, passes: result.passes };
          }),
        };

        fullReports.push(report);
      }

      // Write individual persona reports
      for (const report of fullReports) {
        const filename = `persona-${report.persona.toLowerCase().replace(/\s+/g, '-')}.json`;
        writeOutput(filename, report);
      }

      // Write consolidated summary
      const summary = {
        generatedAt: new Date().toISOString(),
        totalPersonas: fullReports.length,
        totalGrowthAreas: fullReports.reduce((sum, r) => sum + r.domainResults.reduce((s, d) => s + d.growthAreaCount, 0), 0),
        allPassRubric: fullReports.every(r => r.qualityRubricResults.every(q => q.passes)),
        perPersonaSummary: fullReports.map(r => ({
          persona: r.persona,
          project: r.project,
          sessions: r.sessionCount,
          growthAreaCount: r.domainResults.reduce((s, d) => s + d.growthAreaCount, 0),
          domains: r.domainResults.map(d => d.domain),
          allRubricPass: r.qualityRubricResults.every(q => q.passes),
          kbTipsAttached: r.domainResults.flatMap(d => d.growthAreas).filter(g => g.kbTip !== null).length,
        })),
        rubricPassRate: (() => {
          const all = fullReports.flatMap(r => r.qualityRubricResults);
          return `${all.filter(q => q.passes).length}/${all.length}`;
        })(),
      };
      writeOutput('pipeline-summary.json', summary);

      // Assertions
      expect(fullReports.length).toBe(7);
      expect(summary.allPassRubric).toBe(true);
      expect(summary.totalGrowthAreas).toBeGreaterThanOrEqual(15); // 7 personas × ~3 avg
    });
  });

  // ── Section 5: Team Aggregation Readiness ────────────────────────────
  describe('Team Aggregation Data Readiness', () => {
    it('produces MemberGrowthArea structures suitable for team aggregation', () => {
      const memberGrowthAreas: Array<{
        memberName: string;
        growthAreas: Array<{
          title: string;
          domain: string;
          severity: string;
          categoryTags: string[] | undefined;
          recommendation: string;
        }>;
      }> = [];

      for (const persona of personas) {
        const memberAreas = persona.growthAreas.map(pea => {
          const member = peaToMemberGrowthArea(pea);
          return {
            title: member.title,
            domain: member.domain,
            severity: member.severity,
            categoryTags: member.categoryTags,
            recommendation: member.recommendation,
          };
        });

        memberGrowthAreas.push({
          memberName: persona.name,
          growthAreas: memberAreas,
        });
      }

      writeOutput('team-aggregation-input.json', {
        totalMembers: memberGrowthAreas.length,
        members: memberGrowthAreas,
        // Identify cross-developer patterns by shared category tags
        sharedCategoryTags: (() => {
          const tagCount = new Map<string, string[]>();
          for (const m of memberGrowthAreas) {
            for (const ga of m.growthAreas) {
              for (const tag of ga.categoryTags ?? []) {
                const members = tagCount.get(tag) ?? [];
                if (!members.includes(m.memberName)) members.push(m.memberName);
                tagCount.set(tag, members);
              }
            }
          }
          return [...tagCount.entries()]
            .filter(([, members]) => members.length >= 2)
            .sort((a, b) => b[1].length - a[1].length)
            .map(([tag, members]) => ({ tag, memberCount: members.length, members }));
        })(),
      });

      // Assertions: verify all growth areas have category tags for team aggregation
      for (const m of memberGrowthAreas) {
        for (const ga of m.growthAreas) {
          expect(ga.categoryTags).toBeDefined();
          expect(ga.categoryTags!.length).toBeGreaterThanOrEqual(1);
        }
      }
    });
  });

  // ── Section 6: Cross-Persona Pattern Detection ───────────────────────
  describe('Cross-Persona Pattern Detection', () => {
    it('identifies shared growth patterns across personas via tag overlap', () => {
      const allGrowthAreas = personas.flatMap(p =>
        p.growthAreas.map(ga => ({
          persona: p.name,
          title: ga.pattern.title,
          domain: ga.domain,
          severity: ga.pattern.severity,
          categoryTags: ga.categoryTags ?? [],
        })),
      );

      // Find tag-based clusters (2+ shared tags = potential team pattern)
      const clusters: Array<{
        sharedTags: string[];
        members: Array<{ persona: string; title: string; domain: string }>;
      }> = [];

      for (let i = 0; i < allGrowthAreas.length; i++) {
        for (let j = i + 1; j < allGrowthAreas.length; j++) {
          const a = allGrowthAreas[i];
          const b = allGrowthAreas[j];
          if (a.persona === b.persona) continue; // Cross-persona only

          const sharedTags = a.categoryTags.filter(t => b.categoryTags.includes(t));
          if (sharedTags.length >= 2) {
            // Check if this cluster already exists
            const existing = clusters.find(c =>
              c.members.some(m => m.persona === a.persona && m.title === a.title) &&
              c.members.some(m => m.persona === b.persona && m.title === b.title),
            );
            if (!existing) {
              clusters.push({
                sharedTags,
                members: [
                  { persona: a.persona, title: a.title, domain: a.domain },
                  { persona: b.persona, title: b.title, domain: b.domain },
                ],
              });
            }
          }
        }
      }

      writeOutput('cross-persona-patterns.json', {
        totalGrowthAreas: allGrowthAreas.length,
        crossPersonaClusters: clusters.length,
        clusters: clusters.sort((a, b) => b.sharedTags.length - a.sharedTags.length),
      });

      // We expect at least some cross-persona patterns given the diverse set
      // (error-handling, test-coverage, react-components appear across personas)
      expect(clusters.length).toBeGreaterThanOrEqual(1);
    });
  });
});
