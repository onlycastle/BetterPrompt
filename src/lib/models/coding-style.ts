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
 * Uses exploration metaphor: all levels are positive journeys
 */
export const AIControlLevelSchema = z.enum([
  'explorer',      // Open exploration, discovering solutions
  'navigator',     // Balancing exploration and route planning
  'cartographer',  // Mapping territory before advancing
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
 * Creates memorable personalities with exploration theme and style-specific character
 */
export const MATRIX_NAMES: Record<CodingStyleType, Record<AIControlLevel, string>> = {
  architect: {
    explorer: 'Visionary',
    navigator: 'Strategist',
    cartographer: 'Systems Architect',
  },
  scientist: {
    explorer: 'Questioner',
    navigator: 'Analyst',
    cartographer: 'Research Lead',
  },
  collaborator: {
    explorer: 'Conversationalist',
    navigator: 'Team Player',
    cartographer: 'Facilitator',
  },
  speedrunner: {
    explorer: 'Experimenter',
    navigator: 'Rapid Prototyper',
    cartographer: 'Velocity Expert',
  },
  craftsman: {
    explorer: 'Detail Lover',
    navigator: 'Quality Crafter',
    cartographer: 'Master Artisan',
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
    explorer: {
      emoji: '💭',
      description: 'You explore solutions through open-ended planning and vision.',
      keyStrength: 'Clear vision and creative planning',
      growthPath: 'Try validating AI output against your plans more actively',
    },
    navigator: {
      emoji: '📐',
      description: 'You balance strategic planning with hands-on verification.',
      keyStrength: 'Structured approach with balanced control',
      growthPath: 'Keep building verification habits',
    },
    cartographer: {
      emoji: '🏛️',
      description: 'You map out the territory completely before advancing.',
      keyStrength: 'Strategic AI orchestration with full control',
      growthPath: 'Share your planning techniques with others',
    },
  },
  scientist: {
    explorer: {
      emoji: '🔎',
      description: 'You explore through curious questioning and open inquiry.',
      keyStrength: 'Curious mind and questioning attitude',
      growthPath: 'Try challenging AI responses more often',
    },
    navigator: {
      emoji: '🧪',
      description: 'You navigate through hypothesis and verification.',
      keyStrength: 'Growing verification skills',
      growthPath: 'Add systematic testing to your workflow',
    },
    cartographer: {
      emoji: '🔬',
      description: 'You map every hypothesis systematically before proceeding.',
      keyStrength: 'Rigorous verification and error detection',
      growthPath: 'Help others develop critical thinking habits',
    },
  },
  collaborator: {
    explorer: {
      emoji: '👥',
      description: 'You explore solutions through rich dialogue and conversation.',
      keyStrength: 'Open communication style',
      growthPath: 'Try directing conversations more actively',
    },
    navigator: {
      emoji: '🤝',
      description: 'You navigate through balanced, productive dialogue.',
      keyStrength: 'Effective back-and-forth refinement',
      growthPath: 'Focus on asking more probing questions',
    },
    cartographer: {
      emoji: '🎭',
      description: 'You facilitate and direct collaborative sessions masterfully.',
      keyStrength: 'Masterful iterative refinement',
      growthPath: 'Document your collaboration patterns for others',
    },
  },
  speedrunner: {
    explorer: {
      emoji: '🎲',
      description: 'You explore through rapid experimentation and iteration.',
      keyStrength: 'High velocity and experimentation',
      growthPath: 'Add quick sanity checks to your workflow',
    },
    navigator: {
      emoji: '🏃',
      description: 'You navigate quickly while building verification habits.',
      keyStrength: 'Fast iteration with increasing quality awareness',
      growthPath: 'Build quick-check routines into your speed',
    },
    cartographer: {
      emoji: '⚡',
      description: 'You achieve maximum velocity through strategic optimization.',
      keyStrength: 'Efficient expertise - fast AND accurate',
      growthPath: 'Teach efficient verification techniques to others',
    },
  },
  craftsman: {
    explorer: {
      emoji: '🎨',
      description: 'You explore quality through attention to detail and aesthetics.',
      keyStrength: 'High standards and attention to detail',
      growthPath: 'Practice writing quality code without AI assistance',
    },
    navigator: {
      emoji: '🔧',
      description: 'You navigate toward quality through active refinement.',
      keyStrength: 'Active quality improvement process',
      growthPath: 'Keep developing your manual coding skills',
    },
    cartographer: {
      emoji: '💎',
      description: 'You craft with precision, using AI as an expert tool.',
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
  explorer: {
    name: 'Explorer',
    description: 'Open exploration - you discover solutions through experimentation',
    scoreRange: '0-34',
  },
  navigator: {
    name: 'Navigator',
    description: 'Balanced navigation - you balance exploration with route planning',
    scoreRange: '35-64',
  },
  cartographer: {
    name: 'Cartographer',
    description: 'Strategic mapping - you chart the territory before advancing',
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
  'architect_explorer', 'architect_navigator', 'architect_cartographer',
  'scientist_explorer', 'scientist_navigator', 'scientist_cartographer',
  'collaborator_explorer', 'collaborator_navigator', 'collaborator_cartographer',
  'speedrunner_explorer', 'speedrunner_navigator', 'speedrunner_cartographer',
  'craftsman_explorer', 'craftsman_navigator', 'craftsman_cartographer',
];

/**
 * Distribution across all 15 matrix combinations
 * Each value is 0-100, and all 15 should sum to 100
 */
export interface MatrixDistribution {
  architect_explorer: number;
  architect_navigator: number;
  architect_cartographer: number;
  scientist_explorer: number;
  scientist_navigator: number;
  scientist_cartographer: number;
  collaborator_explorer: number;
  collaborator_navigator: number;
  collaborator_cartographer: number;
  speedrunner_explorer: number;
  speedrunner_navigator: number;
  speedrunner_cartographer: number;
  craftsman_explorer: number;
  craftsman_navigator: number;
  craftsman_cartographer: number;
}

/**
 * Zod schema for MatrixDistribution
 */
export const MatrixDistributionSchema = z.object({
  architect_explorer: z.number().min(0).max(100),
  architect_navigator: z.number().min(0).max(100),
  architect_cartographer: z.number().min(0).max(100),
  scientist_explorer: z.number().min(0).max(100),
  scientist_navigator: z.number().min(0).max(100),
  scientist_cartographer: z.number().min(0).max(100),
  collaborator_explorer: z.number().min(0).max(100),
  collaborator_navigator: z.number().min(0).max(100),
  collaborator_cartographer: z.number().min(0).max(100),
  speedrunner_explorer: z.number().min(0).max(100),
  speedrunner_navigator: z.number().min(0).max(100),
  speedrunner_cartographer: z.number().min(0).max(100),
  craftsman_explorer: z.number().min(0).max(100),
  craftsman_navigator: z.number().min(0).max(100),
  craftsman_cartographer: z.number().min(0).max(100),
});

/**
 * Derive a 15-value matrix distribution from:
 * - typeDistribution: 5-value distribution across types
 * - controlScore: 0-100 score for control
 *
 * Logic: Distributes each type's percentage across 3 levels based on controlScore.
 * Higher controlScore = more weight on cartographer, lower = more weight on explorer.
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
  // Score 0-34: mostly explorer
  // Score 35-64: mostly navigator
  // Score 65-100: mostly cartographer
  let explorerWeight: number;
  let navigatorWeight: number;
  let cartographerWeight: number;

  if (score <= 34) {
    // Explorer dominant: 60-80% explorer, rest split
    explorerWeight = 0.6 + (34 - score) / 85; // 0.6 to 1.0
    navigatorWeight = (1 - explorerWeight) * 0.7;
    cartographerWeight = (1 - explorerWeight) * 0.3;
  } else if (score <= 64) {
    // Navigator dominant: peaked in middle
    const distFromCenter = Math.abs(score - 50) / 15;
    navigatorWeight = 0.5 + (1 - distFromCenter) * 0.3; // 0.5 to 0.8
    if (score < 50) {
      explorerWeight = (1 - navigatorWeight) * 0.6;
      cartographerWeight = (1 - navigatorWeight) * 0.4;
    } else {
      explorerWeight = (1 - navigatorWeight) * 0.4;
      cartographerWeight = (1 - navigatorWeight) * 0.6;
    }
  } else {
    // Cartographer dominant: 60-80% cartographer, rest split
    cartographerWeight = 0.6 + (score - 65) / 87.5; // 0.6 to 1.0
    navigatorWeight = (1 - cartographerWeight) * 0.7;
    explorerWeight = (1 - cartographerWeight) * 0.3;
  }

  // Normalize weights to sum to 1
  const totalWeight = explorerWeight + navigatorWeight + cartographerWeight;
  explorerWeight /= totalWeight;
  navigatorWeight /= totalWeight;
  cartographerWeight /= totalWeight;

  // Apply weights to each type's distribution
  // Helper to calculate rounded percentage
  const calcPct = (typePct: number, weight: number): number =>
    Math.round(typePct * weight * 10) / 10;

  return {
    architect_explorer: calcPct(typeDistribution.architect || 0, explorerWeight),
    architect_navigator: calcPct(typeDistribution.architect || 0, navigatorWeight),
    architect_cartographer: calcPct(typeDistribution.architect || 0, cartographerWeight),
    scientist_explorer: calcPct(typeDistribution.scientist || 0, explorerWeight),
    scientist_navigator: calcPct(typeDistribution.scientist || 0, navigatorWeight),
    scientist_cartographer: calcPct(typeDistribution.scientist || 0, cartographerWeight),
    collaborator_explorer: calcPct(typeDistribution.collaborator || 0, explorerWeight),
    collaborator_navigator: calcPct(typeDistribution.collaborator || 0, navigatorWeight),
    collaborator_cartographer: calcPct(typeDistribution.collaborator || 0, cartographerWeight),
    speedrunner_explorer: calcPct(typeDistribution.speedrunner || 0, explorerWeight),
    speedrunner_navigator: calcPct(typeDistribution.speedrunner || 0, navigatorWeight),
    speedrunner_cartographer: calcPct(typeDistribution.speedrunner || 0, cartographerWeight),
    craftsman_explorer: calcPct(typeDistribution.craftsman || 0, explorerWeight),
    craftsman_navigator: calcPct(typeDistribution.craftsman || 0, navigatorWeight),
    craftsman_cartographer: calcPct(typeDistribution.craftsman || 0, cartographerWeight),
  };
}

/**
 * Get matrix key from type and control level
 */
export function getMatrixKey(type: CodingStyleType, level: AIControlLevel): MatrixKey {
  return `${type}_${level}`;
}
