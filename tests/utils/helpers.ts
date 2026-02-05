/**
 * Test Helper Utilities
 *
 * Factory functions for creating mock data used across tests.
 */

import type { ParsedSession, ParsedMessage } from '../../src/lib/models/session.js';
import type { TypeResult, CodingStyleType } from '../../src/lib/models/coding-style.js';
import type { FullAnalysisResult } from '../../src/lib/analyzer/dimensions/index.js';
import type { VerboseEvaluation } from '../../src/lib/models/verbose-evaluation.js';

// ============================================
// Session Factories
// ============================================

/**
 * Create a minimal mock session for testing
 */
export function createMockSession(overrides: Partial<ParsedSession> = {}): ParsedSession {
  return {
    sessionId: 'test-session-001',
    projectPath: '/Users/test/project',
    messages: [
      createMockMessage({ role: 'user', content: 'Hello, help me write a function' }),
      createMockMessage({ role: 'assistant', content: 'Sure, I can help with that.' }),
    ],
    stats: {
      messageCount: 2,
      userMessageCount: 1,
      assistantMessageCount: 1,
      toolUseCount: 0,
      durationMs: 60000,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    },
    ...overrides,
  };
}

/**
 * Create a mock message
 */
export function createMockMessage(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    role: 'user',
    content: 'Test message content',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a complex session with tool usage
 */
export function createComplexSession(): ParsedSession {
  return createMockSession({
    sessionId: 'complex-session-001',
    messages: [
      createMockMessage({
        role: 'user',
        content: 'I need to refactor the authentication module. Can you first read the current implementation?',
      }),
      createMockMessage({
        role: 'assistant',
        content: 'I\'ll read the auth module and analyze it.',
        toolCalls: [{ name: 'Read', input: { path: 'src/auth/index.ts' } }],
      }),
      createMockMessage({
        role: 'user',
        content: 'Now search for all usages of the AuthProvider component',
      }),
      createMockMessage({
        role: 'assistant',
        content: 'Searching for AuthProvider usages...',
        toolCalls: [{ name: 'Grep', input: { pattern: 'AuthProvider' } }],
      }),
      createMockMessage({
        role: 'user',
        content: 'That looks good. Now update the login function to use the new API',
      }),
      createMockMessage({
        role: 'assistant',
        content: 'I\'ll update the login function.',
        toolCalls: [{ name: 'Edit', input: { path: 'src/auth/login.ts' } }],
      }),
    ],
    stats: {
      messageCount: 6,
      userMessageCount: 3,
      assistantMessageCount: 3,
      toolUseCount: 3,
      durationMs: 300000,
      startTime: new Date().toISOString(),
      endTime: new Date().toISOString(),
    },
  });
}

// ============================================
// Type Result Factories
// ============================================

/**
 * Create a mock TypeResult
 */
export function createMockTypeResult(overrides: Partial<TypeResult> = {}): TypeResult {
  return {
    primaryType: 'architect' as CodingStyleType,
    distribution: {
      architect: 45,
      analyst: 25,
      conductor: 15,
      speedrunner: 10,
      trendsetter: 5,
    },
    metrics: {
      avgPromptLength: 150,
      avgFirstPromptLength: 200,
      avgTurnsPerSession: 8,
      questionFrequency: 0.3,
      modificationRate: 0.2,
      toolUsageHighlight: 'Read',
    },
    evidence: [
      { type: 'architect', quote: 'Let me plan this out first', strength: 0.8 },
    ],
    sessionCount: 5,
    analyzedAt: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// Dimension Factories
// ============================================

/**
 * Create mock FullAnalysisResult with all 6 dimensions
 *
 * Note: Each dimension type has a specific structure that must be respected.
 * See src/analyzer/dimensions/*.ts for type definitions.
 */
export function createMockDimensions(overrides: Partial<FullAnalysisResult> = {}): FullAnalysisResult {
  return {
    aiCollaboration: {
      score: 75,
      level: 'proficient',
      breakdown: {
        structuredPlanning: {
          score: 80,
          todoWriteUsage: 5,
          stepByStepPlans: 3,
          specFileReferences: 2,
        },
        aiOrchestration: {
          score: 70,
          taskToolUsage: 4,
          multiAgentSessions: 2,
          parallelWorkflows: 1,
        },
        criticalVerification: {
          score: 75,
          codeReviewRequests: 3,
          testRequests: 4,
          outputModifications: 5,
        },
      },
      strengths: ['Strong structured planning - you break down tasks effectively'],
      growthAreas: ['Explore using Task tool to delegate to specialized agents'],
      interpretation: 'Proficient AI collaborator. You understand the importance of planning and verification.',
    },
    contextEngineering: {
      score: 68,
      level: 'developing',
      breakdown: {
        write: {
          score: 70,
          fileReferences: 15,
          codeElementReferences: 8,
          constraintsMentioned: 3,
          patternReferences: 2,
        },
        select: {
          score: 65,
          specificity: 60,
          codebaseNavigation: 5,
          existingPatternUsage: 4,
        },
        compress: {
          score: 60,
          compactUsageCount: 2,
          iterationEfficiency: 70,
          avgTurnsPerSession: 8,
        },
        isolate: {
          score: 75,
          taskToolUsage: 4,
          multiAgentDelegation: 2,
          focusedPrompts: 6,
        },
      },
      bestExample: {
        content: 'Please check src/utils/parser.ts:45-60 for the existing validation logic...',
        score: 85,
        reasons: ['Specific file reference', 'Line number precision'],
      },
      worstExample: null,
      tips: ['Try providing line numbers with file references'],
      interpretation: 'Developing context engineering skills. Good file references, room to improve compression.',
    },
    toolMastery: {
      overallScore: 82,
      toolUsage: {
        Read: { count: 45, percentage: 35, level: 'expert', assessment: 'Excellent exploration patterns' },
        Edit: { count: 25, percentage: 20, level: 'adept', assessment: 'Good targeted modifications' },
        Bash: { count: 20, percentage: 15, level: 'adept', assessment: 'Comfortable with shell commands' },
        Grep: { count: 15, percentage: 12, level: 'basic', assessment: 'Room to improve search patterns' },
        Task: { count: 10, percentage: 8, level: 'basic', assessment: 'Starting to use delegation' },
      },
      topTools: ['Read', 'Edit', 'Bash'],
      underutilizedTools: ['Task', 'TodoWrite'],
      tips: ['Try using Task tool for parallel work'],
    },
    burnoutRisk: {
      score: 35,
      level: 'low',
      breakdown: {
        afterHoursRate: 15,
        weekendRate: 10,
        lateNightCount: 2,
        avgSessionDuration: 25,
        sessionTrend: 'stable',
        longestSession: 45,
      },
      timeDistribution: {
        businessHours: 70,
        evening: 20,
        lateNight: 5,
        weekend: 5,
      },
      recommendations: ['Maintain current healthy work patterns'],
      qualityCorrelation: {
        shortSessions: { avgDuration: 15, qualityIndicator: 'focused' },
        longSessions: { avgDuration: 40, qualityIndicator: 'complex tasks' },
      },
    },
    aiControl: {
      score: 72,
      level: 'cartographer',
      breakdown: {
        verificationRate: 75,
        constraintSpecification: 70,
        outputCritique: 68,
        contextControl: 74,
      },
      signals: ['Verifies AI output before accepting', 'Provides clear constraints'],
      strengths: ['Strong verification habits', 'Clear constraint specification'],
      growthAreas: ['Could provide more critical feedback on AI suggestions'],
      interpretation: 'You maintain strategic control over AI assistance.',
    },
    skillResilience: {
      score: 65,
      level: 'developing',
      breakdown: {
        coldStartCapability: 70,
        hallucinationDetection: 60,
        explainabilityGap: 65,
      },
      warnings: [],
      recommendations: ['Practice reviewing AI code before accepting'],
      interpretation: 'Developing independent coding skills alongside AI assistance.',
      vpcMetrics: {
        m_csr: 0.70,
        m_ht: 0.60,
        e_gap: 0.35,
      },
    },
    ...overrides,
  };
}


// ============================================
// Verbose Evaluation Factories
// ============================================

/**
 * Create mock VerboseEvaluation
 */
export function createMockVerboseEvaluation(
  overrides: Partial<VerboseEvaluation> = {}
): VerboseEvaluation {
  return {
    sessionId: 'verbose-test-001',
    analyzedAt: new Date().toISOString(),
    sessionsAnalyzed: 5,
    primaryType: 'architect',
    controlLevel: 'cartographer',
    distribution: {
      architect: 40,
      analyst: 25,
      conductor: 20,
      speedrunner: 10,
      trendsetter: 5,
    },
    personalitySummary: 'You are a strategic architect who plans thoroughly before implementation.',
    strengths: [
      {
        title: 'Strategic Planning',
        description: 'You excel at breaking down complex tasks into manageable steps.',
        evidence: [
          {
            quote: 'Let me first understand the requirements before we start coding',
            sessionDate: new Date().toISOString(),
            context: 'Starting a new feature',
            significance: 'Shows proactive planning behavior',
            sentiment: 'positive',
          },
        ],
      },
    ],
    growthAreas: [
      {
        title: 'Tool Exploration',
        description: 'Could benefit from exploring more advanced tool usage.',
        evidence: [],
        recommendation: 'Try using the Task tool for complex multi-step operations.',
      },
    ],
    promptPatterns: [
      {
        patternName: 'Context First',
        description: 'Provides context before making requests',
        frequency: 'frequent',
        examples: [{ quote: 'Here is the current code...', analysis: 'Good context provision' }],
        effectiveness: 'highly_effective',
      },
    ],
    ...overrides,
  };
}

// ============================================
// Supabase Mock Factories
// ============================================

/**
 * Create a mock Supabase client for testing
 */
export function createSupabaseMock() {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
        order: () => ({
          limit: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
      insert: () => ({
        select: () => ({
          single: () => Promise.resolve({ data: { id: 'new-id' }, error: null }),
        }),
      }),
      update: () => ({
        eq: () => ({
          select: () => ({
            single: () => Promise.resolve({ data: { id: 'updated-id' }, error: null }),
          }),
        }),
      }),
      delete: () => ({
        eq: () => Promise.resolve({ error: null }),
      }),
    }),
    auth: {
      getUser: () => Promise.resolve({ data: { user: null }, error: null }),
      signInWithPassword: () => Promise.resolve({ data: { user: null }, error: null }),
    },
    rpc: (name: string, params: unknown) => Promise.resolve({ data: null, error: null }),
  };
}
