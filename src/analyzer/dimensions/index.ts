/**
 * Analysis Dimensions
 *
 * Multiple dimensions of AI collaboration analysis
 * that create curiosity and drive conversions.
 */

export {
  calculateAICollaboration,
  type AICollaborationResult,
} from './ai-collaboration.js';

export {
  calculatePromptScore,
  type PromptScoreResult,
} from './prompt-score.js';

export {
  calculateBurnoutRisk,
  type BurnoutRiskResult,
} from './burnout-risk.js';

export {
  calculateToolMastery,
  type ToolMasteryResult,
  type MasteryLevel,
} from './tool-mastery.js';

import { type ParsedSession } from '../../models/index.js';
import { calculateAICollaboration, type AICollaborationResult } from './ai-collaboration.js';
import { calculatePromptScore, type PromptScoreResult } from './prompt-score.js';
import { calculateBurnoutRisk, type BurnoutRiskResult } from './burnout-risk.js';
import { calculateToolMastery, type ToolMasteryResult } from './tool-mastery.js';

/**
 * Complete analysis result with all dimensions
 */
export interface FullAnalysisResult {
  aiCollaboration: AICollaborationResult;
  promptScore: PromptScoreResult;
  burnoutRisk: BurnoutRiskResult;
  toolMastery: ToolMasteryResult;
}

/**
 * Calculate all analysis dimensions
 */
export function calculateAllDimensions(sessions: ParsedSession[]): FullAnalysisResult {
  return {
    aiCollaboration: calculateAICollaboration(sessions),
    promptScore: calculatePromptScore(sessions),
    burnoutRisk: calculateBurnoutRisk(sessions),
    toolMastery: calculateToolMastery(sessions),
  };
}
