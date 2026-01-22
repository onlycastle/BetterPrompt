/**
 * Knowledge-Driven Patterns
 *
 * Maps INITIAL_INSIGHTS actionableAdvice to detectable patterns.
 * Enables evidence-based feedback: "You did/didn't do X (Source: Y)"
 *
 * Design Philosophy:
 * - Each pattern is derived from a specific actionableAdvice
 * - Patterns are injected into Gemini 3 Context (PTCF framework)
 * - LLM detects matches and provides grounded feedback
 *
 * @module analyzer/knowledge-driven-patterns
 */

import type { DimensionName } from '../models/unified-report';

/**
 * A pattern derived from Knowledge actionableAdvice
 */
export interface KnowledgeDrivenPattern {
  /** Pattern identifier */
  id: string;

  /** Source insight reference */
  insightId: string;
  insightTitle: string;
  source: string;
  sourceUrl?: string;

  /** Which actionableAdvice this pattern detects */
  actionableAdvice: string;

  /** Detection configuration */
  pattern: RegExp;
  dimension: DimensionName;

  /** Detection target: user messages, assistant tool calls, or both */
  target: 'user' | 'assistant' | 'both';

  /** Feedback templates */
  foundFeedback: string;
  missingFeedback: string;

  /** Priority for display (higher = more important) */
  priority: number;
}

/**
 * Knowledge-driven patterns derived from INITIAL_INSIGHTS
 *
 * Each pattern maps directly to an actionableAdvice item,
 * enabling "You practiced/didn't practice X" feedback.
 */
