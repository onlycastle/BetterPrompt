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

// ============================================================================
// 2D Matrix Type System: Style × Control Level
// ============================================================================

/**
 * AI Control Level - measures how well you control AI vs depend on it
 * Based on: elvis ("Professional developers don't vibe, they control")
 */
export const AIControlLevelSchema = z.enum([
  'vibe-coder',  // High AI dependency
  'developing',  // Learning balance
  'ai-master',   // Strategic AI control
]);
export type AIControlLevel = z.infer<typeof AIControlLevelSchema>;

/**
 * 2D Matrix combining Style (5) × Control Level (3) = 15 combinations
 */
export interface CodingStyleMatrix {
  primaryStyle: CodingStyleType;
  controlLevel: AIControlLevel;
  combinedName: string;
  combinedEmoji: string;
}

/**
 * Matrix names for each Style × Control combination
 * Creates memorable personalities like "Systems Architect" or "Yolo Coder"
 */
export const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>> = {
  architect: {
    'vibe-coder': 'Dreamer',
    developing: 'Planner',
    'ai-master': 'Systems Architect',
  },
  scientist: {
    'vibe-coder': 'Curious',
    developing: 'Investigator',
    'ai-master': 'Research Master',
  },
  collaborator: {
    'vibe-coder': 'Follower',
    developing: 'Partner',
    'ai-master': 'Conductor',
  },
  speedrunner: {
    'vibe-coder': 'Yolo Coder',
    developing: 'Fast Learner',
    'ai-master': 'Efficient Master',
  },
  craftsman: {
    'vibe-coder': 'Perfectionist',
    developing: 'Quality Seeker',
    'ai-master': 'Code Artisan',
  },
};

/**
 * Detailed metadata for each Matrix combination
 */
export const MATRIX_METADATA: Record<
  CodingStyleType,
  Record<
    AIControlLevel,
    {
      emoji: string;
      description: string;
      keyStrength: string;
      growthPath: string;
    }
  >
> = {
  architect: {
    'vibe-coder': {
      emoji: '💭',
      description: 'You plan well but tend to let AI take over implementation.',
      keyStrength: 'Clear vision and planning',
      growthPath: 'Try validating AI output against your plans more actively',
    },
    developing: {
      emoji: '📐',
      description: 'You balance planning with hands-on verification.',
      keyStrength: 'Structured approach with growing control',
      growthPath: 'Keep building verification habits',
    },
    'ai-master': {
      emoji: '🏛️',
      description: 'You orchestrate AI with precision, using plans as control mechanisms.',
      keyStrength: 'Strategic AI orchestration with full control',
      growthPath: 'Share your planning techniques with others',
    },
  },
  scientist: {
    'vibe-coder': {
      emoji: '🔎',
      description: 'You ask questions but may accept answers too readily.',
      keyStrength: 'Curious mind and questioning attitude',
      growthPath: 'Try challenging AI responses more often',
    },
    developing: {
      emoji: '🧪',
      description: 'You verify AI output and are building critical thinking habits.',
      keyStrength: 'Growing verification skills',
      growthPath: 'Add systematic testing to your workflow',
    },
    'ai-master': {
      emoji: '🔬',
      description: 'You treat every AI output as a hypothesis to be tested.',
      keyStrength: 'Rigorous verification and error detection',
      growthPath: 'Help others develop critical thinking habits',
    },
  },
  collaborator: {
    'vibe-coder': {
      emoji: '👥',
      description: 'You converse with AI but let it lead the dialogue.',
      keyStrength: 'Open communication style',
      growthPath: 'Try directing conversations more actively',
    },
    developing: {
      emoji: '🤝',
      description: 'You engage in balanced dialogue with AI.',
      keyStrength: 'Effective back-and-forth refinement',
      growthPath: 'Focus on asking more probing questions',
    },
    'ai-master': {
      emoji: '🎭',
      description: 'You conduct AI like an orchestra, directing every iteration.',
      keyStrength: 'Masterful iterative refinement',
      growthPath: 'Document your collaboration patterns for others',
    },
  },
  speedrunner: {
    'vibe-coder': {
      emoji: '🎲',
      description: 'You move fast but may skip important verifications.',
      keyStrength: 'High velocity and experimentation',
      growthPath: 'Add quick sanity checks to your workflow',
    },
    developing: {
      emoji: '🏃',
      description: 'You balance speed with growing verification habits.',
      keyStrength: 'Fast iteration with increasing quality awareness',
      growthPath: 'Build quick-check routines into your speed',
    },
    'ai-master': {
      emoji: '⚡',
      description: 'You achieve maximum velocity through strategic AI delegation.',
      keyStrength: 'Efficient mastery - fast AND accurate',
      growthPath: 'Teach efficient verification techniques to others',
    },
  },
  craftsman: {
    'vibe-coder': {
      emoji: '🎨',
      description: 'You care about quality but rely heavily on AI to achieve it.',
      keyStrength: 'High standards and attention to detail',
      growthPath: 'Practice writing quality code without AI assistance',
    },
    developing: {
      emoji: '🔧',
      description: 'You actively refine AI output to meet your quality standards.',
      keyStrength: 'Active quality improvement process',
      growthPath: 'Keep developing your manual coding skills',
    },
    'ai-master': {
      emoji: '💎',
      description: 'You use AI as a precision tool to achieve exceptional quality.',
      keyStrength: 'Masterful quality control with AI assistance',
      growthPath: 'Set quality benchmarks for your team',
    },
  },
};

