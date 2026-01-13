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
} from './ai-collaboration.js';

export {
  calculateContextEngineering,
  type ContextEngineeringResult,
} from './context-engineering.js';

export {
  calculateBurnoutRisk,
  type BurnoutRiskResult,
} from './burnout-risk.js';

export {
  calculateToolMastery,
  type ToolMasteryResult,
  type MasteryLevel,
} from './tool-mastery.js';

export {
  calculateAIControl,
  type AIControlResult,
  type AIControlLevel,
} from './ai-control.js';

export {
  calculateSkillResilience,
  type SkillResilienceResult,
  type SkillResilienceLevel,
} from './skill-resilience.js';

// Shared utilities for pattern matching
export { countMatches, hasMatch, filterPascalCaseMatches, PATTERNS } from './pattern-utils.js';

import { type ParsedSession } from '../../models/index.js';
import { calculateAICollaboration, type AICollaborationResult } from './ai-collaboration.js';
import { calculateContextEngineering, type ContextEngineeringResult } from './context-engineering.js';
import { calculateBurnoutRisk, type BurnoutRiskResult } from './burnout-risk.js';
import { calculateToolMastery, type ToolMasteryResult } from './tool-mastery.js';
import { calculateAIControl, type AIControlResult } from './ai-control.js';
import { calculateSkillResilience, type SkillResilienceResult } from './skill-resilience.js';

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
