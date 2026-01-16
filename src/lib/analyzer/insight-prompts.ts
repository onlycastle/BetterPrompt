/**
 * Insight Prompts - LLM prompts for generating personalized dimension insights
 *
 * Generates praise for strengths and encouragement for growth areas,
 * based on conversation context and professional research.
 */

import type { DimensionName, DimensionLevel } from '../models/unified-report';
import type { LinkedInsight } from './knowledge-linker';
import type { ExtractedQuote } from './dimension-quote-extractor';

// ============================================
// Constants
// ============================================

/**
 * Score threshold for determining if a dimension is a strength
 */
const STRENGTH_SCORE_THRESHOLD = 70;

/**
 * Divisor for selecting advice from templates (100 / 3 templates = ~34)
 */
const ADVICE_SELECTION_DIVISOR = 34;

/**
 * Maximum number of action items to include from professional insights
 */
const MAX_ACTION_ITEMS = 2;

/**
 * Level descriptors for dimension interpretation
 */
const LEVEL_DESCRIPTORS: Record<DimensionLevel, string> = {
  novice: 'You are beginning your journey in',
  developing: 'You are actively developing your skills in',
  proficient: 'You have solid proficiency in',
  expert: 'You demonstrate expert-level mastery in',
};

// ============================================
// Dimension Descriptions
// ============================================

const DIMENSION_DESCRIPTIONS: Record<
  DimensionName,
  { name: string; strengthDesc: string; growthDesc: string }
> = {
  aiCollaboration: {
    name: 'AI Collaboration Mastery',
    strengthDesc:
      'You excel at working with AI as a true partner. Your structured approach and clear communication make collaboration highly effective.',
    growthDesc:
      'Building strong AI collaboration skills will multiply your productivity. Learning to guide AI effectively is a high-leverage investment.',
  },
  contextEngineering: {
    name: 'Context Engineering',
    strengthDesc:
      'You skillfully provide the right context at the right time, helping AI understand your codebase and intentions.',
    growthDesc:
      'Context is king in AI interactions. Learning to engineer context well will dramatically improve AI output quality.',
  },
  toolMastery: {
    name: 'Tool Mastery',
    strengthDesc:
      'You leverage AI tools effectively, knowing when and how to use each capability for maximum impact.',
    growthDesc:
      'Understanding the full toolkit available to you will unlock new levels of productivity with AI.',
  },
  burnoutRisk: {
    name: 'Burnout Risk Management',
    strengthDesc:
      'You maintain healthy boundaries in your AI-assisted workflow, avoiding the trap of endless iteration.',
    growthDesc:
      'Sustainable AI usage is crucial for long-term productivity. Small adjustments can prevent frustration spirals.',
  },
  aiControl: {
    name: 'AI Control Index',
    strengthDesc:
      "You stay in the driver's seat, actively guiding and correcting AI output to match your vision.",
    growthDesc:
      'Taking more control over AI output ensures code quality and helps you learn from the process.',
  },
  skillResilience: {
    name: 'Skill Resilience',
    strengthDesc:
      'You maintain and grow your core skills while using AI, ensuring you can work independently when needed.',
    growthDesc:
      "Balancing AI assistance with skill practice protects your expertise and keeps you sharp.",
  },
};

// ============================================
// Advice Templates
// ============================================

interface AdviceTemplate {
  reinforcement: string[];
  improvement: string[];
}

const ADVICE_TEMPLATES: Record<DimensionName, AdviceTemplate> = {
  aiCollaboration: {
    reinforcement: [
      'Your planning-first approach is exactly what experts recommend. Keep breaking down tasks before engaging AI.',
      "The way you structure requests shows deep understanding of AI collaboration patterns. You're leveraging AI's strengths effectively.",
      'Your communication style with AI demonstrates mastery. Consider sharing your approach with your team.',
    ],
    improvement: [
      'Try spending 80% of time planning and 20% executing with AI. This dramatically improves outcomes.',
      'Before making requests, write down what you want to achieve. This clarity helps AI deliver better results.',
      'Practice the WRITE framework: What, Requirements, Input, Target output, Evaluation criteria.',
    ],
  },
  contextEngineering: {
    reinforcement: [
      'Your context provision is top-tier. You understand that AI performs best with rich, relevant context.',
      'The way you reference files and provide background information shows sophisticated context engineering.',
      'You naturally apply context engineering principles. Consider exploring advanced techniques like context compaction.',
    ],
    improvement: [
      "Start each AI conversation by providing relevant file paths and code context. It's like giving AI a map.",
      'Use @mentions to reference specific files. This helps AI understand your codebase structure.',
      'When context grows large, use /compact to summarize while preserving key information.',
    ],
  },
  toolMastery: {
    reinforcement: [
      'Your tool selection shows expertise. You know which tool fits each situation.',
      "You're leveraging the full capability of AI tooling. This multiplies your effectiveness.",
      'Consider creating custom workflows combining multiple tools for your common tasks.',
    ],
    improvement: [
      'Explore the available tools: Read for files, Grep for search, Bash for commands. Each has its strengths.',
      'Let AI choose tools sometimes - ask "find the files related to X" and observe its approach.',
      'Build muscle memory for tool shortcuts. Speed comes from knowing your toolkit.',
    ],
  },
  burnoutRisk: {
    reinforcement: [
      'Your sustainable work patterns are admirable. Taking breaks actually improves problem-solving.',
      "You understand that AI collaboration is a marathon, not a sprint. This wisdom serves you well.",
      'The way you manage frustration shows emotional intelligence in AI interaction.',
    ],
    improvement: [
      'If stuck for more than 10 minutes, take a break. Fresh eyes often see solutions immediately.',
      "Set a timer for AI sessions. Even 25-minute focused sprints with 5-minute breaks help.",
      'When frustrated, commit your progress and step away. The problem will still be there tomorrow.',
    ],
  },
  aiControl: {
    reinforcement: [
      "Your active verification of AI output ensures quality. You're the architect, AI is the builder.",
      'The way you correct and guide AI shows healthy skepticism while maintaining collaboration.',
      'You exemplify the 50% modification rule - treating AI output as a starting point, not final answer.',
    ],
    improvement: [
      "Before accepting AI output, ask yourself: 'Do I understand this?' and 'Would I write it this way?'",
      "Practice modifying at least 30% of AI-generated code. This builds understanding and catches issues.",
      'Create verification checkpoints: Review AI output against your original requirements.',
    ],
  },
  skillResilience: {
    reinforcement: [
      'Your ability to work independently while leveraging AI shows true expertise balance.',
      "You're building AI fluency while maintaining core skills. This is the optimal development path.",
      'The knowledge you demonstrate independently ensures AI augments rather than replaces your skills.',
    ],
    improvement: [
      'Try implementing small features without AI once a week. This keeps your skills sharp.',
      'Before asking AI, spend 5 minutes thinking about the approach. Then compare with AI suggestions.',
      'Understand the WHY behind AI solutions, not just the WHAT. This transfers learning to you.',
    ],
  },
};