/**
 * Get the combined matrix result for a style and control level
 */
export function getMatrixResult(
  style: CodingStyleType,
  controlLevel: AIControlLevel
): CodingStyleMatrix {
  return {
    primaryStyle: style,
    controlLevel,
    combinedName: MATRIX_NAMES[style][controlLevel],
    combinedEmoji: MATRIX_METADATA[style][controlLevel].emoji,
  };
}

/**
 * Control level metadata for display
 */
export const CONTROL_LEVEL_METADATA: Record<
  AIControlLevel,
  {
    name: string;
    description: string;
    scoreRange: string;
  }
> = {
  'vibe-coder': {
    name: 'Vibe Coder',
    description: 'High AI dependency - you tend to accept AI output without much modification',
    scoreRange: '0-34',
  },
  developing: {
    name: 'Developing',
    description: 'Learning balance - you are building control habits over AI',
    scoreRange: '35-64',
  },
  'ai-master': {
    name: 'AI Master',
    description: 'Strategic control - you direct AI effectively as a tool',
    scoreRange: '65-100',
  },
};

// ============================================================================
// Matrix Distribution (5 types × 3 levels = 15 combinations)
// ============================================================================

/**
 * Key format for the 5×3 matrix
 */
export type MatrixKey = `${CodingStyleType}_${AIControlLevel}`;

/**
 * All 15 matrix keys
 */
export const ALL_MATRIX_KEYS: MatrixKey[] = [
  'architect_vibe-coder', 'architect_developing', 'architect_ai-master',
  'scientist_vibe-coder', 'scientist_developing', 'scientist_ai-master',
  'collaborator_vibe-coder', 'collaborator_developing', 'collaborator_ai-master',
  'speedrunner_vibe-coder', 'speedrunner_developing', 'speedrunner_ai-master',
  'craftsman_vibe-coder', 'craftsman_developing', 'craftsman_ai-master',
];

/**
 * Distribution across all 15 matrix combinations
 * Each value is 0-100, and all 15 should sum to 100
 */
export interface MatrixDistribution {
  'architect_vibe-coder': number;
  'architect_developing': number;
  'architect_ai-master': number;
  'scientist_vibe-coder': number;
  'scientist_developing': number;
  'scientist_ai-master': number;
  'collaborator_vibe-coder': number;
  'collaborator_developing': number;
  'collaborator_ai-master': number;
  'speedrunner_vibe-coder': number;
  'speedrunner_developing': number;
  'speedrunner_ai-master': number;
  'craftsman_vibe-coder': number;
  'craftsman_developing': number;
  'craftsman_ai-master': number;
}

/**
 * Zod schema for MatrixDistribution
 */
export const MatrixDistributionSchema = z.object({
  'architect_vibe-coder': z.number().min(0).max(100),
  'architect_developing': z.number().min(0).max(100),
  'architect_ai-master': z.number().min(0).max(100),
  'scientist_vibe-coder': z.number().min(0).max(100),
  'scientist_developing': z.number().min(0).max(100),
  'scientist_ai-master': z.number().min(0).max(100),
  'collaborator_vibe-coder': z.number().min(0).max(100),
  'collaborator_developing': z.number().min(0).max(100),
  'collaborator_ai-master': z.number().min(0).max(100),
  'speedrunner_vibe-coder': z.number().min(0).max(100),
  'speedrunner_developing': z.number().min(0).max(100),
  'speedrunner_ai-master': z.number().min(0).max(100),
  'craftsman_vibe-coder': z.number().min(0).max(100),
  'craftsman_developing': z.number().min(0).max(100),
  'craftsman_ai-master': z.number().min(0).max(100),
});

