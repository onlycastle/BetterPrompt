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
      'Anthropic 권장대로 /compact를 활용해 컨텍스트를 관리했습니다. 이는 Context Engineering의 COMPRESS 전략입니다.',
    missingFeedback:
      '컨텍스트가 길어지면 /compact로 정리해보세요. Anthropic이 권장하는 Context Compaction 기법입니다.',
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
      'Task tool을 활용해 작업을 위임하는 패턴이 보입니다. Anthropic이 권장하는 ISOLATE 전략입니다.',
    missingFeedback:
      '복잡한 작업은 Task tool로 전문 에이전트에게 위임해보세요. 컨텍스트 분리에 효과적입니다.',
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
      '계획을 먼저 작성하는 습관이 보입니다. "80% 계획, 20% 실행" 원칙을 실천하고 있습니다.',
    missingFeedback:
      '복잡한 기능 구현 전 plan.md를 작성해보세요. 상위 개발자들은 80%의 시간을 계획에 투자합니다.',
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
      '구현 전 요구사항/기준을 명시하는 패턴이 보입니다. AI에게 명확한 목표를 제공합니다.',
    missingFeedback:
      'AI에게 구현 요청 전 acceptance criteria를 정의해보세요. 결과물 품질이 크게 향상됩니다.',
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
      'TodoWrite를 활용해 작업을 구조화하고 있습니다. 체계적인 작업 관리 패턴입니다.',
    missingFeedback:
      'TodoWrite tool로 작업을 구조화해보세요. 복잡한 작업을 단계별로 추적할 수 있습니다.',
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
      'AI 결과물을 적극적으로 수정/보완하는 패턴이 보입니다. 전문 개발자는 약 50%의 AI 코드를 수정합니다.',
    missingFeedback:
      'AI 결과물을 그대로 수용하는 경향이 있습니다. "이게 맞아?" 하고 한 번 더 검토해보세요.',
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
      'AI 응답에 의문을 제기하는 습관이 보입니다. 이는 hallucination 방지에 효과적입니다.',
    missingFeedback:
      '세션당 최소 한 번은 AI에게 "정말 맞아?"라고 도전해보세요. 오류 발견율이 높아집니다.',
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
    foundFeedback: '빠른 검증 습관이 보입니다. 속도와 정확성을 모두 챙기는 좋은 패턴입니다.',
    missingFeedback:
      '다음 작업으로 넘어가기 전 간단한 테스트를 실행해보세요. 30초 투자로 큰 버그를 막습니다.',
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
      'AI 투입 전 스펙/슈도코드를 작성하는 패턴이 보입니다. 독립적 사고력을 유지하는 좋은 습관입니다.',
    missingFeedback:
      'AI에게 바로 요청하기 전, 간단한 슈도코드를 먼저 작성해보세요. 스킬 위축을 방지합니다.',
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
      'AI 생성 코드에 대해 설명을 요청하는 패턴이 보입니다. 이해 없이 넘어가지 않는 좋은 습관입니다.',
    missingFeedback:
      'AI가 생성한 코드를 설명할 수 있나요? 설명하지 못한다면 스킬 위축의 경고 신호입니다.',
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
      '자신의 생각/계획을 먼저 제시하는 패턴이 보입니다. AI 의존도가 낮은 건강한 습관입니다.',
    missingFeedback:
      'AI에게 요청 전 "내가 먼저 시작할 수 있을까?" 자문해보세요. 의존성을 점검하는 좋은 습관입니다.',
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
      'Context window를 인식하고 관리하는 패턴이 보입니다. Karpathy가 말한 "Context Engineering" 역량입니다.',
    missingFeedback:
      'Context window 한계를 인식하고 계신가요? 이를 관리하는 것이 새로운 핵심 스킬입니다.',
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
      '전략적으로 새 세션을 시작하는 패턴이 보입니다. 컨텍스트 오염을 방지하는 좋은 습관입니다.',
    missingFeedback:
      '컨텍스트가 복잡해지면 새 세션으로 시작하는 것도 좋은 전략입니다. /compact와 함께 활용해보세요.',
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
