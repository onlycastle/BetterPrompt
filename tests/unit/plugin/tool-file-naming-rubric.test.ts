/**
 * Tool/File/API Naming Quality Rubric Tests
 *
 * Validates that the tool_file_naming quality criterion correctly
 * enforces that growth areas name specific tools, files, APIs, or
 * technologies the builder interacted with.
 *
 * Tests both:
 * 1. PEA schema validation (evaluateQualityRubric → toolFileNaming)
 * 2. save-domain-results quality gate (containsToolFileApiReference)
 *
 * @module tests/unit/plugin/tool-file-naming-rubric
 */

import { describe, expect, it } from 'vitest';
import {
  evaluateQualityRubric,
  containsToolFileApiReference,
  isValidToolFileApiEntry,
  processLLMOutputToPEA,
  type GrowthAreaPEALLMOutput,
} from '../../../packages/shared/src/schemas/growth-area-pea.js';

// ==========================================================================
// Helper: Create a valid PEA LLM output with customizable fields
// ==========================================================================

function makeValidPEAOutput(overrides: Partial<GrowthAreaPEALLMOutput> = {}): GrowthAreaPEALLMOutput {
  return {
    pattern: {
      title: 'Untested Error Handling in Express Middleware Routes',
      description: 'Across 4 of 6 sessions, you consistently write catch blocks in Express middleware without creating corresponding test cases. The error paths in middleware/auth.ts and middleware/stripe.ts are never exercised by tests. This leaves undetected bugs in production error flows.',
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

// ==========================================================================
// containsToolFileApiReference
// ==========================================================================

describe('containsToolFileApiReference', () => {
  describe('recognizes Claude Code tools', () => {
    it.each([
      'Use Read to inspect the file',
      'Edit the configuration',
      'Search with Grep for patterns',
      'Glob for matching files',
      'Run Bash commands',
      'Write the output file',
      'Delegate with Task',
      'Track with TodoWrite',
      'Research via WebSearch',
    ])('matches: %s', (text) => {
      expect(containsToolFileApiReference(text)).toBe(true);
    });
  });

  describe('recognizes CLI tools', () => {
    it.each([
      'Run npm install',
      'Execute vitest after changes',
      'Use git commit to save',
      'Run jest test suite',
      'Build with cargo',
      'Deploy with docker',
    ])('matches: %s', (text) => {
      expect(containsToolFileApiReference(text)).toBe(true);
    });
  });

  describe('recognizes frameworks and libraries', () => {
    it.each([
      'Express middleware error handling',
      'React component rendering',
      'Next.js server-side rendering',
      'Prisma schema migration',
      'Tailwind CSS styling',
      'Zod schema validation',
      'TypeScript type checking',
    ])('matches: %s', (text) => {
      expect(containsToolFileApiReference(text)).toBe(true);
    });
  });

  describe('recognizes file paths and extensions', () => {
    it.each([
      'Changes to middleware/auth.ts',
      'Update package.json dependencies',
      'Modified CLAUDE.md instructions',
      'Edit the config.yaml file',
      'Changes in src/api/routes.ts',
    ])('matches: %s', (text) => {
      expect(containsToolFileApiReference(text)).toBe(true);
    });
  });

  describe('recognizes API/service names', () => {
    it.each([
      'Stripe webhook integration',
      'OpenAI API calls',
      'AWS S3 bucket access',
      'Supabase authentication',
    ])('matches: %s', (text) => {
      expect(containsToolFileApiReference(text)).toBe(true);
    });
  });

  describe('rejects generic text without tool references', () => {
    it.each([
      'Error Handling Issues',
      'Improve Testing Habits',
      'Better Planning Practices',
      'Code Review Gaps',
      'Think before you code',
      'Be more careful with errors',
    ])('rejects: %s', (text) => {
      expect(containsToolFileApiReference(text)).toBe(false);
    });
  });
});

// ==========================================================================
// isValidToolFileApiEntry
// ==========================================================================

describe('isValidToolFileApiEntry', () => {
  describe('accepts valid entries', () => {
    it.each([
      'Express.js',
      'middleware/auth.ts',
      'jest',
      'Prisma ORM',
      'vitest',
      'package.json',
      'Stripe',
      '@prisma/client',
      'src/lib/utils',
      'React',
      'TypeScript',
      'Grep',
      'Bash',
    ])('accepts: %s', (entry) => {
      expect(isValidToolFileApiEntry(entry)).toBe(true);
    });
  });

  describe('rejects vague entries', () => {
    it.each([
      '',
      'x',
      'the tool',
      'some API',
      'a framework',
      'tool',
      'api',
      'framework',
      'library',
      'technology',
      'unknown',
      'n/a',
      'none',
      'tbd',
    ])('rejects: %s', (entry) => {
      expect(isValidToolFileApiEntry(entry)).toBe(false);
    });
  });
});

// ==========================================================================
// evaluateQualityRubric — toolFileNaming criterion
// ==========================================================================

describe('evaluateQualityRubric — toolFileNaming', () => {
  it('passes when title names a specific tool and toolsFilesApis has valid entries', () => {
    const pea = makeValidPEAOutput();
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.toolFileNaming).toBe(true);
  });

  it('fails when toolsFilesApis is empty', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Error Handling Issues',
        description: 'A long description that is over 100 characters to pass the minimum length check but does not name any specific tools or technologies at all whatsoever',
        severity: 'high',
        toolsFilesApis: [],
      },
    });
    // This would fail Zod validation (min 1), but let's test the rubric logic
    // directly by bypassing Zod
    const rubric = evaluateQualityRubric(pea as GrowthAreaPEALLMOutput);
    expect(rubric.toolFileNaming).toBe(false);
  });

  it('fails when toolsFilesApis has only vague placeholder entries', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Error Handling Issues',
        description: 'A long description that is over 100 characters to pass the minimum length check but does not name any specific tools or technologies at all whatsoever',
        severity: 'high',
        toolsFilesApis: ['the tool', 'some API'],
      },
    });
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.toolFileNaming).toBe(false);
  });

  it('fails when title and description are generic (no tool/file/API reference)', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Improve Error Handling Practices',
        description: 'This developer has poor error handling across multiple sessions. The pattern shows a lack of attention to detail when dealing with exceptions. This impacts code quality significantly and reduces maintainability over time.',
        severity: 'high',
        toolsFilesApis: ['Express.js'],
      },
    });
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.toolFileNaming).toBe(false);
  });

  it('passes when title contains a tool name even if description is generic', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Skipping vitest After Schema Changes',
        description: 'This developer consistently skips running the test suite after making changes to the data model. The pattern shows a lack of attention to validation that could lead to bugs being introduced silently.',
        severity: 'high',
        toolsFilesApis: ['vitest'],
      },
    });
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.toolFileNaming).toBe(true);
  });

  it('passes when description contains file path even if title is somewhat generic', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Repeated Retry Loops in Testing',
        description: 'In 4 of 6 sessions, the developer retries failing commands without reading error output. The pattern is most visible in middleware/auth.ts where the same TypeScript compilation error appears three times before being addressed.',
        severity: 'medium',
        toolsFilesApis: ['middleware/auth.ts', 'TypeScript'],
      },
    });
    const rubric = evaluateQualityRubric(pea);
    expect(rubric.toolFileNaming).toBe(true);
  });
});