/**
 * Derive a 15-value matrix distribution from:
 * - typeDistribution: 5-value distribution across types
 * - controlScore: 0-100 score for control
 *
 * Logic: Distributes each type's percentage across 3 levels based on controlScore.
 * Higher controlScore = more weight on ai-master, lower = more weight on vibe-coder.
 *
 * @param typeDistribution - 5-value distribution across types
 * @param _controlLevel - User's primary control level (unused, kept for API compatibility)
 * @param controlScore - 0-100 score for control
 */
export function deriveMatrixDistribution(
  typeDistribution: TypeDistribution,
  _controlLevel: AIControlLevel,
  controlScore: number
): MatrixDistribution {
  // Clamp score to 0-100
  const score = Math.max(0, Math.min(100, controlScore));

  // Calculate weights for each control level based on score
  // Score 0-34: mostly vibe-coder
  // Score 35-64: mostly developing
  // Score 65-100: mostly ai-master
  let vibeWeight: number;
  let developingWeight: number;
  let masterWeight: number;

  if (score <= 34) {
    // Vibe-coder dominant: 60-80% vibe, rest split
    vibeWeight = 0.6 + (34 - score) / 85; // 0.6 to 1.0
    developingWeight = (1 - vibeWeight) * 0.7;
    masterWeight = (1 - vibeWeight) * 0.3;
  } else if (score <= 64) {
    // Developing dominant: peaked in middle
    const distFromCenter = Math.abs(score - 50) / 15;
    developingWeight = 0.5 + (1 - distFromCenter) * 0.3; // 0.5 to 0.8
    if (score < 50) {
      vibeWeight = (1 - developingWeight) * 0.6;
      masterWeight = (1 - developingWeight) * 0.4;
    } else {
      vibeWeight = (1 - developingWeight) * 0.4;
      masterWeight = (1 - developingWeight) * 0.6;
    }
  } else {
    // AI-master dominant: 60-80% master, rest split
    masterWeight = 0.6 + (score - 65) / 87.5; // 0.6 to 1.0
    developingWeight = (1 - masterWeight) * 0.7;
    vibeWeight = (1 - masterWeight) * 0.3;
  }

  // Normalize weights to sum to 1
  const totalWeight = vibeWeight + developingWeight + masterWeight;
  vibeWeight /= totalWeight;
  developingWeight /= totalWeight;
  masterWeight /= totalWeight;

  // Apply weights to each type's distribution
  // Helper to calculate rounded percentage
  const calcPct = (typePct: number, weight: number): number =>
    Math.round(typePct * weight * 10) / 10;

  return {
    'architect_vibe-coder': calcPct(typeDistribution.architect || 0, vibeWeight),
    'architect_developing': calcPct(typeDistribution.architect || 0, developingWeight),
    'architect_ai-master': calcPct(typeDistribution.architect || 0, masterWeight),
    'scientist_vibe-coder': calcPct(typeDistribution.scientist || 0, vibeWeight),
    'scientist_developing': calcPct(typeDistribution.scientist || 0, developingWeight),
    'scientist_ai-master': calcPct(typeDistribution.scientist || 0, masterWeight),
    'collaborator_vibe-coder': calcPct(typeDistribution.collaborator || 0, vibeWeight),
    'collaborator_developing': calcPct(typeDistribution.collaborator || 0, developingWeight),
    'collaborator_ai-master': calcPct(typeDistribution.collaborator || 0, masterWeight),
    'speedrunner_vibe-coder': calcPct(typeDistribution.speedrunner || 0, vibeWeight),
    'speedrunner_developing': calcPct(typeDistribution.speedrunner || 0, developingWeight),
    'speedrunner_ai-master': calcPct(typeDistribution.speedrunner || 0, masterWeight),
    'craftsman_vibe-coder': calcPct(typeDistribution.craftsman || 0, vibeWeight),
    'craftsman_developing': calcPct(typeDistribution.craftsman || 0, developingWeight),
    'craftsman_ai-master': calcPct(typeDistribution.craftsman || 0, masterWeight),
  };
}

/**
 * Get matrix key from type and control level
 */
export function getMatrixKey(type: CodingStyleType, level: AIControlLevel): MatrixKey {
  return `${type}_${level}`;
}
