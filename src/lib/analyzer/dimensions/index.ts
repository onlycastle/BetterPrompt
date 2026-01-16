/**
 * Analysis Dimensions
 *
 * Six dimensions of AI collaboration analysis
 * that create curiosity and drive conversions.
 *
 * 1. AI Collaboration Mastery - How well you collaborate with AI (Planning, Orchestration, Verification)
 * 2. Context Engineering - How well you manage AI context (WRITE, SELECT, COMPRESS, ISOLATE)
 * 3. Tool Mastery - How well you use available tools
 * 4. Burnout Risk - Work pattern health indicators
 * 5. AI Control Index - Whether you control AI or depend on it
 * 6. Skill Resilience - Can you code without AI
 */

export {
  calculateAICollaboration,
  type AICollaborationResult,
} from './ai-collaboration';

export {
  calculateContextEngineering,
  type ContextEngineeringResult,
} from './context-engineering';

export {
  calculateBurnoutRisk,
  type BurnoutRiskResult,
} from './burnout-risk';

export {
  calculateToolMastery,
  type ToolMasteryResult,
  type MasteryLevel,
} from './tool-mastery';

export {
  calculateAIControl,
  type AIControlResult,
  type AIControlLevel,
} from './ai-control';

export {
  calculateSkillResilience,
  type SkillResilienceResult,
  type SkillResilienceLevel,
} from './skill-resilience';

// Shared utilities for pattern matching
export { countMatches, hasMatch, filterPascalCaseMatches, PATTERNS } from './pattern-utils';

import { type ParsedSession } from '../../models/index';
import { calculateAICollaboration, type AICollaborationResult } from './ai-collaboration';
import { calculateContextEngineering, type ContextEngineeringResult } from './context-engineering';
import { calculateBurnoutRisk, type BurnoutRiskResult } from './burnout-risk';
import { calculateToolMastery, type ToolMasteryResult } from './tool-mastery';
import { calculateAIControl, type AIControlResult } from './ai-control';
import { calculateSkillResilience, type SkillResilienceResult } from './skill-resilience';

/**
 * Complete analysis result with all 6 dimensions
 */
export interface FullAnalysisResult {
  aiCollaboration: AICollaborationResult;
  contextEngineering: ContextEngineeringResult;
  burnoutRisk: BurnoutRiskResult;
  toolMastery: ToolMasteryResult;
  aiControl: AIControlResult;
  skillResilience: SkillResilienceResult;
}

/**
 * Calculate all 6 analysis dimensions
 */
export function calculateAllDimensions(sessions: ParsedSession[]): FullAnalysisResult {
  return {
    aiCollaboration: calculateAICollaboration(sessions),
    contextEngineering: calculateContextEngineering(sessions),
    burnoutRisk: calculateBurnoutRisk(sessions),
    toolMastery: calculateToolMastery(sessions),
    aiControl: calculateAIControl(sessions),
    skillResilience: calculateSkillResilience(sessions),
  };
}
