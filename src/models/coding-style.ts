import { z } from 'zod';

// ============================================================================
// AI Coding Style Types - MBTI-like personality types for developers
// ============================================================================

/**
 * The 5 AI Coding Style Types
 * All types are positive - each has strengths and growth points
 */
export const CodingStyleTypeSchema = z.enum([
  'architect',
  'scientist',
  'collaborator',
  'speedrunner',
  'craftsman',
]);
export type CodingStyleType = z.infer<typeof CodingStyleTypeSchema>;

/**
 * Type metadata for display
 */
export const TYPE_METADATA: Record<
  CodingStyleType,
  {
    emoji: string;
    name: string;
    tagline: string;
    description: string;
    strengths: string[];
    growthPoints: string[];
  }
> = {
  architect: {
    emoji: '🏗️',
    name: 'Architect',
    tagline: 'Strategic thinker who plans before diving into code',
    description:
      'You approach AI collaboration with a clear vision. Your structured prompts and systematic planning maximize AI implementation speed while maintaining consistency.',
    strengths: [
      'Systematic approach to complex systems',
      "Maximizes AI's implementation speed",
      'High consistency in output',
    ],
    growthPoints: [
      'Quick prototyping can sometimes be more efficient',
      'Over-planning may delay execution',
    ],
  },
  scientist: {
    emoji: '🔬',
    name: 'Scientist',
    tagline: 'Truth-seeker who always verifies AI output',
    description:
      "You maintain healthy skepticism toward AI output. Your verification habits catch bugs early and ensure high code quality while keeping your skills sharp.",
    strengths: [
      'Catches bugs early',
      'High code quality',
      'Low AI dependency, maintains skills',
    ],
    growthPoints: [
      'Verifying everything can slow velocity',
      'More AI trust could improve efficiency',
    ],
  },
  collaborator: {
    emoji: '🤝',
    name: 'Collaborator',
    tagline: 'Partnership master who finds answers through dialogue',
    description:
      'You excel at iterative refinement through conversation. Your collaborative approach maximizes AI synergy and leads to quality improvement through iteration.',
    strengths: [
      'Maximizes AI synergy',
      'Quality improvement through iteration',
      'Flexible problem solving',
    ],
    growthPoints: [
      'Clearer initial requirements could reduce turns',
      'Sometimes one clear request is more efficient',
    ],
  },
  speedrunner: {
    emoji: '⚡',
    name: 'Speedrunner',
    tagline: 'Agile executor who delivers through fast iteration',
    description:
      'You move fast and iterate quickly. Your rapid prototyping approach leads to new discoveries through experimentation and high output per time.',
    strengths: [
      'Rapid prototyping',
      'New discoveries through experimentation',
      'High output per time',
    ],
    growthPoints: [
      'Technical debt may accumulate',
      'Sometimes slower design is more efficient',
    ],
  },
  craftsman: {
    emoji: '🔧',
    name: 'Craftsman',
    tagline: 'Artisan who prioritizes code quality above all',
    description:
      'You care deeply about code quality and consistency. Your attention to detail produces maintainable code and minimizes long-term technical debt.',
    strengths: [
      'Produces maintainable code',
      'Maintains team codebase consistency',
      'Minimizes long-term technical debt',
    ],
    growthPoints: [
      'Perfectionism may delay deployment',
      'Speed matters too at MVP stage',
    ],
  },
};

// ============================================================================
// Metrics extracted from session logs
// ============================================================================

/**
 * Raw metrics extracted from session analysis
 */
export interface SessionMetrics {
  // Prompt characteristics
  avgPromptLength: number;
  avgFirstPromptLength: number;
  maxPromptLength: number;

  // Turn patterns
  avgTurnsPerSession: number;
  totalTurns: number;

  // Question patterns
  questionFrequency: number; // Questions per turn
  whyHowWhatCount: number;