// ============================================
// Prompt Generators
// ============================================

/**
 * Generate advice based on dimension, score, and mode
 */
export function generateAdvice(
  dimension: DimensionName,
  score: number,
  isStrength: boolean
): string {
  const templates = ADVICE_TEMPLATES[dimension];
  const adviceList = isStrength ? templates.reinforcement : templates.improvement;
  const index = Math.floor(score / ADVICE_SELECTION_DIVISOR) % adviceList.length;
  return adviceList[index];
}

/**
 * Default score for base advice generation
 */
const DEFAULT_ADVICE_SCORE = 50;

/**
 * Generate quote-based advice combining quote context with dimension insight
 */
export function generateQuoteAdvice(
  dimension: DimensionName,
  quote: ExtractedQuote,
  isStrength: boolean
): string {
  const baseAdvice = generateAdvice(dimension, DEFAULT_ADVICE_SCORE, isStrength);

  if (quote.sentiment === 'positive') {
    return `This shows your strength: "${quote.explanation}". ${baseAdvice}`;
  }
  if (quote.sentiment === 'negative') {
    return `Notice: ${quote.explanation}. ${baseAdvice}`;
  }
  return baseAdvice;
}

/**
 * Generate insight text from professional insight
 */
export function formatProfessionalInsight(insight: LinkedInsight): string {
  const actionItems = insight.actionableAdvice.slice(0, MAX_ACTION_ITEMS).join(' Also, ');
  return `${insight.keyTakeaway} Try this: ${actionItems}.`;
}

/**
 * Get dimension description for narrative generation
 */
export function getDimensionDescription(
  dimension: DimensionName,
  isStrength: boolean
): string {
  const desc = DIMENSION_DESCRIPTIONS[dimension];
  return isStrength ? desc.strengthDesc : desc.growthDesc;
}

/**
 * Generate interpretation text for a dimension result
 */
export function generateInterpretation(
  dimension: DimensionName,
  _score: number,
  level: DimensionLevel,
  isStrength: boolean
): string {
  const desc = DIMENSION_DESCRIPTIONS[dimension];
  const baseDesc = isStrength ? desc.strengthDesc : desc.growthDesc;
  const levelDesc = LEVEL_DESCRIPTORS[level];
  return `${levelDesc} ${desc.name.toLowerCase()}. ${baseDesc}`;
}

// ============================================
// LLM System Prompt
// ============================================

export const INSIGHT_GENERATION_SYSTEM_PROMPT = `You are an expert AI collaboration coach analyzing developer-AI interaction patterns.

Your role is to:
1. Identify specific behaviors from conversation evidence
2. Provide personalized, actionable advice
3. Use a supportive, encouraging tone
4. Reference research-based best practices

Guidelines:
- Be specific: Reference actual conversation patterns you see
- Be actionable: Give concrete steps, not vague suggestions
- Be encouraging: Focus on growth potential, not criticism
- Be concise: Keep advice to 2-3 sentences maximum

For STRENGTHS (score >= 70):
- Praise the specific positive behavior observed
- Suggest ways to leverage or share this strength
- Encourage continued excellence

For GROWTH AREAS (score < 70):
- Acknowledge the challenge without being negative
- Provide one specific, achievable improvement step
- Frame as opportunity, not weakness`;

/**
 * Build prompt for LLM-based insight generation
 */
export function buildInsightPrompt(
  dimension: DimensionName,
  score: number,
  quotes: ExtractedQuote[],
  professionalInsights: LinkedInsight[]
): string {
  const isStrength = score >= STRENGTH_SCORE_THRESHOLD;
  const desc = DIMENSION_DESCRIPTIONS[dimension];

  const quotesText = quotes
    .map((q) => `- "${q.quote}" (${q.sentiment}: ${q.explanation})`)
    .join('\n');

  const insightsText = professionalInsights
    .map((i) => `- ${i.title}: ${i.keyTakeaway}`)
    .join('\n');

  return `
## Dimension: ${desc.name}
Score: ${score}/100 (${isStrength ? 'STRENGTH' : 'GROWTH AREA'})

## Conversation Evidence:
${quotesText || 'No specific quotes extracted'}

## Research Insights:
${insightsText || 'No specific research insights available'}

## Task:
Generate a personalized ${isStrength ? 'praise' : 'improvement suggestion'} that:
1. References specific behavior from the conversation evidence
2. Incorporates wisdom from the research insights
3. Provides one concrete action item

Keep your response to 2-3 sentences.
`.trim();
}
