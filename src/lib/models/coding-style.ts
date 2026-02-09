import { z } from 'zod';

// ============================================================================
// AI Coding Style Types - MBTI-like personality types for developers
// ============================================================================

/**
 * The 5 AI Coding Style Types
 * All types are positive - each has strengths and growth points
 *
 * v2 Taxonomy (2026-02):
 * - architect: Planning intensity (kept)
 * - analyst: Thoroughness (merges scientist + craftsman)
 * - conductor: Tool mastery & AI orchestration (replaces collaborator)
 * - speedrunner: Efficiency (kept)
 * - trendsetter: Novelty-seeking (new)
 */
export const CodingStyleTypeSchema = z.enum([
  'architect',
  'analyst',
  'conductor',
  'speedrunner',
  'trendsetter',
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
  analyst: {
    emoji: '🔬',
    name: 'Analyst',
    tagline: 'Deep investigator who verifies and questions everything',
    description:
      'You combine systematic verification with critical thinking. Your thorough approach catches bugs early, questions assumptions, and ensures high code quality through investigation.',
    strengths: [
      'Catches bugs early through systematic verification',
      'Questions assumptions and explores alternatives',
      'Low repeated mistakes through deep understanding',
    ],
    growthPoints: [
      'Thoroughness can slow velocity on simpler tasks',
      'Balancing depth with pragmatism',
    ],
  },
  conductor: {
    emoji: '🎼',
    name: 'Conductor',
    tagline: 'Orchestration master who commands AI tools like an ensemble',
    description:
      'You excel at orchestrating AI tools and workflows. Your mastery of slash commands, subagents, role assignments, and multi-tool workflows maximizes AI synergy and productivity.',
    strengths: [
      'High tool diversity and mastery',
      'Effective multi-agent orchestration',
      'Creative workflow composition',
    ],
    growthPoints: [
      'Complex orchestration can add overhead for simple tasks',
      'Direct approaches may be faster for focused work',
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
  trendsetter: {
    emoji: '🚀',
    name: 'Trendsetter',
    tagline: 'Innovation seeker who explores cutting-edge approaches',
    description:
      'You actively seek the latest tools, frameworks, and best practices. Your curiosity drives you to explore emerging technologies and modern approaches, keeping your stack ahead of the curve.',
    strengths: [
      'Early adoption of effective new tools',
      'Awareness of industry best practices',
      'Continuous learning mindset',
    ],
    growthPoints: [
      'Novelty bias may lead to premature adoption',
      'Proven solutions sometimes outperform trendy ones',
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

  // Planning patterns (Architect-specific signals)
  planningKeywordCount: number; // first, then, step, plan, design, etc.
  stepPatternCount: number; // numbered lists, "first...then" structures

  // Time patterns
  avgCycleTimeSeconds: number;
  sessionDurationSeconds: number;
}

/**
 * Scores for each type (0-100)
 */
export interface TypeScores {
  architect: number;
  analyst: number;
  conductor: number;
  speedrunner: number;
  trendsetter: number;
}

/**
 * Distribution as percentages (sum to 100)
 */
export interface TypeDistribution {
  architect: number;
  analyst: number;
  conductor: number;
  speedrunner: number;
  trendsetter: number;
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
    analyst: z.number().min(0).max(100),
    conductor: z.number().min(0).max(100),
    speedrunner: z.number().min(0).max(100),
    trendsetter: z.number().min(0).max(100),
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
  // Questions (Analyst signals)
  questions: ['why', 'how', 'what', 'explain', 'clarify', 'understand'],

  // Modification requests (Analyst signals)
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

  // Quality patterns (Analyst signals)
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

  // Quality terms (Analyst signals)
  qualityTerms: ['test', 'type', 'doc', 'lint', 'format', 'prettier', 'eslint'],

  // Orchestration patterns (Conductor signals)
  orchestration: [
    'slash command',
    'subagent',
    'agent',
    'task tool',
    'parallel',
    'delegate',
    'workflow',
    'role',
    'orchestrat',
  ],

  // Trend patterns (Trendsetter signals)
  trends: [
    'latest',
    'newest',
    'trending',
    'modern',
    'up-to-date',
    'best practice',
    'current version',
    'recently released',
  ],

  // Positive feedback
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

  // Iteration patterns
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
  analyst: {
    explorer: 'Questioner',
    navigator: 'Research Lead',
    cartographer: 'Quality Sentinel',
  },
  conductor: {
    explorer: 'Improviser',
    navigator: 'Arranger',
    cartographer: 'Maestro',
  },
  speedrunner: {
    explorer: 'Experimenter',
    navigator: 'Rapid Prototyper',
    cartographer: 'Velocity Expert',
  },
  trendsetter: {
    explorer: 'Early Adopter',
    navigator: 'Tech Radar',
    cartographer: 'Innovation Lead',
  },
};

/**
 * Detailed metadata for each Matrix combination
 */
/**
 * Type profile seed fields for personality narrative generation.
 * These seeds give the LLM a psychological skeleton per matrix type,
 * enabling consistent yet personalized MBTI-style narratives.
 */
interface MatrixTypeProfile {
  emoji: string;
  description: string;
  keyStrength: string;
  growthPath: string;
  /** Core motivation — why this type codes the way they do */
  innerDrive: string;
  /** The most type-defining behavioral moment */
  signatureScenario: string;
  /** The endearing flip side of their greatest strength */
  shadowStrength: string;
  /** What other developers do differently — for contrast framing */
  contrastWith: string;
}

export const MATRIX_METADATA: Record<
  CodingStyleType,
  Record<AIControlLevel, MatrixTypeProfile>
> = {
  architect: {
    explorer: {
      emoji: '💭',
      description: 'You explore solutions through open-ended planning and vision.',
      keyStrength: 'Clear vision and creative planning',
      growthPath: 'Try validating AI output against your plans more actively',
      innerDrive: 'Turning ambiguity into a clear blueprint before the first line is written',
      signatureScenario: 'sketches a system diagram in comments before writing any implementation code',
      shadowStrength: 'spending an entire session designing an architecture for a feature that could have shipped in 20 minutes',
      contrastWith: 'jump straight into code and figure out the structure as they go',
    },
    navigator: {
      emoji: '📐',
      description: 'You balance strategic planning with hands-on verification.',
      keyStrength: 'Structured approach with balanced control',
      growthPath: 'Keep building verification habits',
      innerDrive: 'Building reliable systems where every component earns its place through deliberate design',
      signatureScenario: 'writes a numbered plan in the first prompt, then checks off each step as the session progresses',
      shadowStrength: 'reworking a perfectly functional implementation because the internal structure does not match the original plan',
      contrastWith: 'treat plans as suggestions and adapt freely as requirements shift',
    },
    cartographer: {
      emoji: '🏛️',
      description: 'You map out the territory completely before advancing.',
      keyStrength: 'Strategic AI orchestration with full control',
      growthPath: 'Share your planning techniques with others',
      innerDrive: 'Achieving total clarity — no unknowns, no surprises, every edge case mapped before execution',
      signatureScenario: 'creates a multi-phase implementation plan with dependencies, risks, and rollback strategies before a single file is touched',
      shadowStrength: 'producing a plan so thorough that the planning itself takes longer than the implementation would have',
      contrastWith: 'start building and let the architecture emerge from working code',
    },
  },
  analyst: {
    explorer: {
      emoji: '🔎',
      description: 'You explore through curious questioning and open inquiry.',
      keyStrength: 'Curious mind and questioning attitude',
      growthPath: 'Try challenging AI responses more systematically',
      innerDrive: 'Understanding the why behind every line — code without comprehension feels incomplete',
      signatureScenario: 'asks AI to explain a working solution three different ways before accepting it',
      shadowStrength: 'going down a fascinating rabbit hole investigating how a library works internally when the task only needed a simple API call',
      contrastWith: 'accept working code at face value and move on to the next task',
    },
    navigator: {
      emoji: '🧪',
      description: 'You navigate through hypothesis-driven investigation and verification.',
      keyStrength: 'Balanced depth with practical verification',
      growthPath: 'Add systematic testing to your workflow',
      innerDrive: 'Treating every coding session like a research experiment — hypothesis, test, conclude',
      signatureScenario: 'asks AI to generate two alternative approaches, then systematically compares them before choosing',
      shadowStrength: 'running one more test case just to be sure, even when the evidence is already conclusive',
      contrastWith: 'go with the first working solution without exploring alternatives',
    },
    cartographer: {
      emoji: '🔬',
      description: 'You leave no stone unturned — rigorous verification meets deep analysis.',
      keyStrength: 'Rigorous verification and error detection',
      growthPath: 'Help others develop critical thinking habits',
      innerDrive: 'Achieving certainty — no assumption goes unverified, no edge case goes untested',
      signatureScenario: 'catches a subtle AI hallucination that would have passed most code reviews, then traces its root cause',
      shadowStrength: 'writing exhaustive error handling for a scenario that has a one-in-a-million chance of occurring',
      contrastWith: 'trust AI output and ship with confidence in the happy path',
    },
  },
  conductor: {
    explorer: {
      emoji: '🎵',
      description: 'You experiment with AI tools freely, discovering creative workflows.',
      keyStrength: 'Creative tool exploration and improvisation',
      growthPath: 'Build repeatable workflows from your discoveries',
      innerDrive: 'Discovering unexpected tool combinations that unlock creative solutions',
      signatureScenario: 'experiments with a new slash command just to see what happens, then builds an entire workflow around it',
      shadowStrength: 'over-tooling a simple task because the orchestration itself is exciting',
      contrastWith: 'rely on a single trusted approach and stick with it',
    },
    navigator: {
      emoji: '🎼',
      description: 'You arrange AI tools into effective, coordinated workflows.',
      keyStrength: 'Effective multi-tool coordination',
      growthPath: 'Document your workflow patterns for team sharing',
      innerDrive: 'Unlocking synergies that no single tool can achieve alone',
      signatureScenario: 'switches between six tools mid-session like a DJ mixing tracks, each transition precisely timed',
      shadowStrength: 'spending ten minutes configuring a workflow for a task that would take five minutes manually',
      contrastWith: 'pick one tool and master it deeply rather than orchestrating many',
    },
    cartographer: {
      emoji: '🎹',
      description: 'You orchestrate AI tools with masterful precision and control.',
      keyStrength: 'Masterful AI tool orchestration',
      growthPath: 'Mentor others in advanced AI workflow techniques',
      innerDrive: 'Achieving perfect orchestration where every tool plays its precise role at the right moment',
      signatureScenario: 'has a custom workflow template for every type of task, with subagents delegated to specialized roles',
      shadowStrength: 'refusing to use a simple approach when an orchestrated multi-tool pipeline exists',
      contrastWith: 'let AI tools work independently without coordination',
    },
  },
  speedrunner: {
    explorer: {
      emoji: '🎲',
      description: 'You explore through rapid experimentation and iteration.',
      keyStrength: 'High velocity and experimentation',
      growthPath: 'Add quick sanity checks to your workflow',
      innerDrive: 'Finding the shortest path to a working solution through rapid trial and error',
      signatureScenario: 'writes a three-word prompt and gets a working component back, then iterates twice to ship',
      shadowStrength: 'shipping so fast that the commit message is longer than the prompt that generated the code',
      contrastWith: 'plan extensively before writing the first line of code',
    },
    navigator: {
      emoji: '🏃',
      description: 'You navigate quickly while building verification habits.',
      keyStrength: 'Fast iteration with increasing quality awareness',
      growthPath: 'Build quick-check routines into your speed',
      innerDrive: 'Maximizing output per unit of effort — every keystroke should move the project forward',
      signatureScenario: 'completes a feature in a single focused session with minimal back-and-forth, prompts so concise they read like commands',
      shadowStrength: 'moving to the next task before fully verifying the current one because momentum feels too good to break',
      contrastWith: 'spend time reviewing and polishing before moving forward',
    },
    cartographer: {
      emoji: '⚡',
      description: 'You achieve maximum velocity through strategic optimization.',
      keyStrength: 'Efficient expertise - fast AND accurate',
      growthPath: 'Teach efficient verification techniques to others',
      innerDrive: 'Proving that speed and quality are not trade-offs — they are multiplied by expertise',
      signatureScenario: 'has a session success rate that makes it look effortless because each prompt is surgically precise',
      shadowStrength: 'optimizing a workflow that is already fast enough, because shaving off 10 more seconds is irresistible',
      contrastWith: 'accept a slower but more cautious approach to reduce risk',
    },
  },
  trendsetter: {
    explorer: {
      emoji: '🌱',
      description: 'You eagerly try new tools and approaches, staying curious about what is emerging.',
      keyStrength: 'Early adoption and experimentation with new tech',
      growthPath: 'Evaluate new tools more critically before adopting',
      innerDrive: 'Being first to discover what is next — the thrill of using something no one else has tried yet',
      signatureScenario: 'asks AI about a framework released last week, then builds a prototype with it in the same session',
      shadowStrength: 'adopting a shiny new library for a problem that the standard library solves perfectly',
      contrastWith: 'wait for community consensus before adopting new technology',
    },
    navigator: {
      emoji: '📡',
      description: 'You track industry trends and selectively adopt what adds value.',
      keyStrength: 'Informed technology radar with selective adoption',
      growthPath: 'Share your technology insights with your team',
      innerDrive: 'Curating the best of what is new — filtering signal from noise in the technology landscape',
      signatureScenario: 'keeps a mental radar of emerging tools and knows exactly when a new approach is mature enough to adopt',
      shadowStrength: 'spending time evaluating a trending tool that the project does not actually need yet',
      contrastWith: 'stick with proven technologies and avoid the adoption treadmill',
    },
    cartographer: {
      emoji: '🚀',
      description: 'You strategically lead innovation, charting paths through emerging technology.',
      keyStrength: 'Strategic innovation leadership',
      growthPath: 'Balance cutting-edge adoption with team readiness',
      innerDrive: 'Charting the future technology landscape — not just using what is new, but knowing why it matters',
      signatureScenario: 'evaluates a new technology against five criteria before recommending it, then writes the migration guide',
      shadowStrength: 'creating a comprehensive adoption plan for a technology the team is not ready to learn yet',
      contrastWith: 'let others pioneer new tools and adopt them after they are battle-tested',
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
  'analyst_explorer', 'analyst_navigator', 'analyst_cartographer',
  'conductor_explorer', 'conductor_navigator', 'conductor_cartographer',
  'speedrunner_explorer', 'speedrunner_navigator', 'speedrunner_cartographer',
  'trendsetter_explorer', 'trendsetter_navigator', 'trendsetter_cartographer',
];

/**
 * Distribution across all 15 matrix combinations
 * Each value is 0-100, and all 15 should sum to 100
 */
export interface MatrixDistribution {
  architect_explorer: number;
  architect_navigator: number;
  architect_cartographer: number;
  analyst_explorer: number;
  analyst_navigator: number;
  analyst_cartographer: number;
  conductor_explorer: number;
  conductor_navigator: number;
  conductor_cartographer: number;
  speedrunner_explorer: number;
  speedrunner_navigator: number;
  speedrunner_cartographer: number;
  trendsetter_explorer: number;
  trendsetter_navigator: number;
  trendsetter_cartographer: number;
}

/**
 * Zod schema for MatrixDistribution
 */
export const MatrixDistributionSchema = z.object({
  architect_explorer: z.number().min(0).max(100),
  architect_navigator: z.number().min(0).max(100),
  architect_cartographer: z.number().min(0).max(100),
  analyst_explorer: z.number().min(0).max(100),
  analyst_navigator: z.number().min(0).max(100),
  analyst_cartographer: z.number().min(0).max(100),
  conductor_explorer: z.number().min(0).max(100),
  conductor_navigator: z.number().min(0).max(100),
  conductor_cartographer: z.number().min(0).max(100),
  speedrunner_explorer: z.number().min(0).max(100),
  speedrunner_navigator: z.number().min(0).max(100),
  speedrunner_cartographer: z.number().min(0).max(100),
  trendsetter_explorer: z.number().min(0).max(100),
  trendsetter_navigator: z.number().min(0).max(100),
  trendsetter_cartographer: z.number().min(0).max(100),
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
    analyst_explorer: calcPct(typeDistribution.analyst || 0, explorerWeight),
    analyst_navigator: calcPct(typeDistribution.analyst || 0, navigatorWeight),
    analyst_cartographer: calcPct(typeDistribution.analyst || 0, cartographerWeight),
    conductor_explorer: calcPct(typeDistribution.conductor || 0, explorerWeight),
    conductor_navigator: calcPct(typeDistribution.conductor || 0, navigatorWeight),
    conductor_cartographer: calcPct(typeDistribution.conductor || 0, cartographerWeight),
    speedrunner_explorer: calcPct(typeDistribution.speedrunner || 0, explorerWeight),
    speedrunner_navigator: calcPct(typeDistribution.speedrunner || 0, navigatorWeight),
    speedrunner_cartographer: calcPct(typeDistribution.speedrunner || 0, cartographerWeight),
    trendsetter_explorer: calcPct(typeDistribution.trendsetter || 0, explorerWeight),
    trendsetter_navigator: calcPct(typeDistribution.trendsetter || 0, navigatorWeight),
    trendsetter_cartographer: calcPct(typeDistribution.trendsetter || 0, cartographerWeight),
  };
}

/**
 * Get matrix key from type and control level
 */
export function getMatrixKey(type: CodingStyleType, level: AIControlLevel): MatrixKey {
  return `${type}_${level}`;
}