// ==========================================================================
// processLLMOutputToPEA — integration test for tool_file_naming gate
// ==========================================================================

describe('processLLMOutputToPEA — tool_file_naming gate', () => {
  it('accepts growth areas that name specific tools', () => {
    const pea = makeValidPEAOutput();
    const result = processLLMOutputToPEA(pea);
    expect(result).not.toBeNull();
    expect(result?.qualityRubric.toolFileNaming).toBe(true);
  });

  it('rejects growth areas with generic titles and no tool references', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Improve Error Handling',
        description: 'The developer has poor error handling patterns across multiple sessions. Errors are caught but not properly logged or handled. This is a significant quality gap.',
        severity: 'high',
        toolsFilesApis: ['the tool'],
      },
    });
    const result = processLLMOutputToPEA(pea);
    expect(result).toBeNull();
  });

  it('accepts growth areas with slash commands in title', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Skipping /plan Before Multi-File Refactors',
        description: 'In 3 of 5 sessions involving multi-file changes, the developer jumps directly into editing without using the plan command to structure the approach. This leads to incomplete refactors.',
        severity: 'medium',
        toolsFilesApis: ['/plan', 'TodoWrite'],
      },
    });
    const result = processLLMOutputToPEA(pea);
    expect(result).not.toBeNull();
    expect(result?.qualityRubric.toolFileNaming).toBe(true);
  });

  it('accepts growth areas naming specific file paths', () => {
    const pea = makeValidPEAOutput({
      pattern: {
        title: 'Context Exhaustion from Unbounded Grep in src/',
        description: 'The developer uses Grep without path constraints when searching the monorepo, causing context window bloat. In 5 of 7 sessions, Grep searches target the root directory instead of scoping to src/lib/ or specific modules.',
        severity: 'high',
        toolsFilesApis: ['Grep', 'src/lib/'],
      },
    });
    const result = processLLMOutputToPEA(pea);
    expect(result).not.toBeNull();
    expect(result?.qualityRubric.toolFileNaming).toBe(true);
  });
});
