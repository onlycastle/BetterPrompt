/**
 * Growth Inference System
 *
 * Provides systematic growth area detection through three mechanisms:
 * 1. Adjacent Skill Gaps - Infer gaps from existing strengths
 * 2. Behavioral Contrast - Compare against best practices
 * 3. Pattern Gap Detection - Detect absence of expected patterns
 *
 * @module analyzer/growth-inference
 */

import type { DimensionName } from '../../types/verbose';

// ============================================================================
// Adjacent Skill Gap Mappings
// ============================================================================

export interface AdjacentSkillGap {
  /** The inferred gap skill identifier */
  inferredGap: string;
  /** Which dimension this gap belongs to */
  dimension: DimensionName;
  /** Human-readable description of why this gap exists */
  description: string;
  /** Recommended action to address this gap */
  recommendation: string;
}

/**
 * Maps detected strengths to potential adjacent skill gaps.
 * When a developer shows strength in one area, they may have
 * underdeveloped skills in related areas.
 *
 * Key pattern: "What you're good at might be hiding what you're missing"
 */
export const ADJACENT_SKILL_GAPS: Record<string, AdjacentSkillGap[]> = {
  // ═══════════════════════════════════════════════════════════════════════════
  // AI Collaboration Dimension
  // ═══════════════════════════════════════════════════════════════════════════

  /** Strong at task delegation → might skip verification of delegated work */
  task_delegation: [
    {
      inferredGap: 'verification_habit',
      dimension: 'aiControl',
      description:
        'Strong delegators sometimes skip verification of delegated work. The ease of delegation can create over-trust in AI output.',
      recommendation:
        "After AI completes a task, add a quick verification step: 'Let me check that this handles [edge case]'",
    },
  ],

  /** Strong at parallel workflows → might lose track of context */
  parallel_workflows: [
    {
      inferredGap: 'context_awareness',
      dimension: 'contextEngineering',
      description:
        'Running multiple parallel tasks can lead to context fragmentation. Each thread loses awareness of the others.',
      recommendation:
        'Periodically use /compact or start fresh sessions to consolidate context across parallel work streams',
    },
  ],

  /** Strong at using expert personas → might over-rely on AI expertise */
  expert_persona_usage: [
    {
      inferredGap: 'deep_learning',
      dimension: 'skillResilience',
      description:
        "Heavy reliance on expert personas can outsource understanding. You get the answer but miss the 'why'.",
      recommendation:
        "After receiving expert advice, ask 'Why does this work?' or 'What are the tradeoffs?' to build your own understanding",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // Context Engineering Dimension
  // ═══════════════════════════════════════════════════════════════════════════

  /** Strong at providing context → might over-load context window */
  rich_context_provision: [
    {
      inferredGap: 'context_efficiency',
      dimension: 'contextEngineering',
      description:
        'Thorough context providers sometimes include too much information, leading to context window bloat and slower responses.',
      recommendation:
        'Practice the ISOLATE pattern: include only the specific code/files needed for the current task',
    },
  ],

  /** Strong at file references → might neglect strategic resets */
  file_reference_mastery: [
    {
      inferredGap: 'strategic_reset',
      dimension: 'contextEngineering',
      description:
        'Excellent file referencing can lead to very long sessions without fresh starts. Context accumulates noise over time.',
      recommendation:
        "After 50+ turns, consider starting a fresh session with a clear summary: 'Continuing work on X. Context: [key points]'",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // Tool Mastery Dimension
  // ═══════════════════════════════════════════════════════════════════════════

  /** Strong at tool usage → might neglect fundamentals */
  advanced_tool_usage: [
    {
      inferredGap: 'fundamentals_practice',
      dimension: 'skillResilience',
      description:
        'Heavy tool users may delegate basic tasks they should practice. Core skills like manual debugging can atrophy.',
      recommendation:
        'Occasionally solve problems manually before using AI. Ask yourself: "Could I debug this without AI help?"',
    },
  ],

  /** Strong at slash commands → might not explore full capabilities */
  slash_command_mastery: [
    {
      inferredGap: 'capability_exploration',
      dimension: 'toolMastery',
      description:
        'Comfortable with known commands might mean missing newer or more powerful features that could improve workflow.',
      recommendation:
        "Try one new Claude Code feature per week. Check /help or docs for commands you haven't used",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // Execution Speed Patterns
  // ═══════════════════════════════════════════════════════════════════════════

  /** Strong at fast execution → might lack upfront planning */
  fast_execution: [
    {
      inferredGap: 'upfront_planning',
      dimension: 'aiCollaboration',
      description:
        'Speed-focused developers may skip planning phases that could prevent rework. Fast starts sometimes lead to slow finishes.',
      recommendation:
        'Before complex tasks, use /plan to create a roadmap. The time invested upfront often saves time overall',
    },
  ],

  /** Strong at iterative refinement → might not establish clear goals */
  iterative_refinement: [
    {
      inferredGap: 'goal_clarity',
      dimension: 'aiCollaboration',
      description:
        'Heavy iteration can indicate unclear initial requirements. Multiple refinement cycles might mean the first prompt was ambiguous.',
      recommendation:
        "Before starting, define 'done': What does success look like? What are the acceptance criteria?",
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // AI Control Dimension
  // ═══════════════════════════════════════════════════════════════════════════

  /** Strong at verification → might over-verify and slow down */
  strong_verification: [
    {
      inferredGap: 'appropriate_trust',
      dimension: 'aiControl',
      description:
        'Excessive verification can slow progress. Not all AI outputs need the same level of scrutiny.',
      recommendation:
        'Calibrate verification to risk: high-risk (security, data) gets full review; low-risk (formatting, comments) gets quick scan',
    },
  ],

  /** Strong at questioning AI → might create friction in simple tasks */
  ai_questioning: [
    {
      inferredGap: 'flow_optimization',
      dimension: 'aiCollaboration',
      description:
        'Constant questioning, while valuable for critical decisions, can interrupt flow for routine tasks.',
      recommendation:
        'Reserve deep questioning for architectural decisions. For routine tasks, establish patterns and trust them',
    },
  ],

  // ═══════════════════════════════════════════════════════════════════════════
  // Communication Patterns
  // ═══════════════════════════════════════════════════════════════════════════

  /** Strong at detailed prompts → might over-specify and limit AI creativity */
  detailed_prompting: [
    {
      inferredGap: 'ai_creativity_space',
      dimension: 'aiCollaboration',
      description:
        'Highly detailed prompts can constrain AI to narrow solutions. Sometimes less specification yields better results.',
      recommendation:
        "Experiment with open-ended prompts for exploratory work: 'What's the best way to...' instead of 'Do exactly this...'",
    },
  ],

  /** Strong at concise communication → might miss important context */
  concise_communication: [
    {
      inferredGap: 'context_richness',
      dimension: 'contextEngineering',
      description:
        'Brief prompts are efficient but may omit context that would improve AI responses. AI works better with more information.',
      recommendation:
        "Add the 'why' to your prompts. Instead of 'Add error handling', try 'Add error handling because users report silent failures'",
    },
  ],
};

// ============================================================================
// Expected Pattern Detection
// ============================================================================

/**
 * Expected patterns that, when absent, indicate growth opportunities.
 * These are behaviors that most effective AI collaborators exhibit.
 */
export interface ExpectedPattern {
  /** Unique identifier for this expected pattern */
  patternId: string;
  /** Human-readable name for display */
  displayName: string;
  /** Which dimension this pattern relates to */
  dimension: DimensionName;
  /** How to detect if this pattern is present (for prompt instructions) */
  detectionMethod: string;
  /** What keywords or behaviors indicate presence */
  presenceIndicators: string[];
  /** Growth area title if this pattern is absent */
  absentGrowthTitle: string;
  /** Detailed description for the growth area */
  absentGrowthDescription: string;
  /** Actionable recommendation */
  recommendation: string;
}

/**
 * List of expected patterns that should be detected in developer sessions.
 * Absence of these patterns indicates a growth opportunity.
 */
export const EXPECTED_PATTERNS: ExpectedPattern[] = [
  // Planning patterns
  {
    patternId: 'plan_usage',
    displayName: '/plan Command Usage',
    dimension: 'aiCollaboration',
    detectionMethod: 'Check for "/plan" command in any session',
    presenceIndicators: ['/plan'],
    absentGrowthTitle: 'Planning Habit Development',
    absentGrowthDescription:
      'No use of the /plan command detected across sessions. The /plan command helps create structured roadmaps before complex implementation, reducing rework and improving focus.',
    recommendation:
      "Try using /plan before your next multi-step task. Example: '/plan Add user authentication with OAuth support'",
  },

  // Context management patterns
  {
    patternId: 'compact_usage',
    displayName: '/compact Usage',
    dimension: 'contextEngineering',
    detectionMethod: 'Check for "/compact" command, especially in sessions >50 turns',
    presenceIndicators: ['/compact'],
    absentGrowthTitle: 'Context Window Management',
    absentGrowthDescription:
      'No use of /compact detected in longer sessions. As conversations grow, context window efficiency decreases. Strategic compaction helps maintain AI response quality.',
    recommendation:
      'When sessions exceed 50 turns, try /compact to summarize and clear the context window while preserving key information',
  },

  // Verification patterns
  {
    patternId: 'verification_questions',
    displayName: 'Verification Questions',
    dimension: 'aiControl',
    detectionMethod: 'Check for verification phrases in user messages',
    presenceIndicators: [
      'are you sure',
      'is that right',
      'is that correct',
      'let me check',
      'verify',
      'confirm',
    ],
    absentGrowthTitle: 'AI Output Verification Habit',
    absentGrowthDescription:
      "No verification questions detected. AI can make mistakes or misunderstand context. A quick 'are you sure?' can catch errors before they become bugs.",
    recommendation:
      "After AI generates code, ask 'Are you sure this handles [edge case]?' or 'What could go wrong here?'",
  },

  // Task decomposition patterns
  {
    patternId: 'task_decomposition',
    displayName: 'Task Decomposition',
    dimension: 'aiCollaboration',
    detectionMethod: 'Check for numbered steps, bullet points, or explicit task breakdown',
    presenceIndicators: [
      '1.',
      '2.',
      '3.',
      'first',
      'then',
      'next',
      'step 1',
      'step 2',
      'break down',
      'split into',
    ],
    absentGrowthTitle: 'Scope Management',
    absentGrowthDescription:
      'Limited evidence of breaking tasks into smaller steps. Complex tasks handled atomically can overwhelm both the developer and the AI, leading to incomplete or incorrect solutions.',
    recommendation:
      "Before tackling complex tasks, explicitly break them down: 'Let's split this into steps: 1. [first part], 2. [second part]...'",
  },

  // Learning depth patterns
  {
    patternId: 'why_questions',
    displayName: 'Understanding Questions',
    dimension: 'skillResilience',
    detectionMethod: 'Check for questions about reasoning or mechanism',
    presenceIndicators: [
      'why',
      'how does this work',
      'explain',
      'what does this do',
      "i don't understand",
      'help me understand',
    ],
    absentGrowthTitle: 'Deep Learning Habit',
    absentGrowthDescription:
      "Limited 'why' questions detected. Accepting AI solutions without understanding can lead to skill atrophy. Understanding the 'why' builds lasting knowledge.",
    recommendation:
      "After receiving a solution, ask 'Why this approach?' or 'How does this work?' to build understanding, not just get answers",
  },

  // Error recovery patterns
  {
    patternId: 'approach_change',
    displayName: 'Approach Adaptation',
    dimension: 'aiCollaboration',
    detectionMethod: 'Check for explicit approach changes after failures',
    presenceIndicators: [
      'different approach',
      "let's try",
      'instead of',
      'another way',
      'alternative',
      'what about',
    ],
    absentGrowthTitle: 'Adaptive Problem-Solving',
    absentGrowthDescription:
      'Limited evidence of changing approach after setbacks. Repeating the same approach that failed can create frustrating loops. Pivoting early often leads to faster solutions.',
    recommendation:
      "If something isn't working after 2 attempts, explicitly try a different approach: 'That's not working. Let's try [alternative]'",
  },

  // Session hygiene patterns
  {
    patternId: 'fresh_start',
    displayName: 'Fresh Session Starts',
    dimension: 'contextEngineering',
    detectionMethod:
      'Check for clear session starts with context summary (vs continuing cluttered sessions)',
    presenceIndicators: [
      'starting fresh',
      'new session',
      'clean slate',
      'let me summarize',
      'context:',
      'continuing from',
    ],
    absentGrowthTitle: 'Session Hygiene',
    absentGrowthDescription:
      'Sessions tend to accumulate context without strategic resets. Long-running sessions accumulate noise that can degrade AI response quality and relevance.',
    recommendation:
      "For complex projects, start fresh sessions with a clear context summary: 'Starting fresh. Project: X. Current goal: Y. Key context: Z'",
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get adjacent skill gaps for a detected strength pattern
 *
 * @param strengthPatternId - The detected strength pattern identifier
 * @returns Array of adjacent skill gaps, or empty array if none defined
 */
export function getAdjacentGaps(strengthPatternId: string): AdjacentSkillGap[] {
  return ADJACENT_SKILL_GAPS[strengthPatternId] || [];
}

/**
 * Get all expected patterns for a specific dimension
 *
 * @param dimension - The dimension to filter by
 * @returns Array of expected patterns for that dimension
 */
export function getExpectedPatternsForDimension(dimension: DimensionName): ExpectedPattern[] {
  return EXPECTED_PATTERNS.filter((p) => p.dimension === dimension);
}

/**
 * Get all unique dimensions that have expected patterns defined
 *
 * @returns Array of dimension names with expected patterns
 */
export function getDimensionsWithExpectedPatterns(): DimensionName[] {
  const dimensions = new Set(EXPECTED_PATTERNS.map((p) => p.dimension));
  return Array.from(dimensions);
}

// ============================================================================
// Frequency & Severity Calculation
// ============================================================================

/**
 * Severity level for growth areas
 */
export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

/**
 * Calculated frequency statistics for a pattern/growth area
 */
export interface FrequencyStats {
  /** Raw count of occurrences */
  absoluteCount: number;
  /** Percentage of sessions where pattern was observed (0-100) */
  percentageOfSessions: number;
  /** Number of sessions affected */
  sessionsAffected: number;
  /** Total sessions analyzed */
  totalSessions: number;
  /** Calculated severity based on frequency thresholds */
  severity: SeverityLevel;
  /** Computed priority score (frequency × impact factor) */
  priorityScore: number;
}

/**
 * Default impact factors by dimension (higher = more impactful)
 * Used to weight priority calculation
 */
const DIMENSION_IMPACT_FACTORS: Record<string, number> = {
  aiCollaboration: 1.0,
  contextEngineering: 0.9,
  toolMastery: 0.7,
  burnoutRisk: 1.2, // Higher weight for wellbeing
  aiControl: 1.1,
  skillResilience: 1.0,
  iterationEfficiency: 0.8,
  learningVelocity: 0.9,
  scopeManagement: 0.85,
};

/**
 * Calculate severity level based on frequency percentage
 *
 * Thresholds:
 * - Critical: 70%+ of sessions
 * - High: 40-70% of sessions
 * - Medium: 20-40% of sessions
 * - Low: <20% of sessions
 *
 * @param percentageOfSessions - Frequency as percentage (0-100)
 * @returns Severity level
 */
export function calculateSeverityFromFrequency(percentageOfSessions: number): SeverityLevel {
  if (percentageOfSessions >= 70) return 'critical';
  if (percentageOfSessions >= 40) return 'high';
  if (percentageOfSessions >= 20) return 'medium';
  return 'low';
}

/**
 * Calculate severity level based on evidence count (proxy for frequency)
 *
 * Used when actual frequency percentage is not available.
 *
 * Thresholds:
 * - Critical: 5+ evidence instances
 * - High: 3-4 evidence instances
 * - Medium: 2 evidence instances
 * - Low: 0-1 evidence instances
 *
 * @param evidenceCount - Number of evidence quotes/instances
 * @returns Severity level
 */
export function calculateSeverityFromEvidence(evidenceCount: number): SeverityLevel {
  if (evidenceCount >= 5) return 'critical';
  if (evidenceCount >= 3) return 'high';
  if (evidenceCount >= 2) return 'medium';
  return 'low';
}

/**
 * Calculate priority score for a growth area
 *
 * Priority = (frequencyWeight × frequency) + (impactWeight × dimensionImpact)
 *
 * @param percentageOfSessions - Frequency as percentage (0-100)
 * @param dimension - The dimension this growth area belongs to
 * @returns Priority score (0-100)
 */
export function calculatePriorityScore(
  percentageOfSessions: number,
  dimension: string
): number {
  const frequencyWeight = 0.6;
  const impactWeight = 0.4;

  const impactFactor = DIMENSION_IMPACT_FACTORS[dimension] || 1.0;
  const normalizedImpact = impactFactor * 100;

  const priorityScore =
    frequencyWeight * percentageOfSessions +
    impactWeight * normalizedImpact;

  return Math.min(100, Math.max(0, Math.round(priorityScore)));
}

/**
 * Calculate comprehensive frequency statistics for a pattern
 *
 * @param occurrenceCounts - Map of sessionId to occurrence count
 * @param totalSessions - Total number of sessions analyzed
 * @param dimension - The dimension for priority calculation
 * @returns Complete frequency statistics
 */
export function calculateFrequencyStats(
  occurrenceCounts: Map<string, number>,
  totalSessions: number,
  dimension: string
): FrequencyStats {
  const sessionsAffected = occurrenceCounts.size;
  const absoluteCount = Array.from(occurrenceCounts.values()).reduce((a, b) => a + b, 0);

  const percentageOfSessions = totalSessions > 0
    ? Math.round((sessionsAffected / totalSessions) * 100)
    : 0;

  const severity = calculateSeverityFromFrequency(percentageOfSessions);
  const priorityScore = calculatePriorityScore(percentageOfSessions, dimension);

  return {
    absoluteCount,
    percentageOfSessions,
    sessionsAffected,
    totalSessions,
    severity,
    priorityScore,
  };
}

/**
 * Calculate frequency statistics from evidence array
 *
 * This is a fallback when session-level data is not available.
 * Uses evidence count as a proxy for frequency.
 *
 * @param evidenceCount - Number of evidence quotes
 * @param totalSessions - Total sessions analyzed (for context)
 * @param dimension - The dimension for priority calculation
 * @returns Estimated frequency statistics
 */
export function estimateFrequencyFromEvidence(
  evidenceCount: number,
  totalSessions: number,
  dimension: string
): FrequencyStats {
  // Estimate: each evidence instance represents ~15-25% of sessions
  // This is a rough heuristic based on typical extraction rates
  const estimatedPercentage = Math.min(100, evidenceCount * 18);

  const severity = calculateSeverityFromEvidence(evidenceCount);
  const priorityScore = calculatePriorityScore(estimatedPercentage, dimension);

  return {
    absoluteCount: evidenceCount,
    percentageOfSessions: estimatedPercentage,
    sessionsAffected: Math.min(totalSessions, evidenceCount),
    totalSessions,
    severity,
    priorityScore,
  };
}