  // Tool usage patterns
  toolUsage: {
    read: number;
    grep: number;
    glob: number;
    task: number;
    plan: number;
    bash: number;
    write: number;
    edit: number;
    total: number;
  };

  // Modification patterns
  modificationRequestCount: number;
  modificationRate: number; // modification requests / total turns

  // Quality signals
  refactorKeywordCount: number;
  styleKeywordCount: number;
  qualityTermCount: number; // test, type, doc mentions

  // Feedback patterns
  positiveFeedbackCount: number;
  negativeFeedbackCount: number;

  // Time patterns
  avgCycleTimeSeconds: number;
  sessionDurationSeconds: number;
}

/**
 * Scores for each type (0-100)
 */
export interface TypeScores {
  architect: number;
  scientist: number;
  collaborator: number;
  speedrunner: number;
  craftsman: number;
}

/**
 * Distribution as percentages (sum to 100)
 */
export interface TypeDistribution {
  architect: number;
  scientist: number;
  collaborator: number;
  speedrunner: number;
  craftsman: number;
}

// ============================================================================
// Evidence extracted from conversations
// ============================================================================

/**
 * A conversation sample that demonstrates a type
 */
export interface ConversationEvidence {
  type: CodingStyleType;
  quote: string;
  timestamp: Date;
  explanation: string;
}

// ============================================================================
// Type Detection Result
// ============================================================================

/**
 * Schema for the type detection result
 */
export const TypeResultSchema = z.object({
  primaryType: CodingStyleTypeSchema,
  distribution: z.object({
    architect: z.number().min(0).max(100),
    scientist: z.number().min(0).max(100),
    collaborator: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    craftsman: z.number().min(0).max(100),
  }),
  metrics: z.object({
    avgPromptLength: z.number(),
    avgFirstPromptLength: z.number(),
    avgTurnsPerSession: z.number(),
    questionFrequency: z.number(),
    modificationRate: z.number(),
    toolUsageHighlight: z.string(),
  }),
  evidence: z.array(
    z.object({
      type: CodingStyleTypeSchema,
      quote: z.string(),
      timestamp: z.string(),
      explanation: z.string(),
    })
  ),
  sessionCount: z.number(),
  analyzedAt: z.string(),
});
export type TypeResult = z.infer<typeof TypeResultSchema>;

// ============================================================================
// Keywords for pattern detection
// ============================================================================

export const PATTERN_KEYWORDS = {
  // Questions (Scientist signals)
  questions: ['why', 'how', 'what', 'explain', 'clarify', 'understand'],

  // Modification requests (Scientist/Collaborator signals)
  modifications: [
    'change',
    'fix',
    'update',
    'modify',
    'adjust',
    'correct',
    'wrong',
    'error',
    'bug',
    'issue',
  ],

  // Planning patterns (Architect signals)
  planning: [
    'first',
    'then',
    'next',
    'step',
    'plan',
    'design',
    'architecture',
    'approach',
    'strategy',
    'before we',
  ],

  // Speed patterns (Speedrunner signals)
  speed: [
    'quick',
    'fast',
    'just do',
    'make it',
    'run',
    'execute',
    'next',
    'done',
    'ok',
  ],

  // Quality patterns (Craftsman signals)
  quality: [
    'refactor',
    'clean',
    'style',
    'naming',
    'readable',
    'maintainable',
    'pattern',
    'consistent',
  ],

  // Quality terms (Craftsman signals)
  qualityTerms: ['test', 'type', 'doc', 'lint', 'format', 'prettier', 'eslint'],

  // Positive feedback (Collaborator signals)
  positiveFeedback: [
    'thanks',
    'thank you',
    'great',
    'good',
    'nice',
    'perfect',
    'excellent',
    'awesome',
    'love it',
  ],

  // Iteration patterns (Collaborator signals)
  iteration: [
    'but',
    'however',
    'also',
    'add',
    'more',
    'another',
    'additionally',
    'almost',
    'close',
  ],
} as const;