export const KNOWLEDGE_DRIVEN_PATTERNS: KnowledgeDrivenPattern[] = [
  // ============================================
  // Anthropic Context Engineering (pi-006)
  // ============================================
  {
    id: 'kdp-compact-usage',
    insightId: 'pi-006',
    insightTitle: 'Anthropic Context Engineering Techniques',
    source: 'Anthropic',
    sourceUrl:
      'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
    actionableAdvice: 'Use /compact when context gets messy or AI performance degrades',
    pattern: /\/compact\b/i,
    dimension: 'contextEngineering',
    target: 'user',
    foundFeedback:
      'You used /compact to manage context as Anthropic recommends. This is the COMPRESS strategy in Context Engineering.',
    missingFeedback:
      'Try using /compact when context gets long. This is the Context Compaction technique recommended by Anthropic.',
    priority: 9,
  },
  {
    id: 'kdp-task-delegation',
    insightId: 'pi-006',
    insightTitle: 'Anthropic Context Engineering Techniques',
    source: 'Anthropic',
    sourceUrl:
      'https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents',
    actionableAdvice: 'Delegate complex subtasks to specialized agents via Task tool',
    pattern: /\b(task\s+tool|subagent|delegate|spawn\s+agent|launch\s+agent)\b/i,
    dimension: 'contextEngineering',
    target: 'both',
    foundFeedback:
      'You delegate work using the Task tool. This is the ISOLATE strategy recommended by Anthropic.',
    missingFeedback:
      'Try delegating complex tasks to specialized agents via Task tool. It effectively separates context.',
    priority: 8,
  },

  // ============================================
  // Planning & Structure (pi-004)
  // ============================================
  {
    id: 'kdp-plan-md',
    insightId: 'pi-004',
    insightTitle: 'The 80% Planning Rule',
    source: 'Peter Yang',
    actionableAdvice: 'Write a brief plan.md before starting any complex feature',
    pattern: /\b(plan\.md|planning|write\s+a\s+plan|create\s+a\s+plan)\b/i,
    dimension: 'aiCollaboration',
    target: 'user',
    foundFeedback:
      'You have a habit of writing plans first. You practice the "80% planning, 20% execution" principle.',
    missingFeedback:
      'Try writing a plan.md before implementing complex features. Top developers invest 80% of their time in planning.',
    priority: 7,
  },
  {
    id: 'kdp-acceptance-criteria',
    insightId: 'pi-004',
    insightTitle: 'The 80% Planning Rule',
    source: 'Peter Yang',
    actionableAdvice: 'Define acceptance criteria before asking AI to implement',
    pattern:
      /\b(acceptance\s+criteria|requirements?|specs?|criteria|must\s+have|should\s+have)\b/i,
    dimension: 'aiCollaboration',
    target: 'user',
    foundFeedback:
      'You specify requirements/criteria before implementation. You provide clear goals to AI.',
    missingFeedback:
      'Try defining acceptance criteria before asking AI to implement. Output quality improves dramatically.',
    priority: 7,
  },
  {
    id: 'kdp-todowrite-usage',
    insightId: 'pi-004',
    insightTitle: 'The 80% Planning Rule',
    source: 'Peter Yang',
    actionableAdvice: 'Use TodoWrite to structure your work',
    pattern: /\b(todowrite|todo\s*write|todo\s+list|task\s+list)\b/i,
    dimension: 'aiCollaboration',
    target: 'both',
    foundFeedback:
      'You use TodoWrite to structure your work. This is a systematic task management pattern.',
    missingFeedback:
      'Try structuring your work with TodoWrite tool. It helps track complex tasks step by step.',
    priority: 6,
  },

  // ============================================
  // Verification & Control (pi-002, pi-005)
  // ============================================
  {
    id: 'kdp-modification-request',
    insightId: 'pi-002',
    insightTitle: 'The 50% Modification Test',
    source: 'elvis',
    actionableAdvice: 'Track how often you modify AI suggestions this week',
    pattern:
      /\b(change|fix|update|modify|adjust|correct|revise|redo|rewrite|alter|wrong|incorrect|that's\s+not)\b/i,
    dimension: 'aiControl',
    target: 'user',
    foundFeedback:
      'You actively modify/refine AI output. Expert developers modify about 50% of AI-generated code.',
    missingFeedback:
      'You tend to accept AI output as-is. Try reviewing with "Is this right?" before accepting.',
    priority: 8,
  },
  {
    id: 'kdp-challenge-ai',
    insightId: 'pi-002',
    insightTitle: 'The 50% Modification Test',
    source: 'elvis',
    actionableAdvice: 'Challenge at least one AI response per session with "are you sure?"',
    pattern: /\b(are\s+you\s+sure|is\s+that\s+(correct|right)|verify\s+that|double\s+check|really\?)\b/i,
    dimension: 'aiControl',
    target: 'user',
    foundFeedback:
      'You have a habit of questioning AI responses. This is effective at preventing hallucinations.',
    missingFeedback:
      'Try challenging AI with "are you sure?" at least once per session. It increases error detection.',
    priority: 8,
  },
  {
    id: 'kdp-quick-verification',
    insightId: 'pi-005',
    insightTitle: 'For Speedrunners: Quick Verification',
    source: 'hashin',
    actionableAdvice: 'Run the simplest possible test before moving on',
    pattern: /\b(run\s+(the\s+)?tests?|npm\s+test|yarn\s+test|pytest|jest|vitest|quick\s+test)\b/i,
    dimension: 'aiControl',
    target: 'both',
    foundFeedback: 'You have a quick verification habit. A good pattern that balances speed and accuracy.',
    missingFeedback:
      'Try running a simple test before moving on. A 30-second investment can prevent major bugs.',
    priority: 7,
  },

  // ============================================
  // Skill Resilience (pi-001, pi-009)
  // ============================================
  {
    id: 'kdp-pseudocode-first',
    insightId: 'pi-001',
    insightTitle: 'Skill Atrophy Self-Diagnosis',
    source: 'VCP Research Team',
    sourceUrl: 'https://arxiv.org/abs/2601.02410',
    actionableAdvice: 'Try writing pseudocode or specs before involving AI',
    pattern: /\b(pseudocode|pseudo\s+code|spec|specification|outline|draft|sketch)\b/i,
    dimension: 'skillResilience',
    target: 'user',
    foundFeedback:
      'You write specs/pseudocode before involving AI. A good habit that maintains independent thinking.',
    missingFeedback:
      'Try writing simple pseudocode before asking AI. It prevents skill atrophy.',
    priority: 9,
  },
  {
    id: 'kdp-explain-code',
    insightId: 'pi-001',
    insightTitle: 'Skill Atrophy Self-Diagnosis',
    source: 'VCP Research Team',
    sourceUrl: 'https://arxiv.org/abs/2601.02410',
    actionableAdvice: "If you can't explain code AI generated, that's a warning sign",
    pattern: /\b(explain|what\s+does\s+this|how\s+does\s+this\s+work|walk\s+me\s+through)\b/i,
    dimension: 'skillResilience',
    target: 'user',
    foundFeedback:
      'You ask for explanations of AI-generated code. A good habit of not moving on without understanding.',
    missingFeedback:
      'Can you explain the code AI generated? If not, it is a warning sign of skill atrophy.',
    priority: 9,
  },
  {
    id: 'kdp-independent-start',
    insightId: 'pi-009',
    insightTitle: 'AI Dependency Checklist',
    source: 'Rohan Paul',
    actionableAdvice: "Before using AI: 'Could I start this myself?'",
    pattern:
      /\b(i('ll|'m\s+going\s+to)|let\s+me|first\s+i|my\s+approach|i\s+think|i\s+plan\s+to)\b/i,
    dimension: 'skillResilience',
    target: 'user',
    foundFeedback:
      'You present your own thoughts/plans first. A healthy habit with low AI dependency.',
    missingFeedback:
      'Before asking AI, ask yourself "Could I start this myself?" A good habit to check dependency.',
    priority: 8,
  },

  // ============================================
  // Context Engineering - Karpathy (pi-003)
  // ============================================
  {
    id: 'kdp-context-window-aware',
    insightId: 'pi-003',
    insightTitle: 'New Skill Layer: Context Engineering',
    source: 'Andrej Karpathy',
    actionableAdvice: "Learn your AI tool's context window limits and how to manage them",
    pattern: /\b(context\s+window|token\s+limit|too\s+long|truncat|context\s+length)\b/i,
    dimension: 'contextEngineering',
    target: 'user',
    foundFeedback:
      'You recognize and manage the context window. This is the "Context Engineering" capability Karpathy describes.',
    missingFeedback:
      'Are you aware of context window limits? Managing this is a critical new skill.',
    priority: 10,
  },
  {
    id: 'kdp-fresh-session',
    insightId: 'pi-003',
    insightTitle: 'New Skill Layer: Context Engineering',
    source: 'Andrej Karpathy',
    actionableAdvice: 'Use /compact and fresh sessions strategically',
    pattern: /\b(new\s+session|fresh\s+session|start\s+over|clean\s+context|restart)\b/i,
    dimension: 'contextEngineering',
    target: 'user',
    foundFeedback:
      'You strategically start fresh sessions. A good habit that prevents context pollution.',
    missingFeedback:
      'Starting a fresh session when context gets complex is a good strategy. Try using it with /compact.',
    priority: 7,
  },
];

/**
 * Get patterns for a specific dimension
 */
export function getPatternsForDimension(dimension: DimensionName): KnowledgeDrivenPattern[] {
  return KNOWLEDGE_DRIVEN_PATTERNS.filter((p) => p.dimension === dimension);
}

/**
 * Get all patterns sorted by priority (highest first)
 */
export function getPatternsByPriority(): KnowledgeDrivenPattern[] {
  return [...KNOWLEDGE_DRIVEN_PATTERNS].sort((a, b) => b.priority - a.priority);
}

/**
 * Build XML representation for Gemini Context injection
 */
export function buildKnowledgePatternsXML(): string {
  const patternsByDimension = new Map<DimensionName, KnowledgeDrivenPattern[]>();

  for (const pattern of KNOWLEDGE_DRIVEN_PATTERNS) {
    const existing = patternsByDimension.get(pattern.dimension) || [];
    existing.push(pattern);
    patternsByDimension.set(pattern.dimension, existing);
  }

  let xml = '<actionable_patterns>\n';
  xml += '  <description>Specific behaviors from expert recommendations to detect in sessions</description>\n';
  xml += '  <instruction>For each pattern, determine if the developer practiced it. Extract evidence quotes.</instruction>\n\n';

  for (const [dimension, patterns] of patternsByDimension) {
    xml += `  <dimension name="${dimension}">\n`;
    for (const p of patterns.sort((a, b) => b.priority - a.priority)) {
      xml += `    <pattern id="${p.id}" priority="${p.priority}">\n`;
      xml += `      <source>${p.source}</source>\n`;
      xml += `      <advice>${p.actionableAdvice}</advice>\n`;
      xml += `      <detect_in>${p.target}</detect_in>\n`;
      xml += `      <if_found>${p.foundFeedback}</if_found>\n`;
      xml += `      <if_missing>${p.missingFeedback}</if_missing>\n`;
      xml += `    </pattern>\n`;
    }
    xml += `  </dimension>\n\n`;
  }

  xml += '</actionable_patterns>';
  return xml;
}
